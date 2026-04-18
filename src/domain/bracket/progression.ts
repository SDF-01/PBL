/**
 * Progression — pure functions that mutate a Bracket given match outcomes.
 * The engine does not talk to the database. Callers project changes to Prisma.
 */
import type { Bracket, BracketNode, NodeId, Side } from "./types";

export type Winner = "A" | "B";

export interface AdvanceResult {
  /** The node that was resolved. */
  nodeId: NodeId;
  /** The next nodes the entrant moved into, if any. */
  propagated: Array<{ nodeId: NodeId; side: Side; entrantId: string }>;
}

/**
 * Advance a node's winner (and, for double-elim brackets, loser) to their
 * next routed nodes. Idempotent: re-calling with the same winner is a no-op.
 *
 * `brackets` is an ordered list; for double-elim pass [winners, losers, grandFinal].
 * Routing is resolved by node id across brackets.
 */
export function advanceMatch(
  brackets: Bracket[],
  nodeId: NodeId,
  winner: Winner,
): AdvanceResult {
  const { node } = findNode(brackets, nodeId);
  const winnerEntrant = winner === "A" ? node.a : node.b;
  const loserEntrant = winner === "A" ? node.b : node.a;
  const winnerSeed = winner === "A" ? node.seedA : node.seedB;
  const loserSeed = winner === "A" ? node.seedB : node.seedA;

  if (winnerEntrant == null) {
    throw new Error(`Cannot advance ${nodeId}: winning side has no entrant.`);
  }

  const propagated: AdvanceResult["propagated"] = [];

  if (node.winnerNext) {
    const target = findNode(brackets, node.winnerNext.nodeId).node;
    assignSide(target, node.winnerNext.side, winnerEntrant, winnerSeed);
    propagated.push({ nodeId: target.id, side: node.winnerNext.side, entrantId: winnerEntrant });
  }
  if (node.loserNext && loserEntrant != null) {
    const target = findNode(brackets, node.loserNext.nodeId).node;
    assignSide(target, node.loserNext.side, loserEntrant, loserSeed);
    propagated.push({ nodeId: target.id, side: node.loserNext.side, entrantId: loserEntrant });
  }

  return { nodeId, propagated };
}

/**
 * Undo an advancement. Clears the winner/loser placements on downstream
 * nodes IF those downstream nodes haven't yet been resolved themselves.
 * Throws if a downstream node has already propagated — admins must undo
 * downstream first. This preserves audit integrity.
 */
export function undoAdvancement(brackets: Bracket[], nodeId: NodeId): void {
  const { node } = findNode(brackets, nodeId);

  const refs: Array<{ nodeId: NodeId; side: Side }> = [];
  if (node.winnerNext) refs.push(node.winnerNext);
  if (node.loserNext) refs.push(node.loserNext);

  for (const ref of refs) {
    const target = findNode(brackets, ref.nodeId).node;
    // Safety: if target has already been advanced, its winner would be set in a
    // further downstream node. We detect by checking if the target has a nextNode
    // that already references the entrant at target[side].
    if (isAlreadyAdvanced(brackets, target)) {
      throw new Error(
        `Cannot undo ${nodeId}: downstream node ${target.id} already advanced. Undo downstream first.`,
      );
    }
    clearSide(target, ref.side);
  }
}

function isAlreadyAdvanced(brackets: Bracket[], node: BracketNode): boolean {
  if (!node.winnerNext) return false;
  const { node: next } = findNode(brackets, node.winnerNext.nodeId);
  const sideVal = node.winnerNext.side === "A" ? next.a : next.b;
  return sideVal != null;
}

function assignSide(node: BracketNode, side: Side, entrantId: string, seed?: number) {
  if (side === "A") { node.a = entrantId; node.seedA = seed; node.isByeA = false; }
  else { node.b = entrantId; node.seedB = seed; node.isByeB = false; }
}
function clearSide(node: BracketNode, side: Side) {
  if (side === "A") { node.a = null; node.seedA = undefined; }
  else { node.b = null; node.seedB = undefined; }
}

function findNode(brackets: Bracket[], nodeId: NodeId): { bracket: Bracket; node: BracketNode } {
  for (const b of brackets) {
    const n = b.nodes[nodeId];
    if (n) return { bracket: b, node: n };
  }
  throw new Error(`Node ${nodeId} not found in provided brackets.`);
}
