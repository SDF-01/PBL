/**
 * Score Submission Component
 * Players enter and verify match scores
 */

"use client";

import React, { useState } from "react";
import { LadderMatchDoc } from "@/lib/firestore/types";
import { Panel } from "../ui/Panel";
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

  const handleIncrement = (side: "A" | "B") => {
    if (side === "A") {
      if (scoreA < targetPoints + 5) setScoreA(scoreA + 1); // Allow overshoot for tiebreaker
    } else {
      if (scoreB < targetPoints + 5) setScoreB(scoreB + 1);
    }
  };

  const handleDecrement = (side: "A" | "B") => {
    if (side === "A") {
      if (scoreA > 0) setScoreA(scoreA - 1);
    } else {
      if (scoreB > 0) setScoreB(scoreB - 1);
    }
  };

  const handleSubmit = async () => {
    // Validate
    if (scoreA === scoreB) {
      setError("Ladder matches cannot end in a tie");
      return;
    }
    if (scoreA < 0 || scoreB < 0) {
      setError("Scores cannot be negative");
      return;
    }
    if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
      setError("Scores must be whole numbers");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(scoreA, scoreB);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Panel className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Enter Score</h2>
          <Button onClick={onCancel} variant="ghost" size="sm" disabled={isSubmitting}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-6">
          {/* Team Labels */}
          <div className="text-sm text-slate-600 text-center">
            Game {match.gameNumber}
          </div>

          {/* Score Input Grid */}
          <div className="grid grid-cols-3 gap-4">
            {/* Side A */}
            <div className="text-center">
              <div
                className={`text-xs font-semibold mb-3 p-2 rounded ${
                  playerTeam === "sideA"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {playerTeam === "sideA" ? "Your Team" : "Opponents"}
              </div>
              <div className="space-y-2">
                <Button
                  onClick={() => handleIncrement("A")}
                  size="sm"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <div className="text-5xl font-bold text-center p-4 bg-slate-50 rounded border-2 border-slate-200">
                  {scoreA}
                </div>
                <Button
                  onClick={() => handleDecrement("A")}
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  <Minus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* VS */}
            <div className="flex items-center justify-center">
              <span className="text-3xl font-bold text-slate-300">—</span>
            </div>

            {/* Side B */}
            <div className="text-center">
              <div
                className={`text-xs font-semibold mb-3 p-2 rounded ${
                  playerTeam === "sideB"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {playerTeam === "sideB" ? "Your Team" : "Opponents"}
              </div>
              <div className="space-y-2">
                <Button
                  onClick={() => handleIncrement("B")}
                  size="sm"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <div className="text-5xl font-bold text-center p-4 bg-slate-50 rounded border-2 border-slate-200">
                  {scoreB}
                </div>
                <Button
                  onClick={() => handleDecrement("B")}
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  <Minus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Result Preview */}
          {scoreA !== scoreB && (
            <Panel className={`p-4 text-center ${playerWon ? "bg-green-50" : "bg-amber-50"}`}>
              <div className={playerWon ? "text-green-700" : "text-amber-700"}>
                <strong>{playerWon ? "Your Team Wins!" : "Other Team Wins"}</strong>
                <div className="text-sm mt-1">
                  {Math.abs(playerScore - oppScore)} point{" "}
                  {Math.abs(playerScore - oppScore) !== 1 ? "lead" : ""}
                </div>
              </div>
            </Panel>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={onCancel}
              variant="ghost"
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 gap-2"
              disabled={
                scoreA === scoreB ||
                scoreA < 0 ||
                scoreB < 0 ||
                isSubmitting
              }
            >
              <CheckCircle className="w-4 h-4" />
              {isSubmitting ? "Submitting..." : "Submit Score"}
            </Button>
          </div>

          {/* Info */}
          <div className="text-xs text-slate-600 p-3 bg-slate-50 rounded">
            Playing to {targetPoints} points. The opposing team will verify this score.
          </div>
        </div>
      </Panel>
    </div>
  );
}
