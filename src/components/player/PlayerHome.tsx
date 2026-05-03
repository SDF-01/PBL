/**
 * Player Home Screen (Court-Centric)
 * Primary heart of the player experience
 * Shows assigned court, current match, next match, and actions
 */

"use client";

import React from "react";
import {
  LadderCourtDoc,
  LadderMatchDoc,
  LadderSessionDoc,
} from "@/lib/firestore/types";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import {
  Activity,
  ChevronRight,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";

interface PlayerHomeProps {
  currentSession?: LadderSessionDoc;
  assignedCourt?: LadderCourtDoc;
  currentMatch?: LadderMatchDoc & { courtNumber: number };
  nextMatch?: LadderMatchDoc & { courtNumber: number };
  sitOutMatch?: LadderMatchDoc;
  playerId: string;
  onEnterScore: () => void;
  onVerifyScore: () => void;
  onViewStandings: () => void;
  onViewCourts: () => void;
}

export function PlayerHome({
  currentSession,
  assignedCourt,
  currentMatch,
  nextMatch,
  sitOutMatch,
  playerId,
  onEnterScore,
  onVerifyScore,
  onViewStandings,
  onViewCourts,
}: PlayerHomeProps) {
  if (!currentSession) {
    return (
      <div className="space-y-6">
        <Panel className="bg-amber-50 border-2 border-amber-200 p-6 text-center">
          <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-amber-900 mb-2">
            Awaiting Session Generation
          </h2>
          <p className="text-amber-800 mb-4">
            The admin will generate the session shortly. Check back soon!
          </p>
          <Button onClick={onViewCourts} variant="outline">
            View Play Dates
          </Button>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">On Court</h1>
        <div className="text-sm text-slate-600">
          Session <span className="font-semibold">{currentSession.kind}</span>
        </div>
      </div>

      {/* Court Assignment */}
      {assignedCourt && (
        <Panel className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 p-6">
          <div className="text-center mb-4">
            <div className="text-sm text-slate-600 mb-1">Your Court</div>
            <div className="text-5xl font-bold text-blue-600">
              COURT {assignedCourt.courtNumber}
            </div>
            <div className="text-sm text-slate-600 mt-2">
              {assignedCourt.size} Players
            </div>
          </div>

          <div className="flex gap-2 flex-wrap justify-center">
            {assignedCourt.playerIds.map((pid) => (
              <span
                key={pid}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  pid === playerId
                    ? "bg-blue-600 text-white"
                    : "bg-white text-blue-600 border border-blue-300"
                }`}
              >
                {pid === playerId ? "You" : pid.substring(0, 8)}
              </span>
            ))}
          </div>
        </Panel>
      )}

      {/* Current/Next Match Display */}
      {sitOutMatch ? (
        <Panel className="bg-slate-50 border-2 border-amber-300 p-6">
          <div className="text-center">
            <Activity className="w-12 h-12 text-amber-600 mx-auto mb-3" />
            <h2 className="text-2xl font-bold mb-1">Sitting Out</h2>
            <p className="text-slate-600">
              Game {sitOutMatch.gameNumber}: Next up is on court
            </p>
          </div>
        </Panel>
      ) : currentMatch ? (
        <Panel className="border-2 border-green-500 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-600" />
              Current Match — Game {currentMatch.gameNumber}
            </h2>

            {/* Score Display */}
            <div className="grid grid-cols-3 gap-3 my-4">
              {/* Side A */}
              <div>
                <div className="text-xs font-semibold text-slate-600 mb-1">
                  Your Team
                </div>
                <div className="bg-blue-50 border-2 border-blue-300 rounded p-3">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">
                      {currentMatch.scoreA ?? "—"}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      {currentMatch.sideA.length} players
                    </div>
                  </div>
                </div>
              </div>

              {/* VS */}
              <div className="flex items-center justify-center">
                <span className="text-2xl font-bold text-slate-400">vs</span>
              </div>

              {/* Side B */}
              <div>
                <div className="text-xs font-semibold text-slate-600 mb-1">
                  Other Team
                </div>
                <div className="bg-slate-100 border-2 border-slate-300 rounded p-3">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-slate-700">
                      {currentMatch.scoreB ?? "—"}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      {currentMatch.sideB.length} players
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Match Status */}
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded mb-4">
              {currentMatch.status === "SCHEDULED" && (
                <>
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span className="text-sm">Ready to play</span>
                </>
              )}
              {currentMatch.status === "SUBMITTED" && (
                <>
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="text-sm">Awaiting verification</span>
                </>
              )}
              {currentMatch.status === "VERIFIED" && (
                <>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm">Score verified ✓</span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={onEnterScore}
              className="gap-2"
              disabled={currentMatch.status !== "SCHEDULED"}
            >
              <Activity className="w-4 h-4" />
              Enter Score
            </Button>
            <Button
              onClick={onVerifyScore}
              variant="outline"
              className="gap-2"
              disabled={currentMatch.status !== "SUBMITTED"}
            >
              <CheckCircle className="w-4 h-4" />
              Verify
            </Button>
          </div>
        </Panel>
      ) : (
        <Panel className="bg-slate-50 border-2 border-slate-300 p-6 text-center">
          <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 mb-4">All matches complete</p>
          <Button onClick={onViewStandings}>View Standings</Button>
        </Panel>
      )}

      {/* Next Match Preview */}
      {nextMatch && !sitOutMatch && (
        <Panel className="bg-blue-50 border border-blue-200 p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <ChevronRight className="w-4 h-4" />
            Next Match — Game {nextMatch.gameNumber}
          </h3>
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <div className="font-semibold text-blue-600">
                {nextMatch.sideA.includes(playerId) ? "Your Team" : "Opponents"}
              </div>
              <div className="text-xs text-slate-600">
                {nextMatch.sideA.length} vs {nextMatch.sideB.length} players
              </div>
            </div>
            <Button
              onClick={onViewCourts}
              variant="ghost"
              size="sm"
              className="gap-1"
            >
              View <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </Panel>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={onViewStandings}
          variant="outline"
          className="w-full"
        >
          View Standings
        </Button>
        <Button
          onClick={onViewCourts}
          variant="outline"
          className="w-full"
        >
          View All Courts
        </Button>
      </div>
    </div>
  );
}
