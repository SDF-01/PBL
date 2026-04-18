/**
 * Double-elimination bracket generation.
 *
 * Structure:
 *  - Winners Bracket (WB): standard single-elim shape.
 *  - Losers Bracket (LB): every round has two phases:
 *      (a) survival phase — existing LB survivors play each other
 *      (b) drop-in phase  — WB losers from the parallel WB round drop in
 *    Round 0 of LB is the "drop-in" of WB round 0 losers (half the field).
 *  - Grand Final (GF): WB champion vs LB champion. Optional "reset match"
 *    if LB champion defeats WB champion (WB champion had 0 losses until then).
 *
 * This implementation produces a correct topology for entrant counts that are
 * powers of two (with BYE support handled similarly to single-elim for WB).
 * LB drop-in wiring uses the standard "alternating mirror" pattern used by
 * Challonge/BracketCloud-style double-elim.
 */
import type {
  Bracket,
  BracketNode,
  BracketRound,
  GenerateDoubleElimInput,
  NodeId,
} from "./types";
import { generateSingleElim, nextPowerOfTwo } from "./singleElim";

export interface DoubleElimResult {
  winners: Bracket;
  losers: Bracket;
  grandFinal: Bracket;  // 1 node (or 2 if reset is pre-scheduled on generation; we add lazily)
}

/**
 * Build the losers bracket skeleton for a power-of-two WB field.
 *
 * Entrants in WB: N (power of two).
 * Losers per WB round: N/2, N/4, N/8, ..., 1  (total log2(N) rounds in WB).
 * Losers bracket rounds: 2 * log2(N) - 1.
 *
 * Example N=8:
 *   WB rounds produce 4, 2, 1 losers.
 *   LB rounds:
 *     LB-R0: 4 losers from WB-R0 → 2 matches
 *     LB-R1: 2 survivors vs 2 WB-R1 losers → 2 matches   (drop-in round)
 *     LB-R2: 2 survivors → 1 match
 *     LB-R3: 1 survivor vs 1 WB-R2 loser → 1 match       (drop-in round)
 *     LB-R4: final → 1 match (LB champion)
 *   Total LB rounds = 5 = 2*log2(8) - 1. ✓
 */
function buildLosersBracket(winners: Bracket, wbSize: number): Bracket {
  const wbRounds = Math.log2(wbSize); // e.g. 3 for N=8
  const lbRoundsCount = 2 * wbRounds - 1;

  const nodes: Record<NodeId, BracketNode> = {};
  const rounds: BracketRound[] = [];
  const mkId = (r: number, p: number) => `lb-${r}-${p}`;

  // Node counts per LB round follow the pattern:
  //   r=0: wbSize/4 matches (pair up first-round WB losers)
  //   then alternating "survival" and "drop-in":
  //     after survival, count halves; after drop-in, count stays.
  // Concretely for N=8: [2, 2, 1, 1, 1]
  const counts: number[] = [];
  // first LB round merges WB-R0 losers in pairs
  let current = wbSize / 4;
  counts.push(current);
  for (let i = 1; i < lbRoundsCount; i++) {
    const isDropIn = i % 2 === 1; // after first pair-up, odd-indexed rounds are drop-in
    if (isDropIn) {
      // drop-in: count stays the same (survivors play dropped-in WB losers)
      counts.push(current);
    } else {
      // survival: count halves
      current = Math.max(1, current / 2);
      counts.push(current);
    }
  }

  // Build empty nodes
  for (let r = 0; r < lbRoundsCount; r++) {
    const round: BracketRound = { index: r, label: `Loser's Round ${r + 1}`, nodeIds: [] };
    for (let p = 0; p < counts[r]!; p++) {
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

  // Wire survival pointers (r → r+1) for survival transitions.
  for (let r = 0; r < lbRoundsCount - 1; r++) {
    const thisCount = counts[r]!;
    const nextCount = counts[r + 1]!;
    const halving = nextCount === thisCount / 2;
    for (let p = 0; p < thisCount; p++) {
      const node = nodes[mkId(r, p)]!;
      if (halving) {
        // standard pair-up
        const nextP = Math.floor(p / 2);
        const nextSide: "A" | "B" = p % 2 === 0 ? "A" : "B";
        node.winnerNext = { nodeId: mkId(r + 1, nextP), side: nextSide };
      } else {
        // drop-in round absorbs survivor into side A; WB loser drops into B
        node.winnerNext = { nodeId: mkId(r + 1, p), side: "A" };
      }
    }
  }
  // Final LB round's winner goes to grand final (wired by caller).

  // Wire WB losers into LB (loserNext on WB nodes).
  // WB-R0 losers → LB-R0 nodes (pairs).
  const wbRoundNodes = (r: number) => winners.rounds[r]!.nodeIds.map((id) => winners.nodes[id]!);

  {
    const wb0 = wbRoundNodes(0);
    for (let i = 0; i < wb0.length; i++) {
      const wbNode = wb0[i]!;
      const lbTargetP = Math.floor(i / 2);
      const lbSide: "A" | "B" = i % 2 === 0 ? "A" : "B";
      wbNode.loserNext = { nodeId: mkId(0, lbTargetP), side: lbSide };
    }
  }

  // WB-Rk losers (k >= 1) → LB drop-in round = 2k - 1.
  for (let k = 1; k < wbRounds; k++) {
    const wbK = wbRoundNodes(k);
    const dropInRound = 2 * k - 1;
    // Mirror mapping: reverse positions to balance bracket halves.
    for (let i = 0; i < wbK.length; i++) {
      const mirrored = wbK.length - 1 - i;
      wbK[i]!.loserNext = { nodeId: mkId(dropInRound, mirrored), side: "B" };
    }
  }

  return {
    type: "DOUBLE_ELIM",
    side: "losers",
    rounds,
    nodes,
    initialSeeding: [],
  };
}

export function generateDoubleElim(input: GenerateDoubleElimInput): DoubleElimResult {
  const winners = generateSingleElim(input);
  // Mark winners bracket side
  winners.side = "winners";
  winners.type = "DOUBLE_ELIM";

  const wbSize = nextPowerOfTwo(input.entrants.length);
  const losers = buildLosersBracket(winners, wbSize);

  // Grand final: single node (reset match added lazily if LB champion wins).
  const gfNodes: Record<NodeId, BracketNode> = {
    "gf-0-0": {
      id: "gf-0-0",
      roundIndex: 0,
      positionInRound: 0,
      a: null, b: null, isByeA: false, isByeB: false,
    },
  };
  const grandFinal: Bracket = {
    type: "DOUBLE_ELIM",
    side: "grand_final",
    rounds: [{ index: 0, label: "Grand Final", nodeIds: ["gf-0-0"] }],
    nodes: gfNodes,
    initialSeeding: [],
  };

  // Wire WB final → GF side A; LB final → GF side B.
  const wbFinal = winners.rounds[winners.rounds.length - 1]!;
  const wbFinalNode = winners.nodes[wbFinal.nodeIds[0]!]!;
  wbFinalNode.winnerNext = { nodeId: "gf-0-0", side: "A" };

  const lbFinal = losers.rounds[losers.rounds.length - 1]!;
  const lbFinalNode = losers.nodes[lbFinal.nodeIds[0]!]!;
  lbFinalNode.winnerNext = { nodeId: "gf-0-0", side: "B" };

  return { winners, losers, grandFinal };
}
