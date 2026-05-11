import { HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "./collections";

interface LeagueScopeFields {
  clubId?: string | null;
  orgId?: string | null;
}

interface UserRoleScopeFields {
  roleId?: string;
  clubId?: string | null;
  leagueId?: string | null;
}

interface SessionScopeFields {
  playDateId?: string;
  seasonId?: string;
}

interface PlayDateScopeFields {
  leagueId?: string;
  seasonId?: string;
}

interface SeasonScopeFields {
  leagueId?: string;
}

interface MatchScopeFields {
  sessionId?: string;
}

async function resolveLeagueIdFromSession(
  sessionId: string,
): Promise<string | null> {
  const db = getFirestore();
  const snap = await db.doc(`${COLLECTIONS.ladderSessions}/${sessionId}`).get();
  if (!snap.exists) return null;
  const session = snap.data() as SessionScopeFields;

  if (session.playDateId) {
    const pdSnap = await db
      .doc(`${COLLECTIONS.playDates}/${session.playDateId}`)
      .get();
    if (pdSnap.exists) {
      const pd = pdSnap.data() as PlayDateScopeFields;
      if (pd.leagueId) return pd.leagueId;
      if (pd.seasonId) {
        const seasonSnap = await db
          .doc(`${COLLECTIONS.seasons}/${pd.seasonId}`)
          .get();
        if (seasonSnap.exists) {
          const leagueId = (seasonSnap.data() as SeasonScopeFields).leagueId;
          if (leagueId) return leagueId;
        }
      }
    }
  }

  if (session.seasonId) {
    const seasonSnap = await db
      .doc(`${COLLECTIONS.seasons}/${session.seasonId}`)
      .get();
    if (seasonSnap.exists) {
      const leagueId = (seasonSnap.data() as SeasonScopeFields).leagueId;
      if (leagueId) return leagueId;
    }
  }

  return null;
}

async function resolveLeagueIdFromPlayDate(
  playDateId: string,
): Promise<string | null> {
  const db = getFirestore();
  const snap = await db.doc(`${COLLECTIONS.playDates}/${playDateId}`).get();
  if (!snap.exists) return null;
  const pd = snap.data() as PlayDateScopeFields;
  if (pd.leagueId) return pd.leagueId;
  if (pd.seasonId) {
    const seasonSnap = await db
      .doc(`${COLLECTIONS.seasons}/${pd.seasonId}`)
      .get();
    if (seasonSnap.exists) {
      const leagueId = (seasonSnap.data() as SeasonScopeFields).leagueId;
      if (leagueId) return leagueId;
    }
  }
  return null;
}

async function resolveLeagueIdFromMatch(
  matchId: string,
): Promise<string | null> {
  const db = getFirestore();
  const snap = await db.doc(`${COLLECTIONS.ladderMatches}/${matchId}`).get();
  if (!snap.exists) return null;
  const match = snap.data() as MatchScopeFields;
  if (!match.sessionId) return null;
  return resolveLeagueIdFromSession(match.sessionId);
}

async function callerHasLeagueScope(
  callerUid: string,
  leagueId: string,
  callerIsSiteAdmin: boolean,
): Promise<boolean> {
  if (callerIsSiteAdmin) return true;

  const db = getFirestore();
  const leagueSnap = await db.doc(`${COLLECTIONS.leagues}/${leagueId}`).get();
  if (!leagueSnap.exists) return false;
  const league = leagueSnap.data() as LeagueScopeFields;
  const leagueClubId = league.clubId ?? league.orgId ?? null;

  const rolesSnap = await db
    .collection(COLLECTIONS.userRoles)
    .where("userId", "==", callerUid)
    .where("active", "==", true)
    .get();

  for (const doc of rolesSnap.docs) {
    const data = doc.data() as UserRoleScopeFields;
    if (data.roleId === "SiteAdmin") return true;
    if (
      data.roleId === "ClubDirector" &&
      leagueClubId &&
      data.clubId === leagueClubId
    ) {
      return true;
    }
    if (data.roleId === "LeagueCoordinator") {
      if (data.leagueId === leagueId) return true;
      if (leagueClubId && data.clubId === leagueClubId) return true;
    }
  }

  return false;
}

export async function requireSessionScope(
  callerUid: string,
  callerIsSiteAdmin: boolean,
  sessionId: string,
): Promise<void> {
  if (callerIsSiteAdmin) return;
  const leagueId = await resolveLeagueIdFromSession(sessionId);
  if (!leagueId) {
    throw new HttpsError(
      "permission-denied",
      "Could not resolve owning league for session; staff scope required.",
    );
  }
  if (!(await callerHasLeagueScope(callerUid, leagueId, callerIsSiteAdmin))) {
    throw new HttpsError(
      "permission-denied",
      "Caller is not a director or coordinator for this league.",
    );
  }
}

export async function requirePlayDateScope(
  callerUid: string,
  callerIsSiteAdmin: boolean,
  playDateId: string,
): Promise<void> {
  if (callerIsSiteAdmin) return;
  const leagueId = await resolveLeagueIdFromPlayDate(playDateId);
  if (!leagueId) {
    throw new HttpsError(
      "permission-denied",
      "Could not resolve owning league for play date; staff scope required.",
    );
  }
  if (!(await callerHasLeagueScope(callerUid, leagueId, callerIsSiteAdmin))) {
    throw new HttpsError(
      "permission-denied",
      "Caller is not a director or coordinator for this league.",
    );
  }
}

export async function requireMatchScope(
  callerUid: string,
  callerIsSiteAdmin: boolean,
  matchId: string,
): Promise<void> {
  if (callerIsSiteAdmin) return;
  const leagueId = await resolveLeagueIdFromMatch(matchId);
  if (!leagueId) {
    throw new HttpsError(
      "permission-denied",
      "Could not resolve owning league for match; staff scope required.",
    );
  }
  if (!(await callerHasLeagueScope(callerUid, leagueId, callerIsSiteAdmin))) {
    throw new HttpsError(
      "permission-denied",
      "Caller is not a director or coordinator for this match's league.",
    );
  }
}
