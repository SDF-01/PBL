// Firebase Cloud Messaging service worker.
// Must live at /firebase-messaging-sw.js (root scope).
// This file is loaded by the FCM SDK automatically.
//
// SETUP: Replace the config values below with your project's values
// from the Firebase Console → Project Settings → General → Your apps.
// These must match your NEXT_PUBLIC_FIREBASE_* env vars.

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// ---------------------------------------------------------------------------
// Replace with your actual Firebase config (same values as .env.local).
// These are safe to expose — they are already public in your web app bundle.
// ---------------------------------------------------------------------------
firebase.initializeApp({
  apiKey: self.__FIREBASE_API_KEY__ ?? "",
  authDomain: self.__FIREBASE_AUTH_DOMAIN__ ?? "",
  projectId: self.__FIREBASE_PROJECT_ID__ ?? "",
  storageBucket: self.__FIREBASE_STORAGE_BUCKET__ ?? "",
  messagingSenderId: self.__FIREBASE_MESSAGING_SENDER_ID__ ?? "",
  appId: self.__FIREBASE_APP_ID__ ?? "",
});

const messaging = firebase.messaging();

// Handle background messages — shown as OS-level notifications.
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification ?? {};
  const data = payload.data ?? {};

  self.registration.showNotification(title ?? "PBL Notification", {
    body: body ?? "",
    icon: icon ?? "/favicon.ico",
    badge: "/favicon.ico",
    data: { href: data.href ?? "/" },
  });
});
