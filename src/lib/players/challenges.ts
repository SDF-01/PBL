"use client";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../firestore/collections";
import type {
  PlayerChallengeDoc,
  ChallengeStatus,
  ChallengeConditions,
} from "../firestore/types";

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getChallenge(challengeId: string): Promise<PlayerChallengeDoc | null> {
  const snap = await getDoc(doc(db(), COLLECTIONS.playerChallenges, challengeId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as PlayerChallengeDoc;
}

/** Real-time listener for a single challenge document. */
export function subscribeChallenge(
  challengeId: string,
  onChange: (challenge: PlayerChallengeDoc | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db(), COLLECTIONS.playerChallenges, challengeId), (snap) => {
    onChange(snap.exists() ? ({ id: snap.id, ...snap.data() } as PlayerChallengeDoc) : null);
  });
}

export async function listIncomingChallenges(userId: string): Promise<PlayerChallengeDoc[]> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.playerChallenges),
      where("challengeeId", "==", userId),
      where("status", "==", "PENDING"),
      orderBy("createdAt", "desc"),
      limit(20),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlayerChallengeDoc);
}

/** Challenges the user sent that are still awaiting a response (PENDING only). */
export async function listPendingSent(userId: string): Promise<PlayerChallengeDoc[]> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.playerChallenges),
      where("challengerId", "==", userId),
      where("status", "==", "PENDING"),
      orderBy("createdAt", "desc"),
      limit(20),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlayerChallengeDoc);
}

/** Active challenges (ACCEPTED / SCHEDULED / SCORE_SUBMITTED) for either role. */
export async function listActiveChallenges(userId: string): Promise<PlayerChallengeDoc[]> {
  const activeStatuses: ChallengeStatus[] = ["ACCEPTED", "SCHEDULED", "SCORE_SUBMITTED"];
  const [asChallenger, asChallengee] = await Promise.all([
    getDocs(
      query(
        collection(db(), COLLECTIONS.playerChallenges),
        where("challengerId", "==", userId),
        where("status", "in", activeStatuses),
        limit(10),
      ),
    ),
    getDocs(
      query(
        collection(db(), COLLECTIONS.playerChallenges),
        where("challengeeId", "==", userId),
        where("status", "in", activeStatuses),
        limit(10),
      ),
    ),
  ]);
  const all = [
    ...asChallenger.docs.map((d) => ({ id: d.id, ...d.data() }) as PlayerChallengeDoc),
    ...asChallengee.docs.map((d) => ({ id: d.id, ...d.data() }) as PlayerChallengeDoc),
  ];
  // Deduplicate (shouldn't happen but guard anyway), sort newest first
  const seen = new Set<string>();
  return all
    .filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; })
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

/** @deprecated Use listPendingSent + listActiveChallenges in the panel. Kept for back-compat. */
export async function listOutgoingChallenges(userId: string): Promise<PlayerChallengeDoc[]> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.playerChallenges),
      where("challengerId", "==", userId),
      where("status", "in", ["PENDING", "ACCEPTED", "SCHEDULED", "SCORE_SUBMITTED"]),
      orderBy("createdAt", "desc"),
      limit(20),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlayerChallengeDoc);
}

export async function listChallengeHistory(userId: string): Promise<PlayerChallengeDoc[]> {
  const [asChallenger, asChallengee] = await Promise.all([
    getDocs(
      query(
        collection(db(), COLLECTIONS.playerChallenges),
        where("challengerId", "==", userId),
        where("status", "in", ["COMPLETED", "DECLINED", "EXPIRED"]),
        orderBy("createdAt", "desc"),
        limit(10),
      ),
    ),
    getDocs(
      query(
        collection(db(), COLLECTIONS.playerChallenges),
        where("challengeeId", "==", userId),
        where("status", "in", ["COMPLETED", "DECLINED", "EXPIRED"]),
        orderBy("createdAt", "desc"),
        limit(10),
      ),
    ),
  ]);

  const all = [
    ...asChallenger.docs.map((d) => ({ id: d.id, ...d.data() }) as PlayerChallengeDoc),
    ...asChallengee.docs.map((d) => ({ id: d.id, ...d.data() }) as PlayerChallengeDoc),
  ];
  all.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return all.slice(0, 15);
}

/** Real-time listener for incoming PENDING challenges. */
export function subscribeIncomingChallenges(
  userId: string,
  onChange: (challenges: PlayerChallengeDoc[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db(), COLLECTIONS.playerChallenges),
      where("challengeeId", "==", userId),
      where("status", "==", "PENDING"),
      orderBy("createdAt", "desc"),
    ),
    (snap) =>
      onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlayerChallengeDoc)),
  );
}

// ── Write ────────────────────────────────────────────────────────────────────

