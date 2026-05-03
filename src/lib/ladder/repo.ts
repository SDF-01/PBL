// Ladder League Firestore read helpers.

"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../firestore/collections";
import type {
  LadderSeasonDoc,
  VenueDoc,
  PlayDateDoc,
  CheckInDoc,
  LadderSessionDoc,
  LadderCourtDoc,
  LadderMatchDoc,
  StandingsSnapshotDoc,
} from "../firestore/types";

export async function listLadderSeasons(): Promise<LadderSeasonDoc[]> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.seasons),
      orderBy("startDate", "desc"),
      limit(50),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LadderSeasonDoc);
}

export async function getLadderSeason(
  id: string,
): Promise<LadderSeasonDoc | null> {
  const snap = await getDoc(doc(db(), COLLECTIONS.seasons, id));
  return snap.exists()
    ? ({ id: snap.id, ...snap.data() } as LadderSeasonDoc)
    : null;
}

export async function listVenues(): Promise<VenueDoc[]> {
  const snap = await getDocs(
    query(collection(db(), COLLECTIONS.venues), limit(100)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VenueDoc);
}

export async function getVenue(id: string): Promise<VenueDoc | null> {
  const snap = await getDoc(doc(db(), COLLECTIONS.venues, id));
  return snap.exists()
    ? ({ id: snap.id, ...snap.data() } as VenueDoc)
    : null;
}

export async function listPlayDates(): Promise<PlayDateDoc[]> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.playDates),
      orderBy("date", "desc"),
      limit(50),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlayDateDoc);
}

export async function getPlayDate(id: string): Promise<PlayDateDoc | null> {
  const snap = await getDoc(doc(db(), COLLECTIONS.playDates, id));
  return snap.exists()
    ? ({ id: snap.id, ...snap.data() } as PlayDateDoc)
    : null;
}

export function subscribeCheckIns(
  playDateId: string,
  onChange: (rows: CheckInDoc[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db(), COLLECTIONS.checkIns),
      where("playDateId", "==", playDateId),
    ),
    (snap) =>
      onChange(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CheckInDoc),
      ),
  );
}

// ============================================================
// LADDER SESSIONS
// ============================================================

export async function listLadderSessions(
  playDateId?: string,
): Promise<LadderSessionDoc[]> {
  let q = query(collection(db(), COLLECTIONS.ladderSessions));
  if (playDateId) {
    q = query(q, where("playDateId", "==", playDateId));
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LadderSessionDoc);
}

export async function getLadderSession(
  id: string,
): Promise<LadderSessionDoc | null> {
  const snap = await getDoc(doc(db(), COLLECTIONS.ladderSessions, id));
  return snap.exists()
    ? ({ id: snap.id, ...snap.data() } as LadderSessionDoc)
    : null;
}

export function subscribeLadderSessions(
  playDateId: string,
  onChange: (sessions: LadderSessionDoc[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db(), COLLECTIONS.ladderSessions),
      where("playDateId", "==", playDateId),
    ),
    (snap) =>
      onChange(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LadderSessionDoc),
      ),
  );
}

// ============================================================
// LADDER COURTS
// ============================================================

export async function listLadderCourts(
  sessionId: string,
): Promise<LadderCourtDoc[]> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.ladderCourts),
      where("sessionId", "==", sessionId),
      orderBy("courtNumber", "asc"),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LadderCourtDoc);
}

export async function getLadderCourt(id: string): Promise<LadderCourtDoc | null> {
  const snap = await getDoc(doc(db(), COLLECTIONS.ladderCourts, id));
  return snap.exists()
    ? ({ id: snap.id, ...snap.data() } as LadderCourtDoc)
    : null;
}

export function subscribeLadderCourts(
  sessionId: string,
  onChange: (courts: LadderCourtDoc[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db(), COLLECTIONS.ladderCourts),
      where("sessionId", "==", sessionId),
      orderBy("courtNumber", "asc"),
    ),
    (snap) =>
      onChange(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LadderCourtDoc),
      ),
  );
}

// ============================================================
// LADDER MATCHES
// ============================================================

export async function listLadderMatches(
  sessionId: string,
): Promise<LadderMatchDoc[]> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.ladderMatches),
      where("sessionId", "==", sessionId),
      orderBy("gameNumber", "asc"),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LadderMatchDoc);
}

