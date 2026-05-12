"use client";

import { httpsCallable, FunctionsError } from "firebase/functions";
import { fns } from "./client";
import { auth } from "@/lib/firebase";
import {
  ApproveClubInput,
  RejectClubInput,
} from "@/lib/schemas/club";
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
  const callable = httpsCallable<{ clubId: string; clubName: string }, unknown>(
    fns(),
    "notifyAdminsOfClubSubmission",
  );
  await callable(input);
}

export async function callApproveClub(
  input: ApproveClubInput,
): Promise<ApproveClubResult> {
  const parsed = ApproveClubInput.parse(input);
  const callable = httpsCallable<ApproveClubInput, ApproveClubResult>(
    fns(),
    "approveClub",
  );
  const res = await callable(parsed);
  return res.data;
}

export async function callRejectClub(
  input: RejectClubInput,
): Promise<RejectClubResult> {
  const parsed = RejectClubInput.parse(input);
  const callable = httpsCallable<RejectClubInput, RejectClubResult>(
    fns(),
    "rejectClub",
  );
  const res = await callable(parsed);
  return res.data;
}

export async function callAssignRole(
  input: AssignRoleInput,
): Promise<AssignRoleResult> {
  const parsed = AssignRoleInput.parse(input);
  const callable = httpsCallable<AssignRoleInput, AssignRoleResult>(
    fns(),
    "assignRole",
  );
  const res = await callable(parsed);
  return res.data;
}

export async function callDeactivateUserRole(
  input: DeactivateUserRoleInput,
): Promise<DeactivateUserRoleResult> {
  const parsed = DeactivateUserRoleInput.parse(input);
  const callable = httpsCallable<
    DeactivateUserRoleInput,
    DeactivateUserRoleResult
  >(fns(), "deactivateUserRole");
  const res = await callable(parsed);
  return res.data;
}

export async function callSetUserGlobalRole(
  input: SetUserGlobalRoleInput,
): Promise<SetUserGlobalRoleResult> {
  const parsed = SetUserGlobalRoleInput.parse(input);
  const callable = httpsCallable<
    SetUserGlobalRoleInput,
    SetUserGlobalRoleResult
  >(fns(), "setUserGlobalRole");
  const res = await callable(parsed);
  return res.data;
}

// ============================================================
// LADDER MATCH + SESSION CALLABLES
// ============================================================

export async function callSubmitMatchScore(
  input: SubmitMatchScoreInput,
): Promise<SubmitMatchScoreResult> {
  const parsed = SubmitMatchScoreInput.parse(input);
  const callable = httpsCallable<SubmitMatchScoreInput, SubmitMatchScoreResult>(
    fns(),
    "submitMatchScore",
  );
  const res = await callable(parsed);
  return res.data;
}

export async function callVerifyMatchScore(
  input: VerifyMatchScoreInput,
): Promise<VerifyMatchScoreResult> {
  const parsed = VerifyMatchScoreInput.parse(input);
  const callable = httpsCallable<VerifyMatchScoreInput, VerifyMatchScoreResult>(
    fns(),
    "verifyMatchScore",
  );
  const res = await callable(parsed);
  return res.data;
}

export async function callDisputeMatch(
  input: DisputeMatchInput,
): Promise<DisputeMatchResult> {
  const parsed = DisputeMatchInput.parse(input);
  const callable = httpsCallable<DisputeMatchInput, DisputeMatchResult>(
    fns(),
    "disputeMatch",
  );
  const res = await callable(parsed);
  return res.data;
}

export async function callAdminAssignMatchResult(
  input: AdminAssignMatchResultInput,
): Promise<AdminAssignMatchResultResult> {
  const parsed = AdminAssignMatchResultInput.parse(input);
  const callable = httpsCallable<
    AdminAssignMatchResultInput,
    AdminAssignMatchResultResult
  >(fns(), "adminAssignMatchResult");
  const res = await callable(parsed);
  return res.data;
}

export async function callPersistGeneratedSession(
  input: PersistGeneratedSessionInput,
): Promise<PersistGeneratedSessionResult> {
  const parsed = PersistGeneratedSessionInput.parse(input);
  const callable = httpsCallable<
    PersistGeneratedSessionInput,
    PersistGeneratedSessionResult
  >(fns(), "persistGeneratedSession");
  const res = await callable(parsed);
  return res.data;
}

export async function callFinalizeSession(
  input: FinalizeSessionInput,
): Promise<FinalizeSessionResult> {
  const parsed = FinalizeSessionInput.parse(input);
  const callable = httpsCallable<FinalizeSessionInput, FinalizeSessionResult>(
    fns(),
    "finalizeSession",
  );
  const res = await callable(parsed);
  return res.data;
}

/**
 * Recompute the caller's claim server-side, then force a local ID-token
 * refresh so the new claim is active in this session immediately.
 */
export async function callSyncMyClaims(): Promise<SyncMyClaimsResult> {
  const callable = httpsCallable<undefined, SyncMyClaimsResult>(
    fns(),
    "syncMyClaims",
  );
  const res = await callable();
  await auth().currentUser?.getIdToken(true);
  return res.data;
}

/** Format a Functions error for user-facing toast messages. */
export function formatFunctionsError(err: unknown): string {
  if (err instanceof FunctionsError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Unknown error.";
}
