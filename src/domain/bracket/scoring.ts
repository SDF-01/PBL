/**
 * Pickleball score validation.
 * Rules modeled after standard pickleball:
 *  - Games are played to a target (11/15/21) — win by 2.
 *  - Matches are best-of-N games.
 *  - Retirement / DQ / Forfeit are terminal outcomes regardless of score.
 */

export type ScoringFormat =
  | "BEST_OF_3_TO_11_WIN_BY_2"
  | "BEST_OF_3_TO_15"
  | "SINGLE_GAME_TO_15"
  | "SINGLE_GAME_TO_21"
  | "BEST_OF_5_TO_11"
  | "CUSTOM";

export interface ScoringRules {
  target: number;
  winBy: number;
  bestOf: number;
}

const PRESETS: Record<Exclude<ScoringFormat, "CUSTOM">, ScoringRules> = {
  BEST_OF_3_TO_11_WIN_BY_2: { target: 11, winBy: 2, bestOf: 3 },
  BEST_OF_3_TO_15:          { target: 15, winBy: 2, bestOf: 3 },
  SINGLE_GAME_TO_15:        { target: 15, winBy: 2, bestOf: 1 },
  SINGLE_GAME_TO_21:        { target: 21, winBy: 2, bestOf: 1 },
  BEST_OF_5_TO_11:          { target: 11, winBy: 2, bestOf: 5 },
};

export function resolveRules(format: ScoringFormat, custom?: ScoringRules): ScoringRules {
  if (format === "CUSTOM") {
    if (!custom) throw new Error("CUSTOM scoring format requires explicit rules.");
    return custom;
  }
  return PRESETS[format];
}

export interface GameScore { a: number; b: number; }

export type Validation =
  | { valid: true; winner: "A" | "B"; gamesA: number; gamesB: number }
  | { valid: false; reason: string };

export function validateMatchScore(games: GameScore[], rules: ScoringRules): Validation {
  if (games.length === 0) return { valid: false, reason: "No games reported." };
  const gamesNeeded = Math.floor(rules.bestOf / 2) + 1;
  let gamesA = 0, gamesB = 0;

  for (let i = 0; i < games.length; i++) {
    const g = games[i]!;
    const gv = validateGame(g, rules);
    if (!gv.valid) return { valid: false, reason: `Game ${i + 1}: ${gv.reason}` };
    if (gv.winner === "A") gamesA++; else gamesB++;

    // Stop if one player has reached games-needed; further games should not exist.
    if (gamesA === gamesNeeded || gamesB === gamesNeeded) {
      if (i !== games.length - 1) {
        return { valid: false, reason: "Extra games reported after match decided." };
      }
    }
  }
  if (gamesA !== gamesNeeded && gamesB !== gamesNeeded) {
    return { valid: false, reason: "Match not complete: no player reached required game wins." };
  }
  return { valid: true, winner: gamesA > gamesB ? "A" : "B", gamesA, gamesB };
}

export function validateGame(g: GameScore, rules: ScoringRules): { valid: true; winner: "A" | "B" } | { valid: false; reason: string } {
  if (g.a < 0 || g.b < 0 || !Number.isInteger(g.a) || !Number.isInteger(g.b)) {
    return { valid: false, reason: "Scores must be non-negative integers." };
  }
  const max = Math.max(g.a, g.b);
  const min = Math.min(g.a, g.b);
  if (max < rules.target) {
    return { valid: false, reason: `No player reached target ${rules.target}.` };
  }
  if (max - min < rules.winBy) {
    return { valid: false, reason: `Must win by ${rules.winBy}.` };
  }
  // Only winner can exceed target; losing score <= max - winBy.
  if (min > max - rules.winBy) {
    return { valid: false, reason: "Invalid score progression." };
  }
  return { valid: true, winner: g.a > g.b ? "A" : "B" };
}
