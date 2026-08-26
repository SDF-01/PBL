import type { CallableOptions } from "firebase-functions/v2/https";

/**
 * Shared options for every authenticated callable in this codebase.
 *
 * App Check attests that a request came from the real web/mobile app rather
 * than a script, a scraped API key, or curl. Enforcement is env-gated rather
 * than hardcoded because turning it on before the app is registered in the
 * Firebase Console rejects EVERY callable request:
 *
 *   ENFORCE_APP_CHECK=true  → callables require a valid App Check token
 *   unset / anything else   → tokens are still verified when present,
 *                             but a missing token is not fatal
 *
 * This is a DEPLOY-TIME option: gen-2 callables bake their options into the
 * deployed function, so ENFORCE_APP_CHECK must be set in the environment that
 * runs `firebase deploy` (functions/.env, or the CI job's env block).
 *
 * Rollout order — do not skip step 3, it is the difference between a working
 * enforcement flip and a total outage:
 *   1. Firebase Console → App Check → Apps → register the web app with
 *      reCAPTCHA Enterprise; copy the site key.
 *   2. Set NEXT_PUBLIC_RECAPTCHA_SITE_KEY for the web build (see .env.example
 *      and .github/workflows/deploy.yml) so src/lib/appcheck.ts mints tokens.
 *   3. Watch Console → App Check → Metrics until verified requests appear and
 *      the "unverified" count is ~0. That proves real clients are attesting.
 *   4. Set ENFORCE_APP_CHECK=true and redeploy functions.
 *
 * Override individual options at the call site if a function needs different
 * memory, timeout, or concurrency. Do NOT override enforceAppCheck without an
 * explicit threat-model justification.
 */
export const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === "true";

export const SECURE_CALLABLE_OPTIONS: CallableOptions = {
  enforceAppCheck: ENFORCE_APP_CHECK,
};
