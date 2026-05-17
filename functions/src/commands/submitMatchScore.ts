import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  getFirestore,
  FieldValue,
  Timestamp,
  type DocumentReference,
} from "firebase-admin/firestore";
import { requireCaller } from "../lib/auth";
import { COLLECTIONS } from "../lib/collections";
import { SECURE_CALLABLE_OPTIONS } from "../lib/secureCallable";
import { sendPushToMany } from "../lib/push";
import { computeEloDeltas, STARTING_ELO } from "../lib/elo";
import { SubmitMatchScoreInput } from "../schemas/match";

interface MatchRecord {
  sessionId: string;
  sideA: string[];
  sideB: string[];
  status?: string;
  gameNumber?: number;
}

interface SessionRecord {
  targetPoints?: number;
}

interface PlayerRecord {
  elo?: number;
  eloPeak?: number;
  stats?: { matches?: number };
}

/**
 * Submit a ladder match score and apply ELO deltas atomically.
 *
 * Within one transaction:
 *   1. Validates the caller is a participant.
 *   2. Validates the match is in a state that accepts a score.
 *   3. Reads target points + every player's current ELO/matches.
 *   4. Computes deltas via the pure ELO module.
 *   5. Updates the match doc with score + submission metadata.
 *   6. Updates each player profile (or seeds if missing) with new ELO + stats.
 *   7. Writes one eloEvents row per player.
 *   8. Writes one audits row.
 *   9. Writes notification docs to the opposing side (post-tx, best-effort).
 */
