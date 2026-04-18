// Firestore document shapes — TypeScript-only (no Prisma).
// These mirror the bracket-engine domain and the pickleball platform needs.
// All ids are string (Firestore document id). Timestamps are ISO strings
// for portability across the wire; use Firestore `serverTimestamp()` on write
// and convert on read in the repository helpers.

export type Role = "PLAYER" | "TEAM_CAPTAIN" | "REFEREE" | "DIRECTOR" | "ADMIN" | "OWNER";

export type Tier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND" | "MYTHIC";

export type TournamentStatus =
  | "DRAFT"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "SEEDED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type MatchStatus =
  | "SCHEDULED"
  | "READY"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "DISPUTED"
  | "FORFEITED"
  | "CANCELLED";

export type RegistrationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "WAITLISTED"
  | "WITHDRAWN"
  | "REJECTED";

export interface UserDoc {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  tier: Tier;
  rating: number;
  createdAt: string;
}

export interface OrganizationDoc {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  createdAt: string;
}

export interface VenueDoc {
  id: string;
  orgId: string;
  name: string;
  city?: string;
  region?: string;
}

export interface CourtDoc {
  id: string;
  venueId: string;
  label: string;
  surface?: "HARD" | "ACRYLIC" | "TILE" | "OUTDOOR";
}

export interface LeagueDoc {
  id: string;
  orgId: string;
  slug: string;
  name: string;
  description?: string;
}

export interface SeasonDoc {
  id: string;
  leagueId: string;
  slug: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface DivisionDoc {
  id: string;
  seasonId: string;
  name: string;
  skillMin: number;
  skillMax: number;
  format: "SINGLES" | "DOUBLES" | "MIXED_DOUBLES";
}

export interface TournamentDoc {
  id: string;
  orgId: string;
  slug: string;
  name: string;
  status: TournamentStatus;
  format: "SINGLE_ELIM" | "DOUBLE_ELIM" | "ROUND_ROBIN" | "POOL_PLAY_PLUS_BRACKET";
  startDate: string;
  endDate: string;
  venueId?: string;
  description?: string;
  targetPoints: number;
  winBy: number;
  bestOf: number;
}

export interface RegistrationDoc {
  id: string;
  tournamentId: string;
  userId?: string;
  teamId?: string;
  displayName: string;
  seed?: number;
  rating?: number;
  status: RegistrationStatus;
  createdAt: string;
}

// Bracket persistence — we store the engine output so reads are cheap.
// Writes always round-trip through the engine so we can't drift.
export interface BracketDoc {
  id: string;
  tournamentId: string;
  format: TournamentDoc["format"];
  seedingMethod: "MANUAL" | "RANDOM" | "RANK_BASED" | "SNAKE";
  rngSeed?: number;
  nodeIds: string[];          // flat list
  rounds: { label: string; nodeIds: string[] }[];
  generatedAt: string;
}

export interface BracketNodeDoc {
  id: string;
  bracketId: string;
  tournamentId: string;
  roundIndex: number;
  positionInRound: number;
  a?: string | null;            // registrationId or null
  b?: string | null;
  isByeA: boolean;
  isByeB: boolean;
  seedA?: number | null;
  seedB?: number | null;
  winnerNext?: { nodeId: string; side: "A" | "B" } | null;
  loserNext?: { nodeId: string; side: "A" | "B" } | null;
}

export interface MatchDoc {
  id: string;
  tournamentId: string;
  bracketNodeId?: string;
  courtId?: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  status: MatchStatus;
  participantAId?: string;
  participantBId?: string;
  winnerId?: string;
  targetPoints: number;
  winBy: number;
  bestOf: number;
}

export interface MatchGameDoc {
  id: string;
  matchId: string;
  gameNumber: number;
  scoreA: number;
  scoreB: number;
}

export interface AnnouncementDoc {
  id: string;
  orgId: string;
  title: string;
  body: string;
  kind: "BRACKET_PUBLISHED" | "SCHEDULE_UPDATE" | "RESULT_POSTED" | "GENERAL";
  createdAt: string;
}

export interface AchievementDoc {
  id: string;
  code: string;
  name: string;
  description: string;
  tier: Tier;
}
