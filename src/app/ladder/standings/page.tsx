"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowLeft,
  RefreshCw,
  Users,
} from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { subscribeLeaderboard, listRecentEloEvents } from "@/lib/players/repo";
import { skillBand } from "@/lib/players/elo";
import { useAuth } from "@/lib/auth-context";
import { isFirebaseConfigured } from "@/lib/firebase";
import type { PlayerProfileDoc } from "@/lib/firestore/types";

interface StandingsRow {
  profile: PlayerProfileDoc;
  rank: number;
  movement: "up" | "down" | "held";
}

const BAND_TONE: Record<
  ReturnType<typeof skillBand>,
  Parameters<typeof RuneChip>[0]["tone"]
> = {
  NOVICE: "neutral",
  BEGINNER: "spectral",
  INTERMEDIATE: "rune",
  ADVANCED: "ember",
  EXPERT: "gold",
  ELITE: "crimson",
};

export default function StandingsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<StandingsRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buildRows(players: PlayerProfileDoc[]) {
    // Compute recent ELO movement for each player (last 2 events, net delta).
    const movementMap: Record<string, "up" | "down" | "held"> = {};
    await Promise.all(
      players.slice(0, 50).map(async (p) => {
        try {
          const events = await listRecentEloEvents(p.id, 3);
          const netDelta = events.reduce((sum, e) => sum + e.delta, 0);
          movementMap[p.id] = netDelta > 0 ? "up" : netDelta < 0 ? "down" : "held";
        } catch {
          movementMap[p.id] = "held";
        }
      }),
    );
    setRows(
      players.map((p, i) => ({
        profile: p,
        rank: i + 1,
        movement: movementMap[p.id] ?? "held",
      })),
    );
  }

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setRows([]);
      return;
    }
    const unsub = subscribeLeaderboard((players) => {
      buildRows(players).catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load movement data"),
      );
    }, 100);
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <RuneChip tone="gold" className="mb-2 inline-flex items-center gap-1">
              <Trophy className="h-3 w-3" /> Standings
            </RuneChip>
            <h1 className="heading-fantasy text-display-md text-ash-100">
              Season Standings
            </h1>
            <p className="text-ash-400 text-sm mt-1">
              Ranked by ELO. Movement indicators show recent trend across last 3 matches.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/ladder/play-dates">
              <Button size="sm" variant="outline">
                <ArrowLeft className="h-3.5 w-3.5" /> Play Dates
              </Button>
            </Link>
          </div>
        </div>

        {error && (
          <Panel variant="base" padding="sm">
            <p className="text-crimson-500 text-sm">{error}</p>
          </Panel>
        )}

        {/* Legend */}
        <Panel variant="base" padding="sm" className="flex items-center gap-4 flex-wrap text-[11px] text-ash-500">
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-spectral-400" /> Rising (net ELO gain)
          </span>
          <span className="flex items-center gap-1">
            <TrendingDown className="h-3.5 w-3.5 text-crimson-500" /> Falling (net ELO loss)
          </span>
          <span className="flex items-center gap-1">
            <Minus className="h-3.5 w-3.5 text-ash-500" /> Held (no recent change)
          </span>
        </Panel>

        {rows === null ? (
          <Panel variant="base" padding="lg" className="text-center">
            <RefreshCw className="h-6 w-6 animate-spin text-ember-400 mx-auto mb-2" />
            <p className="text-ash-400 text-sm">Loading standings…</p>
          </Panel>
        ) : rows.length === 0 ? (
          <Panel variant="base" padding="lg" className="text-center space-y-3">
            <Users className="h-10 w-10 text-ash-600 mx-auto" />
            <p className="text-ash-400 text-sm">
              No players on the board yet. Create a profile to appear here.
            </p>
            <Link href="/players/edit">
              <Button size="sm">Create My Profile</Button>
            </Link>
          </Panel>
        ) : (
          <Panel variant="inventory" padding="md">
            {/* Column headers */}
            <div className="grid grid-cols-[2rem_auto_4rem_5rem_5rem_4rem] gap-2 pb-2 border-b border-obsidian-500 mb-1">
              <span className="text-[10px] uppercase tracking-widest text-ash-600 text-right">#</span>
              <span className="text-[10px] uppercase tracking-widest text-ash-600">Player</span>
              <span className="text-[10px] uppercase tracking-widest text-ash-600 text-right">ELO</span>
              <span className="text-[10px] uppercase tracking-widest text-ash-600 text-right hidden sm:block">W–L</span>
              <span className="text-[10px] uppercase tracking-widest text-ash-600 text-right hidden md:block">Win %</span>
              <span className="text-[10px] uppercase tracking-widest text-ash-600 text-center">Trend</span>
            </div>

            <ol className="divide-y divide-obsidian-600">
              {rows.map(({ profile: p, rank, movement }) => {
                const band = skillBand(p.elo);
                const isMe = user?.uid === p.userId;
                const winRate =
                  p.stats.matches > 0
                    ? `${Math.round((p.stats.wins / p.stats.matches) * 100)}%`
                    : "—";

                return (
                  <li
                    key={p.id}
                    className={`grid grid-cols-[2rem_auto_4rem_5rem_5rem_4rem] gap-2 items-center py-2.5 first:pt-1 last:pb-1 ${
                      isMe ? "bg-ember-900/20 rounded-pixel" : ""
                    }`}
                  >
                    <span className="text-right heading-fantasy text-sm text-ash-500">{rank}</span>

                    <Link
                      href={`/players/view?uid=${p.userId}`}
                      className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
                    >
                      {p.photoURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.photoURL}
                          alt=""
                          className="h-7 w-7 rounded-pixel object-cover border border-obsidian-500 shrink-0"
                        />
                      ) : (
                        <div className="h-7 w-7 rounded-pixel bg-obsidian-700 border border-obsidian-500 flex items-center justify-center text-xs text-ash-500 shrink-0">
                          {p.displayName.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm text-ash-100 truncate flex items-center gap-1">
                          {p.displayName}
                          {isMe && (
                            <span className="text-[10px] text-ember-400 uppercase tracking-widest shrink-0">You</span>
                          )}
                        </div>
                        <RuneChip tone={BAND_TONE[band]} className="text-[9px] mt-0.5">{band}</RuneChip>
                      </div>
                    </Link>

                    <span className="text-right heading-fantasy text-sm text-ash-100">{p.elo}</span>

                    <span className="text-right text-[12px] text-ash-400 font-mono hidden sm:block">
                      {p.stats.wins}–{p.stats.losses}
                    </span>

                    <span className="text-right text-[12px] text-ash-400 font-mono hidden md:block">
                      {winRate}
                    </span>

                    <div className="flex justify-center">
                      {movement === "up" ? (
                        <TrendingUp className="h-4 w-4 text-spectral-400" />
                      ) : movement === "down" ? (
                        <TrendingDown className="h-4 w-4 text-crimson-500" />
                      ) : (
                        <Minus className="h-4 w-4 text-ash-600" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Panel>
        )}

        {rows && rows.length > 0 && (
          <Panel variant="base" padding="sm" className="flex items-center justify-between text-[11px] text-ash-500">
            <span>{rows.length} players ranked</span>
            <Link href="/players" className="hover:text-ash-200 transition-colors">
              Full leaderboard →
            </Link>
          </Panel>
        )}
      </main>
    </ResponsiveShell>
  );
}
