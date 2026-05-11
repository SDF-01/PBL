import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireCaller } from "../lib/auth";
import { COLLECTIONS } from "../lib/collections";
import { SECURE_CALLABLE_OPTIONS } from "../lib/secureCallable";
import { requirePlayDateScope } from "../lib/scope";
import { PersistGeneratedSessionInput } from "../schemas/session";

function callerIsStaff(caller: { isSiteAdmin: boolean; legacyRole: string | null }): boolean {
  return (
    caller.isSiteAdmin ||
    caller.legacyRole === "CLUB_ADMIN" ||
    caller.legacyRole === "LEAGUE_COORDINATOR"
  );
}

function stripUndefined<T extends Record<string, unknown>>(
  obj: T,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  );
}

/**
 * Atomically persist a generated session, its courts, and its matches.
 *
 * The single batch (1 session + N courts + M matches + 1 audit) ensures the
 * session never appears with partial courts/matches. Firestore batches max
 * at 500 ops; the schema caps courts at 20 and matches at 200, so the upper
 * bound is well within budget.
 */
export const persistGeneratedSession = onCall(SECURE_CALLABLE_OPTIONS, async (request) => {
  const caller = await requireCaller(request);
  if (!callerIsStaff(caller)) {
    throw new HttpsError(
      "permission-denied",
      "Staff role required to persist a generated session.",
    );
  }

  const parsed = PersistGeneratedSessionInput.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.message);
  }
  const { sessionDoc, courts, matches } = parsed.data;

  // Staff claim is not scope-aware. Resolve the target play date's owning
  // league and require the caller has a director/coordinator role for that
  // scope before allowing a session overwrite.
  await requirePlayDateScope(
    caller.uid,
    caller.isSiteAdmin,
    sessionDoc.playDateId,
  );

  const db = getFirestore();
  const batch = db.batch();
  const now = Timestamp.now();

  const sessionRef = db.doc(`${COLLECTIONS.ladderSessions}/${sessionDoc.id}`);

  // Defense in depth: if the session already exists, require it belongs to
  // the play date the caller just authorized. Otherwise a coordinator for
  // play date X could pass `sessionDoc.id` belonging to play date Y and
  // overwrite a session in another league.
  const existingSession = await sessionRef.get();
  if (existingSession.exists) {
    const existing = existingSession.data() as { playDateId?: string };
    if (existing.playDateId && existing.playDateId !== sessionDoc.playDateId) {
      throw new HttpsError(
        "permission-denied",
        "Session already exists for a different play date.",
      );
    }
  }

  batch.set(sessionRef, {
    ...stripUndefined(sessionDoc),
    generatedBy: caller.uid,
    generatedAt: now,
    status: "GENERATED",
  });

  for (const court of courts) {
    const ref = db.doc(`${COLLECTIONS.ladderCourts}/${court.id}`);
    batch.set(ref, {
      ...court,
      sessionId: sessionDoc.id,
      playDateId: sessionDoc.playDateId,
      status: "active",
      createdAt: now,
    });
  }

  for (const match of matches) {
    const ref = db.doc(`${COLLECTIONS.ladderMatches}/${match.id}`);
    batch.set(ref, {
      ...stripUndefined(match),
      sessionId: sessionDoc.id,
      status: "SCHEDULED",
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  const auditRef = db.collection(COLLECTIONS.audits).doc();
  batch.set(auditRef, {
    kind: "SESSION_GENERATED",
    targetId: sessionDoc.id,
    targetKind: "session",
    actorId: caller.uid,
    payload: {
      kind: (sessionDoc as { kind?: string }).kind,
      courtCount: courts.length,
      playerCount: courts.reduce((sum, c) => sum + c.playerIds.length, 0),
      matchCount: matches.length,
    },
    createdAt: now,
  });

  await batch.commit();

  return {
    sessionId: sessionDoc.id,
    courtCount: courts.length,
    matchCount: matches.length,
  };
});
