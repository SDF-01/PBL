/**
 * Attendance Review Component
 * Allows admins to review check-ins and adjust fairness placement before session generation
 */

"use client";

import React, { useState } from "react";
import { CheckInDoc, PlayDateDoc, PlayerStats } from "@/lib/firestore/types";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { X, Check, AlertCircle } from "lucide-react";

interface AttendanceReviewProps {
  playDate: PlayDateDoc;
  checkIns: CheckInDoc[];
  playerStats?: Record<string, PlayerStats>;
  onConfirmAttendance: (confirmedPlayerIds: string[]) => void;
  onExcludePlayer: (playerId: string) => void;
  onClose: () => void;
}

export function AttendanceReview({
  playDate,
  checkIns,
  playerStats,
  onConfirmAttendance,
  onExcludePlayer,
  onClose,
}: AttendanceReviewProps) {
  const [selectedPlayers, setSelectedPlayers] = useState(
    new Set(
      checkIns
        .filter((ci) => ci.status === "CONFIRMED" || ci.status === "ADMIN_CONFIRMED")
        .map((ci) => ci.userId)
    )
  );

  const confirmed = checkIns.filter(
    (ci) => ci.status === "CONFIRMED" || ci.status === "ADMIN_CONFIRMED"
  );
  const rejected = checkIns.filter((ci) => ci.status === "GEO_REJECTED");

  const togglePlayer = (playerId: string) => {
    const next = new Set(selectedPlayers);
    if (next.has(playerId)) {
      next.delete(playerId);
    } else {
      next.add(playerId);
    }
    setSelectedPlayers(next);
  };

  const handleConfirm = () => {
    if (selectedPlayers.size < 4) {
      alert("Minimum 4 players required for session generation");
      return;
    }
    onConfirmAttendance(Array.from(selectedPlayers));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Panel className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Attendance Review</h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="text-sm text-slate-600 mb-4">
          Play Date: <span className="font-semibold">{playDate.date}</span>
        </div>

        {/* Confirmed Check-ins */}
        <div className="mb-6">
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            Confirmed Check-ins ({confirmed.length})
          </h3>
          <div className="space-y-2 bg-green-50 p-4 rounded">
            {confirmed.map((ci) => {
              const stats = playerStats?.[ci.userId];
              const isSelected = selectedPlayers.has(ci.userId);

              return (
                <div
                  key={ci.id}
                  className={`flex items-center justify-between p-3 border-2 rounded transition cursor-pointer ${
                    isSelected ? "border-blue-500 bg-white" : "border-slate-200"
                  }`}
                  onClick={() => togglePlayer(ci.userId)}
                >
                  <div>
                    <div className="font-semibold">{ci.displayName || ci.userId}</div>
                    {stats && (
                      <div className="text-sm text-slate-600">
                        Wins: {stats.totalWins || 0} | Games: {stats.sessionsPlayed || 0}
                      </div>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      togglePlayer(ci.userId);
                    }}
                    className="w-5 h-5"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Admin-Confirmed Overrides */}
        {rejected.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              Geofence Rejected ({rejected.length})
            </h3>
            <div className="space-y-2 bg-amber-50 p-4 rounded">
              {rejected.map((ci) => (
                <div
                  key={ci.id}
                  className="flex items-center justify-between p-3 border-2 border-amber-200 rounded"
                >
                  <div>
                    <div className="font-semibold">{ci.displayName || ci.userId}</div>
                    <div className="text-sm text-slate-600">
                      {ci.distanceMeters?.toFixed(1) || "?"} m from venue
                    </div>
                  </div>
                  <button
                    onClick={() => togglePlayer(ci.userId)}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Include
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary & Actions */}
        <Panel className="bg-slate-50 p-4 mb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {selectedPlayers.size}
              </div>
              <div className="text-xs text-slate-600">Selected</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-600">
                {Math.ceil(selectedPlayers.size / 4)}
              </div>
              <div className="text-xs text-slate-600">Courts</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                ✓
              </div>
              <div className="text-xs text-slate-600">
                {selectedPlayers.size >= 4 ? "Ready" : "Min 4"}
              </div>
            </div>
          </div>
        </Panel>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedPlayers.size < 4}
            className="gap-2"
          >
            <Check className="w-4 h-4" />
            Confirm & Proceed
          </Button>
        </div>
      </Panel>
    </div>
  );
}
