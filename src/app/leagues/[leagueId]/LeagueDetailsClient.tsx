"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { getLeague } from "@/lib/leagues/repo";
import { resolveSelectedLeagueId, storeSelectedLeagueId } from "@/lib/selectedLeague";
import type { LeagueDoc } from "@/lib/firestore/types";

function formatNextPlayDate(value?: string): string {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function LeagueDetailsClient({ leagueId }: { leagueId: string }) {
  const searchParams = useSearchParams();
  const [league, setLeague] = useState<LeagueDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const preserved = resolveSelectedLeagueId(searchParams) ?? leagueId;
    if (preserved) storeSelectedLeagueId(preserved);
  }, [leagueId, searchParams]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const fetched = await getLeague(leagueId);
        setLeague(fetched);
        if (!fetched) setError("League not found.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load league details.");
      } finally {
        setLoading(false);
      }
    })();
  }, [leagueId]);

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-10 max-w-4xl">
        <div className="space-y-6">
          <div className="flex flex-col gap-3">
            <Link href="/" className="text-ash-400 text-sm hover:text-ash-100">← Back to home</Link>
            <RuneChip tone="rune" className="mb-1">League Details</RuneChip>
            <h1 className="heading-fantasy text-display-md text-ash-100">
              {league?.name ?? "League details"}
            </h1>
          </div>

          {loading ? (
            <Panel variant="base" padding="lg">
              <p className="text-ash-400">Loading league details…</p>
            </Panel>
          ) : error ? (
            <Panel variant="base" padding="lg">
              <p className="text-rose-400">{error}</p>
            </Panel>
          ) : league ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-5">
                <Panel variant="hud" padding="lg" className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-ash-400 text-sm">{league.city ?? "Unknown city"}, {league.state ?? ""}</p>
                      <h2 className="heading-fantasy text-2xl text-ash-100">{league.name}</h2>
                    </div>
                    <div className="rounded-pixel bg-obsidian-700 px-3 py-2 text-xs text-ash-300">
                      {league.active === false ? "Inactive" : "Active"}
                    </div>
                  </div>
                  <div className="grid gap-3 text-sm text-ash-300">
                    <div>
                      <span className="text-ash-100">Next play date:</span>{" "}
                      {formatNextPlayDate(league.next_play_date)}
                    </div>
                    <div>
                      <span className="text-ash-100">Check-in status:</span>{" "}
                      {league.check_in_status ?? "Unknown"}
                    </div>
                    <div>
                      <span className="text-ash-100">League format:</span>{" "}
                      {league.league_format ?? "Pickleball league"}
                    </div>
                  </div>
                </Panel>

                <Panel variant="inventory" padding="lg">
                  <h3 className="heading-fantasy text-xl text-ash-100">About this league</h3>
                  <p className="text-ash-300 text-sm leading-relaxed">
                    {league.description ?? "No description is available for this league yet."}
                  </p>
                </Panel>
              </div>

              <div className="space-y-4">
                <Panel variant="quest" padding="lg" className="space-y-4">
                  <div>
                    <p className="text-ash-400 text-xs uppercase tracking-[0.24em]">
                      Join this league
                    </p>
                    <h2 className="heading-fantasy text-lg text-ash-100">Create an account to join.</h2>
                  </div>
                  <div className="grid gap-2">
                    <Link href={`/auth/signup?leagueId=${league.id}`} className="w-full">
                      <Button size="sm" className="w-full">Create Account</Button>
                    </Link>
                    <Link href={`/auth/login?leagueId=${league.id}`} className="w-full">
                      <Button variant="outline" size="sm" className="w-full">Login</Button>
                    </Link>
                  </div>
                </Panel>

                <Panel variant="base" padding="lg">
                  <p className="text-ash-400 text-sm">
                    Standings are available after login. Create an account or log in to view player rankings, match history, and court assignments.
                  </p>
                </Panel>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </ResponsiveShell>
  );
}
