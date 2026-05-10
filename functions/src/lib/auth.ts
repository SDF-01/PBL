import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "./collections";

export interface CallerContext {
  uid: string;
  legacyRole: string | null;
  isSiteAdmin: boolean;
}

/**
 * Resolves the calling user. Throws unauthenticated if no auth, otherwise
 * loads the legacy users/{uid}.role for backward-compatible authorization.
 *
 * Future: replace this with custom-claims-only checks once the claim
 * provisioning callable lands (Track A2 in the roadmap).
 */
export async function requireCaller(
  request: CallableRequest<unknown>,
): Promise<CallerContext> {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign-in is required.");
  }

  const claimRole = request.auth?.token?.role;
  if (typeof claimRole === "string" && claimRole === "SITE_ADMIN") {
    return { uid, legacyRole: claimRole, isSiteAdmin: true };
  }

  const userSnap = await getFirestore().doc(`${COLLECTIONS.users}/${uid}`).get();
  const legacyRole = userSnap.exists
    ? ((userSnap.data() as { role?: string }).role ?? null)
    : null;

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
