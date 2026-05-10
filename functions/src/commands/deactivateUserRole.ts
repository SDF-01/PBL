import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireCaller } from "../lib/auth";
import { COLLECTIONS } from "../lib/collections";
import { SECURE_CALLABLE_OPTIONS } from "../lib/secureCallable";
import { syncRoleArtifacts, type RoleKey } from "../lib/roles";
import { DeactivateUserRoleInput } from "../schemas/role";

interface UserRoleRecord {
  userId: string;
  roleId: RoleKey;
  clubId: string | null;
  active: boolean;
}

async function callerCanDeactivate(
  callerUid: string,
  callerIsSiteAdmin: boolean,
  target: UserRoleRecord,
): Promise<boolean> {
  if (callerIsSiteAdmin) return true;
  if (target.roleId !== "LeagueCoordinator") return false;
  if (!target.clubId) return false;

  const directorSnap = await getFirestore()
    .collection(COLLECTIONS.userRoles)
    .where("userId", "==", callerUid)
    .where("roleId", "==", "ClubDirector")
    .where("clubId", "==", target.clubId)
    .where("active", "==", true)
    .limit(1)
    .get();

  return !directorSnap.empty;
}

export const deactivateUserRole = onCall(SECURE_CALLABLE_OPTIONS, async (request) => {
  const caller = await requireCaller(request);

  const parsed = DeactivateUserRoleInput.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.message);
  }
  const { userRoleId } = parsed.data;

  const db = getFirestore();
  const ref = db.doc(`${COLLECTIONS.userRoles}/${userRoleId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", `userRole ${userRoleId} does not exist.`);
  }
  const target = snap.data() as UserRoleRecord;

  if (!target.active) {
    return { userRoleId, status: "already-inactive" as const };
  }

  if (target.userId === caller.uid && target.roleId === "SiteAdmin") {
    throw new HttpsError(
      "failed-precondition",
      "A site admin cannot deactivate their own SiteAdmin role.",
    );
  }

  const allowed = await callerCanDeactivate(caller.uid, caller.isSiteAdmin, target);
  if (!allowed) {
    throw new HttpsError(
      "permission-denied",
      "Caller cannot deactivate this role.",
    );
  }

  const now = Timestamp.now();
  const batch = db.batch();

  batch.update(ref, { active: false });

  if (target.clubId) {
    batch.update(db.doc(`${COLLECTIONS.clubs}/${target.clubId}`), {
      memberIds: FieldValue.arrayRemove(target.userId),
    });
  }

  const eventRef = db.collection(COLLECTIONS.roleEvents).doc();
  batch.set(eventRef, {
    userId: target.userId,
    clubId: target.clubId,
    leagueId: null,
    eventType: "RoleRemoved",
    oldRoleId: target.roleId,
    newRoleId: null,
    eventTimestamp: now,
    notes: `Role ${target.roleId} deactivated by ${caller.uid}.`,
    actorId: caller.uid,
  });

  await batch.commit();

  const effective = await syncRoleArtifacts(target.userId);

  return {
    userRoleId,
    status: "deactivated" as const,
    effectiveLegacyRole: effective,
  };
});
