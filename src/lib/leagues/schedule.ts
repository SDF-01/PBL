"use client";

import {
  collection,
  deleteDoc,
  getDocs,
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
 */
export async function generateLeagueSchedule(
  leagueId: string,
  players: SchedulePlayer[],
): Promise<LeagueScheduleMatchDoc[]> {
  // Clear existing
  const existing = await listScheduleMatches(leagueId);
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
