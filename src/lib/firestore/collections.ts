// Firestore collection names — single source of truth.
export const COLLECTIONS = {
  users: "users",
  organizations: "organizations",
  venues: "venues",
  courts: "courts",
  leagues: "leagues",
  seasons: "seasons",
  divisions: "divisions",
  tournaments: "tournaments",
  brackets: "brackets",
  bracketNodes: "bracketNodes",
  registrations: "registrations",
  teams: "teams",
  matches: "matches",
  matchGames: "matchGames",
  standings: "standings",
  announcements: "announcements",
  achievements: "achievements",
  playerAchievements: "playerAchievements",
  trophies: "trophies",
  notifications: "notifications",
  auditLog: "auditLog",
  // ==== Ladder League (spec v4) ====
  playDates: "playDates",
  ladderSessions: "ladderSessions",
  ladderCourts: "ladderCourts",
  ladderMatches: "ladderMatches",
  checkIns: "checkIns",
  standingsSnapshots: "standingsSnapshots",
  audits: "audits",
  // ==== Player profiles + ELO ====
  players: "players",
  eloEvents: "eloEvents",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
