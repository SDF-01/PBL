// HTTP adapter — serves the same commands as the Cloud Functions adapter, from
// any host that can run Node and hand us a standard Request/Response.
//
// This exists because Cloud Functions require the Blaze plan and the project is
// currently on Spark. The wire protocol is deliberately simple:
//
//   POST <base>/<commandName>
//   Authorization: Bearer <Firebase ID token>
//   Content-Type: application/json
//   body: the command's input object (not wrapped)
//
//   200 -> the command's return value as JSON
//   4xx/5xx -> { "error": { "code": <CommandErrorCode>, "message": string } }
//
// Authority still comes from the ID token's `role` custom claim, exactly as it
// does in Cloud Functions and firestore.rules. Nothing about the security model
// changes by moving hosts — only the transport does.

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { callerFromClaim } from "../lib/auth";
import { HttpsError, STATUS_BY_CODE, isHttpsError } from "../lib/errors";
import { COMMANDS, isCommandName } from "../registry";

/**
 * Origins allowed to call this service. The static site is served from Firebase
 * Hosting, so the browser treats these as cross-origin and will preflight.
 * Override with ALLOWED_ORIGINS (comma-separated) when adding a custom domain.
 */
function allowedOrigins(): string[] {
  const configured = process.env.ALLOWED_ORIGINS;
  if (configured) {
    return configured.split(",").map((o) => o.trim()).filter(Boolean);
  }
  return [
    "https://pickleleauge.web.app",
    "https://pickleleauge.firebaseapp.com",
    "http://localhost:3000",
  ];
}

let initialized = false;

/**
 * Initializes the Admin SDK from a service account in the environment.
 *
 * preferRest keeps Firestore on HTTP/1.1 REST rather than gRPC. On Cloud
 * Functions gRPC is fine, but several free hosts either lack HTTP/2 outbound or
 * handle long-lived gRPC channels badly in a short-lived function invocation.
 * REST costs a little latency and removes a whole class of host-compat failure.
 */
function ensureInitialized(): void {
  if (initialized || getApps().length > 0) {
    initialized = true;
    return;
  }
  // Misconfiguration detail goes to the host's logs, never to the caller —
  // an anonymous request should not be able to probe our env setup.
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error("FIREBASE_SERVICE_ACCOUNT is not set on this host.");
    throw new HttpsError("internal", "Service is not configured.");
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.error("FIREBASE_SERVICE_ACCOUNT is not valid JSON.");
    throw new HttpsError("internal", "Service is not configured.");
  }
  initializeApp({ credential: cert(parsed as never) });
  getFirestore().settings({ preferRest: true });
  initialized = true;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = allowedOrigins();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "3600",
    Vary: "Origin",
  };
  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(
  body: unknown,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function errorResponse(e: unknown, origin: string | null): Response {
  if (isHttpsError(e)) {
    return json(
      { error: { code: e.code, message: e.message } },
      STATUS_BY_CODE[e.code],
      origin,
    );
  }
  // Never leak an unexpected stack to the client; the host's logs keep it.
  console.error("Unhandled command error:", e);
  return json(
    { error: { code: "internal", message: "Internal error." } },
    500,
    origin,
  );
}

/** Extracts and verifies the caller's Firebase ID token. */
async function resolveCaller(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer (.+)$/i.exec(header.trim());
  if (!match || !match[1]) {
    throw new HttpsError("unauthenticated", "Sign-in is required.");
  }
  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(match[1]);
  } catch {
    throw new HttpsError("unauthenticated", "Invalid or expired session.");
  }
  return callerFromClaim(decoded.uid, decoded.role);
}

/**
 * The whole service as one function. Host entry points are thin wrappers that
 * hand this a Request and return its Response, so switching hosts never
 * touches command logic.
 */
export async function handleCommandRequest(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  // Unauthenticated liveness probe — useful for host health checks.
  const name = new URL(request.url).pathname.split("/").filter(Boolean).pop() ?? "";
  if (request.method === "GET" && name === "health") {
    return json({ ok: true, commands: Object.keys(COMMANDS).length }, 200, origin);
  }

  if (request.method !== "POST") {
    return errorResponse(
      new HttpsError("invalid-argument", "Use POST."),
      origin,
    );
  }

  try {
    ensureInitialized();

    // Authenticate before anything else. Resolving the command name first would
    // let an anonymous caller enumerate which commands exist by comparing 404
    // against 401.
    const caller = await resolveCaller(request);

    if (!isCommandName(name)) {
      throw new HttpsError("not-found", `Unknown command "${name}".`);
    }

    let data: unknown = undefined;
    const body = await request.text();
    if (body.length > 0) {
      try {
        data = JSON.parse(body);
      } catch {
        throw new HttpsError("invalid-argument", "Body must be valid JSON.");
      }
    }

    const result = await COMMANDS[name](caller, data);
    return json(result ?? null, 200, origin);
  } catch (e) {
    return errorResponse(e, origin);
  }
}
