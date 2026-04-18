import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import type { Bracket, BracketNode } from "@/domain/bracket";

/**
 * Battle-Tree Bracket View (server-safe, no client JS required).
 * Renders rounds left→right with connector lines. For larger brackets, scrolls
 * horizontally on mobile — full responsive treatment comes later.
 *
 * Names are resolved via the `resolveName` prop so this component stays pure.
 */
export function BracketView({
  bracket,
  resolveName,
  highlightNodeId,
}: {
  bracket: Bracket;
  resolveName: (entrantId: string | null) => string;
  highlightNodeId?: string;
}) {
  return (
    <div className="relative overflow-x-auto pb-4">
      <div className="inline-flex gap-6 min-w-full">
        {bracket.rounds.map((round) => (
          <div key={round.index} className="flex flex-col gap-4 min-w-[220px]">
            <div className="heading-fantasy text-xs uppercase tracking-[0.2em] text-ash-400 pl-1">
              {round.label}
            </div>
            <div className="flex flex-col gap-6 justify-around h-full">
              {round.nodeIds.map((id) => {
                const node = bracket.nodes[id]!;
                return (
                  <MatchNode
                    key={id}
                    node={node}
                    resolveName={resolveName}
                    highlight={id === highlightNodeId}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchNode({
  node, resolveName, highlight,
}: {
  node: BracketNode;
  resolveName: (id: string | null) => string;
  highlight?: boolean;
}) {
  return (
    <Panel
      variant="raised"
      padding="none"
      glow={highlight ? "rune" : "none"}
      className={`text-sm ${highlight ? "animate-pulse-rune" : ""}`}
    >
      <Side node={node} side="A" resolveName={resolveName} />
      <div className="border-t border-obsidian-500" />
      <Side node={node} side="B" resolveName={resolveName} />
    </Panel>
  );
}

function Side({
  node, side, resolveName,
}: {
  node: BracketNode; side: "A" | "B"; resolveName: (id: string | null) => string;
}) {
  const isBye = side === "A" ? node.isByeA : node.isByeB;
  const entrantId = side === "A" ? node.a : node.b;
  const seed = side === "A" ? node.seedA : node.seedB;

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className="w-6 text-[10px] font-mono text-ash-500 tabular-nums">
        {seed ? `#${seed}` : ""}
      </span>
      <span className={`flex-1 truncate ${entrantId ? "text-ash-100" : "text-ash-500"}`}>
        {isBye ? <span className="text-ash-600 italic">— BYE —</span> : resolveName(entrantId) || "TBD"}
      </span>
      {entrantId && !isBye && (
        <RuneChip tone="neutral" className="shrink-0">—</RuneChip>
      )}
    </div>
  );
}
