"use client";

// Firebase Cloud Messaging — client-side token management.
//
// SETUP REQUIRED:
//   1. In Firebase Console → Project Settings → Cloud Messaging, copy the
//      Web Push certificate (VAPID key) and add it to .env.local:
//        NEXT_PUBLIC_FIREBASE_VAPID_KEY=<your-VAPID-key>
//   2. Fill in firebase config values in /public/firebase-messaging-sw.js.
//   3. To send push notifications server-side, deploy a Firebase Cloud
//      Function that reads fcmTokens/{userId} and calls Firebase Admin SDK.
//
// Without step 3, the token infrastructure is in place but actual push
// delivery to closed/background tabs requires a server trigger.

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db, isFirebaseConfigured, messaging as getMessaging } from "./firebase";
import { COLLECTIONS } from "./firestore/collections";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";

/** Request push permission and register the FCM token for this user. */
export async function registerPushToken(userId: string): Promise<string | null> {
  if (!isFirebaseConfigured() || typeof window === "undefined") return null;
  if (!VAPID_KEY) {
    console.warn("[FCM] NEXT_PUBLIC_FIREBASE_VAPID_KEY not set — push registration skipped.");
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const { getToken } = await import("firebase/messaging");
    const token = await getToken(getMessaging(), {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    });

    if (!token) return null;

    // Store token keyed by userId+token so multiple devices work.
    const docId = `${userId}_${token.slice(-16)}`;
    await setDoc(doc(db(), COLLECTIONS.fcmTokens, docId), {
      userId,
      token,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true });

    return token;
  } catch (err) {
    console.warn("[FCM] Token registration failed:", err);
    return null;
  }
}

/** Remove all FCM tokens for a user (on sign-out). */
export async function clearPushTokens(userId: string): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const snap = await getDocs(
    query(collection(db(), COLLECTIONS.fcmTokens), where("userId", "==", userId)),
  );
  await Promise.allSettled(snap.docs.map((d) => deleteDoc(d.ref)));
}

/** Wire up a foreground message listener — shows a toast instead of an OS notification. */
export async function listenForegroundMessages(
  onMsg: (title: string, body: string, href?: string) => void,
): Promise<() => void> {
  if (!isFirebaseConfigured() || typeof window === "undefined") return () => {};
  const { onMessage } = await import("firebase/messaging");
  const unsub = onMessage(getMessaging(), (payload) => {
    const title = payload.notification?.title ?? "PBL";
    const body = payload.notification?.body ?? "";
    const href = (payload.data as Record<string, string> | undefined)?.href;
    onMsg(title, body, href);
  });
  return unsub;
}
