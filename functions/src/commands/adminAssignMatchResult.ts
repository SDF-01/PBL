import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { requireCaller } from "../lib/auth";
import { COLLECTIONS } from "../lib/collections";
import { SECURE_CALLABLE_OPTIONS } from "../lib/secureCallable";
import { requireMatchScope } from "../lib/scope";
import { AdminAssignMatchResultInput } from "../schemas/match";

interface MatchRecord {
  status?: string;
}

function callerIsStaff(caller: { isSiteAdmin: boolean; legacyRole: string | null }): boolean {
  return (
    caller.isSiteAdmin ||
    caller.legacyRole === "CLUB_ADMIN" ||
    caller.legacyRole === "LEAGUE_COORDINATOR"
  );
}

export const adminAssignMatchResult = onCall(SECURE_CALLABLE_OPTIONS, async (request) => {
  const caller = await requireCaller(request);
  if (!callerIsStaff(caller)) {
    throw new HttpsError(
      "permission-denied",
      "Staff role required to assign a match result.",
    );
  }

  const parsed = AdminAssignMatchResultInput.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.message);
  }
  const { matchId, scoreA, scoreB } = parsed.data;

  // The legacy staff claim is not scope-aware. A LEAGUE_COORDINATOR for club X
  // must not be able to override a match in club Y, so re-resolve the match's
  // owning league and require the caller has a director/coordinator role
  // scoped to that league or its club.
  await requireMatchScope(caller.uid, caller.isSiteAdmin, matchId);

  if (scoreA === scoreB) {
    throw new HttpsError(
      "invalid-argument",
      "Ladder matches cannot be assigned a tie.",
    );
  }

  const db = getFirestore();
  const matchRef = db.doc(`${COLLECTIONS.ladderMatches}/${matchId}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(matchRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", `Match ${matchId} does not exist.`);
    }
    const match = snap.data() as MatchRecord;

    if (match.status === "VERIFIED") {
      throw new HttpsError(
        "failed-precondition",
        "Match is already verified; cannot admin-override.",
      );
    }

    const now = Timestamp.now();
    tx.update(matchRef, {
      scoreA,
      scoreB,
      adminOverride: {
        assignedBy: caller.uid,
        assignedAt: now,
        reason: "incomplete_match_admin_assignment",
      },
      status: "ADMIN_ASSIGNED",
    });

    const auditRef = db.collection(COLLECTIONS.audits).doc();
    tx.set(auditRef, {
      kind: "MATCH_ADMIN_ASSIGNED",
      targetId: matchId,
      targetKind: "match",
      actorId: caller.uid,
      payload: { scoreA, scoreB },
      createdAt: now,
    });
  });

  return { matchId, status: "ADMIN_ASSIGNED" as const };
});
