"use client";

import React, { useState } from "react";
import { CheckInDoc, PlayDateDoc, PlayerStats } from "@/lib/firestore/types";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { RuneChip } from "../ui/RuneChip";
import { X, CheckCircle, AlertCircle } from "lucide-react";

interface AttendanceReviewProps {
  playDate: PlayDateDoc;
  checkIns: CheckInDoc[];
  playerStats?: Record<string, PlayerStats>;
  onConfirmAttendance: (confirmedPlayerIds: string[]) => void;
  onClose: () => void;
}

export function AttendanceReview({
  playDate,
  checkIns,
  playerStats,
  onConfirmAttendance,
  onClose,
}: AttendanceReviewProps) {
  const [selected, setSelected] = useState(
    new Set(
      checkIns
        .filter((ci) => ci.status === "CONFIRMED" || ci.status === "ADMIN_CONFIRMED")
        .map((ci) => ci.userId)
    )
  );
  const [error, setError] = useState<string | null>(null);

  const confirmed = checkIns.filter(
    (ci) => ci.status === "CONFIRMED" || ci.status === "ADMIN_CONFIRMED"
  );
  const rejected = checkIns.filter((ci) => ci.status === "GEO_REJECTED");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleConfirm() {
    if (selected.size < 4) {
      setError("Minimum 4 players required for session generation.");
      return;
    }
    onConfirmAttendance(Array.from(selected));
  }

  const courtCount = Math.ceil(selected.size / 4);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Panel variant="quest" padding="lg" className="w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="heading-fantasy text-xl text-ash-100">Attendance Review</h2>
            <p className="text-xs text-ash-500 mt-0.5">Play date: {playDate.date}</p>
          </div>
          <Button onClick={onClose} variant="ghost" size="sm">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Confirmed check-ins */}
        <div className="mt-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-spectral-400" />
            <h3 className="heading-fantasy text-sm text-ash-100">Confirmed Check-ins</h3>
            <RuneChip tone="success" className="text-[9px]">{confirmed.length}</RuneChip>
          </div>
          <div className="space-y-1.5">
            {confirmed.map((ci) => {
              const stats = playerStats?.[ci.userId];
              const isSelected = selected.has(ci.userId);
              return (
                <div
                  key={ci.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-pixel border cursor-pointer transition-colors ${
                    isSelected
                      ? "border-ember-500 bg-obsidian-700"
                      : "border-obsidian-500 bg-obsidian-800 opacity-60"
                  }`}
                  onClick={() => toggle(ci.userId)}
                >
                  <div>
                    <p className="text-sm text-ash-100">{ci.displayName || ci.userId.slice(0, 10)}</p>
                    {stats && (
                      <p className="text-xs text-ash-500">
                        {stats.totalWins ?? 0}W · {stats.sessionsPlayed ?? 0} sessions
                      </p>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => { e.stopPropagation(); toggle(ci.userId); }}
                    className="accent-ember-500 w-4 h-4"
                  />
                </div>
              );
            })}
            {confirmed.length === 0 && (
              <p className="text-sm text-ash-500 py-2">No confirmed check-ins yet.</p>
            )}
          </div>
        </div>

        {/* Geofence-rejected players */}
        {rejected.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-gold-400" />
              <h3 className="heading-fantasy text-sm text-ash-100">Geofence Rejected</h3>
              <RuneChip tone="warning" className="text-[9px]">{rejected.length}</RuneChip>
            </div>
            <div className="space-y-1.5">
              {rejected.map((ci) => {
                const isSelected = selected.has(ci.userId);
                return (
                  <div
                    key={ci.id}
                    className="flex items-center justify-between px-3 py-2 rounded-pixel border border-gold-700/40 bg-gold-900/10"
                  >
                    <div>
                      <p className="text-sm text-ash-200">{ci.displayName || ci.userId.slice(0, 10)}</p>
                      <p className="text-xs text-ash-500">
                        {ci.distanceMeters != null ? `${ci.distanceMeters.toFixed(0)} m from venue` : "Distance unknown"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={isSelected ? "outline" : "outline"}
                      onClick={() => toggle(ci.userId)}
                    >
                      {isSelected ? "Exclude" : "Include"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary */}
        <Panel variant="base" padding="md" className="mb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl heading-fantasy text-ember-400">{selected.size}</p>
              <p className="text-[10px] text-ash-500 uppercase tracking-wider">Selected</p>
            </div>
            <div>
              <p className="text-2xl heading-fantasy text-ash-300">{courtCount}</p>
              <p className="text-[10px] text-ash-500 uppercase tracking-wider">Courts</p>
            </div>
            <div>
              <p className={`text-2xl heading-fantasy ${selected.size >= 4 ? "text-spectral-400" : "text-crimson-400"}`}>
                {selected.size >= 4 ? "Ready" : "Min 4"}
              </p>
              <p className="text-[10px] text-ash-500 uppercase tracking-wider">Status</p>
            </div>
          </div>
        </Panel>

        {error && <p className="text-sm text-crimson-500 mb-3">{error}</p>}

        <div className="flex gap-3 justify-end">
          <Button onClick={onClose} variant="ghost">Cancel</Button>
          <Button onClick={handleConfirm} disabled={selected.size < 4}>
            <CheckCircle className="w-4 h-4 mr-1" />
            Confirm & Proceed
          </Button>
        </div>
      </Panel>
    </div>
  );
}
