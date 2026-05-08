"use client";

import {
  addDoc,
  collection,
  doc,
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
import type { PlayerChallengeDoc, ChallengeStatus } from "../firestore/types";

// ── Read ─────────────────────────────────────────────────────────────────────

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

export async function listOutgoingChallenges(userId: string): Promise<PlayerChallengeDoc[]> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.playerChallenges),
      where("challengerId", "==", userId),
      where("status", "in", ["PENDING", "ACCEPTED"]),
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

  // Notify challengee
  try {
    const { notifyUser } = await import("../firestore/write");
    await notifyUser({
      userId: input.challengeeId,
      title: `${input.challengerName} challenged you to a match`,
      body: input.message
        ? `"${input.message}"`
        : `${input.challengerName} wants to play a match. Accept or decline in your dashboard.`,
      href: "/(authenticated)/dashboard",
      kind: "GENERAL",
      createdBy: input.challengerId,
    });
  } catch { /* ignore */ }

  return ref.id;
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

  // Notify the challenger of the response
  try {
    const { notifyUser } = await import("../firestore/write");
    await notifyUser({
      userId: challengerId,
      title: accept
        ? `${responderName} accepted your challenge!`
        : `${responderName} declined your challenge`,
      body: accept
        ? "Your match is on — agree on a time and location."
        : "Better luck next time.",
      href: "/(authenticated)/dashboard",
      kind: "GENERAL",
      createdBy: responderId,
    });
  } catch { /* ignore */ }
}

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

  // Apply ELO — treat challenger as sideA
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
