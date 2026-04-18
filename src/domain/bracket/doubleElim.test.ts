import { describe, it, expect } from "vitest";
import { generateDoubleElim } from "./doubleElim";
import type { Entrant } from "./types";

const mkEntrants = (n: number): Entrant[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, rating: 2000 - i * 10 }));

describe("generateDoubleElim", () => {
  it("produces winners, losers, and grand final for N=8", () => {
    const r = generateDoubleElim({ entrants: mkEntrants(8), seeding: { method: "RANK_BASED" } });
    expect(r.winners.rounds).toHaveLength(3); // log2(8)
    expect(r.losers.rounds).toHaveLength(5);  // 2*log2(8) - 1
    expect(r.grandFinal.rounds).toHaveLength(1);
  });

  it("wires WB round 0 losers into LB round 0", () => {
    const r = generateDoubleElim({ entrants: mkEntrants(8), seeding: { method: "RANK_BASED" } });
    for (const id of r.winners.rounds[0]!.nodeIds) {
      expect(r.winners.nodes[id]!.loserNext).toBeDefined();
    }
  });

  it("wires WB final → GF side A and LB final → GF side B", () => {
    const r = generateDoubleElim({ entrants: mkEntrants(4), seeding: { method: "RANK_BASED" } });
    const wbFinal = r.winners.rounds.at(-1)!.nodeIds[0]!;
    const lbFinal = r.losers.rounds.at(-1)!.nodeIds[0]!;
    expect(r.winners.nodes[wbFinal]!.winnerNext).toEqual({ nodeId: "gf-0-0", side: "A" });
    expect(r.losers.nodes[lbFinal]!.winnerNext).toEqual({ nodeId: "gf-0-0", side: "B" });
  });

  it("LB node counts follow the expected pattern for N=8", () => {
    const r = generateDoubleElim({ entrants: mkEntrants(8), seeding: { method: "RANK_BASED" } });
    const counts = r.losers.rounds.map((x) => x.nodeIds.length);
    expect(counts).toEqual([2, 2, 1, 1, 1]);
  });
});
