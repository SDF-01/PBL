import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { requireCaller } from "../lib/auth";
import { COLLECTIONS } from "../lib/collections";
import { SECURE_CALLABLE_OPTIONS } from "../lib/secureCallable";
import { VerifyMatchScoreInput } from "../schemas/match";

interface MatchRecord {
  sideA: string[];
  sideB: string[];
  status?: string;
  submittedBy?: string;
}

export const verifyMatchScore = onCall(SECURE_CALLABLE_OPTIONS, async (request) => {
  const caller = await requireCaller(request);

  const parsed = VerifyMatchScoreInput.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.message);
  }
  const { matchId } = parsed.data;

  const db = getFirestore();
  const matchRef = db.doc(`${COLLECTIONS.ladderMatches}/${matchId}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(matchRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", `Match ${matchId} does not exist.`);
    }
    const match = snap.data() as MatchRecord;

    if (match.status === "VERIFIED") {
      return; // idempotent
    }
    if (match.status !== "SUBMITTED") {
      throw new HttpsError(
        "failed-precondition",
        `Match status ${match.status ?? "?"} cannot be verified.`,
      );
    }

    const submitterOnSideA = match.submittedBy
      ? match.sideA.includes(match.submittedBy)
      : false;
    const allowedVerifiers = submitterOnSideA ? match.sideB : match.sideA;

    const isOpposingParticipant = allowedVerifiers.includes(caller.uid);
    if (!isOpposingParticipant && !caller.isSiteAdmin) {
      throw new HttpsError(
        "permission-denied",
        "Only the opposing side may verify this score.",
      );
    }

    const now = Timestamp.now();
    tx.update(matchRef, {
      verifiedBy: caller.uid,
      verifiedAt: now,
      status: "VERIFIED",
    });

    const auditRef = db.collection(COLLECTIONS.audits).doc();
    tx.set(auditRef, {
      kind: "MATCH_VERIFIED",
      targetId: matchId,
      targetKind: "match",
      actorId: caller.uid,
      createdAt: now,
    });
  });

  return { matchId, status: "VERIFIED" as const };
});
