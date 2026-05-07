"use client";

import React from "react";
import {
  LadderCourtDoc,
  LadderMatchDoc,
  LadderSessionDoc,
} from "@/lib/firestore/types";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { RuneChip } from "../ui/RuneChip";
import {
  Activity,
  ChevronRight,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  LayoutGrid,
  Trophy,
  Swords,
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
      <Panel variant="quest" padding="lg" className="text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-ember-400 mx-auto" />
        <div>
          <RuneChip tone="warning" className="mb-2">Awaiting Session</RuneChip>
          <h2 className="heading-fantasy text-ash-100 text-lg">
            Session Not Started
          </h2>
          <p className="text-ash-400 text-sm mt-1">
            The coordinator will generate the session shortly.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onViewCourts}>
          Browse Play Dates
        </Button>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <RuneChip tone="rune" className="mb-1">On Court</RuneChip>
          <h1 className="heading-fantasy text-display-md text-ash-100">Session {currentSession.kind}</h1>
        </div>
        <div className="text-right">
          <p className="text-ash-500 text-xs uppercase tracking-widest">Status</p>
          <p className="text-ash-200 text-sm font-medium capitalize">
            {currentSession.status.replace(/_/g, " ").toLowerCase()}
          </p>
        </div>
      </div>

      {/* Court assignment */}
      {assignedCourt && (
        <Panel variant="hud" padding="lg">
          <div className="text-center mb-4">
            <p className="text-ash-500 text-xs uppercase tracking-[0.2em] mb-1">Your Court</p>
            <div className="heading-fantasy text-6xl text-ember-400 mb-1">
              {assignedCourt.courtNumber}
            </div>
            <p className="text-ash-400 text-sm">{assignedCourt.size} players assigned</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {assignedCourt.playerIds.map((pid) => (
              <span
                key={pid}
                className={`px-3 py-1 rounded-pixel text-xs font-medium border ${
                  pid === playerId
                    ? "bg-ember-500/20 border-ember-400 text-ember-300"
                    : "bg-obsidian-700 border-obsidian-500 text-ash-300"
                }`}
              >
                {pid === playerId ? "You" : pid.substring(0, 8)}
              </span>
            ))}
          </div>
        </Panel>
      )}

      {/* Sitting out */}
      {sitOutMatch ? (
        <Panel variant="inventory" padding="lg" className="text-center space-y-2">
          <Activity className="h-8 w-8 text-gold-400 mx-auto" />
          <RuneChip tone="gold">Sitting Out</RuneChip>
          <p className="text-ash-400 text-sm">
            Game {sitOutMatch.gameNumber} — rest up, you&apos;re next.
          </p>
        </Panel>
      ) : currentMatch ? (
        <Panel variant="quest" padding="lg" className="space-y-4">
          <div className="flex items-center gap-2">
            <Swords className="h-4 w-4 text-ember-400" />
            <h2 className="heading-fantasy text-ash-100 text-base">
              Game {currentMatch.gameNumber} — Current Match
            </h2>
          </div>

          {/* Score display */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-ash-500 text-[10px] uppercase tracking-widest mb-1">Your Side</p>
              <div className="bg-obsidian-800 border border-ember-500/40 rounded-pixel py-3">
                <div className="heading-fantasy text-4xl text-ember-400">
                  {currentMatch.scoreA ?? "—"}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <span className="heading-fantasy text-xl text-ash-500">vs</span>
            </div>
            <div className="text-center">
              <p className="text-ash-500 text-[10px] uppercase tracking-widest mb-1">Opponents</p>
              <div className="bg-obsidian-800 border border-obsidian-500 rounded-pixel py-3">
                <div className="heading-fantasy text-4xl text-ash-300">
                  {currentMatch.scoreB ?? "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Match status */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-pixel bg-obsidian-800 border border-obsidian-600">
            {currentMatch.status === "SCHEDULED" && (
              <>
                <Clock className="h-4 w-4 text-gold-400 shrink-0" />
                <span className="text-ash-300 text-sm">Ready to play</span>
              </>
            )}
            {currentMatch.status === "SUBMITTED" && (
              <>
                <Clock className="h-4 w-4 text-spectral-400 shrink-0" />
                <span className="text-ash-300 text-sm">Awaiting verification</span>
              </>
            )}
            {currentMatch.status === "VERIFIED" && (
              <>
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-ash-300 text-sm">Score verified</span>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={onEnterScore}
              size="sm"
              disabled={currentMatch.status !== "SCHEDULED"}
            >
              <Activity className="h-3.5 w-3.5" /> Enter Score
            </Button>
            <Button
              onClick={onVerifyScore}
              variant="outline"
              size="sm"
              disabled={currentMatch.status !== "SUBMITTED"}
            >
              <CheckCircle className="h-3.5 w-3.5" /> Verify
            </Button>
          </div>
        </Panel>
      ) : (
        <Panel variant="inventory" padding="lg" className="text-center space-y-3">
          <Users className="h-8 w-8 text-spectral-400 mx-auto" />
          <p className="text-ash-300 text-sm">All matches complete for this session.</p>
          <Button onClick={onViewStandings} size="sm">
            <Trophy className="h-3.5 w-3.5" /> View Standings
          </Button>
        </Panel>
      )}

      {/* Next match preview */}
      {nextMatch && !sitOutMatch && (
        <Panel variant="base" padding="md" className="flex items-center gap-3">
          <div className="p-1.5 rounded bg-obsidian-700 shrink-0">
            <ChevronRight className="h-4 w-4 text-ash-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-ash-500 text-[10px] uppercase tracking-widest">Up next</p>
            <p className="text-ash-200 text-sm">
              Game {nextMatch.gameNumber} —{" "}
              {nextMatch.sideA.includes(playerId) ? nextMatch.sideA.length : nextMatch.sideB.length}{" "}
              vs{" "}
              {nextMatch.sideA.includes(playerId) ? nextMatch.sideB.length : nextMatch.sideA.length}{" "}
              players
            </p>
          </div>
          <Button onClick={onViewCourts} variant="ghost" size="sm" className="shrink-0">
            <LayoutGrid className="h-3.5 w-3.5" /> Courts
          </Button>
        </Panel>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={onViewStandings} variant="outline" size="sm" className="w-full">
          <Trophy className="h-3.5 w-3.5" /> Standings
        </Button>
        <Button onClick={onViewCourts} variant="outline" size="sm" className="w-full">
          <LayoutGrid className="h-3.5 w-3.5" /> All Courts
        </Button>
      </div>
    </div>
  );
}
