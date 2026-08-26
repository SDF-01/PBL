// The single source of truth for what commands exist.
//
// Both adapters build from this map, so a new command is registered once and
// is immediately reachable from Cloud Functions and the HTTP host alike. It
// also guarantees the two transports can never expose different command sets.

import type { CallerContext } from "./lib/auth";

import { approveClubCommand } from "./commands/approveClub";
import { rejectClubCommand } from "./commands/rejectClub";
import { notifyAdminsOfClubSubmissionCommand } from "./commands/notifyAdminsOfClubSubmission";
import { assignRoleCommand } from "./commands/assignRole";
import { deactivateUserRoleCommand } from "./commands/deactivateUserRole";
import { setUserGlobalRoleCommand } from "./commands/setUserGlobalRole";
import { syncMyClaimsCommand } from "./commands/syncMyClaims";
import { submitMatchScoreCommand } from "./commands/submitMatchScore";
import { verifyMatchScoreCommand } from "./commands/verifyMatchScore";
import { disputeMatchCommand } from "./commands/disputeMatch";
import { adminAssignMatchResultCommand } from "./commands/adminAssignMatchResult";
import { persistGeneratedSessionCommand } from "./commands/persistGeneratedSession";
import { finalizeSessionCommand } from "./commands/finalizeSession";

export type CommandHandler = (
  caller: CallerContext,
  data: unknown,
) => Promise<unknown>;

export const COMMANDS = {
  approveClub: approveClubCommand,
  rejectClub: rejectClubCommand,
  notifyAdminsOfClubSubmission: notifyAdminsOfClubSubmissionCommand,
  assignRole: assignRoleCommand,
  deactivateUserRole: deactivateUserRoleCommand,
  setUserGlobalRole: setUserGlobalRoleCommand,
  syncMyClaims: syncMyClaimsCommand,
  submitMatchScore: submitMatchScoreCommand,
  verifyMatchScore: verifyMatchScoreCommand,
  disputeMatch: disputeMatchCommand,
  adminAssignMatchResult: adminAssignMatchResultCommand,
  persistGeneratedSession: persistGeneratedSessionCommand,
  finalizeSession: finalizeSessionCommand,
} satisfies Record<string, CommandHandler>;

export type CommandName = keyof typeof COMMANDS;

export function isCommandName(name: string): name is CommandName {
  return Object.prototype.hasOwnProperty.call(COMMANDS, name);
}
