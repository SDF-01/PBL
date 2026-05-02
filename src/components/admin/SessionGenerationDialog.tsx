/**
 * Session Generation Dialog
 * Admin interface to configure and generate Session A or B
 */

"use client";

import React, { useState } from "react";
import { LadderSeasonDoc, CourtDistributionPlacement } from "@/lib/firestore/types";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { Play, X, Loader } from "lucide-react";

interface SessionGenerationDialogProps {
  playDateId: string;
  season: LadderSeasonDoc;
  playerCount: number;
  onGenerate: (options: { distribution: CourtDistributionPlacement }) => Promise<void>;
  onClose: () => void;
}

export function SessionGenerationDialog({
  playDateId,
  season,
  playerCount,
  onGenerate,
  onClose,
}: SessionGenerationDialogProps) {
  const [distribution, setDistribution] =
    useState<CourtDistributionPlacement>(
      season.courtDistributionPlacement || "MIDDLE"
    );
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate court configuration
  const remainder = playerCount % 4;
  let courtSizes: number[] = [];
  if (remainder === 0) {
    courtSizes = Array(playerCount / 4).fill(4);
  } else if (remainder === 1) {
    courtSizes = [5, ...Array((playerCount - 5) / 4).fill(4)];
  } else if (remainder === 2) {
    courtSizes = [5, 5, ...Array((playerCount - 10) / 4).fill(4)];
  } else {
    courtSizes = [5, ...Array((playerCount - 5) / 4).fill(4)];
  }

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      await onGenerate({ distribution });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Panel className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Generate Session A</h2>
          <Button onClick={onClose} variant="ghost" size="sm">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Configuration */}
        <div className="space-y-4 mb-6">
          {/* Court Configuration Display */}
          <Panel className="bg-blue-50 p-4">
            <h3 className="font-semibold text-sm mb-3">Court Configuration</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Players:</span>
                <span className="font-semibold text-lg">{playerCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Courts:</span>
                <span className="font-semibold text-lg">{courtSizes.length}</span>
              </div>
              <div className="flex gap-2">
                {courtSizes.map((size, i) => (
                  <div
                    key={i}
                    className="flex-1 text-center p-2 bg-white border-2 border-blue-300 rounded font-semibold"
                  >
                    {size}
                  </div>
                ))}
              </div>
              <div className="text-xs text-slate-600 mt-2">
                {courtSizes.filter((s) => s === 5).length} courts of 5 players,{" "}
                {courtSizes.filter((s) => s === 4).length} courts of 4 players
              </div>
            </div>
          </Panel>

          {/* Distribution Placement */}
          <div>
            <label className="block font-semibold text-sm mb-2">
              Court Placement Strategy
            </label>
            <div className="space-y-2">
              {(["TOP_HEAVY", "MIDDLE", "BOTTOM_HEAVY"] as const).map((option) => (
                <label key={option} className="flex items-center gap-3 p-3 border-2 rounded cursor-pointer hover:bg-slate-50"
                  style={{
                    borderColor: distribution === option ? "#3b82f6" : "#e2e8f0",
                    backgroundColor:
                      distribution === option ? "#eff6ff" : undefined,
                  }}>
                  <input
                    type="radio"
                    name="distribution"
                    value={option}
                    checked={distribution === option}
                    onChange={(e) =>
                      setDistribution(e.target.value as CourtDistributionPlacement)
                    }
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-semibold text-sm">
                      {option === "TOP_HEAVY"
                        ? "Top-Heavy"
                        : option === "BOTTOM_HEAVY"
                          ? "Bottom-Heavy"
                          : "Middle"}
                    </div>
                    <div className="text-xs text-slate-600">
                      {option === "TOP_HEAVY"
                        ? "Larger courts at top (stronger players)"
                        : option === "BOTTOM_HEAVY"
                          ? "Larger courts at bottom (balance weaker teams)"
                          : "Larger courts in middle"}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Session Configuration Info */}
          <Panel className="bg-slate-50 p-3 text-sm space-y-1">
            <div>
              <span className="text-slate-600">Points per game:</span>
              <span className="font-semibold ml-2">{season.targetPointsPerGame || 11}</span>
            </div>
            <div>
              <span className="text-slate-600">Movement pattern:</span>
              <span className="font-semibold ml-2">{season.movementPattern || "ONE_UP_ONE_DOWN"}</span>
            </div>
          </Panel>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Button onClick={onClose} variant="secondary" disabled={isGenerating}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Generate Session
              </>
            )}
          </Button>
        </div>

        {/* Info Text */}
        <div className="mt-4 text-xs text-slate-600 p-3 bg-slate-50 rounded">
          ⚠️ Once generated, courts and rotations are locked. Admins can still assign
          incomplete matches during finalization.
        </div>
      </Panel>
    </div>
  );
}
