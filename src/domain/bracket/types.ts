/**
 * Bracket Engine — Domain Types
 * ---------------------------------------------------------------
 * Pure data structures. No persistence, no UI. The engine produces
 * an in-memory bracket that can be projected onto Prisma models.
 *
 * Terminology:
 *  - Entrant:    a participant (player in singles OR team in doubles)
 *  - Node:       a match slot in the bracket tree
 *  - Round:      a horizontal layer of nodes
 *  - Side:       A or B within a node
 *  - BYE:        a virtual pass-through used when entrant count != power of 2
 */

export type EntrantId = string;

export interface Entrant {
  id: EntrantId;
  /** Display name (player name or team name). Not used in engine logic. */
  name: string;
  /** Optional seed. If omitted, seeding method assigns one. */
  seed?: number;
  /** Optional rating (ELO-like) used by rank-based seeding. */
  rating?: number;
  /** Optional club/org id used to apply separation rules. */
  clubId?: string;
}

export type Side = "A" | "B";

export type NodeId = string;

export interface BracketNode {
  id: NodeId;
  roundIndex: number;
  positionInRound: number;
  /** Side A occupant: entrant, BYE, or unresolved (null). */
  a: EntrantId | null;
  b: EntrantId | null;
  isByeA: boolean;
  isByeB: boolean;
  seedA?: number;
  seedB?: number;
  /** Winner routes to this node at this side. */
  winnerNext?: { nodeId: NodeId; side: Side };
  /** Loser routes to this node at this side (double elim only). */
  loserNext?: { nodeId: NodeId; side: Side };
}

export interface BracketRound {
  index: number;
  label: string;
  nodeIds: NodeId[];
}

export type BracketSide = "winners" | "losers" | "main" | "consolation" | "grand_final";

export interface Bracket {
  type: "SINGLE_ELIM" | "DOUBLE_ELIM" | "ROUND_ROBIN" | "POOL_TO_BRACKET";
  side: BracketSide;
  rounds: BracketRound[];
  nodes: Record<NodeId, BracketNode>;
  /** Ordered list of initial slot assignments (by round 0 node position). */
  initialSeeding: Array<{ nodeId: NodeId; side: Side; entrantId: EntrantId | null; isBye: boolean; seed: number }>;
}

export interface RoundRobinSchedule {
  type: "ROUND_ROBIN";
  rounds: Array<{
    index: number;
    pairings: Array<{ a: EntrantId; b: EntrantId | null /* bye */ }>;
  }>;
}

export interface PoolPlay {
  type: "POOL_PLAY";
  pools: Array<{
    label: string;
    entrants: EntrantId[];
    schedule: RoundRobinSchedule;
  }>;
}

export type SeedingMethod = "MANUAL" | "RANDOM" | "RANK_BASED" | "SNAKE";

export interface SeedingOptions {
  method: SeedingMethod;
  /** Deterministic RNG seed for RANDOM / tie-break — reproducible brackets. */
  rngSeed?: number;
  /** Try to keep same-club entrants on opposite halves where possible. */
  separateSameClub?: boolean;
}

export interface GenerateSingleElimInput {
  entrants: Entrant[];
  seeding: SeedingOptions;
}

export interface GenerateDoubleElimInput extends GenerateSingleElimInput {
  /** If true, a reset match is scheduled when LB finalist beats WB finalist. */
  grandFinalReset?: boolean;
}

export interface RoundRobinConfig {
  /** If > 0, split entrants into this many pools (snake-seeded by default). */
  pools?: number;
  /** Rotation method for scheduling. `circle` is standard round-robin. */
  method?: "circle";
}
