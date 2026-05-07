"use client";

import React, { useEffect, useState } from "react";
import { LadderSessionDoc, LadderMatchDoc, LadderCourtDoc } from "@/lib/firestore/types";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { RuneChip } from "../ui/RuneChip";
import { CheckCircle, AlertTriangle, X, Loader } from "lucide-react";
import { subscribeLadderMatches, subscribeLadderCourts } from "@/lib/ladder/repo";
import { finalizeSession, adminAssignMatchResult } from "@/lib/ladder/write";
import { calculateSessionResults, isSessionReadyForFinalization } from "@/domain/ladder/finalization";
import { useAuth } from "@/lib/auth-context";

interface SessionFinalizationDialogProps {
  session: LadderSessionDoc;
  onClose: () => void;
  onSuccess: () => void;
}

export function SessionFinalizationDialog({
  session,
  onClose,
  onSuccess,
}: SessionFinalizationDialogProps) {
  const { user } = useAuth();
  const [matches, setMatches] = useState<LadderMatchDoc[]>([]);
  const [courts, setCourts] = useState<LadderCourtDoc[]>([]);
  const [incompleteMatches, setIncompleteMatches] = useState<LadderMatchDoc[]>([]);
  const [assignedResults, setAssignedResults] = useState<Record<string, { scoreA: number; scoreB: number }>>({});
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub1 = subscribeLadderMatches(session.id, (newMatches) => {
      setMatches(newMatches);
      const { incompleteMatches: incomplete } = isSessionReadyForFinalization(newMatches);
      setIncompleteMatches(incomplete);
    });
    const unsub2 = subscribeLadderCourts(session.id, setCourts);
    return () => { unsub1(); unsub2(); };
  }, [session.id]);

  async function handleAssignResult(matchId: string, scoreA: number, scoreB: number) {
    if (!user) return;
    try {
      await adminAssignMatchResult(matchId, scoreA, scoreB, user.uid);
      setAssignedResults((prev) => ({ ...prev, [matchId]: { scoreA, scoreB } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign result.");
    }
  }

  async function handleFinalize() {
    if (!user) return;
    const { ready, incompleteMatches: stillIncomplete } = isSessionReadyForFinalization(matches);
    if (!ready) {
      setError(`${stillIncomplete.length} incomplete matches remain.`);
      return;
    }
    setIsFinalizing(true);
    setError(null);
    try {
      const results = calculateSessionResults(courts, matches);
      const standingsSnapshot = {
        id: `${session.id}_final_standings`,
        sessionId: session.id,
        playDateId: session.playDateId,
        seasonId: session.seasonId,
        snapshotAt: new Date().toISOString(),
        resultsByPlayer: results,
        resultsByCourtAndRank: courts.reduce((acc, court) => {
          acc[court.courtNumber] = results.filter((r) => r.courtNumber === court.courtNumber);
          return acc;
        }, {} as Record<number, typeof results>),
        totalPlayers: results.length,
        totalCourts: courts.length,
      };
      const updatedPlayerStats = results.reduce((acc, r) => {
        acc[r.playerId] = {
          matches: r.wins + r.losses,
          wins: r.wins,
          losses: r.losses,
          pointsFor: r.pointsFor,
          pointsAgainst: r.pointsAgainst,
        };
        return acc;
      }, {} as Record<string, unknown>);
      await finalizeSession(session.id, standingsSnapshot, updatedPlayerStats, user.uid);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Finalization failed.");
    } finally {
      setIsFinalizing(false);
    }
  }

  const { ready } = isSessionReadyForFinalization(matches);
  const allIncompleteHandled = incompleteMatches.every((m) => assignedResults[m.id]);
  const verifiedCount = matches.filter((m) => m.status === "VERIFIED").length;
  const adminCount = matches.filter((m) => m.status === "ADMIN_ASSIGNED").length;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Panel variant="quest" padding="lg" className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="heading-fantasy text-xl text-ash-100">Finalize Session {session.kind}</h2>
            <p className="text-xs text-ash-500 mt-0.5">
              Assign results for incomplete matches, then confirm finalization.
            </p>
          </div>
          <Button onClick={onClose} variant="ghost" size="sm" disabled={isFinalizing}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Status overview */}
        <Panel variant="base" padding="md" className="mb-5">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl heading-fantasy text-spectral-400">{verifiedCount}</p>
              <p className="text-[10px] text-ash-500 uppercase tracking-wider">Verified</p>
            </div>
            <div>
              <p className="text-2xl heading-fantasy text-ember-400">{adminCount}</p>
              <p className="text-[10px] text-ash-500 uppercase tracking-wider">Admin Assigned</p>
            </div>
            <div>
              <p className={`text-2xl heading-fantasy ${ready ? "text-spectral-400" : "text-crimson-400"}`}>
                {incompleteMatches.length}
              </p>
              <p className="text-[10px] text-ash-500 uppercase tracking-wider">Incomplete</p>
            </div>
          </div>
        </Panel>

        {/* Incomplete matches */}
        {incompleteMatches.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-gold-400" />
              <h3 className="heading-fantasy text-sm text-ash-100">Incomplete Matches</h3>
              <RuneChip tone="warning" className="text-[9px]">{incompleteMatches.length}</RuneChip>
            </div>
            <div className="space-y-2">
              {incompleteMatches.map((match) => {
                const assigned = assignedResults[match.id];
                const court = courts.find((c) => c.id === match.courtId);
                return (
                  <Panel key={match.id} variant="inventory" padding="md">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-ash-200 font-semibold">
                        Court {court?.courtNumber} · Game {match.gameNumber}
                      </p>
                      <p className="text-xs text-ash-500 font-mono">
                        {match.sideA[0]?.slice(0, 8)}… vs {match.sideB[0]?.slice(0, 8)}…
                      </p>
                    </div>
                    {assigned ? (
                      <div className="flex items-center gap-2 text-spectral-400 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Assigned: {assigned.scoreA}–{assigned.scoreB}
                      </div>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" onClick={() => handleAssignResult(match.id, 11, 9)}>
                          11–9 Win A
                        </Button>
                        <Button size="sm" onClick={() => handleAssignResult(match.id, 9, 11)}>
                          9–11 Win B
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleAssignResult(match.id, 0, 0)}>
                          0–0 Default
                        </Button>
                      </div>
                    )}
                  </Panel>
                );
              })}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-crimson-500 mb-4">{error}</p>}

        <div className="flex gap-3 justify-end">
          <Button onClick={onClose} variant="ghost" disabled={isFinalizing}>Cancel</Button>
          <Button
            onClick={handleFinalize}
            disabled={!ready || !allIncompleteHandled || isFinalizing}
          >
            {isFinalizing ? (
              <><Loader className="w-4 h-4 animate-spin mr-1" /> Finalizing…</>
            ) : (
              <><CheckCircle className="w-4 h-4 mr-1" /> Finalize Session</>
            )}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
