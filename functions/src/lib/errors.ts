// Transport-agnostic command errors.
//
// The command layer used to throw firebase-functions' HttpsError directly,
// which chained every command to the Cloud Functions runtime. These commands
// now run in two places — Cloud Functions (when the project is on Blaze) and a
// plain HTTP host (while it is not) — so the shared logic throws this instead
// and each adapter maps it to its own wire format:
//
//   Cloud Functions  -> firebase-functions HttpsError (same code strings)
//   HTTP host        -> JSON body + the HTTP status in STATUS_BY_CODE
//
// The constructor signature deliberately matches firebase-functions' HttpsError
// so command bodies did not have to change when they were ported.

export type CommandErrorCode =
  | "ok"
  | "cancelled"
  | "unknown"
  | "invalid-argument"
  | "deadline-exceeded"
  | "not-found"
  | "already-exists"
  | "permission-denied"
  | "resource-exhausted"
  | "failed-precondition"
  | "aborted"
  | "out-of-range"
  | "unimplemented"
  | "internal"
  | "unavailable"
  | "data-loss"
  | "unauthenticated";

export class HttpsError extends Error {
  readonly code: CommandErrorCode;
  readonly details?: unknown;

  constructor(code: CommandErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "HttpsError";
    this.code = code;
    this.details = details;
    // Required so `instanceof` works after TypeScript downlevels the class.
    Object.setPrototypeOf(this, HttpsError.prototype);
  }
}

/** Maps a command error code to the HTTP status the HTTP adapter returns. */
export const STATUS_BY_CODE: Record<CommandErrorCode, number> = {
  ok: 200,
  cancelled: 499,
  unknown: 500,
  "invalid-argument": 400,
  "deadline-exceeded": 504,
  "not-found": 404,
  "already-exists": 409,
  "permission-denied": 403,
  "resource-exhausted": 429,
  "failed-precondition": 400,
  aborted: 409,
  "out-of-range": 400,
  unimplemented: 501,
  internal: 500,
  unavailable: 503,
  "data-loss": 500,
  unauthenticated: 401,
};

export function isHttpsError(e: unknown): e is HttpsError {
  return e instanceof HttpsError;
}
