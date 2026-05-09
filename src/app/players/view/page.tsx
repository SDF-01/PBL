"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Swords,
  Pencil,
  Trophy,
  Activity,
  UserPlus,
  UserCheck,
  Users,
  MessageSquare,
} from "lucide-react";
import { SkeletonCard, SkeletonList } from "@/components/ui/Skeleton";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { useAuth } from "@/lib/auth-context";
import {
  getPlayerProfile,
  listRecentEloEvents,
} from "@/lib/players/repo";
import {
  isFollowingPlayer,
  followPlayer,
  unfollowPlayer,
  getPlayerFollowerCount,
} from "@/lib/players/follows";
import { sendChallenge } from "@/lib/players/challenges";
import { getHeadToHeadRecord, type HeadToHeadRecord } from "@/lib/ladder/repo";
import { getUserRole } from "@/lib/firestore/userRepo";
import { skillBand } from "@/lib/players/elo";
import { getTopPartners, type PartnerStat } from "@/lib/players/partnerStats";
import type {
  PlayerProfileDoc,
  EloEventDoc,
  UserRole,
} from "@/lib/firestore/types";

export default function PlayerViewPage() {
  return (
    <Suspense
      fallback={
        <ResponsiveShell desktopChromeless>
          <main className="container py-10 text-ash-400">Loading…</main>
        </ResponsiveShell>
      }
    >
      <PlayerView />
    </Suspense>
  );
}

