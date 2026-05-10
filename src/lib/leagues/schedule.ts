"use client";

import {
  collection,
  deleteDoc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  doc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import { circleRoundRobin } from "@/domain/bracket/roundRobin";
import type { Entrant } from "@/domain/bracket/types";
import type { LeagueScheduleMatchDoc } from "@/lib/firestore/types";

export type { LeagueScheduleMatchDoc };

const SNAPSHOT_SUBCOLLECTION = "scheduleHistory";

/** Fetch all schedule matches for a league. */
export async function listScheduleMatches(
  leagueId: string,
): Promise<LeagueScheduleMatchDoc[]> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.leagueScheduleMatches),
      where("leagueId", "==", leagueId),
    ),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as LeagueScheduleMatchDoc)
    .sort((a, b) => a.round - b.round || a.id.localeCompare(b.id));
}

export interface SchedulePlayer {
  userId: string;
  displayName: string;
}

/**
 * Generate and persist a full round-robin schedule for a league.
 * Clears any existing schedule first (idempotent regeneration).
 *
 * Before deletion, writes a snapshot under
 * leagues/{leagueId}/scheduleHistory/{timestamp} so the prior
 * schedule can be restored.
 */
export async function generateLeagueSchedule(
  leagueId: string,
  players: SchedulePlayer[],
): Promise<LeagueScheduleMatchDoc[]> {
  // Snapshot + clear existing
  const existing = await listScheduleMatches(leagueId);
  if (existing.length > 0) {
    await snapshotSchedule(leagueId, existing);
  }
  await Promise.allSettled(
    existing.map((m) =>
      deleteDoc(doc(db(), COLLECTIONS.leagueScheduleMatches, m.id)),
    ),
  );

  if (players.length < 2) return [];

  const entrants: Entrant[] = players.map((p) => ({
    id: p.userId,
    name: p.displayName,
    rating: 1500,
  }));

  const schedule = circleRoundRobin(entrants);
  const now = new Date().toISOString();
  const created: LeagueScheduleMatchDoc[] = [];

  for (const round of schedule.rounds) {
    for (const pairing of round.pairings) {
      if (!pairing.b) continue; // BYE — skip

      const playerA = players.find((p) => p.userId === pairing.a)!;
      const playerB = players.find((p) => p.userId === pairing.b)!;
      const id = `${leagueId}_r${round.index + 1}_${pairing.a}_${pairing.b}`;

      const matchDoc: LeagueScheduleMatchDoc = {
        id,
        leagueId,
        round: round.index + 1,
        playerAId: pairing.a,
        playerAName: playerA?.displayName ?? pairing.a,
        playerBId: pairing.b,
        playerBName: playerB?.displayName ?? pairing.b,
        status: "SCHEDULED",
        createdAt: now,
      };

      await setDoc(doc(db(), COLLECTIONS.leagueScheduleMatches, id), {
        ...matchDoc,
        createdAt: serverTimestamp(),
      });
      created.push(matchDoc);
    }
  }

  return created;
}

// ============================================================
// SCHEDULE HISTORY (snapshot + restore)
// ============================================================

export interface ScheduleSnapshot {
  id: string;
  leagueId: string;
  matches: LeagueScheduleMatchDoc[];
  snapshotAt: string;
  matchCount: number;
  completedCount: number;
}

/** Write a snapshot of the current schedule before regeneration. */
async function snapshotSchedule(
  leagueId: string,
  matches: LeagueScheduleMatchDoc[],
): Promise<string> {
  const id = new Date().toISOString().replace(/[.:]/g, "-");
  const completedCount = matches.filter((m) => m.status === "COMPLETED").length;
  await setDoc(
    doc(
      db(),
      COLLECTIONS.leagues,
      leagueId,
      SNAPSHOT_SUBCOLLECTION,
      id,
    ),
    {
      id,
      leagueId,
      matches,
      snapshotAt: serverTimestamp(),
      matchCount: matches.length,
      completedCount,
    },
  );
  return id;
}

/** Most recent snapshots first, capped to 5. */
export async function listScheduleSnapshots(
  leagueId: string,
): Promise<ScheduleSnapshot[]> {
  const snap = await getDocs(
    query(
      collection(
        db(),
        COLLECTIONS.leagues,
        leagueId,
        SNAPSHOT_SUBCOLLECTION,
      ),
      orderBy("snapshotAt", "desc"),
      limit(5),
    ),
  );
  return snap.docs.map((d) => {
    const data = d.data() as {
      matches: LeagueScheduleMatchDoc[];
      matchCount: number;
      completedCount: number;
      snapshotAt: { toDate?: () => Date } | string;
    };
    const at =
      typeof data.snapshotAt === "string"
        ? data.snapshotAt
        : data.snapshotAt?.toDate?.().toISOString() ?? "";
    return {
      id: d.id,
      leagueId,
      matches: data.matches ?? [],
      matchCount: data.matchCount ?? data.matches?.length ?? 0,
      completedCount: data.completedCount ?? 0,
      snapshotAt: at,
    };
  });
}

/**
 * Restore the schedule from a snapshot. Wipes the current schedule
 * (taking another snapshot of *that* first, so the operation is reversible)
 * and re-creates each match exactly as it was when the snapshot was taken.
 */
export async function restoreScheduleSnapshot(
  leagueId: string,
  snapshotId: string,
): Promise<LeagueScheduleMatchDoc[]> {
  const snap = await getDoc(
    doc(
      db(),
      COLLECTIONS.leagues,
      leagueId,
      SNAPSHOT_SUBCOLLECTION,
      snapshotId,
    ),
  );
  if (!snap.exists()) throw new Error("Snapshot not found.");
  const data = snap.data() as { matches: LeagueScheduleMatchDoc[] };
  const matches = data.matches ?? [];

  // Snapshot the current schedule (if any) before we overwrite it.
  const current = await listScheduleMatches(leagueId);
  if (current.length > 0) {
    await snapshotSchedule(leagueId, current);
    await Promise.allSettled(
      current.map((m) =>
        deleteDoc(doc(db(), COLLECTIONS.leagueScheduleMatches, m.id)),
      ),
    );
  }

  await Promise.all(
    matches.map((m) =>
      setDoc(doc(db(), COLLECTIONS.leagueScheduleMatches, m.id), {
        ...m,
        createdAt: serverTimestamp(),
      }),
    ),
  );

  return matches;
}
