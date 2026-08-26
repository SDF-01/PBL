import { HttpsError } from "./errors";

export interface CallerContext {
  uid: string;
  legacyRole: string | null;
  isSiteAdmin: boolean;
}

/**
 * Builds a caller's authority from their Firebase Auth custom claim.
 *
 * Authority comes exclusively from the `role` claim, which is the same source
 * firestore.rules trusts. users/{uid}.role is deliberately NOT consulted: it is
 * a UI cache mirrored by syncRoleArtifacts, it lives in a client-readable
 * document, and honouring it here would let the command layer grant privileges
 * the rules layer would refuse — the two must agree or the model has a seam.
 *
 * A caller whose claim is missing resolves to PLAYER-level authority. To
 * provision a claim, call syncMyClaims (recomputes from userRoles), or
 * scripts/grant-site-admin.ts for the very first site admin. Either way the
 * user must refresh their ID token — getIdToken(true) — before it takes effect.
 *
 * This is transport-neutral on purpose. Each adapter extracts the uid and claim
 * from its own request shape and calls this:
 *   Cloud Functions -> request.auth.uid / request.auth.token.role
 *   HTTP host       -> verified ID token's uid / role
 */
export function callerFromClaim(
  uid: string | undefined | null,
  claimRole: unknown,
): CallerContext {
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign-in is required.");
  }
  const legacyRole = typeof claimRole === "string" ? claimRole : null;
  return {
    uid,
    legacyRole,
    isSiteAdmin: legacyRole === "SITE_ADMIN",
  };
}

export function requireSiteAdmin(caller: CallerContext): void {
  if (!caller.isSiteAdmin) {
    throw new HttpsError("permission-denied", "Site admin role is required.");
  }
}
