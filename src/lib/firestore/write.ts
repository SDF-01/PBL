// Firestore write helpers. All client-side; safe for static export.

"use client";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type FieldValue,
} from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "./collections";
import type {
  TournamentDoc,
  AnnouncementDoc,
  NotificationDoc,
  RegistrationDoc,
  BracketDoc,
  BracketNodeDoc,
  MatchDoc,
} from "./types";
import {
  generateSingleElim,
  generateDoubleElim,
  advanceMatch,
  validateMatchScore,
  type Entrant,
  type Bracket,
  type BracketNode,
} from "@/domain/bracket";

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Firestore rejects `undefined` field values — strip them before writes.
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

type NewTournament = Omit<TournamentDoc, "id"> & { createdBy: string };

export async function createTournament(input: NewTournament): Promise<string> {
  // Use slug as document id when provided so the URL is stable.
  const id = input.slug || slugify(input.name);
  await setDoc(doc(db(), COLLECTIONS.tournaments, id), stripUndefined({
    ...input,
    slug: id,
    createdAt: serverTimestamp(),
  }));
  return id;
}

export async function updateTournamentStatus(
  id: string,
  status: TournamentDoc["status"],
): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.tournaments, id), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function createAnnouncement(input: {
  orgId: string;
  title: string;
  body: string;
  kind?: AnnouncementDoc["kind"];
  createdBy: string;
}): Promise<string> {
  const ref = await addDoc(collection(db(), COLLECTIONS.announcements), {
    orgId: input.orgId,
    title: input.title,
    body: input.body,
    kind: input.kind ?? "GENERAL",
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

interface NewNotification {
  userId: string;
  title: string;
  body: string;
  href?: string;
  kind?: NotificationDoc["kind"];
  createdBy: string;
}

export async function notifyUser(input: NewNotification): Promise<string> {
  const ref = await addDoc(collection(db(), COLLECTIONS.notifications), {
    userId: input.userId,
    title: input.title,
    body: input.body,
    href: input.href ?? null,
    kind: input.kind ?? "GENERAL",
    read: false,
    createdBy: input.createdBy,
    createdAt: serverTimestamp() as FieldValue,
  });
  return ref.id;
}

/**
 * Send a notification to many users at once. Best-effort — failures for any
 * single recipient do not abort the rest.
 */
export async function notifyMany(
  userIds: string[],
  payload: Omit<NewNotification, "userId">,
): Promise<{ sent: number; failed: number }> {
  const results = await Promise.allSettled(
    userIds.map((userId) => notifyUser({ ...payload, userId })),
  );
  return {
    sent: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.notifications, id), { read: true });
}

// ============================================================
// REGISTRATIONS
// ============================================================

interface NewRegistration {
  tournamentId: string;
  userId: string;
  displayName: string;
  rating?: number;
  seed?: number;
}

/**
 * Register a user for a tournament. Uses a deterministic id
 * (`${tournamentId}__${userId}`) so a user can't register twice.
 */
export async function createRegistration(
  input: NewRegistration,
): Promise<string> {
  const id = `${input.tournamentId}__${input.userId}`;
  await setDoc(doc(db(), COLLECTIONS.registrations, id), stripUndefined({
    tournamentId: input.tournamentId,
    userId: input.userId,
    displayName: input.displayName,
    rating: input.rating,
    seed: input.seed,
    status: "PENDING",
    createdAt: serverTimestamp(),
  }));
  return id;
}

export async function updateRegistrationStatus(
  id: string,
  status: "PENDING" | "CONFIRMED" | "WAITLISTED" | "WITHDRAWN" | "REJECTED",
): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.registrations, id), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function updateRegistrationSeed(
  id: string,
  seed: number | null,
): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.registrations, id), {
    seed: seed ?? null,
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// BRACKET PUBLISHING
// ============================================================

/**
 * Build + persist a bracket for a tournament, create match docs for each
 * non-bye node, and flip the tournament to SEEDED. Returns the bracket id.
 * Idempotent: re-publishing deletes prior bracket/nodes/matches first (client-side).
 */
export async function publishBracket(input: {
  tournamentId: string;
  format: TournamentDoc["format"];
  entrants: Entrant[];
  targetPoints: number;
  winBy: number;
  bestOf: number;
  createdBy: string;
}): Promise<string> {
  const { tournamentId, format, entrants, targetPoints, winBy, bestOf } = input;

  // 1. Generate the bracket(s) in-memory.
  const brackets: Bracket[] = [];
  if (format === "SINGLE_ELIM") {
    brackets.push(
      generateSingleElim({ entrants, seeding: { method: "RANK_BASED" } }),
    );
  } else if (format === "DOUBLE_ELIM") {
    const de = generateDoubleElim({
      entrants,
      seeding: { method: "RANK_BASED" },
    });
    brackets.push(de.winners, de.losers, de.grandFinal);
  } else {
    // ROUND_ROBIN / POOL_PLAY_PLUS_BRACKET — fall back to single elim
    // until the round-robin schedule is wired to Bracket shape.
    brackets.push(
      generateSingleElim({ entrants, seeding: { method: "RANK_BASED" } }),
    );
  }

  // 2. Clear any prior bracket for this tournament (wipe + rewrite).
  const priorBrackets = await getDocs(
    query(
      collection(db(), COLLECTIONS.brackets),
      where("tournamentId", "==", tournamentId),
    ),
  );
  const priorNodes = await getDocs(
    query(
      collection(db(), COLLECTIONS.bracketNodes),
      where("tournamentId", "==", tournamentId),
    ),
  );
  const priorMatches = await getDocs(
    query(
      collection(db(), COLLECTIONS.matches),
      where("tournamentId", "==", tournamentId),
    ),
  );

  // 3. Write everything in a batch.
  const batch = writeBatch(db());
  priorBrackets.docs.forEach((d) => batch.delete(d.ref));
  priorNodes.docs.forEach((d) => batch.delete(d.ref));
  priorMatches.docs.forEach((d) => batch.delete(d.ref));

  const primary = brackets[0]!;
  const bracketId = `${tournamentId}__${format.toLowerCase()}`;
  const bracketRef = doc(db(), COLLECTIONS.brackets, bracketId);
  batch.set(bracketRef, stripUndefined({
    tournamentId,
    format,
    seedingMethod: "RANK_BASED",
    nodeIds: Object.keys(primary.nodes),
    rounds: primary.rounds.map((r) => ({ label: r.label, nodeIds: r.nodeIds })),
    generatedAt: serverTimestamp(),
    createdBy: input.createdBy,
  }));

  // Write all nodes across all brackets (for double-elim).
  const allNodes: BracketNode[] = brackets.flatMap((b) => Object.values(b.nodes));
  for (const node of allNodes) {
    const nodeRef = doc(db(), COLLECTIONS.bracketNodes, node.id);
    batch.set(nodeRef, stripUndefined({
      bracketId,
      tournamentId,
      roundIndex: node.roundIndex,
      positionInRound: node.positionInRound,
      a: node.a ?? null,
      b: node.b ?? null,
      isByeA: node.isByeA,
      isByeB: node.isByeB,
      seedA: node.seedA ?? null,
      seedB: node.seedB ?? null,
      winnerNext: node.winnerNext ?? null,
      loserNext: node.loserNext ?? null,
    }));
  }

  // Create MatchDoc for each non-bye first-round match (plus downstream ones
  // will be created when both sides are populated via advancement).
  for (const node of allNodes) {
    // Only create a match record if both sides are assigned or both byes-resolved.
    if (node.isByeA || node.isByeB) continue;
    if (node.a == null && node.b == null) continue;
    const matchRef = doc(db(), COLLECTIONS.matches, node.id);
    batch.set(matchRef, stripUndefined({
      tournamentId,
      bracketNodeId: node.id,
      status: "SCHEDULED",
      participantAId: node.a ?? null,
      participantBId: node.b ?? null,
      targetPoints,
      winBy,
      bestOf,
      createdAt: serverTimestamp(),
    }));
  }

  // Flip tournament status.
  batch.update(doc(db(), COLLECTIONS.tournaments, tournamentId), {
    status: "SEEDED",
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return bracketId;
}

// ============================================================
// MATCH SCORING + ADVANCEMENT
// ============================================================

/**
 * Record a match result by replaying the bracket in memory, calling the
 * engine's `advanceMatch` to resolve downstream placements, then writing
 * everything (match + games + affected nodes + downstream match doc) atomically.
 */
export async function recordMatchScore(input: {
  matchId: string;
  games: Array<{ a: number; b: number }>;
  createdBy: string;
}): Promise<{ winner: "A" | "B"; gamesA: number; gamesB: number }> {
  const { matchId, games } = input;

  // 1. Load the match + node.
  const matchSnap = await getDoc(doc(db(), COLLECTIONS.matches, matchId));
  if (!matchSnap.exists()) throw new Error("Match not found.");
  const match = { id: matchSnap.id, ...matchSnap.data() } as MatchDoc;
  if (!match.bracketNodeId) throw new Error("Match has no bracket node.");

  const rules = {
    target: match.targetPoints,
    winBy: match.winBy,
    bestOf: match.bestOf,
  };
  const validation = validateMatchScore(games, rules);
  if (!validation.valid) throw new Error(validation.reason);

  // 2. Load the bracket + all nodes.
  const nodeSnap = await getDoc(
    doc(db(), COLLECTIONS.bracketNodes, match.bracketNodeId),
  );
  if (!nodeSnap.exists()) throw new Error("Bracket node not found.");
  const persistedNode = nodeSnap.data() as BracketNodeDoc;

  const allNodesSnap = await getDocs(
    query(
      collection(db(), COLLECTIONS.bracketNodes),
      where("tournamentId", "==", match.tournamentId),
    ),
  );
  const allPersistedNodes = allNodesSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as BracketNodeDoc,
  );

  const bracketSnap = await getDocs(
    query(
      collection(db(), COLLECTIONS.brackets),
      where("tournamentId", "==", match.tournamentId),
    ),
  );
  if (bracketSnap.empty) throw new Error("Bracket not found.");
  const bracketData = bracketSnap.docs[0]!.data() as BracketDoc;

  // 3. Build an in-memory Bracket for the engine.
  const engineNodes: BracketNode[] = allPersistedNodes.map((n) => ({
    id: n.id,
    roundIndex: n.roundIndex,
    positionInRound: n.positionInRound,
    a: n.a ?? null,
    b: n.b ?? null,
    isByeA: n.isByeA,
    isByeB: n.isByeB,
    seedA: n.seedA ?? undefined,
    seedB: n.seedB ?? undefined,
    winnerNext: n.winnerNext ?? undefined,
    loserNext: n.loserNext ?? undefined,
  }));
  const engineBracket: Bracket = {
    type: bracketData.format === "DOUBLE_ELIM" ? "DOUBLE_ELIM"
        : bracketData.format === "ROUND_ROBIN" ? "ROUND_ROBIN"
        : "SINGLE_ELIM",
    side: "main",
    nodes: Object.fromEntries(engineNodes.map((n) => [n.id, n])),
    initialSeeding: [],
    rounds: bracketData.rounds.map((r, i) => ({
      index: i,
      label: r.label,
      nodeIds: r.nodeIds,
    })),
  };

  // 4. Run advancement in-memory.
  const result = advanceMatch([engineBracket], match.bracketNodeId, validation.winner);

  // 5. Write everything: match + games + this node's resolution + any
  //    downstream nodes that got propagated, plus create downstream match
  //    docs when both sides are now set.
  const batch = writeBatch(db());
  const winnerId =
    validation.winner === "A" ? match.participantAId : match.participantBId;

  batch.update(doc(db(), COLLECTIONS.matches, matchId), stripUndefined({
    status: "COMPLETED",
    completedAt: serverTimestamp(),
    winnerId: winnerId ?? null,
    updatedAt: serverTimestamp(),
  }));

  // Delete any prior games for this match (in case of re-entry).
  const priorGames = await getDocs(
    query(
      collection(db(), COLLECTIONS.matchGames),
      where("matchId", "==", matchId),
    ),
  );
  priorGames.docs.forEach((d) => batch.delete(d.ref));

  games.forEach((g, i) => {
    const gameRef = doc(collection(db(), COLLECTIONS.matchGames));
    batch.set(gameRef, {
      matchId,
      gameNumber: i + 1,
      scoreA: g.a,
      scoreB: g.b,
      createdAt: serverTimestamp(),
    });
  });

  // Write any downstream node updates.
  for (const prop of result.propagated) {
    const prev = engineNodes.find((n) => n.id === prop.nodeId)!;
    const nodeRef = doc(db(), COLLECTIONS.bracketNodes, prop.nodeId);
    batch.update(nodeRef, stripUndefined({
      a: prev.a ?? null,
      b: prev.b ?? null,
      seedA: prev.seedA ?? null,
      seedB: prev.seedB ?? null,
    }));

    // Upsert the downstream match doc so score entry is available.
    if (prev.a != null && prev.b != null) {
      const downstreamMatchRef = doc(db(), COLLECTIONS.matches, prev.id);
      batch.set(
        downstreamMatchRef,
        stripUndefined({
          tournamentId: match.tournamentId,
          bracketNodeId: prev.id,
          status: "READY",
          participantAId: prev.a,
          participantBId: prev.b,
          targetPoints: match.targetPoints,
          winBy: match.winBy,
          bestOf: match.bestOf,
          updatedAt: serverTimestamp(),
        }),
        { merge: true },
      );
    }
  }

  // Mark tournament IN_PROGRESS the first time a score is posted.
  batch.update(doc(db(), COLLECTIONS.tournaments, match.tournamentId), {
    status: "IN_PROGRESS",
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  // Silence TS unused warning; persistedNode is used for structure assertion.
  void persistedNode;

  return {
    winner: validation.winner,
    gamesA: validation.gamesA,
    gamesB: validation.gamesB,
  };
}

export async function scheduleMatch(
  matchId: string,
  scheduledAt: string | null,
  courtId: string | null,
): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.matches, matchId), stripUndefined({
    scheduledAt: scheduledAt ?? null,
    courtId: courtId ?? null,
    updatedAt: serverTimestamp(),
  }));
}

export async function startTournament(id: string): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.tournaments, id), {
    status: "IN_PROGRESS",
    updatedAt: serverTimestamp(),
  });
}

export async function completeTournament(id: string): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.tournaments, id), {
    status: "COMPLETED",
    updatedAt: serverTimestamp(),
  });
}
