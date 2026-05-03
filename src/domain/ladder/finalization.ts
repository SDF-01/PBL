/**
 * Session finalization logic
 * Computes movement, persists standings, and prepares for next session
 */

import {
  LadderSessionDoc,
  LadderCourtDoc,
  LadderMatchDoc,
  StandingsSnapshotDoc,
  PlayerStats,
  MovementPattern,
} from "@/lib/firestore/types";

export interface PlayerSessionResult {
  playerId: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  courtNumber: number;
  rank: number; // Rank within court (1 = best)
}

export interface SessionResults {
  results: PlayerSessionResult[];
  standings: StandingsSnapshotDoc[];
}

/**
 * Calculate session results from matches
 * Verified matches only (others require admin assignment first)
 */
export function calculateSessionResults(
  courts: LadderCourtDoc[],
  matches: LadderMatchDoc[]
): PlayerSessionResult[] {
  const playerResults: Record<string, PlayerSessionResult> = {};

  // Initialize all court participants
  courts.forEach((court) => {
    court.playerIds.forEach((playerId) => {
      playerResults[playerId] = {
        playerId,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        courtNumber: court.courtNumber,
        rank: 0,
      };
    });
  });

  // Process only verified matches
  matches
    .filter((m) => m.status === "VERIFIED" || m.status === "ADMIN_ASSIGNED")
    .forEach((match) => {
      const scoreA = match.scoreA || 0;
      const scoreB = match.scoreB || 0;

      // Determine winner
      const sideAWins = scoreA > scoreB;

      // Apply results to each player
      match.sideA.forEach((playerId) => {
        if (playerResults[playerId]) {
          if (sideAWins) {
            playerResults[playerId].wins++;
          } else {
            playerResults[playerId].losses++;
          }
          playerResults[playerId].pointsFor += scoreA;
          playerResults[playerId].pointsAgainst += scoreB;
        }
      });

      match.sideB.forEach((playerId) => {
        if (playerResults[playerId]) {
          if (!sideAWins) {
            playerResults[playerId].wins++;
          } else {
            playerResults[playerId].losses++;
          }
          playerResults[playerId].pointsFor += scoreB;
          playerResults[playerId].pointsAgainst += scoreA;
        }
      });
    });

  // Sort by court and rank within court
  const results = Object.values(playerResults);

  const courtGroups: Record<number, PlayerSessionResult[]> = {};
  results.forEach((r) => {
    const bucket = courtGroups[r.courtNumber] || (courtGroups[r.courtNumber] = []);
    bucket.push(r);
  });

  // Sort within each court and assign ranks
  Object.keys(courtGroups).forEach((courtNum) => {
    const group = courtGroups[parseInt(courtNum)];
    if (!group) return;

    group.sort((a, b) => {
      // Primary: wins (descending)
      if (a.wins !== b.wins) return b.wins - a.wins;
      // Secondary: point differential (descending)
      const diffA = a.pointsFor - a.pointsAgainst;
      const diffB = b.pointsFor - b.pointsAgainst;
      return diffB - diffA;
    });

    group.forEach((r, index) => {
      r.rank = index + 1;
    });
  });

  return results;
}

/**
 * Calculate movement between courts based on pattern and current rankings
 *
 * @param results - Session results (ranked within each court)
 * @param movementPattern - ONE_UP_ONE_DOWN or TWO_UP_TWO_DOWN
 * @param courts - Court definitions from this session
 * @returns New court assignments for next session
 */
