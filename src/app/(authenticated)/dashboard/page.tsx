"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDevice } from "@/lib/device";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { Button } from "@/components/ui/Button";
import {
  Plus,
  CalendarDays,
  Trophy,
  MapPin,
  Users,
  Swords,
} from "lucide-react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { listTournaments } from "@/lib/firestore/repo";
import { listLadderSeasons, listPlayDates } from "@/lib/ladder/repo";
import { listLeaderboard } from "@/lib/players/repo";
import type { TournamentDoc } from "@/lib/firestore/types";

interface Stats {
  seasons: number;
  playDates: number;
  players: number;
  tournaments: number;
  liveTourneys: number;
}

export default function DashboardHome() {
  const { isMobile } = useDevice();
  const [stats, setStats] = useState<Stats>({
    seasons: 0,
    playDates: 0,
    players: 0,
    tournaments: 0,
    liveTourneys: 0,
  });

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    (async () => {
      const [seasons, playDates, leaderboard, tournaments] = await Promise.all([
        listLadderSeasons().catch(() => []),
        listPlayDates().catch(() => []),
        listLeaderboard(1000).catch(() => []),
        listTournaments().catch(() => [] as TournamentDoc[]),
      ]);
      setStats({
        seasons: seasons.length,
        playDates: playDates.length,
        players: leaderboard.length,
        tournaments: tournaments.length,
        liveTourneys: tournaments.filter((t) => t.status === "IN_PROGRESS").length,
      });
    })();
  }, []);

  return isMobile ? <DashboardMobile stats={stats} /> : <DashboardDesktop stats={stats} />;
}

function DashboardDesktop({ stats }: { stats: Stats }) {
  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="heading-fantasy text-display-md text-ash-100">Dashboard</div>
          <p className="text-ash-400 text-sm mt-1">League operations overview</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/ladder/seasons">
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> New Season</Button>
          </Link>
          <Link href="/ladder/play-dates"><Button variant="outline" size="sm">Play Dates</Button></Link>
          <Link href="/players"><Button variant="outline" size="sm"><Trophy className="h-3.5 w-3.5" /> Leaderboard</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Seasons" value={String(stats.seasons)} />
        <KpiCard label="Play Dates" value={String(stats.playDates)} />
        <KpiCard label="Players" value={String(stats.players)} />
        <KpiCard label="Live Tournaments" value={String(stats.liveTourneys)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <QuickPanel
          title="Run a play date"
          body="Open a new play date, let players check in, then generate Session A."
          actions={[
            { href: "/ladder/play-dates", label: "Play Dates", icon: CalendarDays },
            { href: "/ladder/check-in", label: "Check-In", icon: MapPin },
          ]}
        />
        <QuickPanel
          title="Grow the community"
          body="Track every player, their ELO, and their home venue. Fill out your profile to appear on the leaderboard."
          actions={[
            { href: "/players", label: "Leaderboard", icon: Trophy },
            { href: "/players/edit", label: "My Profile", icon: Users },
          ]}
        />
      </div>

      <Panel variant="base" padding="md">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <RuneChip tone="neutral" className="mb-2">Legacy</RuneChip>
            <h2 className="heading-fantasy text-lg text-ash-100">Tournaments</h2>
            <p className="text-ash-400 text-xs mt-1">
              {stats.tournaments === 0
                ? "No tournaments yet. Create one to use the bracket engine."
                : `${stats.tournaments} total · ${stats.liveTourneys} live.`}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/tournaments/new"><Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" /> New</Button></Link>
            <Link href="/tournaments"><Button size="sm" variant="outline"><Swords className="h-3.5 w-3.5" /> Browse</Button></Link>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function DashboardMobile({ stats }: { stats: Stats }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="heading-fantasy text-2xl text-ash-100 leading-tight">Dashboard</div>
        <p className="text-ash-400 text-xs mt-1">League overview</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <KpiCard label="Seasons" value={String(stats.seasons)} compact />
        <KpiCard label="Play Dates" value={String(stats.playDates)} compact />
        <KpiCard label="Players" value={String(stats.players)} compact />
        <KpiCard label="Live Tourneys" value={String(stats.liveTourneys)} compact />
      </div>

      <Panel variant="quest" padding="md">
        <RuneChip tone="rune" className="mb-2">Quick Actions</RuneChip>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/ladder/check-in"><Button size="sm" className="w-full"><MapPin className="h-3.5 w-3.5" /> Check-In</Button></Link>
          <Link href="/ladder/play-dates"><Button size="sm" variant="outline" className="w-full"><CalendarDays className="h-3.5 w-3.5" /> Dates</Button></Link>
          <Link href="/players"><Button size="sm" variant="outline" className="w-full"><Trophy className="h-3.5 w-3.5" /> Ranks</Button></Link>
          <Link href="/ladder/seasons"><Button size="sm" variant="outline" className="w-full">Seasons</Button></Link>
        </div>
      </Panel>

      <Panel variant="base" padding="md">
        <h2 className="heading-fantasy text-base text-ash-100 mb-1">Tournaments</h2>
        <p className="text-ash-500 text-xs mb-3">
          {stats.tournaments === 0 ? "None yet." : `${stats.tournaments} total · ${stats.liveTourneys} live`}
        </p>
        <Link href="/tournaments"><Button size="sm" variant="outline" className="w-full">Browse Tournaments</Button></Link>
      </Panel>
    </div>
  );
}

function QuickPanel({
  title, body, actions,
}: {
  title: string;
  body: string;
  actions: Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string }> }>;
}) {
  return (
    <Panel variant="quest" padding="lg">
      <h2 className="heading-fantasy text-lg text-ash-100 mb-1">{title}</h2>
      <p className="text-ash-400 text-sm mb-4">{body}</p>
      <div className="flex gap-2 flex-wrap">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.href} href={a.href}>
              <Button size="sm" variant="outline"><Icon className="h-3.5 w-3.5" />{a.label}</Button>
            </Link>
          );
        })}
      </div>
    </Panel>
  );
}

function KpiCard({
  label, value, compact = false,
}: { label: string; value: string; compact?: boolean }) {
  return (
    <Panel variant="raised" padding={compact ? "sm" : "md"} className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.2em] text-ash-500">{label}</span>
      <div className={`font-mono ${compact ? "text-xl" : "text-2xl"} text-ash-100 tabular-nums`}>{value}</div>
    </Panel>
  );
}