function PlayerView() {
  const params = useSearchParams();
  const uid = params.get("uid");
  const { user } = useAuth();
  const [profile, setProfile] = useState<PlayerProfileDoc | null>(null);
  const [events, setEvents] = useState<EloEventDoc[]>([]);
  const [role, setRole] = useState<UserRole | null>(null);
  const [h2h, setH2h] = useState<HeadToHeadRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [followPending, setFollowPending] = useState(false);
  const [challengeSent, setChallengeSent] = useState(false);
  const [challengePending, setChallengePending] = useState(false);
  const [partners, setPartners] = useState<PartnerStat[]>([]);

  useEffect(() => {
    if (!uid) {
      setError("Missing uid.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [p, ev, r] = await Promise.all([
          getPlayerProfile(uid),
          listRecentEloEvents(uid, 20).catch(() => []),
          getUserRole(uid).catch(() => null),
        ]);
        setProfile(p);
        setEvents(ev);
        setRole(r);
        getTopPartners(uid).then(setPartners).catch(() => {});
        if (user && user.uid !== uid) {
          getHeadToHeadRecord(user.uid, uid).then(setH2h).catch(() => {});
          isFollowingPlayer(user.uid, uid).then(setFollowing).catch(() => setFollowing(false));
          getPlayerFollowerCount(uid).then(setFollowerCount).catch(() => {});
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load.");
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  if (loading) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-6 md:py-10 space-y-4 max-w-3xl">
          <SkeletonCard className="h-32" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} className="h-20" />
            ))}
          </div>
          <SkeletonList count={3} />
        </main>
      </ResponsiveShell>
    );
  }
  if (error || !profile) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10">
          <Panel variant="base" padding="md">
            <h2 className="heading-fantasy text-lg text-crimson-500 mb-2">
              Profile not found
            </h2>
            <p className="text-ash-400 text-sm">
              {error ?? "This player has no profile yet."}
            </p>
            <Link
              href="/players"
              className="text-spectral-500 hover:text-spectral-400 text-sm mt-3 inline-block"
            >
              ← Leaderboard
            </Link>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  const band = skillBand(profile.elo);
  const isMe = user?.uid === profile.userId;

  async function handleChallenge() {
    if (!user || !uid || !profile || challengePending) return;
    setChallengePending(true);
    try {
      await sendChallenge({
        challengerId: user.uid,
        challengerName: user.displayName ?? "A player",
        challengeeId: uid,
        challengeeName: profile.displayName,
      });
      setChallengeSent(true);
    } catch (err) {
      console.error("Challenge failed:", err);
      alert("Could not send challenge. Please try again.");
    } finally {
      setChallengePending(false);
    }
  }

  async function handleFollowToggle() {
    if (!user || !uid || followPending) return;
    setFollowPending(true);
    try {
      if (following) {
        await unfollowPlayer(user.uid, uid);
        setFollowing(false);
        setFollowerCount((c) => (c !== null ? Math.max(0, c - 1) : null));
      } else {
        await followPlayer(user.uid, uid, user.displayName ?? undefined);
        setFollowing(true);
        setFollowerCount((c) => (c !== null ? c + 1 : null));
      }
    } finally {
      setFollowPending(false);
    }
  }

  const roleLabel: Record<UserRole, string> = {
    SITE_ADMIN: "Site Admin",
    CLUB_ADMIN: "Club Director",
    LEAGUE_COORDINATOR: "League Coordinator",
    PLAYER: "",
  };
  const roleTone: Record<UserRole, "ember" | "gold" | "spectral" | "neutral"> = {
    SITE_ADMIN: "ember",
    CLUB_ADMIN: "gold",
    LEAGUE_COORDINATOR: "spectral",
    PLAYER: "neutral",
  };
  const winRate =
    profile.stats.matches > 0
      ? Math.round((profile.stats.wins / profile.stats.matches) * 100)
      : 0;
  const avgPoints =
    profile.stats.matches > 0
      ? (profile.stats.pointsFor / profile.stats.matches).toFixed(1)
      : "—";

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-3xl">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link
            href="/players"
            className="text-ash-400 hover:text-ash-200 text-sm inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Leaderboard
          </Link>
          {isMe ? (
            <Link href="/players/edit">
              <Button size="sm" variant="outline">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            </Link>
          ) : user && (
            <div className="flex gap-2">
              {following !== null && (
                <Button
                  size="sm"
                  variant={following ? "outline" : "primary"}
                  onClick={handleFollowToggle}
                  disabled={followPending}
                  className={following ? "border-spectral-500 text-spectral-400 hover:border-crimson-500 hover:text-crimson-400" : ""}
                >
                  {following ? (
                    <><UserCheck className="h-3.5 w-3.5" /> Following</>
                  ) : (
                    <><UserPlus className="h-3.5 w-3.5" /> Follow</>
                  )}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleChallenge}
                disabled={challengePending || challengeSent}
              >
                <Swords className="h-3.5 w-3.5" />
                {challengeSent ? "Sent!" : "Challenge"}
              </Button>
            </div>
          )}
        </div>

        <Panel variant="quest" padding="lg" glow="rune">
          <div className="flex items-start gap-4 flex-wrap">
            {profile.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.photoURL}
                alt=""
                className="h-20 w-20 rounded-pixel object-cover border border-obsidian-400"
              />
            ) : (
              <div className="h-20 w-20 rounded-pixel bg-obsidian-700 border border-obsidian-400 flex items-center justify-center heading-fantasy text-2xl text-ash-400">
                {profile.displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <RuneChip tone="ember">{band}</RuneChip>
                {role && role !== "PLAYER" && (
                  <RuneChip tone={roleTone[role]}>{roleLabel[role]}</RuneChip>
                )}
                {profile.dominantHand && (
                  <RuneChip tone="neutral">
                    {profile.dominantHand === "AMBI"
                      ? "Ambidextrous"
                      : `${profile.dominantHand.toLowerCase()}-handed`}
                  </RuneChip>
                )}
                {followerCount !== null && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-ash-500 font-mono">
                    <Users className="h-3 w-3" />
                    {followerCount} follower{followerCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <h1 className="heading-fantasy text-display-md text-ash-100 mt-2">
                {profile.displayName}
              </h1>
              <div className="text-ash-500 text-xs font-mono mt-1 flex items-center gap-2 flex-wrap">
                {profile.city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {[profile.city, profile.region, profile.country]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                )}
                {profile.homeVenueName && (
                  <span>· Home: {profile.homeVenueName}</span>
                )}
              </div>
              {profile.bio && (
                <p className="text-ash-300 text-sm mt-3 leading-relaxed">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>
        </Panel>

        <div className="grid gap-3 md:grid-cols-4">
          <Stat
            icon={<Trophy className="h-4 w-4 text-gold-400" />}
            label="ELO"
            value={String(profile.elo)}
            sub={`Peak ${profile.eloPeak}`}
          />
          <Stat
            icon={<Swords className="h-4 w-4 text-ember-400" />}
            label="Record"
            value={`${profile.stats.wins}-${profile.stats.losses}`}
            sub={`${winRate}% win rate`}
          />
          <Stat
            icon={<Activity className="h-4 w-4 text-spectral-400" />}
            label="Matches"
            value={String(profile.stats.matches)}
            sub={`${avgPoints} PF/match`}
          />
          <Stat
            icon={<Trophy className="h-4 w-4 text-rune-glow" />}
            label="DUPR"
            value={
              typeof profile.duprRating === "number"
                ? profile.duprRating.toFixed(3)
                : "—"
            }
            sub={profile.duprId ? `id: ${profile.duprId}` : "not linked"}
          />
        </div>

        {h2h && h2h.matches > 0 && (
          <Panel variant="quest" padding="md">
            <div className="flex items-center gap-3">
              <Swords className="h-5 w-5 text-ember-400 shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-ash-500 mb-0.5">Head-to-Head vs You</p>
                <div className="flex items-center gap-3">
                  <span className="heading-fantasy text-2xl text-ember-400">{h2h.wins}</span>
                  <span className="text-ash-500 text-sm">–</span>
                  <span className="heading-fantasy text-2xl text-ash-400">{h2h.losses}</span>
                  <span className="text-ash-500 text-xs font-mono">
                    ({h2h.matches} game{h2h.matches === 1 ? "" : "s"})
                  </span>
                </div>
                <p className="text-ash-500 text-xs mt-0.5">
                  {profile.displayName.split(" ")[0]} leads {h2h.wins > h2h.losses ? "" : h2h.wins < h2h.losses ? "you lead " : "tied "}
                  {h2h.wins !== h2h.losses && Math.abs(h2h.wins - h2h.losses) > 0 && (
                    <span className={h2h.wins > h2h.losses ? "text-crimson-400" : "text-success-400"}>
                      {Math.abs(h2h.wins - h2h.losses)}-{Math.min(h2h.wins, h2h.losses)}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </Panel>
        )}

        {(profile.paddleBrand || profile.paddleModel || profile.yearsPlaying) && (
          <Panel variant="inventory" padding="md">
            <h2 className="heading-fantasy text-lg text-ash-100 mb-2">
              Equipment
            </h2>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {profile.paddleBrand && (
                <DescItem label="Paddle" value={profile.paddleBrand} />
              )}
              {profile.paddleModel && (
                <DescItem label="Model" value={profile.paddleModel} />
              )}
              {typeof profile.yearsPlaying === "number" && (
                <DescItem
                  label="Experience"
                  value={`${profile.yearsPlaying} yr${profile.yearsPlaying === 1 ? "" : "s"}`}
                />
              )}
            </dl>
          </Panel>
        )}

        {events.length > 0 && (
          <Panel variant="base" padding="md">
            <h2 className="heading-fantasy text-lg text-ash-100 mb-3">
              ELO Trend
            </h2>
            <EloTrendChart events={events} />
          </Panel>
        )}

        {partners.length > 0 && (
          <Panel variant="base" padding="md">
            <h2 className="heading-fantasy text-lg text-ash-100 mb-3">
              Top Doubles Partners
            </h2>
            <ul className="divide-y divide-obsidian-400">
              {partners.map((p, i) => (
                <li key={p.partnerId} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="heading-fantasy text-sm text-ash-500 w-4 shrink-0">{i + 1}</span>
                    <Link
                      href={`/players/view?uid=${p.partnerId}`}
                      className="text-spectral-400 hover:text-spectral-300 truncate"
                    >
                      {p.partnerName ?? p.partnerId.slice(0, 8)}
                    </Link>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-ash-400 font-mono text-xs">
                      {p.wins}W–{p.losses}L
                    </span>
                    <span className={`heading-fantasy text-xs ${p.winRate >= 0.5 ? "text-ember-400" : "text-ash-500"}`}>
                      {Math.round(p.winRate * 100)}%
                    </span>
                    <span className="text-ash-600 text-xs font-mono">
                      {p.gamesPlayed}g
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel variant="base" padding="md">
          <h2 className="heading-fantasy text-lg text-ash-100 mb-3">
            Recent ELO Changes
          </h2>
          {events.length === 0 ? (
            <p className="text-ash-500 text-sm">
              No rated matches yet. Play a match and have it verified to see
              ELO events here.
            </p>
          ) : (
            <ul className="divide-y divide-obsidian-400">
              {events.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-ash-200 truncate">
                      {e.source === "ladderMatch"
                        ? "Ladder match"
                        : e.source === "tournamentMatch"
                          ? "Tournament match"
                          : e.source}{" "}
                      {typeof e.pointsFor === "number" &&
                        typeof e.pointsAgainst === "number" && (
                          <span className="text-ash-500 font-mono">
                            · {e.pointsFor}–{e.pointsAgainst}
                          </span>
                        )}
                    </div>
                    <div className="text-[11px] text-ash-500 font-mono">
                      {e.eloBefore} → {e.eloAfter}
                    </div>
                  </div>
                  <span
                    className={`heading-fantasy text-sm ${e.delta >= 0 ? "text-ember-400" : "text-crimson-500"}`}
                  >
                    {e.delta >= 0 ? "+" : ""}
                    {e.delta}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </main>
    </ResponsiveShell>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Panel variant="inventory" padding="md">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-ash-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="heading-fantasy text-2xl text-ash-100 mt-1">{value}</div>
      {sub && <div className="text-[11px] text-ash-500 font-mono">{sub}</div>}
    </Panel>
  );
}

function DescItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.2em] text-ash-500">
        {label}
      </dt>
      <dd className="text-ash-100">{value}</dd>
    </div>
  );
}

function EloTrendChart({ events }: { events: EloEventDoc[] }) {
  const W = 600;
  const H = 120;
  const PAD = { top: 12, right: 16, bottom: 24, left: 44 };

  // Reverse to get chronological order; build series: eloBefore of first, then eloAfter of each
  const chrono = [...events].reverse();
  const values: number[] = [chrono[0]!.eloBefore, ...chrono.map((e) => e.eloAfter)];

  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  function xAt(i: number) {
    return PAD.left + (i / (values.length - 1)) * innerW;
  }
  function yAt(v: number) {
    return PAD.top + (1 - (v - minV) / range) * innerH;
  }

  const points = values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
  const areaPoints = `${PAD.left},${PAD.top + innerH} ${points} ${xAt(values.length - 1)},${PAD.top + innerH}`;

  const lastX = xAt(values.length - 1);
  const lastY = yAt(values[values.length - 1]!);
  const firstY = yAt(values[0]!);
  const isPositive = values[values.length - 1]! >= values[0]!;

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        aria-label="ELO trend chart"
      >
        {/* Horizontal guide lines */}
        {[0, 0.5, 1].map((t) => {
          const y = PAD.top + t * innerH;
          const v = Math.round(maxV - t * range);
          return (
            <g key={t}>
              <line
                x1={PAD.left}
                y1={y}
                x2={PAD.left + innerW}
                y2={y}
                stroke="#3a3a4a"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={PAD.left - 4}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#6b7280"
                fontFamily="monospace"
              >
                {v}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <polygon
          points={areaPoints}
          fill={isPositive ? "rgba(239,104,32,0.08)" : "rgba(220,38,38,0.08)"}
        />

        {/* Trend line */}
        <polyline
          points={points}
          fill="none"
          stroke={isPositive ? "#ef6820" : "#dc2626"}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Start dot */}
        <circle cx={PAD.left} cy={firstY} r="3" fill="#6b7280" />

        {/* End dot */}
        <circle cx={lastX} cy={lastY} r="4" fill={isPositive ? "#ef6820" : "#dc2626"} />

        {/* Current ELO label */}
        <text
          x={lastX + 5}
          y={Math.min(lastY + 4, PAD.top + innerH - 4)}
          fontSize="11"
          fill={isPositive ? "#ef6820" : "#dc2626"}
          fontFamily="monospace"
          fontWeight="bold"
        >
          {values[values.length - 1]}
        </text>

        {/* X-axis match count */}
        <text
          x={PAD.left + innerW / 2}
          y={H - 4}
          textAnchor="middle"
          fontSize="10"
          fill="#6b7280"
          fontFamily="monospace"
        >
          last {values.length - 1} matches
        </text>
      </svg>
    </div>
  );
}
