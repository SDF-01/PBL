"use client";

// Typed wrappers for the privileged command layer.
//
// Each wrapper validates its input with the canonical Zod schema before the
// request leaves the browser (the server re-validates with the mirrored copy —
// client validation is for fast feedback, never for trust) and returns the
// command's typed result.
//
// The transport lives in ./client. These names and payloads are identical
// whether the commands are served by Cloud Functions or the HTTP host, so
// switching between them touches no call site.

import { auth } from "@/lib/firebase";
import { callCommand } from "./client";
import { ApproveClubInput, RejectClubInput } from "@/lib/schemas/club";
import {
  AssignRoleInput,
  DeactivateUserRoleInput,
  SetUserGlobalRoleInput,
} from "@/lib/schemas/role";
import {
  SubmitMatchScoreInput,
  VerifyMatchScoreInput,
  DisputeMatchInput,
  AdminAssignMatchResultInput,
} from "@/lib/schemas/match";
import {
  PersistGeneratedSessionInput,
  FinalizeSessionInput,
} from "@/lib/schemas/session";

export { formatFunctionsError, CommandError } from "./client";
export type { CommandErrorCode } from "./client";

export type LegacyRole =
  | "SITE_ADMIN"
  | "CLUB_ADMIN"
  | "LEAGUE_COORDINATOR"
  | "PLAYER";

export interface ApproveClubResult {
  clubId: string;
  status: "approved" | "already-approved";
}

export interface RejectClubResult {
  clubId: string;
  status: "rejected" | "already-rejected";
}

export interface AssignRoleResult {
  userRoleId: string;
  effectiveLegacyRole: LegacyRole;
}

export interface DeactivateUserRoleResult {
  userRoleId: string;
  status: "deactivated" | "already-inactive";
  effectiveLegacyRole?: LegacyRole;
}

export interface SyncMyClaimsResult {
  effectiveLegacyRole: LegacyRole;
}

export interface SetUserGlobalRoleResult {
  userRoleId: string;
  effectiveLegacyRole: LegacyRole;
}

export interface MatchStatusResult<S extends string> {
  matchId: string;
  status: S;
}

export type SubmitMatchScoreResult = MatchStatusResult<"SUBMITTED">;
export type VerifyMatchScoreResult = MatchStatusResult<"VERIFIED">;
export type DisputeMatchResult = MatchStatusResult<"DISPUTED">;
export type AdminAssignMatchResultResult = MatchStatusResult<"ADMIN_ASSIGNED">;

export interface PersistGeneratedSessionResult {
  sessionId: string;
  courtCount: number;
  matchCount: number;
}

export interface FinalizeSessionResult {
  sessionId: string;
  status: "finalized" | "already-finalized";
}

export async function callNotifyAdminsOfClubSubmission(input: {
  clubId: string;
  clubName: string;
}): Promise<void> {
  await callCommand<unknown>("notifyAdminsOfClubSubmission", input);
}

export async function callApproveClub(
  input: ApproveClubInput,
): Promise<ApproveClubResult> {
  return callCommand<ApproveClubResult>(
    "approveClub",
    ApproveClubInput.parse(input),
  );
}

export async function callRejectClub(
  input: RejectClubInput,
): Promise<RejectClubResult> {
  return callCommand<RejectClubResult>(
    "rejectClub",
    RejectClubInput.parse(input),
  );
}

export async function callAssignRole(
  input: AssignRoleInput,
): Promise<AssignRoleResult> {
  return callCommand<AssignRoleResult>(
    "assignRole",
    AssignRoleInput.parse(input),
  );
}

export async function callDeactivateUserRole(
  input: DeactivateUserRoleInput,
): Promise<DeactivateUserRoleResult> {
  return callCommand<DeactivateUserRoleResult>(
    "deactivateUserRole",
    DeactivateUserRoleInput.parse(input),
  );
}

export async function callSetUserGlobalRole(
  input: SetUserGlobalRoleInput,
): Promise<SetUserGlobalRoleResult> {
  return callCommand<SetUserGlobalRoleResult>(
    "setUserGlobalRole",
    SetUserGlobalRoleInput.parse(input),
  );
}

// ============================================================
// LADDER MATCH + SESSION COMMANDS
// ============================================================

export async function callSubmitMatchScore(
  input: SubmitMatchScoreInput,
): Promise<SubmitMatchScoreResult> {
  return callCommand<SubmitMatchScoreResult>(
    "submitMatchScore",
    SubmitMatchScoreInput.parse(input),
  );
}

export async function callVerifyMatchScore(
  input: VerifyMatchScoreInput,
): Promise<VerifyMatchScoreResult> {
  return callCommand<VerifyMatchScoreResult>(
    "verifyMatchScore",
    VerifyMatchScoreInput.parse(input),
  );
}

export async function callDisputeMatch(
  input: DisputeMatchInput,
): Promise<DisputeMatchResult> {
  return callCommand<DisputeMatchResult>(
    "disputeMatch",
    DisputeMatchInput.parse(input),
  );
}

export async function callAdminAssignMatchResult(
  input: AdminAssignMatchResultInput,
): Promise<AdminAssignMatchResultResult> {
  return callCommand<AdminAssignMatchResultResult>(
    "adminAssignMatchResult",
    AdminAssignMatchResultInput.parse(input),
  );
}

export async function callPersistGeneratedSession(
  input: PersistGeneratedSessionInput,
): Promise<PersistGeneratedSessionResult> {
  return callCommand<PersistGeneratedSessionResult>(
    "persistGeneratedSession",
    PersistGeneratedSessionInput.parse(input),
  );
}

export async function callFinalizeSession(
  input: FinalizeSessionInput,
): Promise<FinalizeSessionResult> {
  return callCommand<FinalizeSessionResult>(
    "finalizeSession",
    FinalizeSessionInput.parse(input),
  );
}

/**
 * Recompute the caller's claim server-side, then force a local ID-token
 * refresh so the new claim is active in this session immediately.
 */
export async function callSyncMyClaims(): Promise<SyncMyClaimsResult> {
  const result = await callCommand<SyncMyClaimsResult>("syncMyClaims", {});
  await auth().currentUser?.getIdToken(true);
  return result;
}