export async function getLadderMatch(id: string): Promise<LadderMatchDoc | null> {
  const snap = await getDoc(doc(db(), COLLECTIONS.ladderMatches, id));
  return snap.exists()
    ? ({ id: snap.id, ...snap.data() } as LadderMatchDoc)
    : null;
}

export function subscribeLadderMatches(
  sessionId: string,
  onChange: (matches: LadderMatchDoc[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db(), COLLECTIONS.ladderMatches),
      where("sessionId", "==", sessionId),
      orderBy("gameNumber", "asc"),
    ),
    (snap) =>
      onChange(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LadderMatchDoc),
      ),
  );
}

// ============================================================
// STANDINGS SNAPSHOTS
// ============================================================

export async function getLatestStandingsSnapshot(
  sessionId: string,
): Promise<StandingsSnapshotDoc | null> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.standingsSnapshots),
      where("sessionId", "==", sessionId),
      orderBy("snapshotAt", "desc"),
      limit(1),
    ),
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as StandingsSnapshotDoc;
}

// ============================================================
// PLAYER SESSION DATA (aggregated queries)
// ============================================================

export interface PlayerSessionData {
  currentSession?: LadderSessionDoc;
  assignedCourt?: LadderCourtDoc;
  currentMatch?: LadderMatchDoc & { courtNumber: number };
  nextMatch?: LadderMatchDoc & { courtNumber: number };
  sitOutMatch?: LadderMatchDoc & { courtNumber: number };
  allMatches: LadderMatchDoc[];
}

export async function getPlayerSessionData(
  playerId: string,
  playDateId: string,
): Promise<PlayerSessionData> {
  // Get active sessions for this play date
  const sessions = await listLadderSessions(playDateId);
  const activeSession = sessions.find(
    (s) => s.status === "GENERATED" || s.status === "LIVE",
  );

  if (!activeSession) {
    return { allMatches: [] };
  }

  // Get courts for this session
  const courts = await listLadderCourts(activeSession.id);
  const assignedCourt = courts.find((c) => c.playerIds.includes(playerId));

  if (!assignedCourt) {
    return { currentSession: activeSession, allMatches: [] };
  }

  // Get all matches for this session
  const allMatches = await listLadderMatches(activeSession.id);

  // Find matches involving this player
  const playerMatches = allMatches.filter(
    (m) =>
      m.sideA.includes(playerId) ||
      m.sideB.includes(playerId) ||
      m.sittingOut === playerId,
  );

  // Sort by game number to find current/next
  playerMatches.sort((a, b) => a.gameNumber - b.gameNumber);

  let currentMatch: (LadderMatchDoc & { courtNumber: number }) | undefined;
  let nextMatch: (LadderMatchDoc & { courtNumber: number }) | undefined;
  let sitOutMatch: (LadderMatchDoc & { courtNumber: number }) | undefined;

  for (const match of playerMatches) {
    const matchWithCourt = { ...match, courtNumber: assignedCourt.courtNumber };

    if (match.sittingOut === playerId) {
      if (!sitOutMatch) sitOutMatch = matchWithCourt;
      continue;
    }

    // Check if match needs action from this player
    const isOnSideA = match.sideA.includes(playerId);
    const isOnSideB = match.sideB.includes(playerId);
    const needsSubmission =
      match.status === "SCHEDULED" &&
      ((isOnSideA && !match.scoreA) || (isOnSideB && !match.scoreB));
    const needsVerification =
      match.status === "SUBMITTED" &&
      ((isOnSideA && !match.verifiedAt) || (isOnSideB && !match.verifiedAt));

    if (needsSubmission || needsVerification) {
      if (!currentMatch) {
        currentMatch = matchWithCourt;
      } else if (!nextMatch) {
        nextMatch = matchWithCourt;
      }
    } else if (!currentMatch) {
      // Match is complete, but no current action needed yet
      currentMatch = matchWithCourt;
    } else if (!nextMatch) {
      nextMatch = matchWithCourt;
    }
  }

  return {
    currentSession: activeSession,
    assignedCourt,
    currentMatch,
    nextMatch,
    sitOutMatch,
    allMatches,
  };
}
