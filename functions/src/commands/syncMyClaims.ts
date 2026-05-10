import { onCall } from "firebase-functions/v2/https";
import { requireCaller } from "../lib/auth";
import { SECURE_CALLABLE_OPTIONS } from "../lib/secureCallable";
import { syncRoleArtifacts } from "../lib/roles";

/**
 * Idempotent self-service: recomputes the caller's effective legacy role
 * from their userRoles documents and writes the matching custom claim and
 * users.role mirror. Useful after a role assignment so the affected user
 * can refresh their permissions without waiting for token auto-refresh.
 *
 * Client should call await user.getIdToken(true) afterwards to pull the
 * new claim into the active session.
 */
export const syncMyClaims = onCall(SECURE_CALLABLE_OPTIONS, async (request) => {
  const caller = await requireCaller(request);
  const effective = await syncRoleArtifacts(caller.uid);
  return { effectiveLegacyRole: effective };
});
