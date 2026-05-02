/**
 * Live Standings Display
 * Shows current session standings organized by court
 */

"use client";

import React from "react";
import { Panel } from "../ui/Panel";
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

export function LiveStandings({
  sessionKind,
  courtStandings,
  currentPlayerId,
}: LiveStandingsProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-6 h-6 text-amber-600" />
        <h1 className="text-3xl font-bold">Session {sessionKind} Standings</h1>
      </div>

      {/* Courts */}
      {courtStandings.map((court) => (
        <Panel key={court.courtNumber} className="overflow-hidden">
          {/* Court Header */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 border-b border-blue-200">
            <div className="font-bold text-lg text-blue-900">
              Court {court.courtNumber}
              <span className="text-sm font-normal text-blue-700 ml-2">
                ({court.courtSize} players)
              </span>
            </div>
          </div>

          {/* Standings Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">
                    Rank
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">
                    Player
                  </th>
                  <th className="px-4 py-2 text-center font-semibold text-slate-700">
                    W—L
                  </th>
                  <th className="px-4 py-2 text-center font-semibold text-slate-700">
                    Pts For
                  </th>
                  <th className="px-4 py-2 text-center font-semibold text-slate-700">
                    Pts Ag
                  </th>
                  <th className="px-4 py-2 text-center font-semibold text-slate-700">
                    Diff
                  </th>
                </tr>
              </thead>
              <tbody>
                {court.players.map((player, index) => (
                  <tr
                    key={player.playerId}
                    className={`border-b border-slate-100 transition ${
                      player.rank === 1
                        ? "bg-amber-50"
                        : currentPlayerId === player.playerId
                          ? "bg-blue-50"
                          : index % 2 === 0
                            ? "bg-white"
                            : "bg-slate-50"
                    } hover:bg-slate-100`}
                  >
                    {/* Rank */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {player.rank === 1 && (
                          <Trophy className="w-4 h-4 text-amber-600" />
                        )}
                        <span className="font-bold text-lg">
                          {player.rank}
                        </span>
                      </div>
                    </td>

                    {/* Player Name */}
                    <td className="px-4 py-3">
                      <div
                        className={`font-semibold ${
                          currentPlayerId === player.playerId
                            ? "text-blue-700"
                            : "text-slate-900"
                        }`}
                      >
                        {player.displayName || player.playerId.substring(0, 8)}
                        {currentPlayerId === player.playerId && (
                          <span className="text-xs ml-2 px-2 py-1 bg-blue-200 text-blue-700 rounded">
                            You
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Win-Loss Record */}
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold">
                        {player.wins}—{player.losses}
                      </span>
                    </td>

                    {/* Points For */}
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium">{player.pointsFor}</span>
                    </td>

                    {/* Points Against */}
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium">{player.pointsAgainst}</span>
                    </td>

                    {/* Differential */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`font-bold flex items-center justify-center gap-1 ${
                          player.pointDifferential > 0
                            ? "text-green-700"
                            : player.pointDifferential < 0
                              ? "text-red-600"
                              : "text-slate-600"
                        }`}
                      >
                        {player.pointDifferential > 0 && (
                          <TrendingUp className="w-3 h-3" />
                        )}
                        {player.pointDifferential > 0 ? "+" : ""}
                        {player.pointDifferential}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ))}

      {/* Legend */}
      <Panel className="bg-slate-50 p-4">
        <h3 className="font-semibold mb-2 text-sm">Legend</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-amber-100 border border-amber-300 rounded"></div>
            <span>Court Leader</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
            <span>Your Ranking</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs">W—L = Wins and Losses</span>
          </div>
        </div>
      </Panel>
    </div>
  );
}
