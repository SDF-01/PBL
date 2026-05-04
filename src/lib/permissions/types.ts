// Role-based access control types — from leagueforge_permissions_roles_schema.toon

export type RoleKey =
  | "SiteAdmin"
  | "ClubDirector"
  | "LeagueCoordinator"
  | "Player"
  | "ClubCreatorProvisional";

export type ClubStatus = "pending" | "approved" | "rejected";

export type LeagueMembershipStatus = "active" | "inactive" | "waitlisted" | "removed";

export type RoleEventType = "ClubApproved" | "ClubRejected" | "RoleAssigned" | "RoleRemoved";

export interface UserRoleDoc {
  id: string;
  userId: string;
  roleId: RoleKey;
  /** null for global roles (SiteAdmin). Required for club/league-scoped roles. */
  clubId: string | null;
  /** Required for LeagueCoordinator; null otherwise. */
  leagueId: string | null;
  assignedAt: string;
  assignedBy: string | null;
  active: boolean;
}

export interface ClubDoc {
  id: string;
  clubName: string;
  location: string;
  description: string;
  logoUrl: string | null;
  status: ClubStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoleEventDoc {
  id: string;
  userId: string;
  clubId: string | null;
  leagueId: string | null;
  eventType: RoleEventType;
  oldRoleId: RoleKey | null;
  newRoleId: RoleKey | null;
  eventTimestamp: string;
  notes: string;
}

export interface LeagueMembershipDoc {
  id: string;
  leagueId: string;
  userId: string;
  status: LeagueMembershipStatus;
  joinedAt: string;
}

export interface CreateClubInput {
  clubName: string;
  location: string;
  description: string;
  logoUrl?: string;
}
