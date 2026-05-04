"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDevice } from "@/lib/device";
import { useAdminMode } from "@/lib/admin-context";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { Button } from "@/components/ui/Button";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { PlayerHome } from "@/components/player/PlayerHome";
import { isFirebaseConfigured } from '@/lib/firebase'; 
import { listLadderSeasons, listPlayDates } from "@/lib/ladder/repo";
import {
  Plus,
  CalendarDays,
  Trophy,
  MapPin,
  Users,
  Swords,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getPlayerSessionData } from "@/lib/ladder/repo";
import { ScoreModal } from "@/components/player/ScoreModal";
import type { PlayerSessionData } from "@/lib/ladder/repo";
import { LadderSeasonDoc, PlayDateDoc } from '@/lib/firestore/types';
interface Stats {
  seasons: number;
  playDates: number;
  players: number;
  tournaments: number;
  liveTourneys: number;
}

export default function DashboardPage() {
  const { isAdminMode } = useAdminMode();
  const { isMobile } = useDevice();
  const { user } = useAuth();

  // For admin mode
  const [currentSeason, setCurrentSeason] = useState<LadderSeasonDoc>();
  const [upcomingPlayDates, setUpcomingPlayDates] = useState<PlayDateDoc[]>([]);
  const [selectedPlayDate, setSelectedPlayDate] = useState<PlayDateDoc>();

  // For player mode
  const [playerSessionData, setPlayerSessionData] = useState<PlayerSessionData | null>(null);
  const [scoreModal, setScoreModal] = useState<{
    match: any;
    action: "submit" | "verify";
  } | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    if (isAdminMode) {
      // Fetch admin data
      (async () => {
        const seasons = await listLadderSeasons().catch(() => []);
        const playDates = await listPlayDates().catch(() => []);
        setCurrentSeason(seasons[0]); // Placeholder: set first season
        setUpcomingPlayDates(playDates.filter(pd => pd.status === 'SCHEDULED'));
      })();
    } else if (user) {
      // Fetch player session data
      (async () => {
        // For now, get the most recent play date. In production, this should
        // be more sophisticated to find the active play date for the user
        const playDates = await listPlayDates().catch(() => []);
        const today = new Date().toISOString().split('T')[0] as string;
       // Make sure playDates is not empty
      if (playDates.length === 0) {
        console.warn('No play dates available');
      } else {
        // Find the active play date
        const activePlayDate = playDates.find(pd =>
          pd.date >= today && (pd.status === 'CHECK_IN_OPEN' || pd.status === 'IN_PROGRESS')
        ) ?? playDates[0]; // fallback to first play date date

        if (activePlayDate) {
          const data = await getPlayerSessionData(user.uid, activePlayDate.id);
          setPlayerSessionData(data);
        }
      }
})();
    }
  }, [isAdminMode, user]);

  if (isAdminMode) {
    return (
      <AdminDashboard
        currentSeason={currentSeason}
        upcomingPlayDates={upcomingPlayDates}
        selectedPlayDate={selectedPlayDate}
        onSelectPlayDate={setSelectedPlayDate}
        onCreateSeason={() => {}}
        onCreatePlayDate={() => {}}
        onReviewAttendance={() => {}}
        onGenerateSession={() => {}}
        onMonitorSession={() => {}}
        onFinalizeSession={() => {}}
      />
    );
  }

  // Player mode
  if (playerSessionData?.currentSession) {
    return (
      <>
        <PlayerHome
          currentSession={playerSessionData.currentSession}
          assignedCourt={playerSessionData.assignedCourt}
          currentMatch={playerSessionData.currentMatch}
          nextMatch={playerSessionData.nextMatch}
          sitOutMatch={playerSessionData.sitOutMatch}
          playerId={user?.uid || ""}
          onEnterScore={() => {
            if (playerSessionData.currentMatch) {
              setScoreModal({
                match: playerSessionData.currentMatch,
                action: "submit",
              });
            }
          }}
          onVerifyScore={() => {
            if (playerSessionData.currentMatch) {
              setScoreModal({
                match: playerSessionData.currentMatch,
                action: "verify",
              });
            }
          }}
          onViewStandings={() => {
            // TODO: Navigate to standings view
          }}
          onViewCourts={() => {
            // TODO: Navigate to courts view
          }}
        />
        {scoreModal && (
          <ScoreModal
            match={scoreModal.match}
            action={scoreModal.action}
            onClose={() => setScoreModal(null)}
            onSuccess={() => {
              setScoreModal(null);
              // Refresh player data
              if (user && playerSessionData?.currentSession) {
                const activePlayDateId = playerSessionData.currentSession!.playDateId;
                getPlayerSessionData(user.uid, activePlayDateId).then(setPlayerSessionData);
              }
            }}
          />
        )}
      </>
    );
  }

  // Fallback: generic dashboard for players not in active session
  return isMobile ? <DashboardMobile stats={{ seasons: 0, playDates: 0, players: 0, tournaments: 0, liveTourneys: 0 }} /> : <DashboardDesktop stats={{ seasons: 0, playDates: 0, players: 0, tournaments: 0, liveTourneys: 0 }} />;
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
