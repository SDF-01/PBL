import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { COLLECTIONS } from "./collections";

export type RoleKey =
  | "SiteAdmin"
  | "ClubDirector"
  | "LeagueCoordinator"
  | "Player"
  | "ClubCreatorProvisional";

export type LegacyRole =
  | "SITE_ADMIN"
  | "CLUB_ADMIN"
  | "LEAGUE_COORDINATOR"
  | "PLAYER";

export const ROLE_KEY_TO_LEGACY: Partial<Record<RoleKey, LegacyRole>> = {
  SiteAdmin: "SITE_ADMIN",
  ClubDirector: "CLUB_ADMIN",
  LeagueCoordinator: "LEAGUE_COORDINATOR",
  Player: "PLAYER",
};

// Higher number = higher privilege.
export const LEGACY_ROLE_RANK: Record<LegacyRole, number> = {
  SITE_ADMIN: 4,
  CLUB_ADMIN: 3,
  LEAGUE_COORDINATOR: 2,
  PLAYER: 1,
};

/**
 * Recompute the user's highest active legacy role from their userRoles
 * collection. Returns "PLAYER" when no active roles exist.
 */
export async function effectiveLegacyRole(userId: string): Promise<LegacyRole> {
  const snap = await getFirestore()
    .collection(COLLECTIONS.userRoles)
    .where("userId", "==", userId)
    .where("active", "==", true)
    .get();

  let best: LegacyRole = "PLAYER";
  let bestRank = LEGACY_ROLE_RANK.PLAYER;
  for (const doc of snap.docs) {
    const roleId = (doc.data() as { roleId?: RoleKey }).roleId;
    if (!roleId) continue;
    const legacy = ROLE_KEY_TO_LEGACY[roleId];
    if (!legacy) continue;
    const rank = LEGACY_ROLE_RANK[legacy];
    if (rank > bestRank) {
      bestRank = rank;
      best = legacy;
    }
  }
  return best;
}

/**
 * Set the user's custom claim to match their effective legacy role and
 * mirror the value into users/{uid}.role for the rules fallback.
 *
 * Custom claims propagate to client tokens on the next ID-token refresh
 * (auto-refreshes hourly, or call getIdToken(true) for immediate effect).
 */
export async function syncRoleArtifacts(userId: string): Promise<LegacyRole> {
  const effective = await effectiveLegacyRole(userId);

  await Promise.all([
    getAuth().setCustomUserClaims(userId, { role: effective }),
    getFirestore()
      .doc(`${COLLECTIONS.users}/${userId}`)
      .set(
        { role: effective, updatedAt: new Date() },
        { merge: true },
      ),
  ]);

  return effective;
}
