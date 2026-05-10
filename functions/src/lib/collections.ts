// Mirror of src/lib/firestore/collections.ts. Kept in sync manually until
// a shared package or codegen step is introduced.
export const COLLECTIONS = {
  users: "users",
  clubs: "clubs",
  userRoles: "userRoles",
  roleEvents: "roleEvents",
  notifications: "notifications",
  auditLog: "auditLog",
  // Ladder + match collections
  ladderSessions: "ladderSessions",
  ladderCourts: "ladderCourts",
  ladderMatches: "ladderMatches",
  standingsSnapshots: "standingsSnapshots",
  audits: "audits",
  // Player + ELO collections
  players: "players",
  eloEvents: "eloEvents",
} as const;
