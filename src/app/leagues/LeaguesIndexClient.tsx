"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Compass,
  Loader2,
  MapPin,
  Plus,
  Sparkles,
} from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { useAuth } from "@/lib/auth-context";
import { listActiveLeagues, listUserLeagues } from "@/lib/leagues/repo";
import type { LeagueDoc } from "@/lib/firestore/types";

export function LeaguesIndexClient() {
  const { user, ready } = useAuth();
  const [mine, setMine] = useState<LeagueDoc[] | null>(null);
  const [discover, setDiscover] = useState<LeagueDoc[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    const userLeagues = user
      ? listUserLeagues(user.uid).catch(() => [] as LeagueDoc[])
      : Promise.resolve([] as LeagueDoc[]);
    const allActive = listActiveLeagues().catch(() => [] as LeagueDoc[]);
    Promise.all([userLeagues, allActive])
      .then(([userRows, activeRows]) => {
        const memberIds = new Set(userRows.map((l) => l.id));
        setMine(userRows);
        setDiscover(activeRows.filter((l) => !memberIds.has(l.id)));
      })
      .finally(() => setLoading(false));
  }, [user, ready]);

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-4xl">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <RuneChip tone="rune" className="mb-2">My Leagues</RuneChip>
            <h1 className="heading-fantasy text-display-md text-ash-100">
              Leagues
            </h1>
            <p className="text-ash-400 text-sm mt-1">
              Pick a league to see match days, check in, and view standings.
            </p>
          </div>
          <Link href="/leagues/create">
            <Button size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5" /> Create
            </Button>
          </Link>
        </div>

        {loading || !ready ? (
          <Panel variant="base" padding="lg" className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-ember-400" />
            <p className="text-ash-400 text-sm">Loading your leagues…</p>
          </Panel>
        ) : (
          <>
            {user && (
              <section className="space-y-3">
                <h2 className="heading-fantasy text-ash-100 text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-ember-400" />
                  My leagues
                </h2>
                {mine && mine.length > 0 ? (
                  <div className="grid gap-2">
                    {mine.map((l) => (
                      <LeagueRow key={l.id} league={l} tone="member" />
                    ))}
                  </div>
                ) : (
                  <Panel variant="quest" padding="lg" className="text-ash-400 text-sm">
                    You haven&apos;t joined a league yet. Pick one below to get started.
                  </Panel>
                )}
              </section>
            )}

            {!user && (
              <Panel variant="quest" padding="lg" className="space-y-3">
                <p className="text-ash-300 text-sm">
                  Sign in to see leagues you&apos;ve joined.
                </p>
                <div className="flex gap-2">
                  <Link href="/auth/login">
                    <Button size="sm">Sign In</Button>
                  </Link>
                  <Link href="/auth/signup">
                    <Button size="sm" variant="outline">Sign Up</Button>
                  </Link>
                </div>
              </Panel>
            )}

            <section className="space-y-3">
              <h2 className="heading-fantasy text-ash-100 text-base flex items-center gap-2">
                <Compass className="h-4 w-4 text-spectral-400" />
                Discover
              </h2>
              {discover && discover.length > 0 ? (
                <div className="grid gap-2">
                  {discover.map((l) => (
                    <LeagueRow key={l.id} league={l} tone="discover" />
                  ))}
                </div>
              ) : (
                <Panel variant="base" padding="lg" className="text-ash-500 text-sm text-center">
                  No other active leagues yet.
                </Panel>
              )}
            </section>
          </>
        )}
      </main>
    </ResponsiveShell>
  );
}

function LeagueRow({
  league,
  tone,
}: {
  league: LeagueDoc;
  tone: "member" | "discover";
}) {
  const subtitle = [league.city, league.state].filter(Boolean).join(", ");
  return (
    <Link href={`/leagues/${league.id}`}>
      <Panel
        variant={tone === "member" ? "inventory" : "base"}
        padding="md"
        className="flex items-center gap-3 hover:border-ember-500/40 transition-colors"
      >
        <div className="p-2 rounded-pixel bg-obsidian-700 shrink-0">
          <MapPin className="h-4 w-4 text-ember-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="heading-fantasy text-ash-100 text-sm truncate">
              {league.name}
            </p>
            {league.active === false && (
              <RuneChip tone="neutral" className="text-[9px]">Inactive</RuneChip>
            )}
          </div>
          <p className="text-ash-500 text-xs truncate">
            {subtitle || "Pickleball league"}
            {league.league_format ? ` · ${league.league_format}` : ""}
          </p>
        </div>
        {league.firstSessionDate && (
          <div className="text-[11px] text-ash-500 font-mono shrink-0 hidden sm:flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {league.firstSessionDate}
          </div>
        )}
      </Panel>
    </Link>
  );
}
