import { describe, it, expect } from "vitest";
import { generateSingleElim, nextPowerOfTwo } from "./singleElim";
import { advanceMatch } from "./progression";
import type { Entrant } from "./types";

function mkEntrants(n: number, withRating = false): Entrant[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    ...(withRating ? { rating: 2000 - i * 10 } : {}),
  }));
}

describe("nextPowerOfTwo", () => {
  it("handles edges and powers", () => {
    expect(nextPowerOfTwo(1)).toBe(2);
    expect(nextPowerOfTwo(2)).toBe(2);
    expect(nextPowerOfTwo(3)).toBe(4);
    expect(nextPowerOfTwo(8)).toBe(8);
    expect(nextPowerOfTwo(9)).toBe(16);
    expect(nextPowerOfTwo(33)).toBe(64);
  });
});

describe("generateSingleElim", () => {
  it("creates log2(N) rounds for power-of-two fields", () => {
    const b = generateSingleElim({
      entrants: mkEntrants(8, true),
      seeding: { method: "RANK_BASED" },
    });
    expect(b.rounds).toHaveLength(3);
    expect(b.rounds[0]!.nodeIds).toHaveLength(4);
    expect(b.rounds[2]!.label).toBe("Final");
  });

  it("places top seed opposite lowest seed in round 0", () => {
    const b = generateSingleElim({
      entrants: mkEntrants(8, true),
      seeding: { method: "RANK_BASED" },
    });
    const first = b.nodes[b.rounds[0]!.nodeIds[0]!]!;
    expect(first.seedA).toBe(1);
    expect(first.seedB).toBe(8);
  });

  it("auto-advances BYEs for non-power-of-two fields", () => {
    // 5 entrants → 8 slots, 3 BYEs; top seeds should receive BYEs.
    const b = generateSingleElim({
      entrants: mkEntrants(5, true),
      seeding: { method: "RANK_BASED" },
    });
    // Round 1 should already contain top seed as a pre-advanced entrant.
    const r1 = b.rounds[1]!.nodeIds.map((id) => b.nodes[id]!);
    const pseudoAdvanced = r1.some((n) => n.a === "p1" || n.b === "p1");
    expect(pseudoAdvanced).toBe(true);
  });

  it("wires winnerNext for every non-final node", () => {
    const b = generateSingleElim({
      entrants: mkEntrants(16, true),
      seeding: { method: "RANK_BASED" },
    });
    for (let r = 0; r < b.rounds.length - 1; r++) {
      for (const id of b.rounds[r]!.nodeIds) {
        expect(b.nodes[id]!.winnerNext).toBeDefined();
      }
    }
    // Final has no winnerNext.
    const finalId = b.rounds[b.rounds.length - 1]!.nodeIds[0]!;
    expect(b.nodes[finalId]!.winnerNext).toBeUndefined();
  });

  it("propagates winners through the tree via advanceMatch", () => {
    const b = generateSingleElim({
      entrants: mkEntrants(4, true),
      seeding: { method: "RANK_BASED" },
    });
    // Round 0: two matches. Advance both A-side winners.
    const [n1, n2] = b.rounds[0]!.nodeIds;
    advanceMatch([b], n1!, "A");
    advanceMatch([b], n2!, "A");
    const finalId = b.rounds[1]!.nodeIds[0]!;
    const finalNode = b.nodes[finalId]!;
    expect(finalNode.a).not.toBeNull();
    expect(finalNode.b).not.toBeNull();
  });

  it("is deterministic for RANDOM seeding with fixed rngSeed", () => {
    const input = { entrants: mkEntrants(8), seeding: { method: "RANDOM" as const, rngSeed: 42 } };
    const a = generateSingleElim(input);
    const b = generateSingleElim(input);
    expect(JSON.stringify(a.initialSeeding)).toBe(JSON.stringify(b.initialSeeding));
  });
});
