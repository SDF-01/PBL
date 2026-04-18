/**
 * Round-Robin scheduling using the circle method.
 * Supports pool play via snake seeding.
 */
import type {
  Entrant,
  RoundRobinSchedule,
  PoolPlay,
  RoundRobinConfig,
  SeedingOptions,
} from "./types";
import { assignSeeds, snakePools } from "./seeding";

/**
 * Circle method for N entrants (N even; insert virtual BYE if odd).
 * Produces N-1 rounds with N/2 pairings per round.
 */
export function circleRoundRobin(entrants: Entrant[]): RoundRobinSchedule {
  const BYE = "__BYE__";
  const working: Array<string> = entrants.map((e) => e.id);
  if (working.length % 2 === 1) working.push(BYE);

  const n = working.length;
  const rounds: RoundRobinSchedule["rounds"] = [];

  // Fix element 0; rotate the rest.
  const rotating = working.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const pairings: Array<{ a: string; b: string | null }> = [];
    const left: string[] = [working[0]!, ...rotating.slice(0, n / 2 - 1)];
    const right: string[] = rotating.slice(n / 2 - 1).reverse();

    for (let i = 0; i < n / 2; i++) {
      const a = left[i]!;
      const b = right[i]!;
      if (a === BYE) { pairings.push({ a: b!, b: null }); }
      else if (b === BYE) { pairings.push({ a, b: null }); }
      else { pairings.push({ a, b }); }
    }
    rounds.push({ index: r, pairings });

    // Rotate: move first of rotating to end.
    rotating.unshift(rotating.pop()!);
  }

  return { type: "ROUND_ROBIN", rounds };
}

export function generatePoolPlay(
  entrants: Entrant[],
  seeding: SeedingOptions,
  config: RoundRobinConfig,
): PoolPlay {
  const seeded = assignSeeds(entrants, seeding);
  const poolCount = Math.max(1, config.pools ?? 1);
  const pools = snakePools(seeded, poolCount);

  return {
    type: "POOL_PLAY",
    pools: pools.map((entrantsInPool, i) => ({
      label: `Pool ${String.fromCharCode(65 + i)}`,
      entrants: entrantsInPool.map((e) => e.id),
      schedule: circleRoundRobin(entrantsInPool),
    })),
  };
}
