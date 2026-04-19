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

export interface NotificationDoc {
  id: string;
  userId: string;
  title: string;
  body: string;
  href?: string | null;
  kind: "TOURNAMENT_CREATED" | "BRACKET_PUBLISHED" | "MATCH_READY" | "ANNOUNCEMENT" | "GENERAL";
  read: boolean;
  createdAt: string;
  createdBy?: string;
}

// ============================================================
// LADDER LEAGUE (spec v4)
// A doubles-ladder product: Season -> PlayDate -> (Session A, Session B)
// -> Courts (4-5 players each) -> Matches. Individual ranking from
// doubles play. See ladder_league_builders_spec_v4_agent_update.toon.
// ============================================================

export type UserMode = "PLAYER" | "ADMIN";

export type PlayDateStatus = "SCHEDULED" | "CHECK_IN_OPEN" | "IN_PROGRESS" | "CLOSED";

export type LadderSessionStatus =
  | "DRAFT"
  | "GENERATED"
  | "LIVE"
  | "AWAITING_FINALIZATION"
  | "FINALIZED";

export type LadderSessionKind = "A" | "B";

export type LadderMatchStatus =
  | "SCHEDULED"
  | "SUBMITTED"
  | "AWAITING_VERIFICATION"
  | "VERIFIED"
  | "ADMIN_ASSIGNED";

export type CheckInStatus =
  | "PENDING"
  | "CONFIRMED"
  | "GEO_REJECTED"
  | "ADMIN_CONFIRMED";

export type MovementPattern = "ONE_UP_ONE_DOWN" | "TWO_UP_TWO_DOWN";

export type CourtDistributionPlacement = "TOP_HEAVY" | "MIDDLE" | "BOTTOM_HEAVY";

/** Extends UserDoc semantics — the fields here are optional additions for V1. */
export interface LadderUserExtras {
  activeMode?: UserMode;
  roles?: UserMode[];
  duprId?: string | null;
}

export interface LadderSeasonDoc {
  id: string;
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
  /** Score-to-X default for matches. */
  targetPoints: number;
  movementPattern: MovementPattern;
  courtDistributionPlacement: CourtDistributionPlacement;
  createdAt: string;
  createdBy: string;
}

export interface VenueDoc {
  id: string;
  name: string;
  address?: string;
  /** Geofence center, WGS84 degrees. */
  lat: number;
  lng: number;
  /** Geofence radius in meters. */
  radiusMeters: number;
  createdAt: string;
  createdBy: string;
}

export interface PlayDateDoc {
  id: string;
  seasonId: string;
  venueId: string;
  /** YYYY-MM-DD in the venue's local timezone. */
  date: string;
  status: PlayDateStatus;
  /** ISO check-in window bounds. */
  checkInOpensAt?: string;
  checkInClosesAt?: string;
  sessionAId?: string;
  sessionBId?: string;
  createdAt: string;
  createdBy: string;
}

export interface LadderSessionDoc {
  id: string;
  playDateId: string;
  seasonId: string;
  kind: LadderSessionKind;
  status: LadderSessionStatus;
  targetPoints: number;
  movementPattern: MovementPattern;
  generatedAt?: string;
  finalizedAt?: string;
}

export interface LadderCourtDoc {
  id: string;
  sessionId: string;
  playDateId: string;
  /** 1-indexed. 1 = top court. */
  courtNumber: number;
  /** 4 or 5 only, per spec hard rule. */
  size: 4 | 5;
  /** User ids of players assigned to this court. */
  playerIds: string[];
}

export interface LadderMatchDoc {
  id: string;
  sessionId: string;
  courtId: string;
  /** Rotation slot index (1-based): 1..4 for 4-player courts, 1..6 for 5. */
  gameNumber: number;
  sideA: { players: [string, string] };
  sideB: { players: [string, string] };
  /** User id sitting out this game (only for 5-player courts). */
  sittingOut?: string | null;
  scoreA?: number;
  scoreB?: number;
  submittedBy?: string;
  submittedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  /** If set, admin assigned the result manually (incomplete-match rule). */
  adminAssignedBy?: string;
  adminAssignedAt?: string;
  status: LadderMatchStatus;
}

export interface CheckInDoc {
  id: string;
  playDateId: string;
  sessionId?: string; // defaults to Session A per spec
  userId: string;
  displayName: string;
  status: CheckInStatus;
  /** Reported geolocation at check-in time. */
  lat?: number;
  lng?: number;
  /** Distance from venue center in meters, if computed. */
  distanceMeters?: number;
  adminOverrideBy?: string;
  createdAt: string;
}

export interface StandingsSnapshotDoc {
  id: string;
  sessionId: string;
  playDateId: string;
  seasonId: string;
  /** Per-player row (individual ranking even though play is doubles). */
  rows: Array<{
    userId: string;
    displayName: string;
    courtNumber: number;
    wins: number;
    losses: number;
    pointsFor: number;
    pointsAgainst: number;
    pointDifferential: number;
  }>;
  computedAt: string;
}

/** Append-only audit log per spec directive 04. */
export interface AuditDoc {
  id: string;
  /** e.g. "session.generate", "match.scoreEdit", "match.adminAssign". */
  kind: string;
  actorId: string;
  targetId?: string;
  /** Entity type for targetId, e.g. "session"|"match". */
  targetKind?: string;
  /** Arbitrary JSON-safe payload describing before/after. */
  payload?: Record<string, unknown>;
  createdAt: string;
}