export async function sendChallenge(input: {
  challengerId: string;
  challengerName: string;
  challengeeId: string;
  challengeeName: string;
  message?: string;
  proposedDate?: string;
}): Promise<string> {
  const ref = await addDoc(collection(db(), COLLECTIONS.playerChallenges), {
    ...input,
    message: input.message ?? null,
    proposedDate: input.proposedDate ?? null,
    status: "PENDING" as ChallengeStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    const { notifyUser } = await import("../firestore/write");
    await notifyUser({
      userId: input.challengeeId,
      title: `${input.challengerName} challenged you to a match`,
      body: input.message
        ? `"${input.message}"`
        : `${input.challengerName} wants to play a match. Accept or decline in your dashboard.`,
      href: "/(authenticated)/dashboard",
      kind: "CHALLENGE",
      createdBy: input.challengerId,
    });
  } catch { /* ignore */ }

  return ref.id;
}

export async function withdrawChallenge(
  challengeId: string,
  challengerId: string,
  challengerName: string,
  challengeeId: string,
): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.playerChallenges, challengeId), {
    status: "DECLINED" as ChallengeStatus,
    updatedAt: serverTimestamp(),
  });

  try {
    const { notifyUser } = await import("../firestore/write");
    await notifyUser({
      userId: challengeeId,
      title: `${challengerName} withdrew their challenge`,
      body: "The challenge has been cancelled.",
      href: "/(authenticated)/dashboard",
      kind: "CHALLENGE",
      createdBy: challengerId,
    });
  } catch { /* ignore */ }
}

export async function respondToChallenge(
  challengeId: string,
  accept: boolean,
  responderId: string,
  responderName: string,
  challengerId: string,
): Promise<void> {
  const status: ChallengeStatus = accept ? "ACCEPTED" : "DECLINED";
  await updateDoc(doc(db(), COLLECTIONS.playerChallenges, challengeId), {
    status,
    updatedAt: serverTimestamp(),
  });

  try {
    const { notifyUser } = await import("../firestore/write");
    await notifyUser({
      userId: challengerId,
      title: accept
        ? `${responderName} accepted your challenge!`
        : `${responderName} declined your challenge`,
      body: accept
        ? "Head to your dashboard to set match conditions."
        : "Better luck next time.",
      href: `/challenges/${challengeId}`,
      kind: "CHALLENGE",
      createdBy: responderId,
    });
  } catch { /* ignore */ }
}

/** Save proposed match conditions. Either player can propose; the other must accept. */
export async function proposeConditions(
  challengeId: string,
  conditions: ChallengeConditions,
  proposedById: string,
  otherPlayerId: string,
  proposerName: string,
): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.playerChallenges, challengeId), {
    conditions,
    conditionsProposedBy: proposedById,
    updatedAt: serverTimestamp(),
  });

  try {
    const { notifyUser } = await import("../firestore/write");
    await notifyUser({
      userId: otherPlayerId,
      title: `${proposerName} proposed match conditions`,
      body: `Format: ${formatLabel(conditions.format)}${conditions.scheduledDate ? ` · ${conditions.scheduledDate}` : ""}`,
      href: `/challenges/${challengeId}`,
      kind: "CHALLENGE",
      createdBy: proposedById,
    });
  } catch { /* ignore */ }
}

/** Accept the currently proposed conditions → status becomes SCHEDULED. */
export async function acceptConditions(
  challengeId: string,
  acceptorId: string,
  proposerId: string,
  acceptorName: string,
): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.playerChallenges, challengeId), {
    status: "SCHEDULED" as ChallengeStatus,
    updatedAt: serverTimestamp(),
  });

  try {
    const { notifyUser } = await import("../firestore/write");
    await notifyUser({
      userId: proposerId,
      title: `${acceptorName} accepted the match conditions`,
      body: "Your challenge is scheduled — time to play!",
      href: `/challenges/${challengeId}`,
      kind: "CHALLENGE",
      createdBy: acceptorId,
    });
  } catch { /* ignore */ }
}

/**
 * Submit a score after the match is played.
 * myRole: "challenger" | "challengee" — determines how scores map to scoreA/scoreB.
 * myScore / opponentScore are from the submitter's perspective.
 * gameBreakdown (optional): per-game scores in challenger/challengee order for best-of-3.
 */
