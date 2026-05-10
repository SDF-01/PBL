"use client";

// Firebase App Check — proves to Firebase backends that requests come from
// the legitimate app (and not from a script, bot, or stolen API key). Once
// enforced server-side (callables use enforceAppCheck: true), every Firebase
// product call must carry a valid attestation token.
//
// Provider: reCAPTCHA Enterprise (Google's bot-detection ML, low friction
// for end users — no UI puzzle in the happy path).
//
// Local dev: set NEXT_PUBLIC_APPCHECK_DEBUG=true to mint a debug token.
// The Firebase SDK prints the debug token to the browser console on first
// load; paste it into Firebase Console → App Check → Apps → ⋯ → Manage
// debug tokens. After that, every request from this browser is accepted
// for ~1 day per the console TTL.

import { getFirebaseApp, isFirebaseConfigured } from "@/lib/firebase";

let initialized = false;

export async function initAppCheck(): Promise<void> {
  if (initialized) return;
  if (typeof window === "undefined") return;
  if (!isFirebaseConfigured()) return;

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const debugMode = process.env.NEXT_PUBLIC_APPCHECK_DEBUG === "true";

  if (!siteKey && !debugMode) {
    // Nothing to do — App Check is opt-in via env. Without a site key or
    // a debug-mode flag, we silently skip so dev preview environments
    // without a configured key still work.
    return;
  }

  if (debugMode) {
    // Must be set BEFORE initializeAppCheck. Triggers debug-token output
    // in the console on the next App Check call.
    (
      self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }
    ).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import(
    "firebase/app-check"
  );

  // ReCaptchaEnterpriseProvider requires a site key even when debug mode
  // is on — the SDK ignores it in favor of the debug token at request
  // time, but the provider constructor still validates the argument.
  const provider = new ReCaptchaEnterpriseProvider(
    siteKey ?? "00000000000000000000000000000000000000000",
  );

  initializeAppCheck(getFirebaseApp(), {
    provider,
    isTokenAutoRefreshEnabled: true,
  });

  initialized = true;
}
