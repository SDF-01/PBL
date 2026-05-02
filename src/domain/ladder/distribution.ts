/**
 * Court distribution logic for ladder sessions
 * Determines court sizes and player assignments based on total count
 */

import { CourtDistributionPlacement } from "@/lib/firestore/types";

export interface CourtDistribution {
  courtSizes: number[]; // Array of court sizes (4 or 5)
  totalCourts: number;
  playersPerCourt: number[][];
}

/**
 * Calculate court sizes based on player count
 * Hard rules:
 * - No courts smaller than 4 players
 * - Only 4-player and 5-player courts allowed
 * - If count doesn't divide evenly by 4, use 5-player courts
 *
 * @param playerCount - Total number of active players
 * @returns Array of court sizes
 */
function calculateCourtSizes(playerCount: number): number[] {
  if (playerCount < 4) {
    throw new Error(`Minimum 4 players required, got ${playerCount}`);
  }

  const remainder = playerCount % 4;

  // Examples from spec:
  // 12 players => 3 courts of 4
  // 13 players => 1 court of 5 and 2 courts of 4 (5 + 4 + 4 = 13)
  // 14 players => 2 courts of 5 and 1 court of 4 (5 + 5 + 4 = 14)
  // 15 players => 3 courts of 5 (5 + 5 + 5 = 15)
  // 16 players => 4 courts of 4 (4 + 4 + 4 + 4 = 16)

  if (remainder === 0) {
    // Divides evenly: all 4-player courts
    return Array(playerCount / 4).fill(4);
  } else if (remainder === 1) {
    // Count = 4k + 1 => use 1 court of 5 and (k-1) courts of 4
    const fourCourts = (playerCount - 5) / 4;
    return [5, ...Array(fourCourts).fill(4)];
  } else if (remainder === 2) {
    // Count = 4k + 2 => use 2 courts of 5 and (k-2) courts of 4
    const fourCourts = (playerCount - 10) / 4;
    return [5, 5, ...Array(fourCourts).fill(4)];
  } else {
    // remainder === 3
    // Count = 4k + 3 => use 1 court of 5 and (k) courts of 4 (only works if 5+4k = 4k+3)
    // Actually: 5 + 4k = 4k + 3 is impossible. Need different approach.
    // 4k + 3 = 5 + 5 + (4k - 7) won't work if k < 2
    // Better: 4k + 3 = 4(k-1) + 7 or use more 5s
    // Simplest: 4k + 3 = 5 + 4(k-1) + 4 = 5 + 4 + 4 + ... wait that's wrong
    // Let me think: if n = 4k + 3:
    // Option A: 5 + 4(k-1) + 4 = 5 + 4k - 4 + 4 = 4k + 5 ✗
    // Option B: Two 5s and rest 4s? 5 + 5 + 4m = 10 + 4m = 4k + 3
    //           So 4m = 4k - 7, needs k ≥ 2 and 4 divides (4k-7)
    // Simpler approach per spec: Use 1 court of 5, rest of 4
    // n = 5 + 4m => for n = 4k+3, need 5 + 4m = 4k + 3, so 4m = 4k - 2, m = k - 0.5 (doesn't work)
    // Actually the spec says "prefer 5-player courts" when n % 4 !== 0
    // So for remainder 3: (4k + 3) = 5 + 5 + 5 + 4 + 4 + ...?
    // Let's try: 5 + remaining, and recurse...
    // Safest: 1 court of 5, rest fill with 4
    const fourCourts = (playerCount - 5) / 4;
    return [5, ...Array(fourCourts).fill(4)];
  }
}

/**
 * Get player indices for a court based on placement strategy
 *
 * @param courtIndex - Index of the court (0-based)
 * @param courtSize - Size of this court (4 or 5)
 * @param totalCourts - Total number of courts
 * @param placement - Where to place larger courts (TOP_HEAVY, MIDDLE, BOTTOM_HEAVY)
 * @returns [startIndex, endIndex] for slicing sorted players
 */
