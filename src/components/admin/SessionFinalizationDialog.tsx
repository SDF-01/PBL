/**
 * Session Finalization Dialog
 * Admin interface for finalizing sessions and handling incomplete matches
 */

"use client";

import React, { useEffect, useState } from "react";
import { LadderSessionDoc, LadderMatchDoc, LadderCourtDoc } from "@/lib/firestore/types";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import {
  CheckCircle,
  AlertTriangle,
  Users,
  X,
  Loader,
} from "lucide-react";
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
    // Subscribe to real-time updates
    const unsubscribeMatches = subscribeLadderMatches(session.id, (newMatches) => {
      setMatches(newMatches);
      const { ready, incompleteMatches: incomplete } = isSessionReadyForFinalization(newMatches);
      setIncompleteMatches(incomplete);
    });
    const unsubscribeCourts = subscribeLadderCourts(session.id, setCourts);

    return () => {
      unsubscribeMatches();
      unsubscribeCourts();
    };
  }, [session.id]);

  const handleAssignResult = async (matchId: string, scoreA: number, scoreB: number) => {
    if (!user) return;

    try {
      await adminAssignMatchResult(matchId, scoreA, scoreB, user.uid);
      setAssignedResults((prev) => ({
        ...prev,
        [matchId]: { scoreA, scoreB },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign result");
    }
  };

  const handleFinalize = async () => {
    if (!user) return;

    // Check if all matches are now complete
    const { ready, incompleteMatches: stillIncomplete } = isSessionReadyForFinalization(matches);
    if (!ready) {
      setError(`Still ${stillIncomplete.length} incomplete matches`);
      return;
    }

    setIsFinalizing(true);
    setError(null);

    try {
      // Calculate final results
      const results = calculateSessionResults(courts, matches);

      // Create standings snapshot
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

      // Update player stats (simplified - in real implementation, fetch current stats)
      const updatedPlayerStats = results.reduce((acc, result) => {
        acc[result.playerId] = {
          matches: result.wins + result.losses,
          wins: result.wins,
          losses: result.losses,
          pointsFor: result.pointsFor,
          pointsAgainst: result.pointsAgainst,
        };
        return acc;
      }, {} as Record<string, any>);

      await finalizeSession(session.id, standingsSnapshot, updatedPlayerStats, user.uid);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Finalization failed");
    } finally {
      setIsFinalizing(false);
    }
  };

  const { ready, incompleteMatches: checkIncomplete } = isSessionReadyForFinalization(matches);
  const allIncompleteHandled = incompleteMatches.every((m) => assignedResults[m.id]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Panel className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Finalize Session {session.kind}</h2>
            <p className="text-sm text-slate-600">
              Assign results for incomplete matches and confirm finalization
            </p>
          </div>
          <Button onClick={onClose} variant="ghost" size="sm">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Status Overview */}
        <Panel className="bg-slate-50 p-4 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {matches.filter((m) => m.status === "VERIFIED").length}
              </div>
              <div className="text-xs text-slate-600">Verified</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {matches.filter((m) => m.status === "ADMIN_ASSIGNED").length}
              </div>
              <div className="text-xs text-slate-600">Admin Assigned</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${ready ? "text-green-600" : "text-red-600"}`}>
                {incompleteMatches.length}
              </div>
              <div className="text-xs text-slate-600">Incomplete</div>
            </div>
          </div>
        </Panel>

        {/* Incomplete Matches */}
        {incompleteMatches.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Incomplete Matches ({incompleteMatches.length})
            </h3>

            <div className="space-y-3">
              {incompleteMatches.map((match) => {
                const assigned = assignedResults[match.id];
                const court = courts.find((c) => c.id === match.courtId);

                return (
                  <Panel key={match.id} className="p-4 border-amber-200 bg-amber-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold">
                        Court {court?.courtNumber} • Game {match.gameNumber}
                      </div>
                      <div className="text-sm text-slate-600">
                        {match.sideA[0]?.slice(0, 8)}... vs {match.sideB[0]?.slice(0, 8)}...
                      </div>
                    </div>

                    {assigned ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span>Assigned: {assigned.scoreA}-{assigned.scoreB}</span>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAssignResult(match.id, 11, 9)}
                        >
                          11-9 Win A
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAssignResult(match.id, 9, 11)}
                        >
                          9-11 Win B
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAssignResult(match.id, 0, 0)}
                        >
                          0-0 Default
                        </Button>
                      </div>
                    )}
                  </Panel>
                );
              })}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Button onClick={onClose} variant="ghost" disabled={isFinalizing}>
            Cancel
          </Button>
          <Button
            onClick={handleFinalize}
            disabled={!ready || !allIncompleteHandled || isFinalizing}
            className="gap-2"
          >
            {isFinalizing ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Finalizing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Finalize Session
              </>
            )}
          </Button>
        </div>
      </Panel>
    </div>
  );
}