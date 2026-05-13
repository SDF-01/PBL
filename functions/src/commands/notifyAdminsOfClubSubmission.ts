import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireCaller } from "../lib/auth";
import { COLLECTIONS } from "../lib/collections";
import { SECURE_CALLABLE_OPTIONS } from "../lib/secureCallable";
import { sendPushToMany } from "../lib/push";

const Input = z.object({
  clubId: z.string().min(1),
  clubName: z.string().min(1),
});

export const notifyAdminsOfClubSubmission = onCall(
  SECURE_CALLABLE_OPTIONS,
  async (request) => {
    const caller = await requireCaller(request);

    const parsed = Input.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", parsed.error.message);
    }
    const { clubId, clubName } = parsed.data;

    const db = getFirestore();

    const clubSnap = await db.doc(`${COLLECTIONS.clubs}/${clubId}`).get();
    if (!clubSnap.exists) {
      throw new HttpsError("not-found", `Club ${clubId} does not exist.`);
    }
    if (clubSnap.data()?.createdBy !== caller.uid) {
      throw new HttpsError("permission-denied", "You did not submit this club.");
    }

    const adminsSnap = await db
      .collection(COLLECTIONS.users)
      .where("role", "==", "SITE_ADMIN")
      .get();

    if (adminsSnap.empty) return { notified: 0 };

    const batch = db.batch();
    for (const adminDoc of adminsSnap.docs) {
      const notifRef = db.collection(COLLECTIONS.notifications).doc();
      batch.set(notifRef, {
        userId: adminDoc.id,
        title: "New Club Submission",
        body: `"${clubName}" has been submitted for review.`,
        href: "/admin/clubs",
        kind: "GENERAL",
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: caller.uid,
      });
    }

    await batch.commit();

    const adminIds = adminsSnap.docs.map((d) => d.id);
    sendPushToMany(adminIds, "New Club Submission", `"${clubName}" has been submitted for review.`, "/admin/clubs").catch(() => {});

    return { notified: adminsSnap.size };
  },
);
