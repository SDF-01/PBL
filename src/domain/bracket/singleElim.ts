/**
 * Single-elimination bracket generation.
 *
 * Algorithm:
 *  1. Assign seeds per SeedingOptions.
 *  2. Compute bracketSize = nextPowerOfTwo(entrantCount).
 *  3. Place BYEs at positions that pair them with top seeds first.
 *  4. Build round 0 from standardSeedOrder(bracketSize).
 *  5. Construct subsequent rounds; wire winner pointers.
 *  6. Auto-advance through BYEs so top seeds appear in round 1 immediately.
 */
import type {
  Bracket,
  BracketNode,
  Entrant,
  GenerateSingleElimInput,
  NodeId,
  BracketRound,
} from "./types";
import { assignSeeds, standardSeedOrder } from "./seeding";

export function nextPowerOfTwo(n: number): number {
  if (n < 2) return 2;
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function roundLabel(roundsTotal: number, roundIndex: number): string {
  const fromEnd = roundsTotal - 1 - roundIndex;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinals";
  if (fromEnd === 2) return "Quarterfinals";
  if (fromEnd === 3) return "Round of 16";
  if (fromEnd === 4) return "Round of 32";
  if (fromEnd === 5) return "Round of 64";
  return `Round ${roundIndex + 1}`;
}

export function generateSingleElim(input: GenerateSingleElimInput): Bracket {
  const seeded = assignSeeds(input.entrants, input.seeding);
  const entrantBySeed = new Map<number, Entrant>();
  for (const e of seeded) entrantBySeed.set(e.seed!, e);

  const bracketSize = nextPowerOfTwo(seeded.length);
  const totalRounds = Math.log2(bracketSize);
  const order = standardSeedOrder(bracketSize);

  const nodes: Record<NodeId, BracketNode> = {};
  const rounds: BracketRound[] = [];
  const mkId = (r: number, p: number) => `n-${r}-${p}`;

  // Build empty nodes for all rounds.
  for (let r = 0; r < totalRounds; r++) {
    const nodesInRound = bracketSize / Math.pow(2, r + 1);
    const round: BracketRound = {
      index: r,
      label: roundLabel(totalRounds, r),
      nodeIds: [],
    };
    for (let p = 0; p < nodesInRound; p++) {
      const node: BracketNode = {
        id: mkId(r, p),
        roundIndex: r,
        positionInRound: p,
        a: null,
        b: null,
        isByeA: false,
        isByeB: false,
      };
      nodes[node.id] = node;
      round.nodeIds.push(node.id);
    }
    rounds.push(round);
  }

  // Wire winner pointers (r → r+1).
  for (let r = 0; r < totalRounds - 1; r++) {
    const round = rounds[r]!;
    for (let p = 0; p < round.nodeIds.length; p++) {
      const node = nodes[round.nodeIds[p]!]!;
      const nextP = Math.floor(p / 2);
      const nextSide: "A" | "B" = p % 2 === 0 ? "A" : "B";
      node.winnerNext = { nodeId: mkId(r + 1, nextP), side: nextSide };
    }
  }

  // Fill round 0 per standardSeedOrder pairing: slot 2k vs 2k+1.
  const initialSeeding: Bracket["initialSeeding"] = [];
  for (let i = 0; i < order.length; i += 2) {
    const p = i / 2;
    const node = nodes[mkId(0, p)]!;
    const seedA = order[i]!;
    const seedB = order[i + 1]!;
    const ea = entrantBySeed.get(seedA) ?? null;
    const eb = entrantBySeed.get(seedB) ?? null;

    node.seedA = seedA;
    node.seedB = seedB;
    node.a = ea?.id ?? null;
    node.b = eb?.id ?? null;
    node.isByeA = ea == null;
    node.isByeB = eb == null;

    initialSeeding.push(
      { nodeId: node.id, side: "A", entrantId: ea?.id ?? null, isBye: ea == null, seed: seedA },
      { nodeId: node.id, side: "B", entrantId: eb?.id ?? null, isBye: eb == null, seed: seedB },
    );
  }

  // Auto-advance through BYEs: if one side is BYE and the other has an entrant,
  // propagate that entrant into the next round's slot.
  for (let r = 0; r < totalRounds - 1; r++) {
    for (const id of rounds[r]!.nodeIds) {
      const node = nodes[id]!;
      const aReal = node.a != null && !node.isByeA;
      const bReal = node.b != null && !node.isByeB;
      // Only auto-advance if exactly one is real AND the other is a true BYE.
      if (aReal !== bReal && (node.isByeA || node.isByeB) && node.winnerNext) {
        const winnerEntrant = aReal ? node.a! : node.b!;
        const nextNode = nodes[node.winnerNext.nodeId]!;
        if (node.winnerNext.side === "A") {
          nextNode.a = winnerEntrant;
          nextNode.seedA = aReal ? node.seedA : node.seedB;
        } else {
          nextNode.b = winnerEntrant;
          nextNode.seedB = aReal ? node.seedA : node.seedB;
        }
      }
    }
  }

  return {
    type: "SINGLE_ELIM",
    side: "main",
    rounds,
    nodes,
    initialSeeding,
  };
}
