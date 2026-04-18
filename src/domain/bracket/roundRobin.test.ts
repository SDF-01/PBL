import { describe, it, expect } from "vitest";
import { circleRoundRobin, generatePoolPlay } from "./roundRobin";
import { computeStandings } from "./standings";
import type { Entrant } from "./types";

const mk = (n: number): Entrant[] => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, rating: 2000 - i * 10 }));

describe("circleRoundRobin", () => {
  it("produces N-1 rounds with N/2 pairings (even N)", () => {
    const s = circleRoundRobin(mk(6));
    expect(s.rounds).toHaveLength(5);
    for (const r of s.rounds) expect(r.pairings).toHaveLength(3);
  });

  it("every pair plays exactly once (odd N with BYE)", () => {
    const entrants = mk(5);
    const s = circleRoundRobin(entrants);
    const played = new Set<string>();
    for (const r of s.rounds) {
      for (const p of r.pairings) {
        if (p.b == null) continue;
        const key = [p.a, p.b].sort().join("|");
        expect(played.has(key)).toBe(false);
        played.add(key);
      }
    }
    // C(5,2) = 10
    expect(played.size).toBe(10);
  });
});

describe("generatePoolPlay", () => {
  it("distributes entrants across pools via snake seeding", () => {
    const pp = generatePoolPlay(mk(8), { method: "RANK_BASED" }, { pools: 2 });
    expect(pp.pools).toHaveLength(2);
    const ids = pp.pools.flatMap((p) => p.entrants);
    expect(new Set(ids).size).toBe(8);
  });
});

describe("computeStandings", () => {
  it("ranks by wins then point differential", () => {
    const rows = computeStandings(
      ["a", "b", "c"],
      [
        { aId: "a", bId: "b", winner: "A", pointsA: 11, pointsB: 5 },
        { aId: "b", bId: "c", winner: "A", pointsA: 11, pointsB: 9 },
        { aId: "a", bId: "c", winner: "A", pointsA: 11, pointsB: 7 },
      ],
    );
    expect(rows[0]!.entrantId).toBe("a");
    expect(rows[0]!.wins).toBe(2);
  });
});
