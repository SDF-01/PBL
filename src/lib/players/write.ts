// Player profile Firestore write helpers + ELO application.

"use client";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type FieldValue,
} from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../firestore/collections";
import type {
  PlayerProfileDoc,
  DominantHand,
  PlayerStats,
} from "../firestore/types";
import {
  STARTING_ELO,
  computeEloDeltas,
  type MatchOutcome,
  type EloDelta,
} from "./elo";

function stripUndefined<T extends Record<string, unknown>>(
  obj: T,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  );
}

export interface PlayerProfileInput {
  userId: string;
  displayName: string;
  photoURL?: string;
  city?: string;
  region?: string;
  country?: string;
  homeVenueId?: string;
  homeVenueName?: string;
  dominantHand?: DominantHand;
  paddleBrand?: string;
  paddleModel?: string;
  yearsPlaying?: number;
  bio?: string;
  duprRating?: number;
  duprId?: string | null;
}

/**
 * Create or update a player profile. The first write seeds ELO at
 * `STARTING_ELO` and zero stats; subsequent writes only patch the
 * editable identity / equipment fields — never ELO or stats, which are
 * maintained by match results via `applyMatchEloDeltas`.
 */
export async function upsertPlayerProfile(
  input: PlayerProfileInput,
): Promise<string> {
  const id = input.userId;
  if (!id) throw new Error("userId required.");
  const ref = doc(db(), COLLECTIONS.players, id);
  const existing = await getDoc(ref);

  const editable = stripUndefined({
    displayName: input.displayName.trim(),
    photoURL: input.photoURL,
    city: input.city?.trim() || undefined,
    region: input.region?.trim() || undefined,
    country: input.country?.trim() || undefined,
    homeVenueId: input.homeVenueId,
    homeVenueName: input.homeVenueName?.trim() || undefined,
    dominantHand: input.dominantHand,
    paddleBrand: input.paddleBrand?.trim() || undefined,
    paddleModel: input.paddleModel?.trim() || undefined,
    yearsPlaying:
      typeof input.yearsPlaying === "number" && input.yearsPlaying >= 0
        ? Math.floor(input.yearsPlaying)
        : undefined,
    bio: input.bio?.trim() || undefined,
    duprRating:
      typeof input.duprRating === "number" && input.duprRating > 0
        ? input.duprRating
        : undefined,
    duprId: input.duprId ?? undefined,
    userId: id,
    updatedAt: serverTimestamp() as unknown as string,
  });

  if (!existing.exists()) {
    const seed: Record<string, unknown> = {
      ...editable,
      elo: STARTING_ELO,
      eloPeak: STARTING_ELO,
      stats: {
        matches: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      } satisfies PlayerStats,
      createdAt: serverTimestamp() as unknown as FieldValue,
    };
    await setDoc(ref, seed);
  } else {
    await updateDoc(ref, editable);
  }
  return id;
}

/**
 * Apply a completed match's ELO deltas to all involved player profiles
 * and write one EloEvent per player. Missing player profiles are
 * auto-seeded at STARTING_ELO before the delta is applied.
 *
 * Intended to be invoked from score-verification flows (ladder matches
 * once finalized, tournament matches on completion).
 */
export async function applyMatchEloDeltas(args: {
  outcome: MatchOutcome;
  source: string; // "ladderMatch" | "tournamentMatch"
  sourceId: string;
}): Promise<EloDelta[]> {
  const { outcome, source, sourceId } = args;
  const deltas = computeEloDeltas(outcome);
  const won = (uid: string) =>
    outcome.scoreA > outcome.scoreB
      ? outcome.sideA.some((p) => p.userId === uid)
      : outcome.sideB.some((p) => p.userId === uid);

  const batch = writeBatch(db());
  for (const d of deltas) {
    const pRef = doc(db(), COLLECTIONS.players, d.userId);
    const snap = await getDoc(pRef);
    if (!snap.exists()) {
      batch.set(pRef, {
        userId: d.userId,
        displayName: d.userId,
        elo: d.after,
        eloPeak: Math.max(d.after, STARTING_ELO),
        stats: {
          matches: 1,
          wins: won(d.userId) ? 1 : 0,
          losses: won(d.userId) ? 0 : 1,
          pointsFor: pointsFor(outcome, d.userId),
          pointsAgainst: pointsAgainst(outcome, d.userId),
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const curr = snap.data() as PlayerProfileDoc;
      batch.update(pRef, {
        elo: d.after,
        eloPeak: Math.max(d.after, curr.eloPeak ?? d.after),
        "stats.matches": increment(1),
        "stats.wins": increment(won(d.userId) ? 1 : 0),
        "stats.losses": increment(won(d.userId) ? 0 : 1),
        "stats.pointsFor": increment(pointsFor(outcome, d.userId)),
        "stats.pointsAgainst": increment(pointsAgainst(outcome, d.userId)),
        "stats.updatedAt": serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    const eventRef = doc(collection(db(), COLLECTIONS.eloEvents));
    batch.set(eventRef, {
      playerId: d.userId,
      delta: d.delta,
      eloBefore: d.before,
      eloAfter: d.after,
      source,
      sourceId,
      opponentIds: opponentsOf(outcome, d.userId),
      partnerIds: partnersOf(outcome, d.userId),
      won: won(d.userId),
      pointsFor: pointsFor(outcome, d.userId),
      pointsAgainst: pointsAgainst(outcome, d.userId),
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return deltas;
}

function sideOf(outcome: MatchOutcome, uid: string): "A" | "B" | null {
  if (outcome.sideA.some((p) => p.userId === uid)) return "A";
  if (outcome.sideB.some((p) => p.userId === uid)) return "B";
  return null;
}
function pointsFor(outcome: MatchOutcome, uid: string): number {
  const s = sideOf(outcome, uid);
  return s === "A" ? outcome.scoreA : s === "B" ? outcome.scoreB : 0;
}
function pointsAgainst(outcome: MatchOutcome, uid: string): number {
  const s = sideOf(outcome, uid);
  return s === "A" ? outcome.scoreB : s === "B" ? outcome.scoreA : 0;
}
function partnersOf(outcome: MatchOutcome, uid: string): string[] {
  const s = sideOf(outcome, uid);
  const side = s === "A" ? outcome.sideA : s === "B" ? outcome.sideB : [];
  return side.filter((p) => p.userId !== uid).map((p) => p.userId);
}
function opponentsOf(outcome: MatchOutcome, uid: string): string[] {
  const s = sideOf(outcome, uid);
  const opp = s === "A" ? outcome.sideB : s === "B" ? outcome.sideA : [];
  return opp.map((p) => p.userId);
}
