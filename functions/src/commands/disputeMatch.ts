import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireCaller } from "../lib/auth";
import { COLLECTIONS } from "../lib/collections";
import { SECURE_CALLABLE_OPTIONS } from "../lib/secureCallable";
import { DisputeMatchInput } from "../schemas/match";

interface MatchRecord {
  sideA: string[];
  sideB: string[];
  status?: string;
  submittedBy?: string;
  sessionId?: string;
}

export const disputeMatch = onCall(SECURE_CALLABLE_OPTIONS, async (request) => {
  const caller = await requireCaller(request);

  const parsed = DisputeMatchInput.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.message);
  }
  const { matchId, reason } = parsed.data;

  const db = getFirestore();
  const matchRef = db.doc(`${COLLECTIONS.ladderMatches}/${matchId}`);

  const submitterUid = await db.runTransaction(async (tx) => {
    const snap = await tx.get(matchRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", `Match ${matchId} does not exist.`);
    }
    const match = snap.data() as MatchRecord;

    const isParticipant =
      match.sideA.includes(caller.uid) || match.sideB.includes(caller.uid);
    if (!isParticipant && !caller.isSiteAdmin) {
      throw new HttpsError(
        "permission-denied",
        "Only match participants may dispute a score.",
      );
    }

    if (match.status !== "SUBMITTED") {
      throw new HttpsError(
        "failed-precondition",
        `Match status ${match.status ?? "?"} cannot be disputed.`,
      );
    }

    const now = Timestamp.now();
    tx.update(matchRef, {
      status: "DISPUTED",
      disputedBy: caller.uid,
      disputedAt: now,
      disputeReason: reason ?? null,
    });

    const auditRef = db.collection(COLLECTIONS.audits).doc();
    tx.set(auditRef, {
      kind: "MATCH_DISPUTED",
      targetId: matchId,
      targetKind: "match",
      actorId: caller.uid,
      payload: { reason: reason ?? null, sessionId: match.sessionId ?? null },
      createdAt: now,
    });

    return match.submittedBy ?? null;
  });

  // Notify the original submitter (post-tx, best-effort).
  if (submitterUid) {
    await db
      .collection(COLLECTIONS.notifications)
      .add({
        userId: submitterUid,
        title: "Score disputed",
        body: reason
          ? `Your submitted score is under review: ${reason}`
          : "Your submitted score is under review.",
        kind: "SCORE_DISPUTED",
        href: "/dashboard",
        read: false,
        createdBy: caller.uid,
        createdAt: FieldValue.serverTimestamp(),
      })
      .catch(() => {
        /* best-effort */
      });
  }

  return { matchId, status: "DISPUTED" as const };
});
