import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireCaller } from "../lib/auth";
import { COLLECTIONS } from "../lib/collections";
import { SECURE_CALLABLE_OPTIONS } from "../lib/secureCallable";
import { requireSessionScope } from "../lib/scope";
import { FinalizeSessionInput } from "../schemas/session";

interface SessionRecord {
  status?: string;
}

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
 * Atomically finalize a ladder session.
 *
 * One batch updates the session status, persists the standings snapshot,
 * patches each affected player's cumulative stats, and writes the audit
 * row. Status is set last so a partial failure leaves the session NOT
 * finalized rather than finalized-but-missing-snapshot.
 */
export const finalizeSession = onCall(SECURE_CALLABLE_OPTIONS, async (request) => {
  const caller = await requireCaller(request);
  if (!callerIsStaff(caller)) {
    throw new HttpsError(
      "permission-denied",
      "Staff role required to finalize a session.",
    );
  }

  const parsed = FinalizeSessionInput.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.message);
  }
  const { sessionId, standingsSnapshot, updatedPlayerStats } = parsed.data;

  // Staff claim is not scope-aware. Re-resolve the session's owning league
  // and require the caller has a director/coordinator role for that scope.
  await requireSessionScope(caller.uid, caller.isSiteAdmin, sessionId);

  const db = getFirestore();

  // Idempotency check + state guard outside the batch (a single read).
  const sessionRef = db.doc(`${COLLECTIONS.ladderSessions}/${sessionId}`);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    throw new HttpsError("not-found", `Session ${sessionId} does not exist.`);
  }
  const sessionStatus = (sessionSnap.data() as SessionRecord).status;
  if (sessionStatus === "FINALIZED") {
    return { sessionId, status: "already-finalized" as const };
  }

  const playerIds = Object.keys(updatedPlayerStats);
  // 1 session + 1 snapshot + N players + 1 audit. Cap defensively at 500.
  if (playerIds.length > 495) {
    throw new HttpsError(
      "out-of-range",
      `Cannot finalize: too many players (${playerIds.length}); chunking required.`,
    );
  }

  // Restrict updatedPlayerStats to players actually assigned to a court in
  // this session. Otherwise a coordinator could pass arbitrary player IDs in
  // the patch map and overwrite stats for players outside the session.
  const courtsSnap = await db
    .collection(COLLECTIONS.ladderCourts)
    .where("sessionId", "==", sessionId)
    .get();
  const sessionParticipants = new Set<string>();
  for (const courtDoc of courtsSnap.docs) {
    const ids = (courtDoc.data() as { playerIds?: string[] }).playerIds;
    if (Array.isArray(ids)) {
      for (const id of ids) sessionParticipants.add(id);
    }
  }
  for (const playerId of playerIds) {
    if (!sessionParticipants.has(playerId)) {
      throw new HttpsError(
        "permission-denied",
        `Player ${playerId} is not part of session ${sessionId}.`,
      );
    }
  }

  const batch = db.batch();
  const now = Timestamp.now();

  // Persist snapshot first (so a partial failure doesn't leave session
  // FINALIZED without the snapshot).
  const snapshotRef = db.doc(
    `${COLLECTIONS.standingsSnapshots}/${standingsSnapshot.id}`,
  );
  batch.set(snapshotRef, {
    ...stripUndefined(standingsSnapshot),
    createdAt: now,
  });

  for (const [playerId, stats] of Object.entries(updatedPlayerStats)) {
    batch.update(db.doc(`${COLLECTIONS.players}/${playerId}`), {
      stats: stripUndefined(stats),
      updatedAt: now,
    });
  }

  const auditRef = db.collection(COLLECTIONS.audits).doc();
  batch.set(auditRef, {
    kind: "SESSION_FINALIZED",
    targetId: sessionId,
    targetKind: "session",
    actorId: caller.uid,
    payload: { playersAffected: playerIds.length },
    createdAt: now,
  });

  // Set status LAST in the batch so it commits in one atomic step alongside
  // the snapshot/player/audit writes.
  batch.update(sessionRef, {
    status: "FINALIZED",
    finalizedAt: FieldValue.serverTimestamp(),
    finalizedBy: caller.uid,
  });

  await batch.commit();

  return { sessionId, status: "finalized" as const };
});
