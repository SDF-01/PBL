/**
 * Classic Elo with a doubles-match adaptation.
 *
 * We compute expected score using the *average* rating of each side and
 * apply one symmetric delta to the winning side and the mirror delta to
 * the losing side. Partners on the same side receive the same delta
 * so teammates share credit / blame equally.
 *
 * K-factor scales with experience (provisional up to 30 matches) and
 * with the absolute score margin — blowouts swing more than nail-biters.
 */

export const STARTING_ELO = 1500;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export interface PlayerRating {
  userId: string;
  elo: number;
  /** Number of matches previously played. Drives provisional K. */
  matches: number;
}

export interface MatchOutcome {
  sideA: PlayerRating[]; // length 1 (singles) or 2 (doubles)
  sideB: PlayerRating[];
  scoreA: number;
  scoreB: number;
  /** Configured target points for the match. Used to scale margin weight. */
  targetPoints: number;
}

export interface EloDelta {
  userId: string;
  before: number;
  after: number;
  delta: number;
}

function kFactor(matches: number): number {
  // Provisional boost for first 30 matches, then steady 24.
  if (matches < 5) return 40;
  if (matches < 15) return 32;
  if (matches < 30) return 28;
  return 24;
}

/**
 * Returns per-player ELO deltas for a completed match. Side with the
 * higher score is the winner; ties are not accepted (throws).
 */
export function computeEloDeltas(m: MatchOutcome): EloDelta[] {
  if (m.sideA.length === 0 || m.sideB.length === 0) {
    throw new Error("Both sides must have at least one player.");
  }
  if (m.scoreA === m.scoreB) {
    throw new Error("Match cannot end in a tie.");
  }
  const avgA = avg(m.sideA.map((p) => p.elo));
  const avgB = avg(m.sideB.map((p) => p.elo));
  const expA = expectedScore(avgA, avgB);

  const winnerA = m.scoreA > m.scoreB;
  const actualA = winnerA ? 1 : 0;
  const actualB = 1 - actualA;

  // Margin multiplier: 1.0 at exactly target-points-to-1, scaling toward
  // 1.5 for a shutout. Never below 0.8 for a 1-point win.
  const margin = Math.abs(m.scoreA - m.scoreB);
  const marginMult = Math.max(
    0.8,
    Math.min(1.5, 0.8 + (margin / Math.max(1, m.targetPoints)) * 0.7),
  );

  const deltas: EloDelta[] = [];
  for (const p of m.sideA) {
    const k = kFactor(p.matches);
    const change = Math.round(k * marginMult * (actualA - expA));
    deltas.push({
      userId: p.userId,
      before: p.elo,
      after: p.elo + change,
      delta: change,
    });
  }
  for (const p of m.sideB) {
    const k = kFactor(p.matches);
    const change = Math.round(k * marginMult * (actualB - (1 - expA)));
    deltas.push({
      userId: p.userId,
      before: p.elo,
      after: p.elo + change,
      delta: change,
    });
  }
  return deltas;
}

function avg(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function skillBand(
  elo: number,
):
  | "NOVICE"
  | "BEGINNER"
  | "INTERMEDIATE"
  | "ADVANCED"
  | "EXPERT"
  | "ELITE" {
  if (elo < 1200) return "NOVICE";
  if (elo < 1400) return "BEGINNER";
  if (elo < 1600) return "INTERMEDIATE";
  if (elo < 1800) return "ADVANCED";
  if (elo < 2000) return "EXPERT";
  return "ELITE";
}
