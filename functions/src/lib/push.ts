import { getMessaging } from "firebase-admin/messaging";
import { getFirestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "./collections";

interface FcmTokenDoc {
  userId: string;
  token: string;
}

/** Send a push notification to all registered devices for a single user. Best-effort. */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  href?: string,
): Promise<void> {
  const db = getFirestore();
  const snap = await db
    .collection(COLLECTIONS.fcmTokens)
    .where("userId", "==", userId)
    .get();

  if (snap.empty) return;

  const tokens = snap.docs.map((d) => (d.data() as FcmTokenDoc).token);

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    ...(href ? { webpush: { fcmOptions: { link: href } } } : {}),
  });

  // Remove stale tokens that Firebase rejected.
  const staleDeletes = response.responses
    .map((r, i) => (r.success ? null : snap.docs[i].ref))
    .filter(Boolean) as FirebaseFirestore.DocumentReference[];

  await Promise.allSettled(staleDeletes.map((ref) => ref.delete()));
}

/** Send a push notification to multiple users. Best-effort per user. */
export async function sendPushToMany(
  userIds: string[],
  title: string,
  body: string,
  href?: string,
): Promise<void> {
  await Promise.allSettled(userIds.map((id) => sendPushToUser(id, title, body, href)));
}
