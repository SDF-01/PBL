"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  BellOff,
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
  getClubFollowerCount,
  isFollowingClub,
  listClubCoordinators,
  listClubFacilities,
  listClubLeagues,
  listClubPosts,
} from "@/lib/clubs/repo";
import { followClub, unfollowClub } from "@/lib/clubs/write";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import type { ClubDoc, ClubFacility, ClubPost } from "@/lib/permissions/types";
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
  const [facilities, setFacilities] = useState<ClubFacility[]>([]);
  const [posts, setPosts] = useState<ClubPost[]>([]);
  const [playerCount, setPlayerCount] = useState<number>(0);
  const [followerCount, setFollowerCount] = useState<number>(0);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
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
      const [leagueRes, coordRes, facilityRes, fCountRes, postsRes] = await Promise.allSettled([
        listClubLeagues(realId),
        listClubCoordinators(realId),
        listClubFacilities(realId),
        getClubFollowerCount(realId),
        listClubPosts(realId, 10),
      ]);
      const l = leagueRes.status === "fulfilled" ? leagueRes.value : [];
      setLeagues(l);
      if (coordRes.status === "fulfilled") setCoordinators(coordRes.value);
      if (facilityRes.status === "fulfilled") setFacilities(facilityRes.value);
      if (fCountRes.status === "fulfilled") setFollowerCount(fCountRes.value);
      if (postsRes.status === "fulfilled") setPosts(postsRes.value);
      const count = await countClubPlayers(l.map((x) => x.id)).catch(() => 0);
      setPlayerCount(count);
      if (user) {
        const alreadyFollowing = await isFollowingClub(user.uid, realId).catch(() => false);
        setFollowing(alreadyFollowing);
      }
      setLoading(false);
    })().catch((e) => { console.error(e); setLoading(false); });
  }, [slugOrId]);

  // Always use the real Firestore doc ID for permission checks and manage links
  const realClubId = club?.id ?? slugOrId;
  const isDirector = !permLoading && (isSiteAdmin || clubDirectorFor.includes(realClubId));

  async function handleFollowToggle() {
    if (!user || !club) return;
    setFollowBusy(true);
    try {
      if (following) {
        await unfollowClub(user.uid, club.id);
        setFollowing(false);
        setFollowerCount((n) => Math.max(0, n - 1));
      } else {
        await followClub(user.uid, club.id);
        setFollowing(true);
        setFollowerCount((n) => n + 1);
      }
    } finally {
      setFollowBusy(false);
    }
  }

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

          <div className="flex flex-col gap-2 shrink-0">
            {/* Follow button — shown for signed-in non-directors */}
            {user && !isDirector && (
              <Button
                size="sm"
                variant={following ? "outline" : "ghost"}
                className={`w-full sm:w-auto ${following ? "border-spectral-500/40 text-spectral-400" : "text-ash-300 border-ash-700"}`}
                onClick={handleFollowToggle}
                disabled={followBusy}
              >
                {following
                  ? <><BellOff className="h-3.5 w-3.5" /> Following</>
                  : <><Bell className="h-3.5 w-3.5" /> Follow</>}
              </Button>
            )}

            {/* Director actions */}
            {isDirector && (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-4 gap-3">
          <Panel variant="hud" padding="md" className="text-center space-y-1">
            <Layers className="h-5 w-5 text-ember-400 mx-auto" />
            <p className="heading-fantasy text-ash-100 text-2xl">{loading ? "—" : leagues.length}</p>
            <p className="text-ash-500 text-[10px] uppercase tracking-wider">Leagues</p>
          </Panel>
          <Panel variant="hud" padding="md" className="text-center space-y-1">
            <Trophy className="h-5 w-5 text-ember-400 mx-auto" />
            <p className="heading-fantasy text-ash-100 text-2xl">
              {loading ? "—" : playerCount}
            </p>
            <p className="text-ash-500 text-[10px] uppercase tracking-wider">Players</p>
          </Panel>
          <Panel variant="hud" padding="md" className="text-center space-y-1">
            <Users className="h-5 w-5 text-ember-400 mx-auto" />
            <p className="heading-fantasy text-ash-100 text-2xl">{loading ? "—" : coordinators.length}</p>
            <p className="text-ash-500 text-[10px] uppercase tracking-wider">Coordinators</p>
          </Panel>
          <Panel variant="hud" padding="md" className="text-center space-y-1">
            <Bell className="h-5 w-5 text-spectral-400 mx-auto" />
            <p className="heading-fantasy text-ash-100 text-2xl">{followerCount}</p>
            <p className="text-ash-500 text-[10px] uppercase tracking-wider">Followers</p>
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
                        <div className="min-w-0 flex-1">
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
                          {league.next_play_date && (
                            <p className="text-ash-400 text-xs mt-1 flex items-center gap-1">
                              <CalendarDays className="h-3 w-3 text-spectral-400 shrink-0" />
                              Next: {league.next_play_date}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                          <Link href={`/leagues/${league.id}`}>
                            <Button size="sm" variant="outline">View</Button>
                          </Link>
                          {user && !isDirector && league.active !== false && (
                            <Link href={`/leagues/${league.id}`}>
                              <Button size="sm">Join</Button>
                            </Link>
                          )}
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
            {(facilities.length > 0 || isDirector) && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-ember-400" /> Facilities
                  </h2>
                  {isDirector && (
                    <Link href={`/clubs/manage/${realClubId}?section=facilities`}>
                      <Button size="sm" variant="ghost" className="text-ember-400">
                        {facilities.length === 0 ? "Add" : "Edit"}
                      </Button>
                    </Link>
                  )}
                </div>

                {facilities.length === 0 ? (
                  <Panel variant="base" padding="md" className="text-center">
                    <p className="text-ash-500 text-sm">No facility info added yet.</p>
                    {isDirector && (
                      <Link href={`/clubs/manage/${realClubId}?section=facilities`}>
                        <Button size="sm" variant="outline" className="mt-2">Add Facility Info</Button>
                      </Link>
                    )}
                  </Panel>
                ) : (
                  <div className="space-y-3">
                    {facilities.map((facility) => (
                      <Panel key={facility.id} variant="inventory" padding="md" className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded bg-ash-800 shrink-0 mt-0.5">
                            <MapPin className="h-4 w-4 text-ember-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {facility.facilityName && (
                              <p className="heading-fantasy text-ash-100 text-sm">{facility.facilityName}</p>
                            )}
                            {facility.address && (
                              <p className="text-ash-400 text-xs mt-0.5">{facility.address}</p>
                            )}
                            <div className="flex flex-wrap gap-3 mt-1.5 text-ash-500 text-xs">
                              {(facility.pickleballCourts ?? 0) > 0 && (
                                <span>{facility.pickleballCourts} Pickleball Courts</span>
                              )}
                              {(facility.tennisConversionCourts ?? 0) > 0 && (
                                <span>{facility.tennisConversionCourts} Tennis Conversion</span>
                              )}
                              {facility.hasParking && <span className="flex items-center gap-1"><Car className="h-3 w-3" /> Parking</span>}
                              {facility.hasLights && <span className="flex items-center gap-1"><Lightbulb className="h-3 w-3" /> Lights</span>}
                            </div>
                            {(facility.amenities?.length ?? 0) > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {facility.amenities!.slice(0, 4).map((a) => (
                                  <span key={a} className="px-1.5 py-0.5 rounded-full text-[10px] bg-obsidian-700 border border-ash-700 text-ash-400">{a}</span>
                                ))}
                                {facility.amenities!.length > 4 && (
                                  <span className="px-1.5 py-0.5 text-[10px] text-ash-500">+{facility.amenities!.length - 4} more</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        {facility.address && (
                          <div className="rounded-pixel overflow-hidden border border-ash-700 h-40 w-full">
                            <iframe
                              title={`${facility.facilityName ?? "Facility"} location`}
                              src={`https://maps.google.com/maps?q=${encodeURIComponent(facility.address)}&output=embed`}
                              className="w-full h-full border-0"
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                            />
                          </div>
                        )}
                        {facility.notes && (
                          <p className="text-ash-500 text-xs leading-relaxed pt-2 border-t border-ash-800">{facility.notes}</p>
                        )}
                      </Panel>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Posts feed */}
            {(posts.length > 0 || isDirector) && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest flex items-center gap-2">
                    <Bell className="h-4 w-4 text-ember-400" /> Updates
                  </h2>
                  {isDirector && (
                    <Link href={`/clubs/manage/${realClubId}?section=posts`}>
                      <Button size="sm" variant="ghost" className="text-ember-400">Post Update</Button>
                    </Link>
                  )}
                </div>
                {posts.length === 0 ? (
                  <Panel variant="base" padding="md" className="text-center">
                    <p className="text-ash-500 text-sm">No posts yet.</p>
                  </Panel>
                ) : (
                  <div className="space-y-3">
                    {posts.map((post) => (
                      <Panel key={post.id} variant="base" padding="md" className="space-y-1.5">
                        <p className="text-ash-200 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
                        <p className="text-ash-600 text-[10px]">
                          {post.authorName} · {new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </Panel>
                    ))}
                  </div>
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
