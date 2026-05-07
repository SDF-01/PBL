"use client";

import React, { useState } from "react";
import { LadderMatchDoc } from "@/lib/firestore/types";
import { Button } from "../ui/Button";
import { Plus, Minus, CheckCircle, X } from "lucide-react";

interface ScoreSubmissionProps {
  match: LadderMatchDoc;
  playerTeam?: "sideA" | "sideB";
  targetPoints?: number;
  onSubmit: (scoreA: number, scoreB: number) => Promise<void>;
  onCancel: () => void;
}

export function ScoreSubmission({
  match,
  playerTeam = "sideA",
  targetPoints = 11,
  onSubmit,
  onCancel,
}: ScoreSubmissionProps) {
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerScore = playerTeam === "sideA" ? scoreA : scoreB;
  const oppScore = playerTeam === "sideA" ? scoreB : scoreA;
  const playerWon = playerScore > oppScore;

  function inc(side: "A" | "B") {
    const max = targetPoints + 5;
    if (side === "A" && scoreA < max) setScoreA(scoreA + 1);
    if (side === "B" && scoreB < max) setScoreB(scoreB + 1);
  }
  function dec(side: "A" | "B") {
    if (side === "A" && scoreA > 0) setScoreA(scoreA - 1);
    if (side === "B" && scoreB > 0) setScoreB(scoreB - 1);
  }

  async function handleSubmit() {
    if (scoreA === scoreB) { setError("Ladder matches cannot end in a tie."); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(scoreA, scoreB);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="heading-fantasy text-xl text-ash-100">Enter Score</h2>
          <p className="text-xs text-ash-500 mt-0.5">Game {match.gameNumber}</p>
        </div>
        <Button onClick={onCancel} variant="ghost" size="sm" disabled={isSubmitting}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {(["A", "B"] as const).map((side, i) => {
          const isMine = (side === "A" && playerTeam === "sideA") || (side === "B" && playerTeam === "sideB");
          const score = side === "A" ? scoreA : scoreB;
          return (
            <React.Fragment key={side}>
              {i === 1 && (
                <div className="flex items-center justify-center">
                  <span className="text-2xl font-bold text-ash-600">—</span>
                </div>
              )}
              <div className="text-center space-y-2">
                <div className={`text-[10px] font-semibold py-1 px-2 rounded-pixel ${
                  isMine ? "bg-ember-900/40 text-ember-300" : "bg-obsidian-700 text-ash-400"
                }`}>
                  {isMine ? "Your Team" : "Opponents"}
                </div>
                <Button onClick={() => inc(side)} size="sm" className="w-full" disabled={isSubmitting}>
                  <Plus className="w-4 h-4" />
                </Button>
                <div className="text-5xl heading-fantasy text-ash-100 bg-obsidian-950 border border-obsidian-400 rounded-pixel py-3 text-center">
                  {score}
                </div>
                <Button onClick={() => dec(side)} variant="outline" size="sm" className="w-full" disabled={isSubmitting || score === 0}>
                  <Minus className="w-4 h-4" />
                </Button>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {scoreA !== scoreB && (
        <div className={`text-sm text-center py-2 px-3 rounded-pixel mb-4 ${
          playerWon ? "text-spectral-300 bg-spectral-900/20" : "text-gold-300 bg-gold-900/20"
        }`}>
          {playerWon ? "Your Team Wins!" : "Other Team Wins"}
        </div>
      )}

      {error && <p className="text-sm text-crimson-500 mb-3">{error}</p>}

      <div className="flex gap-3">
        <Button onClick={onCancel} variant="ghost" className="flex-1" disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          className="flex-1"
          disabled={scoreA === scoreB || isSubmitting}
        >
          <CheckCircle className="w-4 h-4 mr-1" />
          {isSubmitting ? "Submitting…" : "Submit Score"}
        </Button>
      </div>

      <p className="text-xs text-ash-600 text-center mt-3">
        Playing to {targetPoints}. Opposing team verifies this score.
      </p>
    </>
  );
}
