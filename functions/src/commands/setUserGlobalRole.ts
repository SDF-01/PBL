import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { requireCaller, requireSiteAdmin } from "../lib/auth";
import { COLLECTIONS } from "../lib/collections";
import { SECURE_CALLABLE_OPTIONS } from "../lib/secureCallable";
import {
  syncRoleArtifacts,
  type LegacyRole,
  type RoleKey,
} from "../lib/roles";
import { SetUserGlobalRoleInput } from "../schemas/role";

const LEGACY_TO_ROLE_KEY: Record<LegacyRole, RoleKey> = {
  SITE_ADMIN: "SiteAdmin",
  CLUB_ADMIN: "ClubDirector",
  LEAGUE_COORDINATOR: "LeagueCoordinator",
  PLAYER: "Player",
};

/**
 * Set a user's primary global (clubId == null) role.
 *
 * Deactivates any existing active global userRoles entries for the target,
 * adds a new one for the requested role, writes a roleEvents audit row,
 * and recomputes the target's custom claim + users.role mirror.
 */
export const setUserGlobalRole = onCall(SECURE_CALLABLE_OPTIONS, async (request) => {
  const caller = await requireCaller(request);
  requireSiteAdmin(caller);

  const parsed = SetUserGlobalRoleInput.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.message);
  }
  const { userId, newRole } = parsed.data;

  if (userId === caller.uid && newRole !== "SITE_ADMIN") {
    throw new HttpsError(
      "failed-precondition",
      "A site admin cannot demote themselves; ask another admin.",
    );
  }

  const db = getFirestore();
  const now = Timestamp.now();
  const newRoleKey = LEGACY_TO_ROLE_KEY[newRole];

  const previousSnap = await db.doc(`${COLLECTIONS.users}/${userId}`).get();
  const previousLegacy = previousSnap.exists
    ? ((previousSnap.data() as { role?: LegacyRole }).role ?? "PLAYER")
    : "PLAYER";

  const globalRolesSnap = await db
    .collection(COLLECTIONS.userRoles)
    .where("userId", "==", userId)
    .where("active", "==", true)
    .where("clubId", "==", null)
    .get();

  const batch = db.batch();

  for (const d of globalRolesSnap.docs) {
    batch.update(d.ref, { active: false });
  }

  // Always write a userRoles entry — even for PLAYER — so the audit trail
  // shows the demotion as a deliberate assignment rather than absence.
  const newRoleRef = db.collection(COLLECTIONS.userRoles).doc();
  batch.set(newRoleRef, {
    userId,
    roleId: newRoleKey,
    clubId: null,
    leagueId: null,
    assignedAt: now,
    assignedBy: caller.uid,
    active: true,
  });

  const eventRef = db.collection(COLLECTIONS.roleEvents).doc();
  batch.set(eventRef, {
    userId,
    clubId: null,
    leagueId: null,
    eventType: "RoleAssigned",
    oldRoleId: LEGACY_TO_ROLE_KEY[previousLegacy] ?? null,
    newRoleId: newRoleKey,
    eventTimestamp: now,
    notes: `Global role changed from ${previousLegacy} to ${newRole} by ${caller.uid}.`,
    actorId: caller.uid,
  });

  await batch.commit();

  const effective = await syncRoleArtifacts(userId);

  return {
    userRoleId: newRoleRef.id,
    effectiveLegacyRole: effective,
  };
});