export function calculateCourtMovement(
  results: PlayerSessionResult[],
  movementPattern: MovementPattern,
  courts: LadderCourtDoc[]
): Record<string, number> {
  // Group results by court
  const resultsByCourtNum: Record<number, PlayerSessionResult[]> = {};
  results.forEach((r) => {
    const bucket = resultsByCourtNum[r.courtNumber] || (resultsByCourtNum[r.courtNumber] = []);
    bucket.push(r);
  });

  const sortedCourtNumbers = Object.keys(resultsByCourtNum)
    .map(Number)
    .sort((a, b) => a - b);

  const newAssignments: Record<string, number> = {};
  const moversUp: PlayerSessionResult[] = [];
  const moversDown: PlayerSessionResult[] = [];
  const stayers: PlayerSessionResult[] = [];

  if (movementPattern === "ONE_UP_ONE_DOWN") {
    // Top-ranked player from each court (except top) moves up
    // Bottom-ranked player from each court (except bottom) moves down

    sortedCourtNumbers.forEach((courtNum, index) => {
      const courtResults = (resultsByCourtNum[courtNum] || []).sort(
        (a, b) => a.rank - b.rank
      );

      const isTopCourt = index === 0;
      const isBottomCourt = index === sortedCourtNumbers.length - 1;
      const topPlayer = courtResults[0];
      const bottomPlayer = courtResults[courtResults.length - 1];

      // Top player moves up (unless already in top court)
      if (!isTopCourt && topPlayer) {
        moversUp.push(topPlayer);
      } else if (isTopCourt && topPlayer) {
        stayers.push(topPlayer);
      }

      // Bottom player moves down (unless already in bottom court)
      if (!isBottomCourt && bottomPlayer) {
        moversDown.push(bottomPlayer);
      } else if (isBottomCourt && bottomPlayer) {
        stayers.push(bottomPlayer);
      }

      // Middle players stay
      courtResults.slice(1, -1).forEach((r) => {
        stayers.push(r);
      });
    });
  } else if (movementPattern === "TWO_UP_TWO_DOWN") {
    // Top 2 ranked players from each court (except top) move up
    // Bottom 2 ranked players from each court (except bottom) move down

    sortedCourtNumbers.forEach((courtNum, index) => {
      const courtResults = (resultsByCourtNum[courtNum] || []).sort(
        (a, b) => a.rank - b.rank
      );

      const isTopCourt = index === 0;
      const isBottomCourt = index === sortedCourtNumbers.length - 1;

      // Top 2 move up
      if (!isTopCourt && courtResults.length >= 2) {
        const first = courtResults[0]!;
        const second = courtResults[1]!;
        moversUp.push(first, second);
      } else if (!isTopCourt && courtResults.length === 1) {
        moversUp.push(courtResults[0]!);
      } else {
        courtResults.slice(0, Math.min(2, courtResults.length)).forEach((r) => {
          stayers.push(r);
        });
      }

      // Bottom 2 move down
      const bottomIndex = Math.max(0, courtResults.length - 2);
      if (!isBottomCourt && bottomIndex < courtResults.length) {
        moversDown.push(...courtResults.slice(bottomIndex));
      } else {
        stayers.push(...courtResults.slice(bottomIndex));
      }

      // Middle players stay
      const middleStart = !isTopCourt ? 2 : 0;
      const middleEnd = !isBottomCourt ? courtResults.length - 2 : courtResults.length;
      courtResults.slice(middleStart, middleEnd).forEach((r) => {
        if (!moversUp.includes(r) && !moversDown.includes(r)) {
          stayers.push(r);
        }
      });
    });
  }

  // Assign new court positions
  // Movers go to adjacent courts; stayers maintain court
  let movingUpIndex = 0;
  let movingDownIndex = 0;

  // For next session, rebalance movements between courts
  // This is simplified - in production, queue movers for next session
  [
    ...stayers,
    ...moversUp,
    ...moversDown,
  ].forEach((result) => {
    newAssignments[result.playerId] = result.courtNumber;
  });

  return newAssignments;
}

/**
 * Create standings snapshot for persistence
 */
export function createStandingsSnapshot(
  sessionId: string,
  results: PlayerSessionResult[]
): StandingsSnapshotDoc {
  const courtCount = Math.max(...results.map((r) => r.courtNumber));

  const byCourtNum: Record<number, PlayerSessionResult[]> = {};
  results.forEach((r) => {
    const bucket = byCourtNum[r.courtNumber] || (byCourtNum[r.courtNumber] = []);
    bucket.push(r);
  });

  return {
    id: `${sessionId}_standings`,
    sessionId: sessionId,
    snapshotAt: new Date().toISOString(),
    resultsByPlayer: results,
    resultsByCourtAndRank: byCourtNum,
    totalPlayers: results.length,
    totalCourts: courtCount,
  };
}

/**
 * Update cumulative player statistics
 */
export function updateCumulativeStats(
  currentStats: Record<string, any> | undefined,
  sessionResults: PlayerSessionResult[]
): Record<string, PlayerStats> {
  const updated: Record<string, PlayerStats> = {};

  sessionResults.forEach((result) => {
    const existing = currentStats?.[result.playerId] || {
      matches: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      sessionsPlayed: 0,
      totalWins: 0,
      totalLosses: 0,
      cumulativePointsFor: 0,
      cumulativePointsAgainst: 0,
    };

    updated[result.playerId] = {
      matches: existing.matches || 0,
      wins: existing.wins || 0,
      losses: existing.losses || 0,
      pointsFor: existing.pointsFor || 0,
      pointsAgainst: existing.pointsAgainst || 0,
      sessionsPlayed: (existing.sessionsPlayed || 0) + 1,
      totalWins: (existing.totalWins || 0) + result.wins,
      totalLosses: (existing.totalLosses || 0) + result.losses,
      cumulativePointsFor: (existing.cumulativePointsFor || 0) + result.pointsFor,
      cumulativePointsAgainst:
        (existing.cumulativePointsAgainst || 0) + result.pointsAgainst,
    };
  });

  return updated;
}

/**
 * Check if session is ready for finalization
 * All matches must be either verified or admin-assigned
 */
export function isSessionReadyForFinalization(matches: LadderMatchDoc[]): {
  ready: boolean;
  incompleteMatches: LadderMatchDoc[];
} {
  const incomplete = matches.filter(
    (m) => m.status !== "VERIFIED" && m.status !== "ADMIN_ASSIGNED"
  );

  return {
    ready: incomplete.length === 0,
    incompleteMatches: incomplete,
  };
}
