export const TRUSTED_BACKEND_REQUIRED_MESSAGE =
  "This action now requires a trusted backend function before it can run safely.";

export function trustedBackendRequired(action: string): void {
  throw new Error(`${TRUSTED_BACKEND_REQUIRED_MESSAGE} Action: ${action}.`);
}