export async function submitChallengeScore(
  challengeId: string,
  myScore: number,
  opponentScore: number,
  submittedById: string,
  myRole: "challenger" | "challengee",
  otherPlayerId: string,
  submitterName: string,
  gameBreakdown?: Array<{ scoreA: number; scoreB: number }>,
): Promise<void> {
  const scoreA = myRole === "challenger" ? myScore : opponentScore;
  const scoreB = myRole === "challengee" ? myScore : opponentScore;

  await updateDoc(doc(db(), COLLECTIONS.playerChallenges, challengeId), {
    status: "SCORE_SUBMITTED" as ChallengeStatus,
    scoreA,
    scoreB,
    ...(gameBreakdown ? { games: gameBreakdown } : {}),
    submittedBy: submittedById,
    updatedAt: serverTimestamp(),
  });

  try {
    const { notifyUser } = await import("../firestore/write");
    await notifyUser({
      userId: otherPlayerId,
      title: `${submitterName} logged the match score`,
      body: `Score: ${scoreA}–${scoreB}. Please verify the result.`,
      href: `/challenges/${challengeId}`,
      kind: "CHALLENGE",
      createdBy: submittedById,
    });
  } catch { /* ignore */ }
}

/**
 * Verify the submitted score → status becomes COMPLETED and ELO is applied.
 */
export async function verifyChallengeScore(
  challengeId: string,
  verifierId: string,
): Promise<void> {
  const challenge = await getChallenge(challengeId);
  if (!challenge) throw new Error("Challenge not found");
  if (challenge.status !== "SCORE_SUBMITTED") throw new Error("No score to verify");
  if (challenge.scoreA == null || challenge.scoreB == null) throw new Error("Missing scores");

  const challengerWon = challenge.scoreA > challenge.scoreB;

  await updateDoc(doc(db(), COLLECTIONS.playerChallenges, challengeId), {
    status: "COMPLETED" as ChallengeStatus,
    verifiedBy: verifierId,
    winnerSide: challengerWon ? "challenger" : "challengee",
    updatedAt: serverTimestamp(),
  });

  // ELO writes require admin/backend. Catch permission errors so the challenge
  // stays COMPLETED even while backend functions are not yet deployed.
  try {
    const { applyMatchEloByUserIds } = await import("../players/write");
    await applyMatchEloByUserIds({
      sideA: [challenge.challengerId],
      sideB: [challenge.challengeeId],
      scoreA: challenge.scoreA,
      scoreB: challenge.scoreB,
      targetPoints: targetPoints(challenge.conditions?.format),
      source: "challenge",
      sourceId: challengeId,
    });
    await updateDoc(doc(db(), COLLECTIONS.playerChallenges, challengeId), {
      eloApplied: true,
      updatedAt: serverTimestamp(),
    });
  } catch { /* ELO pending — requires admin SDK or Cloud Function */ }
}

/**
 * Re-apply ELO for a COMPLETED challenge where the initial ELO write failed.
 * Safe to call multiple times — skips if eloApplied is already true.
 */
export async function reapplyChallengeElo(challengeId: string): Promise<void> {
  const challenge = await getChallenge(challengeId);
  if (!challenge) throw new Error("Challenge not found");
  if (challenge.status !== "COMPLETED") throw new Error("Challenge is not completed");
  if (challenge.scoreA == null || challenge.scoreB == null) throw new Error("Missing scores");
  if (challenge.eloApplied) return;

  const { applyMatchEloByUserIds } = await import("../players/write");
  await applyMatchEloByUserIds({
    sideA: [challenge.challengerId],
    sideB: [challenge.challengeeId],
    scoreA: challenge.scoreA,
    scoreB: challenge.scoreB,
    targetPoints: targetPoints(challenge.conditions?.format),
    source: "challenge",
    sourceId: challengeId,
  });

  await updateDoc(doc(db(), COLLECTIONS.playerChallenges, challengeId), {
    eloApplied: true,
    updatedAt: serverTimestamp(),
  });
}

/** @deprecated Use verifyChallengeScore for the new flow. Kept for existing callers. */
export async function reportChallengeResult(
  challengeId: string,
  scoreA: number,
  scoreB: number,
  challengerWon: boolean,
  challengerId: string,
  challengeeId: string,
): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.playerChallenges, challengeId), {
    status: "COMPLETED" as ChallengeStatus,
    scoreA,
    scoreB,
    winnerSide: challengerWon ? "challenger" : "challengee",
    updatedAt: serverTimestamp(),
  });

  try {
    const { applyMatchEloByUserIds } = await import("../players/write");
    await applyMatchEloByUserIds({
      sideA: [challengerId],
      sideB: [challengeeId],
      scoreA,
      scoreB,
      targetPoints: 11,
      source: "challenge",
      sourceId: challengeId,
    });
  } catch { /* ignore ELO failure */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatLabel(format: ChallengeConditions["format"]): string {
  switch (format) {
    case "game-11": return "Game to 11";
    case "game-15": return "Game to 15";
    case "game-21": return "Game to 21";
    case "best-of-3": return "Best of 3 to 11";
  }
}

function targetPoints(format?: ChallengeConditions["format"]): number {
  switch (format) {
    case "game-15": return 15;
    case "game-21": return 21;
    case "best-of-3": return 3; // games won
    default: return 11;
  }
}
