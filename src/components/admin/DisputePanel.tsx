"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Shield, RefreshCw } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { listDisputedMatches } from "@/lib/ladder/repo";
import { adminAssignMatchResult, verifyLadderMatchScore } from "@/lib/ladder/write";
import { useAuth } from "@/lib/auth-context";
import type { LadderMatchDoc } from "@/lib/firestore/types";

export function DisputePanel() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<LadderMatchDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const rows = await listDisputedMatches();
      setMatches(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load disputes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function handleAccept(match: LadderMatchDoc) {
    if (!user) return;
    setResolving(match.id);
    try {
      await verifyLadderMatchScore(match.id, user.uid);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept score");
    } finally {
      setResolving(null);
    }
  }

  async function handleOverride(match: LadderMatchDoc, scoreA: number, scoreB: number) {
    if (!user) return;
    setResolving(match.id);
    try {
      await adminAssignMatchResult(match.id, scoreA, scoreB, user.uid);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to override score");
    } finally {
      setResolving(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-gold-400" />
          <h2 className="heading-fantasy text-ash-100 text-lg">Disputed Scores</h2>
          {matches.length > 0 && (
            <RuneChip tone="warning">{matches.length}</RuneChip>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {error && (
        <Panel variant="base" padding="sm">
          <p className="text-crimson-500 text-sm">{error}</p>
        </Panel>
      )}

      {loading ? (
        <Panel variant="base" padding="md">
          <p className="text-ash-400 text-sm">Loading disputes…</p>
        </Panel>
      ) : matches.length === 0 ? (
        <Panel variant="base" padding="lg" className="text-center space-y-2">
          <CheckCircle className="h-8 w-8 text-spectral-400 mx-auto" />
          <p className="text-ash-400 text-sm">No disputed scores. All clear.</p>
        </Panel>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <DisputeCard
              key={m.id}
              match={m}
              resolving={resolving === m.id}
              onAccept={() => handleAccept(m)}
              onOverride={(a, b) => handleOverride(m, a, b)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DisputeCard({
  match,
  resolving,
  onAccept,
  onOverride,
}: {
  match: LadderMatchDoc;
  resolving: boolean;
  onAccept: () => void;
  onOverride: (scoreA: number, scoreB: number) => void;
}) {
  const [overrideMode, setOverrideMode] = useState(false);
  const [oA, setOA] = useState(match.scoreA ?? 0);
  const [oB, setOB] = useState(match.scoreB ?? 0);

  return (
    <Panel variant="inventory" padding="md" className="space-y-3">
      <div className="flex items-start gap-3 flex-wrap">
        <RuneChip tone="warning" className="shrink-0">DISPUTED</RuneChip>
        <div className="flex-1 min-w-0">
          <p className="text-ash-200 text-sm font-semibold">Game {match.gameNumber}</p>
          <p className="text-ash-500 text-xs font-mono">Session: {match.sessionId.slice(0, 12)}…</p>
          {(match as LadderMatchDoc & { disputeReason?: string }).disputeReason && (
            <p className="text-gold-300 text-xs mt-1">
              Reason: {(match as LadderMatchDoc & { disputeReason?: string }).disputeReason}
            </p>
          )}
        </div>
        <div className="text-ash-100 font-mono text-lg">
          {match.scoreA ?? "?"} – {match.scoreB ?? "?"}
        </div>
      </div>

      <div className="text-[11px] text-ash-500 flex gap-4 flex-wrap">
        <span>Side A: {match.sideA.join(", ")}</span>
        <span>Side B: {match.sideB.join(", ")}</span>
      </div>

      {overrideMode ? (
        <div className="space-y-3 pt-2 border-t border-obsidian-600">
          <p className="text-ash-400 text-xs">Override scores:</p>
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <label className="text-[10px] text-ash-500 uppercase tracking-widest block mb-1">Side A</label>
              <input
                type="number"
                className="w-full bg-obsidian-700 border border-ash-700 rounded px-3 py-1.5 text-ash-100 text-sm"
                value={oA}
                min={0}
                onChange={(e) => setOA(Number(e.target.value))}
              />
            </div>
            <span className="text-ash-500 mt-4">–</span>
            <div className="flex-1">
              <label className="text-[10px] text-ash-500 uppercase tracking-widest block mb-1">Side B</label>
              <input
                type="number"
                className="w-full bg-obsidian-700 border border-ash-700 rounded px-3 py-1.5 text-ash-100 text-sm"
                value={oB}
                min={0}
                onChange={(e) => setOB(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setOverrideMode(false)} disabled={resolving}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => onOverride(oA, oB)}
              disabled={resolving || oA === oB}
            >
              <Shield className="h-3.5 w-3.5" />
              {resolving ? "Saving…" : "Confirm Override"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 pt-2 border-t border-obsidian-600">
          <Button size="sm" variant="outline" onClick={() => setOverrideMode(true)} disabled={resolving}>
            Override Score
          </Button>
          <Button
            size="sm"
            onClick={onAccept}
            disabled={resolving || match.scoreA == null || match.scoreB == null}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            {resolving ? "Resolving…" : "Accept Submitted Score"}
          </Button>
        </div>
      )}
    </Panel>
  );
}
