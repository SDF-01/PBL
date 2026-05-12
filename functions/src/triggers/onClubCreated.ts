import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "../lib/collections";

export const onClubCreated = onDocumentCreated(
  `${COLLECTIONS.clubs}/{clubId}`,
  async (event) => {
    const data = event.data?.data();
    if (!data || data.status !== "pending") return;

    const db = getFirestore();

    const adminsSnap = await db
      .collection(COLLECTIONS.users)
      .where("role", "==", "SITE_ADMIN")
      .get();

    if (adminsSnap.empty) return;

    const batch = db.batch();
    for (const adminDoc of adminsSnap.docs) {
      const notifRef = db.collection(COLLECTIONS.notifications).doc();
      batch.set(notifRef, {
        userId: adminDoc.id,
        title: "New Club Submission",
        body: `"${data.clubName as string}" has been submitted for review.`,
        href: "/admin/clubs",
        kind: "GENERAL",
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: data.createdBy as string,
      });
    }

    await batch.commit();
  },
);
