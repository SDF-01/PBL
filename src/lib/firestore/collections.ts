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
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
