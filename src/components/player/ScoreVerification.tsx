/**
 * Score Verification Component
 * Opposing team verifies submitted score
 */

"use client";

import React, { useState } from "react";
import { LadderMatchDoc } from "@/lib/firestore/types";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { CheckCircle, X, AlertCircle } from "lucide-react";

interface ScoreVerificationProps {
  match: LadderMatchDoc;
  playerTeam: "sideA" | "sideB";
  onVerify: () => Promise<void>;
  onDispute: () => void;
  onCancel: () => void;
}

export function ScoreVerification({
  match,
  playerTeam,
  onVerify,
  onDispute,
  onCancel,
}: ScoreVerificationProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!match.scoreA || !match.scoreB) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Panel className="w-full max-w-md">
          <h2 className="text-2xl font-bold mb-4">Error</h2>
          <p className="text-slate-600 mb-6">No score to verify</p>
          <Button onClick={onCancel} className="w-full">
            Close
          </Button>
        </Panel>
      </div>
    );
  }

  const handleVerify = async () => {
    setIsVerifying(true);
    setError(null);
    try {
      await onVerify();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const playerScore = playerTeam === "sideA" ? match.scoreA : match.scoreB;
  const oppScore = playerTeam === "sideA" ? match.scoreB : match.scoreA;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Panel className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Verify Score</h2>
          <Button onClick={onCancel} variant="ghost" size="sm" disabled={isVerifying}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-6">
          {/* Game Info */}
          <div className="text-sm text-slate-600 text-center">
            Game {match.gameNumber}
          </div>

          {/* Score Display */}
          <div className="grid grid-cols-3 gap-4">
            {/* Your Team Score */}
            <div className="text-center">
              <div className="text-xs font-semibold mb-3 p-2 rounded bg-blue-100 text-blue-700">
                Your Team
              </div>
              <div className="text-5xl font-bold text-blue-600 p-4 bg-blue-50 rounded border-2 border-blue-300">
                {playerScore}
              </div>
            </div>

            {/* VS */}
            <div className="flex items-center justify-center">
              <span className="text-3xl font-bold text-slate-300">—</span>
            </div>

            {/* Opposing Team Score */}
            <div className="text-center">
              <div className="text-xs font-semibold mb-3 p-2 rounded bg-slate-100 text-slate-700">
                Opponents
              </div>
              <div className="text-5xl font-bold text-slate-600 p-4 bg-slate-50 rounded border-2 border-slate-300">
                {oppScore}
              </div>
            </div>
          </div>

          {/* Result */}
          <Panel className={`p-4 text-center ${playerScore > oppScore ? "bg-green-50" : "bg-amber-50"}`}>
            <div className={playerScore > oppScore ? "text-green-700" : "text-amber-700"}>
              <strong>
                {playerScore > oppScore ? "Your Team Wins!" : "Other Team Wins"}
              </strong>
              <div className="text-sm mt-1">
                {Math.abs(playerScore - oppScore)} point victory
              </div>
            </div>
          </Panel>

          {/* Info */}
          <Panel className="bg-blue-50 p-3 flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="text-sm text-blue-700">
              <strong>Please review carefully.</strong> If this score is correct, tap
              "Confirm". If there's a discrepancy, tap "Dispute" to flag for admin review.
            </div>
          </Panel>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 flex-col sm:flex-row">
            <Button
              onClick={onDispute}
              variant="secondary"
              className="flex-1"
              disabled={isVerifying}
            >
              Dispute Score
            </Button>
            <Button
              onClick={handleVerify}
              className="flex-1 gap-2"
              disabled={isVerifying}
            >
              <CheckCircle className="w-4 h-4" />
              {isVerifying ? "Confirming..." : "Confirm Score"}
            </Button>
          </div>

          {/* Cancel */}
          <Button
            onClick={onCancel}
            variant="ghost"
            className="w-full"
            disabled={isVerifying}
          >
            Cancel
          </Button>
        </div>
      </Panel>
    </div>
  );
}
