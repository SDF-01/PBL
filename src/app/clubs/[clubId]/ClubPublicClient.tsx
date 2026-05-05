"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Car,
  CheckCircle,
  Layers,
  Lightbulb,
  Loader2,
  MapPin,
  ShieldCheck,
  Settings,
  Trophy,
  Users,
} from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import {
  countClubPlayers,
  getClubById,
  getClubBySlug,
  getClubFacility,
  listClubCoordinators,
  listClubLeagues,
} from "@/lib/clubs/repo";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import type { ClubDoc, ClubFacility } from "@/lib/permissions/types";
import type { LeagueDoc } from "@/lib/firestore/types";
import type { CoordinatorEntry } from "@/lib/clubs/repo";

export function ClubPublicClient({ clubId: fallbackId }: { clubId: string }) {
  const routeParams = useParams<{ clubId: string }>();
  const pathname = usePathname();
  const { user } = useAuth();
  const { isSiteAdmin, clubDirectorFor, loading: permLoading } = usePermissions();

  // useParams() may return "__fallback" when the fallback shell is served for a dynamic URL.
  // usePathname() always reflects the real browser URL, so prefer it.
  const pathnameSegment = pathname.split("/")[2];
  const slugOrId =
    pathnameSegment && pathnameSegment !== "__fallback"
      ? pathnameSegment
      : routeParams?.clubId && routeParams.clubId !== "__fallback"
      ? routeParams.clubId
      : fallbackId;

  const [club, setClub] = useState<ClubDoc | null>(null);
  const [leagues, setLeagues] = useState<LeagueDoc[]>([]);
  const [coordinators, setCoordinators] = useState<CoordinatorEntry[]>([]);
  const [facility, setFacility] = useState<ClubFacility | null>(null);
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slugOrId || slugOrId === "__fallback") { setLoading(false); return; }
    setLoading(true);
    (async () => {
      // Try direct doc-ID lookup first (fast path for existing links)
      let c = await getClubById(slugOrId);
      // Fall back to slug lookup for human-readable URLs
      if (!c) c = await getClubBySlug(slugOrId);
      if (!c) { setLoading(false); return; }

      setClub(c);
      const realId = c.id;
      const [l, coords, f] = await Promise.all([
        listClubLeagues(realId),
        listClubCoordinators(realId),
        getClubFacility(realId),
      ]);
      setLeagues(l);
      setCoordinators(coords);
      setFacility(f);
      const count = await countClubPlayers(l.map((x) => x.id));
      setPlayerCount(count);
      setLoading(false);
    })().catch((e) => { console.error(e); setLoading(false); });
  }, [slugOrId]);

  // Always use the real Firestore doc ID for permission checks and manage links
  const realClubId = club?.id ?? slugOrId;
  const isDirector = !permLoading && (isSiteAdmin || clubDirectorFor.includes(realClubId));

  if (loading || (slugOrId === "__fallback" && !club)) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-4xl flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-ember-400" />
        </main>
      </ResponsiveShell>
    );
  }

  if (!club) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-4xl">
          <Panel variant="base" padding="lg">
            <p className="text-rose-400">Club not found.</p>
            <Link href="/clubs/my" className="text-ash-400 text-sm hover:text-ash-100 mt-2 inline-block">
              ← My Clubs
            </Link>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  const totalCourts = (facility?.pickleballCourts ?? 0) + (facility?.tennisConversionCourts ?? 0);

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-8 max-w-4xl">

        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-2 text-xs text-ash-500">
          <Link href="/clubs/my" className="hover:text-ash-100 flex items-center gap-1 transition-colors">
            <ArrowLeft className="h-3 w-3" /> My Clubs
          </Link>
          <span>·</span>
          <span className="text-ash-300">{club.clubName}</span>
        </div>

        {/* ── Hero ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-ember-900/40 border border-ember-800/50 shrink-0">
              <Building2 className="h-7 w-7 text-ember-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="heading-fantasy text-display-sm text-ash-100">{club.clubName}</h1>
                <RuneChip tone="success">
                  <CheckCircle className="h-3 w-3" /> Approved
                </RuneChip>
              </div>
              <p className="text-ash-400 text-sm flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-ember-400 shrink-0" />
                {club.location}
              </p>
              {club.description && (
                <p className="text-ash-500 text-sm mt-2 max-w-xl leading-relaxed">{club.description}</p>
              )}
            </div>
          </div>

          {/* Director actions */}
          {isDirector && (
            <div className="flex flex-col gap-2 shrink-0">
              <Link href={`/clubs/manage/${realClubId}`}>
                <Button size="sm" className="w-full sm:w-auto">
                  <Settings className="h-3.5 w-3.5" /> Manage Club
                </Button>
              </Link>
              {isSiteAdmin && (
                <Link href="/admin/clubs">
                  <Button size="sm" variant="outline" className="w-full sm:w-auto border-ember-500/40 text-ember-400 hover:bg-ember-500/10">
                    <ShieldCheck className="h-3.5 w-3.5" /> Admin Console
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-3 gap-3">
          <Panel variant="hud" padding="md" className="text-center space-y-1">
            <Layers className="h-5 w-5 text-ember-400 mx-auto" />
            <p className="heading-fantasy text-ash-100 text-2xl">{loading ? "—" : leagues.length}</p>
            <p className="text-ash-500 text-[10px] uppercase tracking-wider">Leagues</p>
          </Panel>
          <Panel variant="hud" padding="md" className="text-center space-y-1">
            <Trophy className="h-5 w-5 text-ember-400 mx-auto" />
            <p className="heading-fantasy text-ash-100 text-2xl">
              {playerCount === null ? "—" : playerCount}
            </p>
            <p className="text-ash-500 text-[10px] uppercase tracking-wider">Players</p>
          </Panel>
          <Panel variant="hud" padding="md" className="text-center space-y-1">
            <Users className="h-5 w-5 text-ember-400 mx-auto" />
            <p className="heading-fantasy text-ash-100 text-2xl">{loading ? "—" : coordinators.length}</p>
            <p className="text-ash-500 text-[10px] uppercase tracking-wider">Coordinators</p>
          </Panel>
        </div>

        {/* ── Main content: leagues + facilities + sidebar ── */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">

          {/* Left column */}
          <div className="space-y-6">

            {/* Leagues */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest flex items-center gap-2">
                  <Layers className="h-4 w-4 text-ember-400" /> Leagues
                </h2>
                {isDirector && (
                  <Link href={`/clubs/manage/${realClubId}?section=leagues`}>
                    <Button size="sm" variant="ghost" className="text-ember-400">
                      + Add League
                    </Button>
                  </Link>
                )}
              </div>

              {loading ? (
                <Panel variant="base" padding="md" className="flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-ember-400" />
                </Panel>
              ) : leagues.length === 0 ? (
                <Panel variant="base" padding="md" className="text-center space-y-2">
                  <Layers className="h-6 w-6 text-ash-600 mx-auto" />
                  <p className="text-ash-500 text-sm">No leagues running yet.</p>
                  {isDirector && (
                    <Link href={`/clubs/manage/${realClubId}?section=leagues`}>
                      <Button size="sm" variant="outline" className="mt-1">Create First League</Button>
                    </Link>
                  )}
                </Panel>
              ) : (
                <div className="space-y-2">
                  {leagues.map((league) => (
                    <Panel key={league.id} variant="inventory" padding="md">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="heading-fantasy text-ash-100 text-sm">{league.name}</span>
                            {league.active !== false && (
                              <RuneChip tone="success" className="text-[10px]">Active</RuneChip>
                            )}
                          </div>
                          <p className="text-ash-500 text-xs mt-0.5">
                            {[league.city, league.state].filter(Boolean).join(", ")}
                            {league.league_format ? ` · ${league.league_format}` : ""}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Link href={`/leagues/${league.id}`}>
                            <Button size="sm" variant="outline">View</Button>
                          </Link>
                          {isDirector && (
                            <Link href={`/clubs/manage/${realClubId}?section=leagues`}>
                              <Button size="sm" variant="ghost">
                                <Settings className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </Panel>
                  ))}
                </div>
              )}
            </section>

            {/* Facilities */}
            {(facility || isDirector) && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-ember-400" /> Facilities
                  </h2>
                  {isDirector && (
                    <Link href={`/clubs/manage/${realClubId}?section=facilities`}>
                      <Button size="sm" variant="ghost" className="text-ember-400">Edit</Button>
                    </Link>
                  )}
                </div>

                {facility ? (
                  <Panel variant="quest" padding="lg" className="space-y-4">
                    {facility.facilityName && (
                      <p className="heading-fantasy text-ash-100 text-sm">{facility.facilityName}</p>
                    )}
                    {facility.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-ember-400 mt-0.5 shrink-0" />
                        <p className="text-ash-300 text-sm">{facility.address}</p>
                      </div>
                    )}

                    {totalCourts > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        {(facility.pickleballCourts ?? 0) > 0 && (
                          <div className="rounded-pixel bg-obsidian-700 px-3 py-2">
                            <p className="text-ash-100 text-lg font-bold heading-fantasy">{facility.pickleballCourts}</p>
                            <p className="text-ash-500 text-[10px] uppercase tracking-wide">Pickleball Courts</p>
                          </div>
                        )}
                        {(facility.tennisConversionCourts ?? 0) > 0 && (
                          <div className="rounded-pixel bg-obsidian-700 px-3 py-2">
                            <p className="text-ash-100 text-lg font-bold heading-fantasy">{facility.tennisConversionCourts}</p>
                            <p className="text-ash-500 text-[10px] uppercase tracking-wide">Tennis Conversion</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-3 flex-wrap">
                      {facility.hasParking && (
                        <div className="flex items-center gap-1.5 text-xs text-ash-300">
                          <Car className="h-3.5 w-3.5 text-ember-400" /> Parking
                        </div>
                      )}
                      {facility.hasLights && (
                        <div className="flex items-center gap-1.5 text-xs text-ash-300">
                          <Lightbulb className="h-3.5 w-3.5 text-ember-400" /> Court Lights
                        </div>
                      )}
                    </div>

                    {(facility.amenities?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-ash-800">
                        {facility.amenities!.map((a) => (
                          <span key={a} className="px-2 py-0.5 rounded-full text-[10px] bg-obsidian-700 border border-ash-700 text-ash-400">
                            {a}
                          </span>
                        ))}
                      </div>
                    )}

                    {facility.notes && (
                      <p className="text-ash-500 text-xs leading-relaxed pt-1 border-t border-ash-800">
                        {facility.notes}
                      </p>
                    )}
                  </Panel>
                ) : (
                  <Panel variant="base" padding="md" className="text-center">
                    <p className="text-ash-500 text-sm">No facility info added yet.</p>
                    <Link href={`/clubs/manage/${realClubId}?section=facilities`}>
                      <Button size="sm" variant="outline" className="mt-2">Add Facility Info</Button>
                    </Link>
                  </Panel>
                )}
              </section>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">

            {/* Join CTA */}
            {!user ? (
              <Panel variant="quest" padding="lg" className="space-y-4">
                <div>
                  <RuneChip tone="rune" className="mb-2">Join a League</RuneChip>
                  <h2 className="heading-fantasy text-lg text-ash-100">Play at {club.clubName}</h2>
                  <p className="text-ash-500 text-xs mt-1">
                    Create an account to join one of this club&apos;s leagues.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Link href="/auth/signup" className="w-full">
                    <Button size="sm" className="w-full">Create Account</Button>
                  </Link>
                  <Link href="/auth/login" className="w-full">
                    <Button variant="outline" size="sm" className="w-full">Login</Button>
                  </Link>
                </div>
              </Panel>
            ) : !isDirector ? (
              <Panel variant="hud" padding="lg" className="space-y-3">
                <h2 className="heading-fantasy text-ash-100 text-base">Browse Leagues</h2>
                <p className="text-ash-500 text-xs">
                  Select a league below and hit &quot;View&quot; to join.
                </p>
                <Link href="/ladder/play-dates">
                  <Button size="sm" variant="outline" className="w-full">
                    <CalendarDays className="h-3.5 w-3.5" /> Upcoming Play Dates
                  </Button>
                </Link>
              </Panel>
            ) : null}

            {/* Coordinators */}
            {coordinators.length > 0 && (
              <Panel variant="inventory" padding="md" className="space-y-3">
                <h3 className="heading-fantasy text-ash-300 text-xs uppercase tracking-widest flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-ember-400" /> Coordinators
                </h3>
                <div className="space-y-2">
                  {coordinators.map((c) => (
                    <div key={c.userRoleId} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-obsidian-700 flex items-center justify-center shrink-0">
                        <Users className="h-3 w-3 text-ember-400" />
                      </div>
                      <span className="text-ash-200 text-sm">{c.displayName ?? "Coordinator"}</span>
                    </div>
                  ))}
                </div>
                {isDirector && (
                  <Link href={`/clubs/manage/${realClubId}?section=coordinators`}>
                    <Button size="sm" variant="ghost" className="w-full text-ember-400">
                      Manage Coordinators
                    </Button>
                  </Link>
                )}
              </Panel>
            )}

            {/* Director quick-access */}
            {isDirector && (
              <Panel variant="quest" padding="md" className="space-y-2">
                <h3 className="heading-fantasy text-ash-300 text-xs uppercase tracking-widest">Quick Access</h3>
                <div className="grid gap-1.5">
                  <Link href={`/clubs/manage/${realClubId}?section=leagues`}>
                    <Button size="sm" variant="ghost" className="w-full justify-start text-ash-300 hover:text-ash-100">
                      <Layers className="h-3.5 w-3.5 text-ember-400" /> Leagues
                    </Button>
                  </Link>
                  <Link href={`/clubs/manage/${realClubId}?section=facilities`}>
                    <Button size="sm" variant="ghost" className="w-full justify-start text-ash-300 hover:text-ash-100">
                      <MapPin className="h-3.5 w-3.5 text-ember-400" /> Facilities
                    </Button>
                  </Link>
                  <Link href={`/clubs/manage/${realClubId}?section=coordinators`}>
                    <Button size="sm" variant="ghost" className="w-full justify-start text-ash-300 hover:text-ash-100">
                      <Users className="h-3.5 w-3.5 text-ember-400" /> Coordinators
                    </Button>
                  </Link>
                  <Link href="/ladder/play-dates">
                    <Button size="sm" variant="ghost" className="w-full justify-start text-ash-300 hover:text-ash-100">
                      <CalendarDays className="h-3.5 w-3.5 text-ember-400" /> Play Dates
                    </Button>
                  </Link>
                </div>
              </Panel>
            )}
          </div>
        </div>
      </main>
    </ResponsiveShell>
  );
}
