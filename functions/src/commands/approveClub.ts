import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireCaller, requireSiteAdmin } from "../lib/auth";
import { COLLECTIONS } from "../lib/collections";
import { SECURE_CALLABLE_OPTIONS } from "../lib/secureCallable";
import { ApproveClubInput } from "../schemas/club";

const LEGACY_ROLE_RANK: Record<string, number> = {
  SITE_ADMIN: 4,
  CLUB_ADMIN: 3,
  LEAGUE_COORDINATOR: 2,
  PLAYER: 1,
};

function outranks(newRole: string, currentRole: string | null | undefined): boolean {
  return (LEGACY_ROLE_RANK[newRole] ?? 0) > (LEGACY_ROLE_RANK[currentRole ?? ""] ?? 0);
}

export const approveClub = onCall(SECURE_CALLABLE_OPTIONS, async (request) => {
  const caller = await requireCaller(request);
  requireSiteAdmin(caller);

  const parsed = ApproveClubInput.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.message);
  }
  const { clubId, creatorUserId } = parsed.data;

  const db = getFirestore();

  const clubRef = db.doc(`${COLLECTIONS.clubs}/${clubId}`);
  const creatorRef = db.doc(`${COLLECTIONS.users}/${creatorUserId}`);

  const [clubSnap, creatorSnap, provisionalSnap] = await Promise.all([
    clubRef.get(),
    creatorRef.get(),
    db
      .collection(COLLECTIONS.userRoles)
      .where("userId", "==", creatorUserId)
      .where("roleId", "==", "ClubCreatorProvisional")
      .where("clubId", "==", clubId)
      .where("active", "==", true)
      .get(),
  ]);

  if (!clubSnap.exists) {
    throw new HttpsError("not-found", `Club ${clubId} does not exist.`);
  }
  const clubData = clubSnap.data() as { status?: string; createdBy?: string };
  if (clubData.status === "approved") {
    // Idempotent: already approved is a no-op success.
    return { clubId, status: "already-approved" as const };
  }
  if (clubData.createdBy !== creatorUserId) {
    throw new HttpsError(
      "failed-precondition",
      "creatorUserId does not match clubs.createdBy.",
    );
  }

  const creatorCurrentRole = creatorSnap.exists
    ? ((creatorSnap.data() as { role?: string }).role ?? null)
    : null;

  const batch = db.batch();
  const now = Timestamp.now();

  batch.update(clubRef, {
    status: "approved",
    updatedAt: now,
  });

  for (const d of provisionalSnap.docs) {
    batch.update(d.ref, { active: false });
  }

  const directorRef = db.collection(COLLECTIONS.userRoles).doc();
  batch.set(directorRef, {
    userId: creatorUserId,
    roleId: "ClubDirector",
    clubId,
    leagueId: null,
    assignedAt: now,
    assignedBy: caller.uid,
    active: true,
  });

  if (outranks("CLUB_ADMIN", creatorCurrentRole)) {
    batch.update(creatorRef, {
      role: "CLUB_ADMIN",
      updatedAt: now,
    });
  }

  const eventRef = db.collection(COLLECTIONS.roleEvents).doc();
  batch.set(eventRef, {
    userId: creatorUserId,
    clubId,
    leagueId: null,
    eventType: "ClubApproved",
    oldRoleId: "ClubCreatorProvisional",
    newRoleId: "ClubDirector",
    eventTimestamp: now,
    notes: "Club approval promoted user to ClubDirector.",
    actorId: caller.uid,
  });

  const notifRef = db.collection(COLLECTIONS.notifications).doc();
  batch.set(notifRef, {
    userId: creatorUserId,
    title: "Club Approved",
    body: "Your club has been approved. You are now a Club Director.",
    href: "/clubs/my",
    kind: "GENERAL",
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: caller.uid,
  });

  await batch.commit();

  return { clubId, status: "approved" as const };
});
