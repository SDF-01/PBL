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

const DISTRIBUTION_LABELS: Record<CourtDistributionPlacement, { title: string; desc: string }> = {
  TOP_HEAVY:    { title: "Top-Heavy",    desc: "Larger courts at top (stronger players)" },
  MIDDLE:       { title: "Middle",       desc: "Larger courts in the middle" },
  BOTTOM_HEAVY: { title: "Bottom-Heavy", desc: "Larger courts at bottom (balance weaker teams)" },
};

function computeCourtSizes(playerCount: number): number[] {
  const rem = playerCount % 4;
  if (rem === 0) return Array(playerCount / 4).fill(4);
  if (rem === 1) return [5, ...Array((playerCount - 5) / 4).fill(4)];
  if (rem === 2) return [5, 5, ...Array((playerCount - 10) / 4).fill(4)];
  return [5, ...Array((playerCount - 5) / 4).fill(4)];
}

export function SessionGenerationDialog({
  season,
  playerCount,
  onGenerate,
  onClose,
}: SessionGenerationDialogProps) {
  const [distribution, setDistribution] = useState<CourtDistributionPlacement>(
    season.courtDistributionPlacement ?? "MIDDLE"
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const courtSizes = computeCourtSizes(playerCount);
  const courts5 = courtSizes.filter((s) => s === 5).length;
  const courts4 = courtSizes.filter((s) => s === 4).length;

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    try {
      await onGenerate({ distribution });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Panel variant="quest" padding="lg" className="w-full max-w-md">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="heading-fantasy text-xl text-ash-100">Generate Session A</h2>
            <p className="text-xs text-ash-500 mt-0.5">{playerCount} checked-in players</p>
          </div>
          <Button onClick={onClose} variant="ghost" size="sm" disabled={isGenerating}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Court configuration preview */}
        <Panel variant="base" padding="md" className="mb-4">
          <p className="text-xs text-ash-500 uppercase tracking-wider mb-3">Court Configuration</p>
          <div className="flex gap-2 mb-3 flex-wrap">
            {courtSizes.map((size, i) => (
              <div
                key={i}
                className="flex-1 min-w-[2.5rem] text-center bg-obsidian-950 border border-obsidian-400 rounded-pixel py-2 text-ash-100 font-mono text-lg"
              >
                {size}
              </div>
            ))}
          </div>
          <p className="text-xs text-ash-500">
            {courts5 > 0 && `${courts5} court${courts5 > 1 ? "s" : ""} of 5`}
            {courts5 > 0 && courts4 > 0 && " · "}
            {courts4 > 0 && `${courts4} court${courts4 > 1 ? "s" : ""} of 4`}
          </p>
        </Panel>

        {/* Distribution placement */}
        <div className="mb-4">
          <p className="text-xs text-ash-500 uppercase tracking-wider mb-2">Court Placement Strategy</p>
          <div className="space-y-2">
            {(["TOP_HEAVY", "MIDDLE", "BOTTOM_HEAVY"] as const).map((option) => {
              const selected = distribution === option;
              return (
                <label
                  key={option}
                  className={`flex items-center gap-3 p-3 rounded-pixel border cursor-pointer transition-colors ${
                    selected
                      ? "border-ember-500 bg-ember-900/20"
                      : "border-obsidian-500 bg-obsidian-800 hover:border-obsidian-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="distribution"
                    value={option}
                    checked={selected}
                    onChange={() => setDistribution(option)}
                    className="accent-ember-500"
                  />
                  <div>
                    <p className={`text-sm font-semibold ${selected ? "text-ember-300" : "text-ash-200"}`}>
                      {DISTRIBUTION_LABELS[option].title}
                    </p>
                    <p className="text-xs text-ash-500">{DISTRIBUTION_LABELS[option].desc}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Season settings summary */}
        <Panel variant="base" padding="sm" className="mb-4">
          <div className="flex justify-between text-xs">
            <span className="text-ash-500">Score to</span>
            <span className="text-ash-200 font-mono">{season.targetPoints ?? 11}</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-ash-500">Movement</span>
            <span className="text-ash-200 font-mono">{(season.movementPattern ?? "ONE_UP_ONE_DOWN").replace(/_/g, " ").toLowerCase()}</span>
          </div>
        </Panel>

        {error && <p className="text-sm text-crimson-500 mb-4">{error}</p>}

        <div className="flex gap-3 justify-end">
          <Button onClick={onClose} variant="ghost" disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <><Loader className="w-4 h-4 animate-spin mr-1" /> Generating…</>
            ) : (
              <><Play className="w-4 h-4 mr-1" /> Generate Session</>
            )}
          </Button>
        </div>

        <p className="text-xs text-ash-600 mt-3">
          Once generated, courts and rotations are locked. Admins can still assign incomplete matches during finalization.
        </p>
      </Panel>
    </div>
  );
}
