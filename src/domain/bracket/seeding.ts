/**
 * Seeding strategies for the bracket engine.
 * All seeding is deterministic given the same rngSeed.
 */
import type { Entrant, SeedingOptions } from "./types";

/** Deterministic PRNG (Mulberry32). Reproducible across JS runtimes. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates using provided rng. Does not mutate input. */
export function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/**
 * Assign seed numbers (1..N) to entrants.
 *  - MANUAL:     respect existing `seed`; missing seeds appended in original order.
 *  - RANK_BASED: descending by rating; ties broken deterministically by id.
 *  - RANDOM:     deterministic shuffle by rngSeed.
 *  - SNAKE:      snake through pools; at single-bracket level treated as RANK_BASED.
 */
export function assignSeeds(entrants: Entrant[], options: SeedingOptions): Entrant[] {
  const { method, rngSeed = 1 } = options;

  switch (method) {
    case "MANUAL": {
      const seeded = entrants.filter((e) => typeof e.seed === "number").sort((a, b) => a.seed! - b.seed!);
      const unseeded = entrants.filter((e) => typeof e.seed !== "number");
      const result: Entrant[] = [];
      let next = 1;
      for (const e of seeded) { result.push({ ...e, seed: next++ }); }
      for (const e of unseeded) { result.push({ ...e, seed: next++ }); }
      return result;
    }
    case "RANK_BASED":
    case "SNAKE": {
      return entrants
        .slice()
        .sort((a, b) => {
          const ra = a.rating ?? 0;
          const rb = b.rating ?? 0;
          if (rb !== ra) return rb - ra;
          return a.id.localeCompare(b.id);
        })
        .map((e, i) => ({ ...e, seed: i + 1 }));
    }
    case "RANDOM": {
      const rng = mulberry32(rngSeed);
      return shuffle(entrants, rng).map((e, i) => ({ ...e, seed: i + 1 }));
    }
    default: {
      const _exhaustive: never = method;
      return _exhaustive;
    }
  }
}

/**
 * Classic bracket seed order for a power-of-two field.
 * For N=8 → [1,8,4,5,2,7,3,6] (top-seed vs lowest, etc.).
 *
 * Produced recursively:
 *   f(2) = [1,2]
 *   f(2k) = interleave(f(k), (2k+1 - f(k)))
 */
export function standardSeedOrder(size: number): number[] {
  if (size < 2 || (size & (size - 1)) !== 0) {
    throw new Error(`standardSeedOrder requires a power-of-two size, got ${size}`);
  }
  let order = [1, 2];
  while (order.length < size) {
    const next: number[] = [];
    const sum = order.length * 2 + 1;
    for (const s of order) {
      next.push(s);
      next.push(sum - s);
    }
    order = next;
  }
  return order;
}

/** Snake seeding across pools for pool play (1,2,3..N,N,N-1,...) */
export function snakePools(seededEntrants: Entrant[], poolCount: number): Entrant[][] {
  const pools: Entrant[][] = Array.from({ length: poolCount }, () => []);
  let dir: 1 | -1 = 1;
  let idx = 0;
  for (const e of seededEntrants) {
    pools[idx]!.push(e);
    if (dir === 1) {
      if (idx === poolCount - 1) { dir = -1; } else { idx++; }
    } else {
      if (idx === 0) { dir = 1; } else { idx--; }
    }
  }
  return pools;
}
