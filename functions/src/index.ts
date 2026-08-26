// Cloud Functions adapter.
//
// This entry point exists so the command layer can go back to Cloud Functions
// the moment the project is on the Blaze plan, with no change to any command.
// While the project is on Spark, functions cannot deploy at all and the HTTP
// adapter in src/server/ serves the same commands from a free host instead.
//
// Nothing here contains business logic — it maps the Cloud Functions request
// shape onto a CallerContext and maps our transport-agnostic HttpsError back
// onto the firebase-functions one.

import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, HttpsError as FunctionsHttpsError } from "firebase-functions/v2/https";

import { callerFromClaim } from "./lib/auth";
import { isHttpsError } from "./lib/errors";
import { SECURE_CALLABLE_OPTIONS } from "./lib/secureCallable";
import { COMMANDS, type CommandHandler, type CommandName } from "./registry";

initializeApp();

setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
});

/** Wraps a command as a callable, translating auth and error representations. */
function callable(handler: CommandHandler) {
  return onCall(SECURE_CALLABLE_OPTIONS, async (request) => {
    const caller = callerFromClaim(
      request.auth?.uid,
      request.auth?.token?.role,
    );
    try {
      return await handler(caller, request.data);
    } catch (e) {
      if (isHttpsError(e)) {
        // Same code strings on both sides, so this is a straight re-throw
        // into the wire type the callable protocol expects.
        throw new FunctionsHttpsError(e.code, e.message, e.details);
      }
      throw e;
    }
  });
}

// Exported names must match the keys in COMMANDS so the deployed callable
// names stay identical to what the client already calls.
export const approveClub = callable(COMMANDS.approveClub);
export const rejectClub = callable(COMMANDS.rejectClub);
export const notifyAdminsOfClubSubmission = callable(
  COMMANDS.notifyAdminsOfClubSubmission,
);
export const assignRole = callable(COMMANDS.assignRole);
export const deactivateUserRole = callable(COMMANDS.deactivateUserRole);
export const setUserGlobalRole = callable(COMMANDS.setUserGlobalRole);
export const syncMyClaims = callable(COMMANDS.syncMyClaims);
export const submitMatchScore = callable(COMMANDS.submitMatchScore);
export const verifyMatchScore = callable(COMMANDS.verifyMatchScore);
export const disputeMatch = callable(COMMANDS.disputeMatch);
export const adminAssignMatchResult = callable(COMMANDS.adminAssignMatchResult);
export const persistGeneratedSession = callable(
  COMMANDS.persistGeneratedSession,
);
export const finalizeSession = callable(COMMANDS.finalizeSession);

// Compile-time assertion that every registered command is exported above.
// If a command is added to the registry and not wired here, this errors.
type ExportedName =
  | "approveClub"
  | "rejectClub"
  | "notifyAdminsOfClubSubmission"
  | "assignRole"
  | "deactivateUserRole"
  | "setUserGlobalRole"
  | "syncMyClaims"
  | "submitMatchScore"
  | "verifyMatchScore"
  | "disputeMatch"
  | "adminAssignMatchResult"
  | "persistGeneratedSession"
  | "finalizeSession";
type _AllCommandsExported = CommandName extends ExportedName ? true : never;
const _assertAllExported: _AllCommandsExported = true;
void _assertAllExported;
