/**
 * Score Action Modal
 * Wrapper component for score submission and verification modals
 */

"use client";

import React, { useState } from "react";
import { LadderMatchDoc } from "@/lib/firestore/types";
import { ScoreSubmission } from "./ScoreSubmission";
import { ScoreVerification } from "./ScoreVerification";
import { submitLadderMatchScore, verifyLadderMatchScore } from "@/lib/ladder/write";
import { useAuth } from "@/lib/auth-context";

interface ScoreModalProps {
  match: LadderMatchDoc;
  action: "submit" | "verify";
  onClose: () => void;
  onSuccess: () => void;
}

export function ScoreModal({ match, action, onClose, onSuccess }: ScoreModalProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    // For now, just close the modal. In a full implementation,
    // this would open a dispute flow or notify admins
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-full max-w-md">
        {action === "submit" ? (
          <ScoreSubmission
            match={match}
            onSubmit={handleSubmitScore}
            onCancel={onClose}
            isSubmitting={isSubmitting}
            error={error}
          />
        ) : (
          <ScoreVerification
            match={match}
            onVerify={handleVerifyScore}
            onDispute={handleDisputeScore}
            onCancel={onClose}
            isSubmitting={isSubmitting}
            error={error}
          />
        )}
      </div>
    </div>
  );
}