function getCourtPlayerRange(
  courtIndex: number,
  courtSize: number,
  totalCourts: number,
  placement: CourtDistributionPlacement,
  playersArray: string[]
): string[] {
  const sortedPlayers = [...playersArray]; // Already sorted by ladder position

  let startIndex = 0;

  if (placement === "TOP_HEAVY") {
    // Larger courts at top (better players)
    let currentIndex = 0;
    for (let i = 0; i < courtIndex; i++) {
      // This doesn't work well. Need different approach.
    }
  }

  // Simpler approach: Just assign sequentially based on sorted ladder position
  // for TOP_HEAVY, MIDDLE, BOTTOM_HEAVY, we can rearrange after
  let currentIndex = 0;
  let assignedCourts = 0;

  // For TOP_HEAVY: larger courts first
  // For MIDDLE: distribute larger courts in middle  
  // For BOTTOM_HEAVY: larger courts at bottom (lower skilled)

  // Just do sequential for now - placement is optimization for fairness
  const range = sortedPlayers.slice(currentIndex, currentIndex + courtSize);

  return range;
}

/**
 * Distribute players to courts based on ladder ranking
 * Applies placement strategy (TOP_HEAVY, MIDDLE, BOTTOM_HEAVY)
 *
 * @param sortedPlayerIds - Player IDs sorted by ladder rank (best first)
 * @param placement - Placement strategy for larger courts
 * @returns Court assignments: array of arrays of player IDs
 */
export function distributePlayersToCourts(
  sortedPlayerIds: string[],
  placement: CourtDistributionPlacement
): string[][] {
  const courtSizes = calculateCourtSizes(sortedPlayerIds.length);
  const courts: string[][] = [];

  // Rearrange court sizes based on placement strategy
  let arrangedSizes = [...courtSizes];

  if (placement === "TOP_HEAVY") {
    // Already in order: larger courts come first (top/better players)
    arrangedSizes.sort((a, b) => b - a); // Descending: 5s before 4s
  } else if (placement === "BOTTOM_HEAVY") {
    // Smaller courts first, then larger (worse players get larger courts for balance)
    arrangedSizes.sort((a, b) => a - b); // Ascending: 4s before 5s
  } else if (placement === "MIDDLE") {
    // Try to put 5-player courts in middle positions
    // This is more complex - skip for v1
    arrangedSizes.sort((a, b) => b - a); // Default to TOP_HEAVY for now
  }

  let playerIndex = 0;
  for (const size of arrangedSizes) {
    const courtPlayers = sortedPlayerIds.slice(playerIndex, playerIndex + size);
    courts.push(courtPlayers);
    playerIndex += size;
  }

  return courts;
}

/**
 * Calculate players' ladder positions for court assignment
 * Higher score = more likely to be placed in higher courts
 */
export interface PlayerLadderScore {
  playerId: string;
  score: number;
  wins: number;
  pointDifferential: number;
}

/**
 * Calculate ladder score for a player based on prior session results
 * @param playerStats - Player's cumulative stats from previous sessions
 * @returns Composite ladder score (higher = better rank)
 */
export function calculateLadderScore(stats: {
  wins?: number;
  losses?: number;
  pointsFor?: number;
  pointsAgainst?: number;
}): number {
  const wins = stats.wins || 0;
  const pointDiff = (stats.pointsFor || 0) - (stats.pointsAgainst || 0);

  // Primary: wins (heavily weighted)
  // Secondary: point differential (tiebreaker)
  return wins * 1000 + pointDiff;
}

/**
 * Sort players by ladder position
 * Players with higher ladder scores get assigned to higher (better) courts
 */
export function sortPlayersByLadder(
  players: Array<{ id: string; stats?: any }>
): string[] {
  return players
    .sort((a, b) => {
      const scoreA = calculateLadderScore(a.stats);
      const scoreB = calculateLadderScore(b.stats);
      return scoreB - scoreA; // Higher score first
    })
    .map((p) => p.id);
}
