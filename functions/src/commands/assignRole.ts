import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireCaller } from "../lib/auth";
import { COLLECTIONS } from "../lib/collections";
import { SECURE_CALLABLE_OPTIONS } from "../lib/secureCallable";
import { syncRoleArtifacts, type RoleKey } from "../lib/roles";
import { AssignRoleInput } from "../schemas/role";

/**
 * Returns true if the caller is permitted to assign the requested role at
 * the requested scope. Site admins may assign anything. Club directors may
 * only assign LeagueCoordinator within a club they actively direct.
 */
async function callerCanAssign(
  callerUid: string,
  callerIsSiteAdmin: boolean,
  roleId: RoleKey,
  clubId: string | null,
): Promise<boolean> {
  if (callerIsSiteAdmin) return true;
  if (roleId !== "LeagueCoordinator") return false;
  if (!clubId) return false;

  const directorSnap = await getFirestore()
    .collection(COLLECTIONS.userRoles)
    .where("userId", "==", callerUid)
    .where("roleId", "==", "ClubDirector")
    .where("clubId", "==", clubId)
    .where("active", "==", true)
    .limit(1)
    .get();

  return !directorSnap.empty;
}

export const assignRole = onCall(SECURE_CALLABLE_OPTIONS, async (request) => {
  const caller = await requireCaller(request);

  const parsed = AssignRoleInput.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.message);
  }
  const { userId, roleId, clubId, leagueId } = parsed.data;

  if (roleId === "ClubCreatorProvisional") {
    throw new HttpsError(
      "invalid-argument",
      "ClubCreatorProvisional is granted only via club submission.",
    );
  }
  if (roleId === "LeagueCoordinator" && !leagueId && !clubId) {
    throw new HttpsError(
      "invalid-argument",
      "LeagueCoordinator requires clubId (or leagueId scope).",
    );
  }

  const allowed = await callerCanAssign(
    caller.uid,
    caller.isSiteAdmin,
    roleId,
    clubId,
  );
  if (!allowed) {
    throw new HttpsError(
      "permission-denied",
      "Caller cannot assign this role at the requested scope.",
    );
  }

  const db = getFirestore();
  const now = Timestamp.now();
  const batch = db.batch();

  const userRoleRef = db.collection(COLLECTIONS.userRoles).doc();
  batch.set(userRoleRef, {
    userId,
    roleId,
    clubId,
    leagueId,
    assignedAt: now,
    assignedBy: caller.uid,
    active: true,
  });

  if (clubId) {
    batch.update(db.doc(`${COLLECTIONS.clubs}/${clubId}`), {
      memberIds: FieldValue.arrayUnion(userId),
    });
  }

  const eventRef = db.collection(COLLECTIONS.roleEvents).doc();
  batch.set(eventRef, {
    userId,
    clubId,
    leagueId,
    eventType: "RoleAssigned",
    oldRoleId: null,
    newRoleId: roleId,
    eventTimestamp: now,
    notes: `Role ${roleId} assigned by ${caller.uid}.`,
    actorId: caller.uid,
  });

  await batch.commit();

  const effective = await syncRoleArtifacts(userId);

  return {
    userRoleId: userRoleRef.id,
    effectiveLegacyRole: effective,
  };
});
