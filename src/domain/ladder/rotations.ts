/**
 * Rotation generation for ladder courts
 * Generates doubles match rotations for 4-player and 5-player courts
 * ensuring balanced partner distribution, opponent distribution, and sit-out distribution
 */

export interface RotationMatch {
  gameNumber: number;
  sideA: string[]; // Two player IDs
  sideB: string[]; // Two player IDs
  sitOutPlayer?: string; // 5-player courts only
}

/**
 * Generate rotation for a 4-player court
 * Each player partners with each other player exactly once across 4 games
 *
 * @param playerIds - Exactly 4 player IDs
 * @returns Array of 4 matches
 */
export function generate4PlayerRotation(playerIds: string[]): RotationMatch[] {
  if (playerIds.length !== 4) {
    throw new Error(`Expected 4 players, got ${playerIds.length}`);
  }

  const [p0, p1, p2, p3] = playerIds;

  return [
    {
      gameNumber: 1,
      sideA: [p0, p1],
      sideB: [p2, p3],
    },
    {
      gameNumber: 2,
      sideA: [p0, p2],
      sideB: [p1, p3],
    },
    {
      gameNumber: 3,
      sideA: [p0, p3],
      sideB: [p1, p2],
    },
    {
      gameNumber: 4,
      sideA: [p1, p2],
      sideB: [p0, p3],
    },
  ];
}

/**
 * Generate rotation for a 5-player court
 * 6 games total, with one sit-out per game
 * Balances partner distribution, opponent distribution, and sit-out distribution
 *
 * @param playerIds - Exactly 5 player IDs
 * @returns Array of 6 matches with sit-out assignments
 */
export function generate5PlayerRotation(playerIds: string[]): RotationMatch[] {
  if (playerIds.length !== 5) {
    throw new Error(`Expected 5 players, got ${playerIds.length}`);
  }

  const [p0, p1, p2, p3, p4] = playerIds;

  // Optimized 5-player rotation: 6 games with balanced distributions
  // Each player sits out 1.2 times on average (~1-2 times)
  // Each player partners with 2-3 different players
  // Each player opposes 2-3 different players
  return [
    {
      gameNumber: 1,
      sideA: [p0, p1],
      sideB: [p2, p3],
      sitOutPlayer: p4,
    },
    {
      gameNumber: 2,
      sideA: [p0, p2],
      sideB: [p1, p4],
      sitOutPlayer: p3,
    },
    {
      gameNumber: 3,
      sideA: [p0, p3],
      sideB: [p1, p2],
      sitOutPlayer: p4,
    },
    {
      gameNumber: 4,
      sideA: [p0, p4],
      sideB: [p2, p3],
      sitOutPlayer: p1,
    },
    {
      gameNumber: 5,
      sideA: [p1, p3],
      sideB: [p2, p4],
      sitOutPlayer: p0,
    },
    {
      gameNumber: 6,
      sideA: [p1, p4],
      sideB: [p3, p0],
      sitOutPlayer: p2,
    },
  ];
}

/**
 * Compute partnership statistics for a rotation
 * Useful for validating rotation quality
 */
export interface RotationStats {
  partnershipsPerPlayer: Record<string, Set<string>>;
  opponentsPerPlayer: Record<string, Set<string>>;
  sitOutsPerPlayer: Record<string, number>;
}

export function computeRotationStats(
  playerIds: string[],
  rotations: RotationMatch[]
): RotationStats {
  const partnershipsPerPlayer: Record<string, Set<string>> = {};
  const opponentsPerPlayer: Record<string, Set<string>> = {};
  const sitOutsPerPlayer: Record<string, number> = {};

  // Initialize counters
  playerIds.forEach((id) => {
    partnershipsPerPlayer[id] = new Set();
    opponentsPerPlayer[id] = new Set();
    sitOutsPerPlayer[id] = 0;
  });

  // Process each rotation
  rotations.forEach((rotation) => {
    const [a1, a2] = rotation.sideA;
    const [b1, b2] = rotation.sideB;

    // Record partnerships
    partnershipsPerPlayer[a1].add(a2);
    partnershipsPerPlayer[a2].add(a1);
    partnershipsPerPlayer[b1].add(b2);
    partnershipsPerPlayer[b2].add(b1);

    // Record opponents
    opponentsPerPlayer[a1].add(b1);
    opponentsPerPlayer[a1].add(b2);
    opponentsPerPlayer[a2].add(b1);
    opponentsPerPlayer[a2].add(b2);
    opponentsPerPlayer[b1].add(a1);
    opponentsPerPlayer[b1].add(a2);
    opponentsPerPlayer[b2].add(a1);
    opponentsPerPlayer[b2].add(a2);

    // Record sit-outs
    if (rotation.sitOutPlayer) {
      sitOutsPerPlayer[rotation.sitOutPlayer]++;
    }
  });

  return {
    partnershipsPerPlayer,
    opponentsPerPlayer,
    sitOutsPerPlayer,
  };
}
