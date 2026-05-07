"use client";

import React from "react";
import { Panel } from "../ui/Panel";
import { RuneChip } from "../ui/RuneChip";
import { Trophy, TrendingUp } from "lucide-react";

export interface StandingsRow {
  rank: number;
  playerId: string;
  displayName?: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
}

export interface CourtStandings {
  courtNumber: number;
  courtSize: number;
  players: StandingsRow[];
}

interface LiveStandingsProps {
  sessionKind: "A" | "B";
  courtStandings: CourtStandings[];
  currentPlayerId?: string;
}

export function LiveStandings({ sessionKind, courtStandings, currentPlayerId }: LiveStandingsProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-gold-400" />
        <h2 className="heading-fantasy text-xl text-ash-100">Session {sessionKind} Standings</h2>
      </div>

      {courtStandings.map((court) => (
        <Panel key={court.courtNumber} variant="inventory" padding="none" className="overflow-hidden">
          {/* Court header */}
          <div className="bg-obsidian-800 border-b border-obsidian-600 px-4 py-3 flex items-center justify-between">
            <h3 className="heading-fantasy text-ash-100 text-base">Court {court.courtNumber}</h3>
            <RuneChip tone="neutral" className="text-[9px]">{court.courtSize} players</RuneChip>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-obsidian-600 bg-obsidian-900/50">
                  <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-ash-500">Rank</th>
                  <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-ash-500">Player</th>
                  <th className="px-4 py-2 text-center text-[10px] uppercase tracking-wider text-ash-500">W—L</th>
                  <th className="px-4 py-2 text-center text-[10px] uppercase tracking-wider text-ash-500">Pts For</th>
                  <th className="px-4 py-2 text-center text-[10px] uppercase tracking-wider text-ash-500">Pts Ag</th>
                  <th className="px-4 py-2 text-center text-[10px] uppercase tracking-wider text-ash-500">Diff</th>
                </tr>
              </thead>
              <tbody>
                {court.players.map((player) => {
                  const isMe = currentPlayerId === player.playerId;
                  const isLeader = player.rank === 1;
                  return (
                    <tr
                      key={player.playerId}
                      className={`border-b border-obsidian-700/50 transition-colors hover:bg-obsidian-700/40 ${
                        isLeader ? "bg-gold-900/15" : isMe ? "bg-ember-900/15" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isLeader && <Trophy className="w-3.5 h-3.5 text-gold-400" />}
                          <span className="font-mono text-ash-200 font-semibold">{player.rank}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isMe ? "text-ember-300" : "text-ash-100"}`}>
                            {player.displayName || player.playerId.slice(0, 8)}
                          </span>
                          {isMe && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-ember-900/50 text-ember-300 rounded-pixel">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-ash-200">
                        {player.wins}—{player.losses}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-ash-300">{player.pointsFor}</td>
                      <td className="px-4 py-3 text-center font-mono text-ash-300">{player.pointsAgainst}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-mono font-semibold flex items-center justify-center gap-1 ${
                          player.pointDifferential > 0
                            ? "text-spectral-400"
                            : player.pointDifferential < 0
                              ? "text-crimson-400"
                              : "text-ash-500"
                        }`}>
                          {player.pointDifferential > 0 && <TrendingUp className="w-3 h-3" />}
                          {player.pointDifferential > 0 ? "+" : ""}{player.pointDifferential}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ))}

      {/* Legend */}
      <Panel variant="base" padding="md">
        <p className="text-[10px] text-ash-500 uppercase tracking-wider mb-2">Legend</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-ash-400">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-pixel bg-gold-900/30 border border-gold-700/50" />
            <span>Court Leader</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-pixel bg-ember-900/30 border border-ember-700/50" />
            <span>Your Ranking</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-spectral-400 font-semibold">+</span>
            <span>Positive diff</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-crimson-400 font-semibold">−</span>
            <span>Negative diff</span>
          </div>
        </div>
      </Panel>
    </div>
  );
}
