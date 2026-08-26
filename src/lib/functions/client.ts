"use client";

// Transport for the privileged command layer.
//
// This used to be firebase/functions httpsCallable. Cloud Functions require the
// Blaze plan, so while the project is on Spark the same commands are served
// over plain HTTPS from a free host (see functions/src/server/). The security
// model is unchanged: every request carries the caller's Firebase ID token and
// authority still comes from its `role` custom claim, exactly as
// firestore.rules enforces.
//
// To move back to Cloud Functions, point NEXT_PUBLIC_COMMANDS_BASE_URL at
// nothing and restore the httpsCallable implementation — the command names and
// payloads are identical on both transports by design.

import { auth, isFirebaseConfigured } from "@/lib/firebase";

/** Mirrors the server's CommandErrorCode so callers can branch on it. */
export type CommandErrorCode =
  | "invalid-argument"
  | "not-found"
  | "already-exists"
  | "permission-denied"
  | "failed-precondition"
  | "unauthenticated"
  | "internal"
  | "unavailable";

export class CommandError extends Error {
  readonly code: CommandErrorCode;
  constructor(code: CommandErrorCode, message: string) {
    super(message);
    this.name = "CommandError";
    this.code = code;
    Object.setPrototypeOf(this, CommandError.prototype);
  }
}

function baseUrl(): string {
  const url = process.env.NEXT_PUBLIC_COMMANDS_BASE_URL;
  if (!url) {
    throw new CommandError(
      "unavailable",
      "Command service is not configured. Set NEXT_PUBLIC_COMMANDS_BASE_URL.",
    );
  }
  return url.replace(/\/+$/, "");
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

/**
 * Calls one privileged command. Resolves with the command's return value, or
 * throws a CommandError carrying the server's code and message.
 */
export async function callCommand<TResult>(
  name: string,
  input?: unknown,
): Promise<TResult> {
  if (!isFirebaseConfigured()) {
    throw new CommandError("unavailable", "Firebase is not configured.");
  }

  const user = auth().currentUser;
  if (!user) {
    throw new CommandError("unauthenticated", "Sign-in is required.");
  }
  const token = await user.getIdToken();

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input ?? {}),
    });
  } catch {
    // Network-level failure: offline, DNS, CORS rejection, host asleep.
    throw new CommandError(
      "unavailable",
      "Could not reach the command service. Check your connection and try again.",
    );
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    const body = (parsed ?? {}) as ErrorBody;
    const code = (body.error?.code ?? "internal") as CommandErrorCode;
    const message = body.error?.message ?? `Request failed (${res.status}).`;
    throw new CommandError(code, message);
  }

  return parsed as TResult;
}

/** Format a command error for user-facing toast messages. */
export function formatFunctionsError(err: unknown): string {
  if (err instanceof CommandError) return err.message;
  if (err instanceof Error) return err.message;
  return "Unknown error.";
}
