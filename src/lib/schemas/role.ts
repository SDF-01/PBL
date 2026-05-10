// Canonical Zod schemas for role command payloads.
// Mirror in functions/src/schemas/role.ts must remain byte-equivalent.
import { z } from "zod";

const NonEmptyId = z.string().trim().min(1).max(128);

export const RoleKey = z.enum([
  "SiteAdmin",
  "ClubDirector",
  "LeagueCoordinator",
  "Player",
  "ClubCreatorProvisional",
]);

export const AssignRoleInput = z.object({
  userId: NonEmptyId,
  roleId: RoleKey,
  clubId: NonEmptyId.nullable(),
  leagueId: NonEmptyId.nullable(),
});

export type AssignRoleInput = z.infer<typeof AssignRoleInput>;

export const DeactivateUserRoleInput = z.object({
  userRoleId: NonEmptyId,
});

export type DeactivateUserRoleInput = z.infer<typeof DeactivateUserRoleInput>;

export const LegacyRole = z.enum([
  "SITE_ADMIN",
  "CLUB_ADMIN",
  "LEAGUE_COORDINATOR",
  "PLAYER",
]);

export const SetUserGlobalRoleInput = z.object({
  userId: NonEmptyId,
  newRole: LegacyRole,
});

export type SetUserGlobalRoleInput = z.infer<typeof SetUserGlobalRoleInput>;
