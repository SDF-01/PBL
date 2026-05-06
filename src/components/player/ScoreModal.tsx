/**
 * Score Action Modal
 * Wrapper component for score submission and verification modals
 */

"use client";

import React, { useState } from "react";
import { LadderMatchDoc } from "@/lib/firestore/types";
import { ScoreSubmission } from "./ScoreSubmission";
import { ScoreVerification } from "./ScoreVerification";
import { submitLadderMatchScore, verifyLadderMatchScore, disputeLadderMatch } from "@/lib/ladder/write";
import { useAuth } from "@/lib/auth-context";

interface ScoreModalProps {
  match: LadderMatchDoc;
  action: "submit" | "verify";
  onClose: () => void;
  onSuccess: () => void;
  targetPoints: number;
}

interface DisputeState {
  open: boolean;
  reason: string;
  saving: boolean;
  error: string | null;
}

export function ScoreModal({ match, action, onClose, onSuccess, targetPoints }: ScoreModalProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dispute, setDispute] = useState<DisputeState>({
    open: false,
    reason: "",
    saving: false,
    error: null,
  });

  const playerTeam = match.sideA.includes(user?.uid || "") ? "sideA" : "sideB";

  const handleSubmitScore = async (scoreA: number, scoreB: number) => {
    if (!user) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await submitLadderMatchScore({
        matchId: match.id,
        scoreA,
        scoreB,
        submittedBy: user.uid,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit score");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyScore = async () => {
    if (!user) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await verifyLadderMatchScore(match.id, user.uid);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify score");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisputeScore = () => {
    setDispute((d) => ({ ...d, open: true }));
  };

  const handleDisputeSubmit = async () => {
    if (!user) return;
    setDispute((d) => ({ ...d, saving: true, error: null }));
    try {
      await disputeLadderMatch(match.id, user.uid, dispute.reason.trim() || undefined);
      onSuccess();
    } catch (err) {
      setDispute((d) => ({
        ...d,
        saving: false,
        error: err instanceof Error ? err.message : "Failed to flag dispute",
      }));
    }
  };

  if (dispute.open) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-full max-w-md space-y-4">
          <h2 className="text-xl font-bold text-white">Dispute Score</h2>
          <p className="text-slate-400 text-sm">
            Flagging this score will pause verification and notify the admin for review.
          </p>
          <textarea
            className="w-full bg-slate-700 border border-slate-600 rounded p-3 text-white text-sm resize-none"
            rows={3}
            placeholder="Describe the discrepancy (optional)…"
            value={dispute.reason}
            onChange={(e) => setDispute((d) => ({ ...d, reason: e.target.value }))}
          />
          {dispute.error && (
            <p className="text-red-400 text-sm">{dispute.error}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setDispute((d) => ({ ...d, open: false }))}
              className="flex-1 py-2 rounded border border-slate-600 text-slate-300 text-sm"
              disabled={dispute.saving}
            >
              Cancel
            </button>
            <button
              onClick={handleDisputeSubmit}
              className="flex-1 py-2 rounded bg-red-600 text-white text-sm font-semibold"
              disabled={dispute.saving}
            >
              {dispute.saving ? "Flagging…" : "Flag Dispute"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-full max-w-md">
        {action === "submit" ? (
          <ScoreSubmission
            match={match}
            playerTeam={playerTeam}
            targetPoints={targetPoints}
            onSubmit={handleSubmitScore}
            onCancel={onClose}
          />
        ) : (
          <ScoreVerification
            match={match}
            playerTeam={playerTeam}
            onVerify={handleVerifyScore}
            onDispute={handleDisputeScore}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  );
}