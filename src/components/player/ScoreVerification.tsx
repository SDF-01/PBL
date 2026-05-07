"use client";

import React, { useState } from "react";
import { LadderMatchDoc } from "@/lib/firestore/types";
import { Button } from "../ui/Button";
import { CheckCircle, X, AlertCircle } from "lucide-react";

interface ScoreVerificationProps {
  match: LadderMatchDoc;
  playerTeam?: "sideA" | "sideB";
  onVerify: () => Promise<void>;
  onDispute: () => void;
  onCancel: () => void;
}

export function ScoreVerification({
  match,
  playerTeam = "sideA",
  onVerify,
  onDispute,
  onCancel,
}: ScoreVerificationProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasScore = typeof match.scoreA === "number" && typeof match.scoreB === "number";
  const playerScore = playerTeam === "sideA" ? match.scoreA ?? 0 : match.scoreB ?? 0;
  const oppScore = playerTeam === "sideA" ? match.scoreB ?? 0 : match.scoreA ?? 0;
  const playerWon = playerScore > oppScore;

  async function handleVerify() {
    setIsVerifying(true);
    setError(null);
    try {
      await onVerify();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setIsVerifying(false);
    }
  }

  if (!hasScore) {
    return (
      <>
        <h2 className="heading-fantasy text-xl text-ash-100 mb-3">Verify Score</h2>
        <p className="text-ash-400 text-sm mb-4">No score has been submitted yet.</p>
        <Button onClick={onCancel} className="w-full">Close</Button>
      </>
    );
  }

  return (
    <>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="heading-fantasy text-xl text-ash-100">Verify Score</h2>
          <p className="text-xs text-ash-500 mt-0.5">Game {match.gameNumber}</p>
        </div>
        <Button onClick={onCancel} variant="ghost" size="sm" disabled={isVerifying}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className="text-[10px] font-semibold py-1 px-2 rounded-pixel mb-2 bg-ember-900/40 text-ember-300">
            Your Team
          </div>
          <div className="text-5xl heading-fantasy text-ember-400 bg-obsidian-950 border border-ember-700/50 rounded-pixel py-3 text-center">
            {playerScore}
          </div>
        </div>
        <div className="flex items-center justify-center">
          <span className="text-2xl font-bold text-ash-600">—</span>
        </div>
        <div className="text-center">
          <div className="text-[10px] font-semibold py-1 px-2 rounded-pixel mb-2 bg-obsidian-700 text-ash-400">
            Opponents
          </div>
          <div className="text-5xl heading-fantasy text-ash-300 bg-obsidian-950 border border-obsidian-400 rounded-pixel py-3 text-center">
            {oppScore}
          </div>
        </div>
      </div>

      <div className={`text-sm text-center py-2 px-3 rounded-pixel mb-4 ${
        playerWon ? "text-spectral-300 bg-spectral-900/20" : "text-gold-300 bg-gold-900/20"
      }`}>
        {playerWon ? "Your Team Wins" : "Other Team Wins"} · {Math.abs(playerScore - oppScore)} point lead
      </div>

      <div className="flex gap-2 items-start text-xs text-ash-400 bg-obsidian-700 rounded-pixel p-3 mb-4">
        <AlertCircle className="w-4 h-4 text-spectral-400 shrink-0 mt-0.5" />
        <span>Review carefully. Confirm if correct, or dispute to flag for admin review.</span>
      </div>

      {error && <p className="text-sm text-crimson-500 mb-3">{error}</p>}

      <div className="flex gap-3">
        <Button onClick={onDispute} variant="outline" className="flex-1" disabled={isVerifying}>
          Dispute
        </Button>
        <Button onClick={handleVerify} className="flex-1" disabled={isVerifying}>
          <CheckCircle className="w-4 h-4 mr-1" />
          {isVerifying ? "Confirming…" : "Confirm Score"}
        </Button>
      </div>
      <Button onClick={onCancel} variant="ghost" className="w-full mt-2" disabled={isVerifying}>
        Cancel
      </Button>
    </>
  );
}
