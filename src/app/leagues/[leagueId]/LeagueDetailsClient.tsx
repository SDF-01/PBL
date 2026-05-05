"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Layers,
  Loader2,
  LogIn,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { getLeague, getUserLeagueMembership } from "@/lib/leagues/repo";
import { joinLeague } from "@/lib/leagues/write";
import { resolveSelectedLeagueId, storeSelectedLeagueId } from "@/lib/selectedLeague";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
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

export function LeagueDetailsClient({ leagueId: fallbackId }: { leagueId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL shape: /leagues/{leagueId} → segment index 2
  // usePathname() always reflects the real browser URL; the prop may be "__fallback".
  const pathnameSegment = pathname.split("/")[2];
  const leagueId =
    pathnameSegment && pathnameSegment !== "__fallback"
      ? pathnameSegment
      : fallbackId;
  const { user } = useAuth();
  const {
    isSiteAdmin,
    clubDirectorFor,
    leagueCoordinatorFor,
    coordinatorClubIds,
    loading: permLoading,
  } = usePermissions();

  const [league, setLeague] = useState<LeagueDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // undefined = not yet checked, null = confirmed not a member
  const [membership, setMembership] = useState<{ id: string; status: string } | null | undefined>(
    undefined,
  );
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    const preserved = resolveSelectedLeagueId(searchParams) ?? leagueId;
    if (preserved) storeSelectedLeagueId(preserved);
  }, [leagueId, searchParams]);

  useEffect(() => {
    if (!leagueId || leagueId === "__fallback") { setLoading(false); return; }
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

  // Check the logged-in user's membership once permissions + league are both ready.
  useEffect(() => {
    if (!user || !league || permLoading) return;
    getUserLeagueMembership(leagueId, user.uid)
      .then(setMembership)
      .catch(() => setMembership(null));
  }, [user, league, leagueId, permLoading]);

  const clubId = league?.clubId ?? league?.orgId ?? "";
  const isDirector = !permLoading && (isSiteAdmin || clubDirectorFor.includes(clubId));
  const isCoordinator =
    !permLoading &&
    (leagueCoordinatorFor.includes(leagueId) || coordinatorClubIds.includes(clubId));
  const isStaff = isDirector || isCoordinator;
  const isMember = membership?.status === "active";
  const membershipChecked = membership !== undefined;

  async function handleJoin() {
    if (!user) return;
    setJoining(true);
    setJoinError(null);
    try {
      await joinLeague(user.uid, leagueId);
      setMembership({ id: `${leagueId}__${user.uid}`, status: "active" });
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Failed to join league.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-10 max-w-4xl">
        <div className="space-y-6">
          <div className="flex flex-col gap-3">
            <Link href="/" className="text-ash-400 text-sm hover:text-ash-100">
              ← Back to home
            </Link>
            <RuneChip tone="rune" className="mb-1">League Details</RuneChip>
            <h1 className="heading-fantasy text-display-md text-ash-100">
              {league?.name ?? "League details"}
            </h1>
          </div>

          {loading ? (
            <Panel variant="base" padding="lg" className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-ember-400" />
              <p className="text-ash-400">Loading league details…</p>
            </Panel>
          ) : error ? (
            <Panel variant="base" padding="lg">
              <p className="text-rose-400">{error}</p>
            </Panel>
          ) : league ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* Left: league info */}
              <div className="space-y-5">
                <Panel variant="hud" padding="lg" className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-ash-400 text-sm">
                        {league.city ?? "Unknown city"}, {league.state ?? ""}
                      </p>
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

                <Panel variant="inventory" padding="lg" className="space-y-2">
                  <h3 className="heading-fantasy text-xl text-ash-100">About this league</h3>
                  <p className="text-ash-300 text-sm leading-relaxed">
                    {league.description ?? "No description is available for this league yet."}
                  </p>
                </Panel>
              </div>

              {/* Right: role-aware action panel */}
              <div className="space-y-4">

                {/* ── Staff: Club Director or Coordinator ── */}
                {isStaff && (
                  <Panel variant="quest" padding="lg" className="space-y-4">
                    <div>
                      <RuneChip tone="gold" className="mb-2">
                        {isDirector ? "Club Director" : "Coordinator"}
                      </RuneChip>
                      <h2 className="heading-fantasy text-lg text-ash-100">Manage this league</h2>
                      <p className="text-ash-500 text-xs mt-1">
                        You have management access to this league.
                      </p>
                    </div>
                    <div className="grid gap-2">
                      {clubId && (
                        <Link href={`/clubs/manage/${clubId}?section=leagues`}>
                          <Button size="sm" className="w-full">
                            <ShieldCheck className="h-3.5 w-3.5" /> Club Hub
                          </Button>
                        </Link>
                      )}
                      <Link href="/ladder/play-dates">
                        <Button size="sm" variant="outline" className="w-full">
                          <CalendarDays className="h-3.5 w-3.5" /> Play Dates
                        </Button>
                      </Link>
                      <Link href="/players">
                        <Button size="sm" variant="outline" className="w-full">
                          <Users className="h-3.5 w-3.5" /> Leaderboard
                        </Button>
                      </Link>
                    </div>
                  </Panel>
                )}

                {/* ── Active member ── */}
                {!isStaff && user && isMember && (
                  <Panel variant="hud" padding="lg" className="space-y-4">
                    <div>
                      <RuneChip tone="success" className="mb-2">
                        <CheckCircle2 className="h-3 w-3" /> Member
                      </RuneChip>
                      <h2 className="heading-fantasy text-lg text-ash-100">
                        You&apos;re in this league
                      </h2>
                      <p className="text-ash-500 text-xs mt-1">
                        Check in on play date days to get your court assignment.
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Link href="/ladder/check-in">
                        <Button size="sm" className="w-full">
                          <UserCheck className="h-3.5 w-3.5" /> Check In
                        </Button>
                      </Link>
                      <Link href="/ladder/play-dates">
                        <Button size="sm" variant="outline" className="w-full">
                          <CalendarDays className="h-3.5 w-3.5" /> Play Dates
                        </Button>
                      </Link>
                      <Link href="/players">
                        <Button size="sm" variant="outline" className="w-full">
                          <Layers className="h-3.5 w-3.5" /> Standings
                        </Button>
                      </Link>
                    </div>
                  </Panel>
                )}

                {/* ── Logged-in, not a member — show join ── */}
                {!isStaff && user && !isMember && membershipChecked && (
                  <Panel variant="quest" padding="lg" className="space-y-4">
                    <div>
                      <p className="text-ash-400 text-xs uppercase tracking-[0.24em]">
                        Join this league
                      </p>
                      <h2 className="heading-fantasy text-lg text-ash-100">
                        Join now to play.
                      </h2>
                    </div>
                    {joinError && <p className="text-rose-400 text-xs">{joinError}</p>}
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={handleJoin}
                      disabled={joining}
                    >
                      {joining ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Joining…
                        </>
                      ) : (
                        "Join League"
                      )}
                    </Button>
                  </Panel>
                )}

                {/* ── Logged-in but membership check still loading ── */}
                {!isStaff && user && !membershipChecked && !permLoading && (
                  <Panel variant="base" padding="lg" className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-ember-400" />
                    <p className="text-ash-500 text-sm">Loading your status…</p>
                  </Panel>
                )}

                {/* ── Not logged in ── */}
                {!user && (
                  <Panel variant="quest" padding="lg" className="space-y-4">
                    <div>
                      <p className="text-ash-400 text-xs uppercase tracking-[0.24em]">
                        Join this league
                      </p>
                      <h2 className="heading-fantasy text-lg text-ash-100">
                        Create an account to join.
                      </h2>
                    </div>
                    <div className="grid gap-2">
                      <Link href={`/auth/signup?leagueId=${league.id}`} className="w-full">
                        <Button size="sm" className="w-full">Create Account</Button>
                      </Link>
                      <Link href={`/auth/login?leagueId=${league.id}`} className="w-full">
                        <Button variant="outline" size="sm" className="w-full">
                          <LogIn className="h-3.5 w-3.5" /> Login
                        </Button>
                      </Link>
                    </div>
                  </Panel>
                )}

                <Panel variant="base" padding="lg">
                  <p className="text-ash-400 text-sm">
                    Standings and match history are available after joining the league.
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
