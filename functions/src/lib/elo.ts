// Parallel copy of src/lib/players/elo.ts. Keep in sync with the client
// copy until a shared package extracts pure domain logic.

export const STARTING_ELO = 1500;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export interface PlayerRating {
  userId: string;
  elo: number;
  matches: number;
}

export interface MatchOutcome {
  sideA: PlayerRating[];
  sideB: PlayerRating[];
  scoreA: number;
  scoreB: number;
  targetPoints: number;
}

export interface EloDelta {
  userId: string;
  before: number;
  after: number;
  delta: number;
}

function kFactor(matches: number): number {
  if (matches < 5) return 40;
  if (matches < 15) return 32;
  if (matches < 30) return 28;
  return 24;
}

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
