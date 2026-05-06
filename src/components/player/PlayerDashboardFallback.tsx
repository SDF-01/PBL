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
  Clock,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { getPlayerProfile } from "@/lib/players/repo";
import { listPlayDates } from "@/lib/ladder/repo";
import { listPlayerRecentMatches } from "@/lib/ladder/repo";
import { listFollowedClubs } from "@/lib/clubs/repo";
import { listFeedPosts } from "@/lib/clubs/repo";
import { skillBand } from "@/lib/players/elo";
import { formatDistanceToNow, parseISO } from "date-fns";
import type { PlayerProfileDoc, PlayDateDoc, LadderMatchDoc } from "@/lib/firestore/types";
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
  const [feedPosts, setFeedPosts] = useState<ClubPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const today = new Date().toISOString().split("T")[0]!;
        const [p, pd, rm, followedClubs] = await Promise.all([
          getPlayerProfile(userId),
          listPlayDates().then((dates) =>
            dates
              .filter((d) => d.date >= today && d.status !== "CLOSED")
              .sort((a, b) => a.date.localeCompare(b.date))
              .slice(0, 3),
          ),
          listPlayerRecentMatches(userId, 5).catch(() => [] as LadderMatchDoc[]),
          listFollowedClubs(userId).catch(() => []),
        ]);
        setProfile(p);
        setUpcomingDates(pd);
        setRecentMatches(rm);
        if (followedClubs.length > 0) {
          const posts = await listFeedPosts(followedClubs.map((c) => c.id)).catch(() => []);
          setFeedPosts(posts);
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
            <div className="h-16 bg-obsidian-700 animate-pulse rounded" />
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

      {/* Quick actions */}
      <Panel variant="inventory" padding="md">
        <RuneChip tone="rune" className="mb-3">Quick Actions</RuneChip>
        <div className="grid grid-cols-2 gap-2">
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
        </div>
      </Panel>

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
        {recentMatches.length === 0 ? (
          <p className="text-ash-500 text-sm">
            No verified matches yet. Play and verify scores to see results here.
          </p>
        ) : (
          <ul className="divide-y divide-obsidian-600">
            {recentMatches.map((m) => (
              <MatchRow key={m.id} match={m} playerId={userId} />
            ))}
          </ul>
        )}
      </Panel>

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
                  {new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
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

function MatchRow({ match, playerId }: { match: LadderMatchDoc; playerId: string }) {
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
