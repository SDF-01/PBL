"use client";

import React, { useState } from "react";
import { LadderMatchDoc } from "@/lib/firestore/types";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { ScoreSubmission } from "./ScoreSubmission";
import { ScoreVerification } from "./ScoreVerification";
import {
  submitLadderMatchScore,
  verifyLadderMatchScore,
  disputeLadderMatch,
} from "@/lib/ladder/write";
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
  const [error, setError] = useState<string | null>(null);
  const [dispute, setDispute] = useState<DisputeState>({
    open: false,
    reason: "",
    saving: false,
    error: null,
  });

  const playerTeam = match.sideA.includes(user?.uid ?? "") ? "sideA" : "sideB";

  async function handleSubmitScore(scoreA: number, scoreB: number) {
    if (!user) return;
    setError(null);
    await submitLadderMatchScore({ matchId: match.id, scoreA, scoreB, submittedBy: user.uid });
    onSuccess();
  }

  async function handleVerifyScore() {
    if (!user) return;
    setError(null);
    await verifyLadderMatchScore(match.id, user.uid);
    onSuccess();
  }

  async function handleDisputeSubmit() {
    if (!user) return;
    setDispute((d) => ({ ...d, saving: true, error: null }));
    try {
      await disputeLadderMatch(match.id, user.uid, dispute.reason.trim() || undefined);
      onSuccess();
    } catch (err) {
      setDispute((d) => ({
        ...d,
        saving: false,
        error: err instanceof Error ? err.message : "Failed to flag dispute.",
      }));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Panel variant="quest" padding="lg" className="w-full max-w-md">
        {dispute.open ? (
          <>
            <h2 className="heading-fantasy text-xl text-ash-100 mb-1">Dispute Score</h2>
            <p className="text-xs text-ash-400 mb-4">
              Flagging pauses verification and notifies the admin for review.
            </p>
            <textarea
              className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100 placeholder:text-ash-600 focus:outline-none focus:border-ember-500 resize-none mb-3"
              rows={3}
              placeholder="Describe the discrepancy (optional)…"
              value={dispute.reason}
              onChange={(e) => setDispute((d) => ({ ...d, reason: e.target.value }))}
            />
            {dispute.error && <p className="text-sm text-crimson-500 mb-3">{dispute.error}</p>}
            <div className="flex gap-3">
              <Button
                onClick={() => setDispute((d) => ({ ...d, open: false }))}
                variant="outline"
                className="flex-1"
                disabled={dispute.saving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDisputeSubmit}
                className="flex-1 !bg-crimson-600 hover:!bg-crimson-500"
                disabled={dispute.saving}
              >
                {dispute.saving ? "Flagging…" : "Flag Dispute"}
              </Button>
            </div>
          </>
        ) : action === "submit" ? (
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
            onDispute={() => setDispute((d) => ({ ...d, open: true }))}
            onCancel={onClose}
          />
        )}
        {error && <p className="text-sm text-crimson-500 mt-3">{error}</p>}
      </Panel>
    </div>
  );
}
