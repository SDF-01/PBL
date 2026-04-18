/**
 * Standings computation for round-robin / pool play / season records.
 * Configurable tiebreak hierarchy.
 */
export interface MatchRecord {
  aId: string;
  bId: string;
  winner: "A" | "B" | "DRAW" | "FORFEIT_A" | "FORFEIT_B";
  pointsA: number;
  pointsB: number;
}

export interface StandingRow {
  entrantId: string;
  wins: number;
  losses: number;
  draws: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
  winPct: number;
  leaguePoints: number;
  /** Head-to-head map; +1 for win over opponent, -1 for loss. */
  h2h: Record<string, number>;
}

export type Tiebreak =
  | "WIN_PCT"
  | "LEAGUE_POINTS"
  | "HEAD_TO_HEAD"
  | "POINT_DIFFERENTIAL"
  | "POINTS_FOR"
  | "POINTS_AGAINST_INV";

export interface StandingsConfig {
  pointsPerWin?: number;
  pointsPerDraw?: number;
  pointsPerLoss?: number;
  tiebreaks?: Tiebreak[];
}

const DEFAULT_CONFIG: Required<StandingsConfig> = {
  pointsPerWin: 3,
  pointsPerDraw: 1,
  pointsPerLoss: 0,
  tiebreaks: ["WIN_PCT", "HEAD_TO_HEAD", "POINT_DIFFERENTIAL", "POINTS_FOR"],
};

export function computeStandings(
  entrants: string[],
  matches: MatchRecord[],
  config: StandingsConfig = {},
): StandingRow[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const rows = new Map<string, StandingRow>(
    entrants.map((id) => [id, emptyRow(id)]),
  );

  for (const m of matches) {
    const ra = rows.get(m.aId);
    const rb = rows.get(m.bId);
    if (!ra || !rb) continue;

    ra.pointsFor += m.pointsA;
    ra.pointsAgainst += m.pointsB;
    rb.pointsFor += m.pointsB;
    rb.pointsAgainst += m.pointsA;

    switch (m.winner) {
      case "A":
      case "FORFEIT_B":
        ra.wins++; rb.losses++;
        ra.leaguePoints += cfg.pointsPerWin; rb.leaguePoints += cfg.pointsPerLoss;
        ra.h2h[m.bId] = (ra.h2h[m.bId] ?? 0) + 1;
        rb.h2h[m.aId] = (rb.h2h[m.aId] ?? 0) - 1;
        break;
      case "B":
      case "FORFEIT_A":
        rb.wins++; ra.losses++;
        rb.leaguePoints += cfg.pointsPerWin; ra.leaguePoints += cfg.pointsPerLoss;
        rb.h2h[m.aId] = (rb.h2h[m.aId] ?? 0) + 1;
        ra.h2h[m.bId] = (ra.h2h[m.bId] ?? 0) - 1;
        break;
      case "DRAW":
        ra.draws++; rb.draws++;
        ra.leaguePoints += cfg.pointsPerDraw; rb.leaguePoints += cfg.pointsPerDraw;
        break;
    }
  }

  for (const row of rows.values()) {
    const played = row.wins + row.losses + row.draws;
    row.winPct = played === 0 ? 0 : row.wins / played;
    row.pointDifferential = row.pointsFor - row.pointsAgainst;
  }

  const arr = Array.from(rows.values());
  arr.sort((a, b) => compareByTiebreaks(a, b, cfg.tiebreaks));
  return arr;
}

function emptyRow(id: string): StandingRow {
  return {
    entrantId: id,
    wins: 0, losses: 0, draws: 0,
    pointsFor: 0, pointsAgainst: 0,
    pointDifferential: 0, winPct: 0, leaguePoints: 0,
    h2h: {},
  };
}

function compareByTiebreaks(a: StandingRow, b: StandingRow, order: Tiebreak[]): number {
  for (const t of order) {
    const diff = compare(a, b, t);
    if (diff !== 0) return diff;
  }
  return a.entrantId.localeCompare(b.entrantId);
}

function compare(a: StandingRow, b: StandingRow, t: Tiebreak): number {
  switch (t) {
    case "WIN_PCT": return b.winPct - a.winPct;
    case "LEAGUE_POINTS": return b.leaguePoints - a.leaguePoints;
    case "POINT_DIFFERENTIAL": return b.pointDifferential - a.pointDifferential;
    case "POINTS_FOR": return b.pointsFor - a.pointsFor;
    case "POINTS_AGAINST_INV": return a.pointsAgainst - b.pointsAgainst;
    case "HEAD_TO_HEAD": {
      const ab = a.h2h[b.entrantId] ?? 0;
      return -ab; // positive ab means a beat b more → a ranks higher
    }
  }
}