export const submitMatchScore = onCall(SECURE_CALLABLE_OPTIONS, async (request) => {
  const caller = await requireCaller(request);

  const parsed = SubmitMatchScoreInput.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.message);
  }
  const { matchId, scoreA, scoreB } = parsed.data;

  if (scoreA === scoreB) {
    throw new HttpsError("invalid-argument", "Ladder matches cannot tie.");
  }

  const db = getFirestore();
  const matchRef = db.doc(`${COLLECTIONS.ladderMatches}/${matchId}`);

  const txResult = await db.runTransaction(async (tx) => {
    const matchSnap = await tx.get(matchRef);
    if (!matchSnap.exists) {
      throw new HttpsError("not-found", `Match ${matchId} does not exist.`);
    }
    const match = matchSnap.data() as MatchRecord;

    const isParticipant =
      match.sideA.includes(caller.uid) || match.sideB.includes(caller.uid);
    if (!isParticipant && !caller.isSiteAdmin) {
      throw new HttpsError(
        "permission-denied",
        "Only match participants may submit a score.",
      );
    }

    const status = match.status ?? "SCHEDULED";
    if (status !== "SCHEDULED" && status !== "DISPUTED") {
      throw new HttpsError(
        "failed-precondition",
        `Match status ${status} does not accept score submission.`,
      );
    }

    const sessionRef = db.doc(
      `${COLLECTIONS.ladderSessions}/${match.sessionId}`,
    );
    const sessionSnap = await tx.get(sessionRef);
    const targetPoints =
      (sessionSnap.exists
        ? (sessionSnap.data() as SessionRecord).targetPoints
        : undefined) ?? 11;

    const allUserIds = [...match.sideA, ...match.sideB];
    const playerRefs = new Map<string, DocumentReference>();
    const playerSnaps = await Promise.all(
      allUserIds.map((uid) => {
        const ref = db.doc(`${COLLECTIONS.players}/${uid}`);
        playerRefs.set(uid, ref);
        return tx.get(ref);
      }),
    );
    const ratingByUser = new Map<
      string,
      { elo: number; matches: number; existed: boolean; eloPeak: number }
    >();
    playerSnaps.forEach((snap, i) => {
      const uid = allUserIds[i]!;
      if (!snap.exists) {
        ratingByUser.set(uid, {
          elo: STARTING_ELO,
          matches: 0,
          existed: false,
          eloPeak: STARTING_ELO,
        });
      } else {
        const p = snap.data() as PlayerRecord;
        ratingByUser.set(uid, {
          elo: p.elo ?? STARTING_ELO,
          matches: p.stats?.matches ?? 0,
          existed: true,
          eloPeak: p.eloPeak ?? STARTING_ELO,
        });
      }
    });

    const deltas = computeEloDeltas({
      sideA: match.sideA.map((uid) => ({
        userId: uid,
        elo: ratingByUser.get(uid)!.elo,
        matches: ratingByUser.get(uid)!.matches,
      })),
      sideB: match.sideB.map((uid) => ({
        userId: uid,
        elo: ratingByUser.get(uid)!.elo,
        matches: ratingByUser.get(uid)!.matches,
      })),
      scoreA,
      scoreB,
      targetPoints,
    });

    const winnerSide: "A" | "B" = scoreA > scoreB ? "A" : "B";
    const playerWon = (uid: string): boolean =>
      winnerSide === "A"
        ? match.sideA.includes(uid)
        : match.sideB.includes(uid);
    const playerSide = (uid: string): "A" | "B" =>
      match.sideA.includes(uid) ? "A" : "B";
    const partnersOf = (uid: string): string[] => {
      const side = playerSide(uid) === "A" ? match.sideA : match.sideB;
      return side.filter((p) => p !== uid);
    };
    const opponentsOf = (uid: string): string[] =>
      playerSide(uid) === "A" ? match.sideB : match.sideA;
    const pointsForPlayer = (uid: string): number =>
      playerSide(uid) === "A" ? scoreA : scoreB;
    const pointsAgainstPlayer = (uid: string): number =>
      playerSide(uid) === "A" ? scoreB : scoreA;

    const now = Timestamp.now();

    tx.update(matchRef, {
      scoreA,
      scoreB,
      submittedBy: caller.uid,
      submittedAt: now,
      status: "SUBMITTED",
    });

    for (const d of deltas) {
      const ref = playerRefs.get(d.userId)!;
      const rating = ratingByUser.get(d.userId)!;
      const won = playerWon(d.userId) ? 1 : 0;
      const newPeak = Math.max(rating.eloPeak, d.after);

      if (!rating.existed) {
        tx.set(ref, {
          userId: d.userId,
          displayName: d.userId,
          elo: d.after,
          eloPeak: newPeak,
          stats: {
            matches: 1,
            wins: won,
            losses: 1 - won,
            pointsFor: pointsForPlayer(d.userId),
            pointsAgainst: pointsAgainstPlayer(d.userId),
            updatedAt: now,
          },
          createdAt: now,
          updatedAt: now,
        });
      } else {
        tx.update(ref, {
          elo: d.after,
          eloPeak: newPeak,
          "stats.matches": FieldValue.increment(1),
          "stats.wins": FieldValue.increment(won),
          "stats.losses": FieldValue.increment(1 - won),
          "stats.pointsFor": FieldValue.increment(pointsForPlayer(d.userId)),
          "stats.pointsAgainst": FieldValue.increment(
            pointsAgainstPlayer(d.userId),
          ),
          "stats.updatedAt": now,
          updatedAt: now,
        });
      }

      const eventRef = db.collection(COLLECTIONS.eloEvents).doc();
      tx.set(eventRef, {
        playerId: d.userId,
        delta: d.delta,
        eloBefore: d.before,
        eloAfter: d.after,
        source: "ladderMatch",
        sourceId: matchId,
        opponentIds: opponentsOf(d.userId),
        partnerIds: partnersOf(d.userId),
        won: playerWon(d.userId),
        pointsFor: pointsForPlayer(d.userId),
        pointsAgainst: pointsAgainstPlayer(d.userId),
        createdAt: now,
      });
    }

    const auditRef = db.collection(COLLECTIONS.audits).doc();
    tx.set(auditRef, {
      kind: "MATCH_SCORE_SUBMITTED",
      targetId: matchId,
      targetKind: "match",
      actorId: caller.uid,
      payload: { scoreA, scoreB, sessionId: match.sessionId },
      createdAt: now,
    });

    return {
      sideA: match.sideA,
      sideB: match.sideB,
      gameNumber: match.gameNumber ?? 0,
    };
  });

  // Notifications happen post-transaction so they don't bloat the tx.
  // Best-effort; failures here do not roll back the score.
  const submitterOnSideA = txResult.sideA.includes(caller.uid);
  const opposingSide = submitterOnSideA ? txResult.sideB : txResult.sideA;
  const db2 = getFirestore();
  await Promise.allSettled(
    opposingSide.map((uid) =>
      db2.collection(COLLECTIONS.notifications).add({
        userId: uid,
        title: "Score submitted — verify now",
        body: `Game ${txResult.gameNumber} score: ${scoreA}–${scoreB}. Tap to confirm or dispute.`,
        kind: "SCORE_SUBMITTED",
        href: "/dashboard",
        read: false,
        createdBy: caller.uid,
        createdAt: FieldValue.serverTimestamp(),
      }),
    ),
  );

  sendPushToMany(opposingSide, "Score submitted — verify now", `Game ${txResult.gameNumber} score: ${scoreA}–${scoreB}. Tap to confirm or dispute.`, "/dashboard").catch((err) => console.error("[submitMatchScore] push failed:", err));

  return { matchId, status: "SUBMITTED" as const };
});
