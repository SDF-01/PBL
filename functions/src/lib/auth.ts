import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

export interface CallerContext {
  uid: string;
  legacyRole: string | null;
  isSiteAdmin: boolean;
}

/**
 * Resolves the calling user's authority from their Firebase Auth custom claim.
 *
 * Authority comes exclusively from `request.auth.token.role`, which is the
 * same source firestore.rules trusts. users/{uid}.role is deliberately NOT
 * consulted: it is a UI cache mirrored by syncRoleArtifacts, it lives in a
 * client-readable document, and honouring it here would let the Functions
 * layer grant privileges that the rules layer would refuse — the two must
 * agree or the security model has a seam in it.
 *
 * A user whose claim is missing resolves to PLAYER-level authority. To
 * provision a claim, call the syncMyClaims callable (recomputes from
 * userRoles), or scripts/grant-site-admin.ts for the very first site admin.
 * Either way the affected user must refresh their ID token —
 * getIdToken(true) — before the new claim is active in their session.
 *
 * Declared async so the 14 existing `await requireCaller(request)` call sites
 * keep working, and so a future claim-lookup that does need IO can slot in
 * without touching every command.
 */
export async function requireCaller(
  request: CallableRequest<unknown>,
): Promise<CallerContext> {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign-in is required.");
  }

  const claimRole = request.auth?.token?.role;
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
