"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Lock, Minus, Trophy, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { SkeletonList } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getLeague, listLeagueMembers, type LeagueMemberEntry } from "@/lib/leagues/repo";
import { getPlayerProfile, listRecentEloEvents } from "@/lib/players/repo";
import { skillBand } from "@/lib/players/elo";
import { useAuth } from "@/lib/auth-context";
import type { LeagueDoc, PlayerProfileDoc } from "@/lib/firestore/types";

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

interface StandingRow {
  member: LeagueMemberEntry;
  profile: PlayerProfileDoc | null;
  rank: number;
  movement: "up" | "down" | "held";
}

export function StandingsClient({ leagueId: propLeagueId }: { leagueId: string }) {
  return (
    <Suspense
      fallback={
        <ResponsiveShell desktopChromeless>
          <main className="container py-10 text-ash-400">Loading…</main>
        </ResponsiveShell>
      }
    >
      <StandingsInner propLeagueId={propLeagueId} />
    </Suspense>
  );
}

function StandingsInner({ propLeagueId }: { propLeagueId: string }) {
  const pathname = usePathname();
  const pathnameSegment = pathname.split("/")[2];
  const leagueId =
    pathnameSegment && pathnameSegment !== "__fallback"
      ? pathnameSegment
      : propLeagueId;
  const { user } = useAuth();

  const [league, setLeague] = useState<LeagueDoc | null>(null);
  const [rows, setRows] = useState<StandingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) return;
    (async () => {
      try {
        const [lg, members] = await Promise.all([
          getLeague(leagueId),
          listLeagueMembers(leagueId),
        ]);
        setLeague(lg);

        const active = members.filter(
          (m) => m.status === "active" || m.status === "ACTIVE",
        );

        const enriched = await Promise.all(
          active.map(async (m) => {
            const profile = await getPlayerProfile(m.userId).catch(() => null);
            return { member: m, profile };
          }),
        );

        enriched.sort((a, b) => (b.profile?.elo ?? 0) - (a.profile?.elo ?? 0));

        const movementMap: Record<string, "up" | "down" | "held"> = {};
        await Promise.all(
          enriched.slice(0, 50).map(async ({ member: m }) => {
            try {
              const events = await listRecentEloEvents(m.userId, 3);
              const net = events.reduce((sum, e) => sum + e.delta, 0);
              movementMap[m.userId] = net > 0 ? "up" : net < 0 ? "down" : "held";
            } catch {
              movementMap[m.userId] = "held";
            }
          }),
        );

        setRows(
          enriched.map((e, i) => ({
            ...e,
            rank: i + 1,
            movement: movementMap[e.member.userId] ?? "held",
          })),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load standings");
      }
    })();
  }, [leagueId]);

  const rankColor = (rank: number) => {
    if (rank === 1) return "text-gold-400";
    if (rank === 2) return "text-ash-300";
    if (rank === 3) return "text-ember-500";
    return "text-ash-600";
  };

  if (!user) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-2xl">
          <Link href={`/leagues/${leagueId}`} className="text-ash-400 hover:text-ash-200 text-sm inline-flex items-center gap-1 mb-6">
            <ArrowLeft className="h-4 w-4" /> Back to league
          </Link>
          <Panel variant="quest" padding="lg" className="text-center space-y-4">
            <Lock className="h-10 w-10 text-ash-500 mx-auto" />
            <RuneChip tone="neutral">Members Only</RuneChip>
            <h2 className="heading-fantasy text-xl text-ash-100">Standings available after login</h2>
            <p className="text-ash-400 text-sm max-w-xs mx-auto">
              Create an account or log in to view player rankings, match history, and league results.
            </p>
            <div className="flex gap-3 justify-center">
              <Link href={`/auth/signup?leagueId=${leagueId}`}>
                <Button size="sm">Create Account</Button>
              </Link>
              <Link href={`/auth/login?leagueId=${leagueId}`}>
                <Button size="sm" variant="outline">Login</Button>
              </Link>
            </div>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link
              href={`/leagues/${leagueId}`}
              className="text-ash-400 hover:text-ash-200 text-sm inline-flex items-center gap-1 mb-2"
            >
              <ArrowLeft className="h-4 w-4" /> League
            </Link>
            <RuneChip tone="gold" className="mb-2 block w-fit">
              <Trophy className="h-3 w-3 inline mr-1" /> Standings
            </RuneChip>
            <h1 className="heading-fantasy text-display-md text-ash-100">
              {league?.name ?? "League Standings"}
            </h1>
            <p className="text-ash-400 text-sm mt-1">
              {rows !== null
                ? `${rows.length} player${rows.length !== 1 ? "s" : ""} ranked · sorted by ELO`
                : "Loading…"}
            </p>
          </div>
        </div>

        {/* Trend legend */}
        {rows !== null && rows.length > 0 && (
          <Panel
            variant="base"
            padding="sm"
            className="flex items-center gap-5 flex-wrap text-[11px] text-ash-500"
          >
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-spectral-400" /> Rising
            </span>
            <span className="flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5 text-crimson-500" /> Falling
            </span>
            <span className="flex items-center gap-1">
              <Minus className="h-3.5 w-3.5 text-ash-500" /> Held
            </span>
            <span className="ml-auto text-ash-600">Movement: last 3 matches</span>
          </Panel>
        )}

        {error && (
          <Panel variant="base" padding="sm">
            <p className="text-crimson-500 text-sm">{error}</p>
          </Panel>
        )}

        {rows === null ? (
          <SkeletonList count={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="No standings yet"
            description="Standings appear once players have joined and played in this league."
          />
        ) : (
          <Panel variant="inventory" padding="md">
            {/* Column headers */}
            <div className="grid grid-cols-[2.5rem_1fr_4rem_5rem_5rem_3rem] gap-2 pb-2 border-b border-obsidian-500 text-[10px] uppercase tracking-widest text-ash-600">
              <span className="text-right">#</span>
              <span>Player</span>
              <span className="text-right">ELO</span>
              <span className="text-right hidden sm:block">W–L</span>
              <span className="text-right hidden md:block">Win %</span>
              <span className="text-center">Trend</span>
            </div>

            <ol className="divide-y divide-obsidian-600">
              {rows.map(({ member: m, profile: p, rank, movement }) => {
                const band = p ? skillBand(p.elo) : null;
                const isMe = user?.uid === m.userId;
                const winRate =
                  p && p.stats.matches > 0
                    ? `${Math.round((p.stats.wins / p.stats.matches) * 100)}%`
                    : "—";

                return (
                  <li
                    key={m.id}
                    className={`grid grid-cols-[2.5rem_1fr_4rem_5rem_5rem_3rem] gap-2 items-center py-2.5 first:pt-1 last:pb-1 ${
                      isMe ? "bg-ember-900/10 -mx-4 px-4" : ""
                    }`}
                  >
                    {/* Rank */}
                    <span
                      className={`text-right heading-fantasy text-sm ${rankColor(rank)}`}
                    >
                      {rank}
                    </span>

                    {/* Player */}
                    <Link
                      href={`/players/view?uid=${m.userId}`}
                      className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
                    >
                      {p?.photoURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.photoURL}
                          alt=""
                          className="h-7 w-7 rounded-pixel object-cover border border-obsidian-500 shrink-0"
                        />
                      ) : (
                        <div className="h-7 w-7 rounded-pixel bg-obsidian-700 border border-obsidian-500 flex items-center justify-center text-xs text-ash-500 shrink-0">
                          {(p?.displayName ?? m.displayName ?? "?")
                            .slice(0, 1)
                            .toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div
                          className={`text-sm truncate ${
                            isMe ? "text-ember-300 font-medium" : "text-ash-100"
                          }`}
                        >
                          {p?.displayName ?? m.displayName ?? m.userId.slice(0, 8)}
                          {isMe && (
                            <span className="ml-1 text-[10px] text-ember-500">
                              you
                            </span>
                          )}
                        </div>
                        {band && (
                          <RuneChip tone={BAND_TONE[band]} className="text-[9px] mt-0.5">
                            {band}
                          </RuneChip>
                        )}
                      </div>
                    </Link>

                    {/* ELO */}
                    <span className="text-right heading-fantasy text-sm text-ash-100">
                      {p?.elo ?? "—"}
                    </span>

                    {/* W–L */}
                    <span className="text-right text-[11px] text-ash-500 font-mono hidden sm:block">
                      {p ? `${p.stats.wins}–${p.stats.losses}` : "—"}
                    </span>

                    {/* Win % */}
                    <span className="text-right text-[11px] text-ash-500 font-mono hidden md:block">
                      {winRate}
                    </span>

                    {/* Trend */}
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
          <Panel
            variant="base"
            padding="sm"
            className="flex items-center justify-between text-[11px] text-ash-500"
          >
            <span>
              {rows.length} player{rows.length !== 1 ? "s" : ""} · ranked by ELO
            </span>
            <Link
              href="/ladder/standings"
              className="hover:text-ash-200 transition-colors"
            >
              Global leaderboard →
            </Link>
          </Panel>
        )}
      </main>
    </ResponsiveShell>
  );
}
