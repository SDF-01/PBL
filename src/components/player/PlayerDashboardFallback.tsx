"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Building2,
  CalendarDays,
  MapPin,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Swords,
  CheckCircle,
  ArrowRight,
  Users,
  Search,
} from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { getPlayerProfile, listRecentEloEvents } from "@/lib/players/repo";
import { listPlayDates } from "@/lib/ladder/repo";
import { listPlayerRecentMatches } from "@/lib/ladder/repo";
import { listFollowedClubs } from "@/lib/clubs/repo";
import { listFeedPosts } from "@/lib/clubs/repo";
import {
  listFollowedPlayerIds,
  listFollowedActivity,
} from "@/lib/players/follows";
import { ChallengesPanel } from "@/components/player/ChallengesPanel";
import { skillBand } from "@/lib/players/elo";
import { listChallengeHistory, formatLabel } from "@/lib/players/challenges";
import { formatDistanceToNow, parseISO } from "date-fns";
import type { PlayerProfileDoc, PlayDateDoc, LadderMatchDoc, EloEventDoc, PlayerChallengeDoc } from "@/lib/firestore/types";
import type { ClubPost } from "@/lib/permissions/types";

interface Props {
  userId: string;
  leaderboardRank?: number;
  totalPlayers?: number;
}

export function PlayerDashboardFallback({ userId, leaderboardRank, totalPlayers }: Props) {
  const [profile, setProfile] = useState<PlayerProfileDoc | null>(null);
  const [upcomingDates, setUpcomingDates] = useState<PlayDateDoc[]>([]);
  const [recentMatches, setRecentMatches] = useState<LadderMatchDoc[]>([]);
  const [completedChallenges, setCompletedChallenges] = useState<PlayerChallengeDoc[]>([]);
  const [eloBySourceId, setEloBySourceId] = useState<Map<string, number>>(new Map());
  const [feedPosts, setFeedPosts] = useState<ClubPost[]>([]);
  const [playerActivity, setPlayerActivity] = useState<
    Array<(EloEventDoc & { followedId: string }) & { followedProfile: PlayerProfileDoc | null }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const today = new Date().toISOString().split("T")[0]!;
        const [p, pd, rm, ch, followedClubs, followedIds, eloEvts] = await Promise.all([
          getPlayerProfile(userId),
          listPlayDates().then((dates) =>
            dates
              .filter((d) => d.date >= today && d.status !== "CLOSED")
              .sort((a, b) => a.date.localeCompare(b.date))
              .slice(0, 3),
          ),
          listPlayerRecentMatches(userId, 5).catch(() => [] as LadderMatchDoc[]),
          listChallengeHistory(userId).catch(() => [] as PlayerChallengeDoc[]),
          listFollowedClubs(userId).catch(() => []),
          listFollowedPlayerIds(userId).catch(() => [] as string[]),
          listRecentEloEvents(userId, 30).catch(() => [] as EloEventDoc[]),
        ]);
        setProfile(p);
        setUpcomingDates(pd);
        setRecentMatches(rm);
        setCompletedChallenges(ch.filter((c) => c.status === "COMPLETED"));
        setEloBySourceId(new Map(eloEvts.filter(e => e.sourceId).map(e => [e.sourceId!, e.delta])));
        if (followedClubs.length > 0) {
          const posts = await listFeedPosts(followedClubs.map((c) => c.id)).catch(() => []);
          setFeedPosts(posts);
        }
        if (followedIds.length > 0) {
          const events = await listFollowedActivity(followedIds).catch(() => []);
          const profileMap = new Map<string, PlayerProfileDoc | null>();
          await Promise.all(
            followedIds.map(async (id) => {
              const prof = await getPlayerProfile(id).catch(() => null);
              profileMap.set(id, prof);
            }),
          );
          setPlayerActivity(
            events.map((e) => ({ ...e, followedProfile: profileMap.get(e.followedId) ?? null })),
          );
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Panel key={i} variant="base" padding="md">
            <div className="h-16 bg-obsidian-700 animate-shimmer rounded" />
          </Panel>
        ))}
      </div>
    );
  }

  const band = profile ? skillBand(profile.elo) : null;
  const winRate =
    profile && profile.stats.matches > 0
      ? Math.round((profile.stats.wins / profile.stats.matches) * 100)
      : null;

  return (
    <div className="space-y-5">
      {/* Welcome + standing */}
      <Panel variant="quest" padding="lg" glow="rune">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-ash-500 text-xs uppercase tracking-widest mb-1">Your standing</p>
            <div className="heading-fantasy text-display-md text-ash-100">
              {profile?.displayName ?? "Player"}
            </div>
            {band && (
              <div className="flex items-center gap-2 mt-1">
                <RuneChip tone={BAND_TONE[band]}>{band}</RuneChip>
                {leaderboardRank != null && totalPlayers != null && (
                  <span className="text-ash-400 text-sm">
                    #{leaderboardRank} of {totalPlayers}
                  </span>
                )}
              </div>
            )}
          </div>
          {profile && (
            <div className="text-right shrink-0">
              <div className="heading-fantasy text-3xl text-ember-400">{profile.elo}</div>
              <div className="text-ash-500 text-[11px] font-mono">ELO · Peak {profile.eloPeak}</div>
            </div>
          )}
        </div>

        {profile && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            <StatMini label="Matches" value={String(profile.stats.matches)} />
            <StatMini label="Record" value={`${profile.stats.wins}–${profile.stats.losses}`} />
            <StatMini label="Win %" value={winRate != null ? `${winRate}%` : "—"} />
          </div>
        )}
      </Panel>

      {/* Next session reminder */}
      {upcomingDates.length > 0 && upcomingDates[0] && (
        <Panel variant="hud" padding="md" className="flex items-center gap-4 flex-wrap">
          <div className="p-2 rounded-pixel bg-spectral-500/15 shrink-0">
            <CalendarDays className="h-5 w-5 text-spectral-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-ash-500 text-[10px] uppercase tracking-widest">Next Play Date</p>
            <p className="text-ash-100 text-sm font-medium">
              {upcomingDates[0].date} · <span className="text-ash-400">{formatDateLabel(upcomingDates[0].date)}</span>
            </p>
          </div>
          {upcomingDates[0].status === "CHECK_IN_OPEN" ? (
            <Link href="/ladder/check-in">
              <Button size="sm">
                <CheckCircle className="h-3.5 w-3.5" /> Check In
              </Button>
            </Link>
          ) : (
            <RuneChip tone="spectral" className="text-[9px]">{upcomingDates[0].status}</RuneChip>
          )}
        </Panel>
      )}

      {/* Quick actions */}
      <Panel variant="inventory" padding="md">
        <RuneChip tone="rune" className="mb-3">Quick Actions</RuneChip>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Link href="/ladder/check-in">
            <Button size="sm" className="w-full">
              <MapPin className="h-3.5 w-3.5" /> Check In
            </Button>
          </Link>
          <Link href="/players">
            <Button size="sm" variant="outline" className="w-full">
              <Trophy className="h-3.5 w-3.5" /> Standings
            </Button>
          </Link>
          <Link href="/ladder/play-dates">
            <Button size="sm" variant="outline" className="w-full">
              <CalendarDays className="h-3.5 w-3.5" /> Play Dates
            </Button>
          </Link>
          <Link href={`/players/view?uid=${userId}`}>
            <Button size="sm" variant="outline" className="w-full">
              <Swords className="h-3.5 w-3.5" /> My Profile
            </Button>
          </Link>
          <Link href="/leagues" className="col-span-2 lg:col-span-4">
            <Button size="sm" variant="ghost" className="w-full border border-obsidian-500 hover:border-spectral-500/50">
              <Search className="h-3.5 w-3.5" /> Find a League
            </Button>
          </Link>
        </div>
      </Panel>

      {/* Two-column dashboard grid at lg+: stays vertical stack on mobile.
          Each pair shares a row on desktop to recover vertical space. */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Upcoming play dates */}
        <Panel variant="base" padding="md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="heading-fantasy text-ash-100 text-base">Upcoming Play Dates</h2>
            <Link href="/ladder/play-dates">
              <Button size="sm" variant="ghost" className="gap-1">
                All <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          {upcomingDates.length === 0 ? (
            <p className="text-ash-500 text-sm">No upcoming play dates scheduled.</p>
          ) : (
            <ul className="divide-y divide-obsidian-600">
              {upcomingDates.map((pd) => (
                <PlayDateRow key={pd.id} pd={pd} />
              ))}
            </ul>
          )}
        </Panel>

        {/* Recent match results */}
        <Panel variant="base" padding="md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="heading-fantasy text-ash-100 text-base">Recent Matches</h2>
            <Link href={`/players/view?uid=${userId}`}>
              <Button size="sm" variant="ghost" className="gap-1">
                Profile <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          {recentMatches.length === 0 && completedChallenges.length === 0 ? (
            <p className="text-ash-500 text-sm">
              No verified matches yet. Play and verify scores to see results here.
            </p>
          ) : (
            <ul className="divide-y divide-obsidian-600">
              {recentMatches.map((m) => (
                <MatchRow key={m.id} match={m} playerId={userId} eloDelta={eloBySourceId.get(m.id)} />
              ))}
              {completedChallenges.map((c) => (
                <ChallengeMatchRow key={c.id} challenge={c} userId={userId} eloDelta={eloBySourceId.get(c.id)} />
              ))}
            </ul>
          )}
        </Panel>

        {/* Challenges inbox */}
        <ChallengesPanel userId={userId} displayName={profile?.displayName ?? "Player"} />

        {/* Player activity feed */}
        <Panel variant="base" padding="md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="heading-fantasy text-ash-100 text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-rune-400" /> Following Activity
            </h2>
            <Link href="/players">
              <button className="text-[11px] text-ash-500 hover:text-ash-300 transition-colors flex items-center gap-0.5">
                Find players <ArrowRight className="h-3 w-3" />
              </button>
            </Link>
          </div>
          {playerActivity.length === 0 ? (
            <p className="text-ash-500 text-sm">
              Follow players to see their match results here.
            </p>
          ) : (
            <ul className="divide-y divide-obsidian-700">
              {playerActivity.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Club feed */}
      {feedPosts.length > 0 && (
        <Panel variant="base" padding="md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="heading-fantasy text-ash-100 text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-ember-400" /> Club Updates
            </h2>
            <Link href="/clubs/my">
              <Button size="sm" variant="ghost" className="gap-1">
                My Clubs <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {feedPosts.map((post) => (
              <div key={post.id} className="space-y-1 py-2 border-b border-obsidian-700 last:border-0 last:pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-3 w-3 text-ember-400 shrink-0" />
                  <Link href={`/clubs/${post.clubId}`}>
                    <span className="text-ember-400 text-xs font-medium hover:text-ember-300 transition-colors">{post.clubName}</span>
                  </Link>
                </div>
                <p className="text-ash-200 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
                <p className="text-ash-600 text-[10px]">
                  {(() => {
                    const ca = post.createdAt as unknown;
                    const d = ca && typeof ca === "object" && "toDate" in ca
                      ? (ca as { toDate(): Date }).toDate()
                      : new Date(post.createdAt);
                    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                  })()}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function ActivityRow({
  item,
}: {
  item: (EloEventDoc & { followedId: string }) & { followedProfile: PlayerProfileDoc | null };
}) {
  const name = item.followedProfile?.displayName ?? item.playerId.slice(0, 8);
  const initial = name.slice(0, 1).toUpperCase();
  const won = item.won;
  const deltaStr = item.delta >= 0 ? `+${item.delta}` : String(item.delta);
  const sourceLabel = item.source === "ladderMatch" ? "Ladder" : "Tournament";
  const scoreStr =
    typeof item.pointsFor === "number" && typeof item.pointsAgainst === "number"
      ? ` · ${item.pointsFor}–${item.pointsAgainst}`
      : "";

  const ageMs = (() => {
    const ca = item.createdAt as unknown;
    if (ca && typeof ca === "object" && "toDate" in ca)
      return (ca as { toDate(): Date }).toDate().getTime();
    if (typeof ca === "string") return new Date(ca).getTime();
    return 0;
  })();
  const ago = ageMs > 0
    ? formatDistanceToNow(new Date(ageMs), { addSuffix: true })
    : "";

  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <Link href={`/players/view?uid=${item.followedId}`} className="shrink-0">
        {item.followedProfile?.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.followedProfile.photoURL}
            alt=""
            className="h-7 w-7 rounded-pixel object-cover border border-obsidian-500"
          />
        ) : (
          <div className="h-7 w-7 rounded-pixel bg-obsidian-700 border border-obsidian-500 flex items-center justify-center text-xs text-ash-500">
            {initial}
          </div>
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link
            href={`/players/view?uid=${item.followedId}`}
            className="text-sm text-ash-200 hover:text-ash-100 font-medium transition-colors"
          >
            {name}
          </Link>
          <span className="text-ash-500 text-xs">
            {won ? "won" : "lost"} a {sourceLabel} match{scoreStr}
          </span>
        </div>
        <p className="text-ash-600 text-[10px] mt-0.5">{ago}</p>
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        {won ? (
          <TrendingUp className="h-3.5 w-3.5 text-spectral-400" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 text-crimson-500" />
        )}
        <span
          className={`heading-fantasy text-sm ${
            item.delta >= 0 ? "text-spectral-400" : "text-crimson-500"
          }`}
        >
          {deltaStr}
        </span>
      </div>
    </li>
  );
}

function PlayDateRow({ pd }: { pd: PlayDateDoc }) {
  const dateLabel = formatDateLabel(pd.date);
  const statusTone =
    pd.status === "CHECK_IN_OPEN"
      ? "spectral"
      : pd.status === "IN_PROGRESS"
      ? "ember"
      : "neutral";

  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="p-1.5 rounded bg-obsidian-700 shrink-0">
        <CalendarDays className="h-4 w-4 text-spectral-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-ash-200 text-sm">{pd.date}</p>
        <p className="text-ash-500 text-[11px]">{dateLabel}</p>
      </div>
      <RuneChip tone={statusTone} className="text-[9px] shrink-0">
        {pd.status === "CHECK_IN_OPEN" ? "Check-in Open" : pd.status}
      </RuneChip>
      {pd.status === "CHECK_IN_OPEN" && (
        <Link href="/ladder/check-in">
          <Button size="sm" className="shrink-0">
            <CheckCircle className="h-3 w-3" /> Check In
          </Button>
        </Link>
      )}
    </li>
  );
}

function MatchRow({ match, playerId, eloDelta }: { match: LadderMatchDoc; playerId: string; eloDelta?: number }) {
  const onSideA = match.sideA.includes(playerId);
  const myScore = onSideA ? match.scoreA : match.scoreB;
  const oppScore = onSideA ? match.scoreB : match.scoreA;
  const won = (myScore ?? 0) > (oppScore ?? 0);
  const isDraw = myScore === oppScore;

  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="shrink-0">
        {isDraw ? (
          <Minus className="h-4 w-4 text-ash-500" />
        ) : won ? (
          <TrendingUp className="h-4 w-4 text-spectral-400" />
        ) : (
          <TrendingDown className="h-4 w-4 text-crimson-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-ash-200 text-sm">Game {match.gameNumber}</p>
        <p className="text-ash-500 text-[11px]">
          {onSideA
            ? `With: ${match.sideA.filter((id) => id !== playerId).join(", ").slice(0, 20)}`
            : `With: ${match.sideB.filter((id) => id !== playerId).join(", ").slice(0, 20)}`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`heading-fantasy text-lg ${won ? "text-spectral-400" : isDraw ? "text-ash-400" : "text-crimson-500"}`}
        >
          {myScore ?? "?"} – {oppScore ?? "?"}
        </span>
        <RuneChip tone={won ? "spectral" : isDraw ? "neutral" : "crimson"} className="text-[9px]">
          {won ? "W" : isDraw ? "D" : "L"}
        </RuneChip>
        {eloDelta != null && (
          <span className={`text-[10px] font-mono font-bold ${eloDelta >= 0 ? "text-spectral-400" : "text-crimson-500"}`}>
            {eloDelta >= 0 ? `+${eloDelta}` : eloDelta}
          </span>
        )}
      </div>
    </li>
  );
}

function ChallengeMatchRow({ challenge: c, userId, eloDelta }: { challenge: PlayerChallengeDoc; userId: string; eloDelta?: number }) {
  const isChallenger = c.challengerId === userId;
  const opponentName = isChallenger ? c.challengeeName : c.challengerName;
  const opponentId   = isChallenger ? c.challengeeId  : c.challengerId;
  const myScore      = isChallenger ? c.scoreA : c.scoreB;
  const oppScore     = isChallenger ? c.scoreB : c.scoreA;
  const won          = (myScore ?? 0) > (oppScore ?? 0);
  const isBo3        = c.conditions?.format === "best-of-3";
  const unit         = isBo3 ? "games" : "pts";
  const fmtLabel     = c.conditions ? formatLabel(c.conditions.format) : "Challenge";

  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="shrink-0">
        {won
          ? <TrendingUp className="h-4 w-4 text-spectral-400" />
          : <TrendingDown className="h-4 w-4 text-crimson-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Swords className="h-3 w-3 text-ember-400 shrink-0" />
          <Link href={`/players/view?uid=${opponentId}`} className="text-ash-200 text-sm hover:text-ash-100 transition-colors">
            {opponentName}
          </Link>
        </div>
        <p className="text-ash-500 text-[11px]">
          {fmtLabel} ·{" "}
          <Link href={`/challenges/${c.id}`} className="text-ash-500 hover:text-ash-300 underline-offset-2 hover:underline">
            view match
          </Link>
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`heading-fantasy text-lg ${won ? "text-spectral-400" : "text-crimson-500"}`}>
          {myScore ?? "?"} – {oppScore ?? "?"}
        </span>
        <span className="text-ash-600 text-[10px]">{unit}</span>
        <RuneChip tone={won ? "spectral" : "crimson"} className="text-[9px]">
          {won ? "W" : "L"}
        </RuneChip>
        {eloDelta != null && (
          <span className={`text-[10px] font-mono font-bold ${eloDelta >= 0 ? "text-spectral-400" : "text-crimson-500"}`}>
            {eloDelta >= 0 ? `+${eloDelta}` : eloDelta}
          </span>
        )}
      </div>
    </li>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-obsidian-800/50 rounded-pixel px-3 py-2 text-center">
      <div className="heading-fantasy text-ash-100 text-lg">{value}</div>
      <div className="text-ash-500 text-[10px] uppercase tracking-wider">{label}</div>
    </div>
  );
}

function formatDateLabel(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

const BAND_TONE = {
  NOVICE: "neutral",
  BEGINNER: "spectral",
  INTERMEDIATE: "rune",
  ADVANCED: "ember",
  EXPERT: "gold",
  ELITE: "crimson",
} as const;
