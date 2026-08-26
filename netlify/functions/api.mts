// Netlify Functions entry point.
//
// Netlify v2 functions already speak the Web Request/Response shape, so this is
// a pure pass-through to the vendor-neutral handler. Any other host needs an
// equally thin file:
//
//   Deno Deploy       Deno.serve(handleCommandRequest)
//   Cloudflare Worker export default { fetch: handleCommandRequest }
//   Node / container  functions/src/server/node.ts (already in the repo)
//
// Required environment variable on the host:
//   FIREBASE_SERVICE_ACCOUNT  the service account JSON, as one line
// Optional:
//   ALLOWED_ORIGINS           comma-separated CORS allowlist
//
// The config path below strips the /api prefix from the command name lookup by
// keeping the command as the last path segment, which is what the handler reads.

import { handleCommandRequest } from "../../functions/src/server/handler";

export default async (request: Request): Promise<Response> =>
  handleCommandRequest(request);

export const config = {
  path: "/api/:command",
};
