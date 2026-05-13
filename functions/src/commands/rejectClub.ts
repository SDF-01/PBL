import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireCaller, requireSiteAdmin } from "../lib/auth";
import { COLLECTIONS } from "../lib/collections";
import { SECURE_CALLABLE_OPTIONS } from "../lib/secureCallable";
import { RejectClubInput } from "../schemas/club";
import { sendPushToUser } from "../lib/push";

export const rejectClub = onCall(SECURE_CALLABLE_OPTIONS, async (request) => {
  const caller = await requireCaller(request);
  requireSiteAdmin(caller);

  const parsed = RejectClubInput.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.message);
  }
  const { clubId, creatorUserId, notes } = parsed.data;

  const db = getFirestore();

  const clubRef = db.doc(`${COLLECTIONS.clubs}/${clubId}`);
  const [clubSnap, provisionalSnap] = await Promise.all([
    clubRef.get(),
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
  if (clubData.status === "rejected") {
    return { clubId, status: "already-rejected" as const };
  }
  if (clubData.createdBy !== creatorUserId) {
    throw new HttpsError(
      "failed-precondition",
      "creatorUserId does not match clubs.createdBy.",
    );
  }

  const batch = db.batch();
  const now = Timestamp.now();

  batch.update(clubRef, {
    status: "rejected",
    updatedAt: now,
  });

  for (const d of provisionalSnap.docs) {
    batch.update(d.ref, { active: false });
  }

  const eventRef = db.collection(COLLECTIONS.roleEvents).doc();
  batch.set(eventRef, {
    userId: creatorUserId,
    clubId,
    leagueId: null,
    eventType: "ClubRejected",
    oldRoleId: "ClubCreatorProvisional",
    newRoleId: null,
    eventTimestamp: now,
    notes,
    actorId: caller.uid,
  });

  const notifRef = db.collection(COLLECTIONS.notifications).doc();
  batch.set(notifRef, {
    userId: creatorUserId,
    title: "Club Not Approved",
    body: "Your club proposal was not approved. You remain a Player.",
    href: "/clubs/my",
    kind: "GENERAL",
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: caller.uid,
  });

  await batch.commit();

  sendPushToUser(creatorUserId, "Club Not Approved", "Your club proposal was not approved. You remain a Player.", "/clubs/my").catch(() => {});

  return { clubId, status: "rejected" as const };
});
