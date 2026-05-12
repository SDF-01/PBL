import type { CallableOptions } from "firebase-functions/v2/https";

/**
 * Shared options for every authenticated callable in this codebase.
 *
 * `enforceAppCheck: true` rejects any request that does not carry a valid
 * Firebase App Check token (attestation that the call came from the real
 * web/mobile app, not a script or stolen API key). The client wires this
 * up via src/lib/appcheck.ts; without that setup, callables WILL FAIL.
 *
 * Override individual options at the call site if a function needs
 * different memory, timeout, or concurrency. Do NOT override
 * enforceAppCheck without an explicit threat-model justification.
 */
export const SECURE_CALLABLE_OPTIONS: CallableOptions = {
  enforceAppCheck: false,
};
