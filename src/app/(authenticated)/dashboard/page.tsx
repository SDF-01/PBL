"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDevice } from "@/lib/device";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { listTournaments } from "@/lib/firestore/repo";
import type { TournamentDoc } from "@/lib/firestore/types";

export default function DashboardHome() {
  const { isMobile } = useDevice();
  const [tournaments, setTournaments] = useState<TournamentDoc[] | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setTournaments([]);
      return;
    }
    listTournaments().then(setTournaments).catch(() => setTournaments([]));
  }, []);

  const stats = {
    tournaments: tournaments?.length ?? 0,
    live: tournaments?.filter((t) => t.status === "IN_PROGRESS").length ?? 0,
    open: tournaments?.filter((t) => t.status === "REGISTRATION_OPEN").length ?? 0,
    completed: tournaments?.filter((t) => t.status === "COMPLETED").length ?? 0,
  };

  return isMobile ? <DashboardMobile stats={stats} /> : <DashboardDesktop stats={stats} />;
}

type Stats = { tournaments: number; live: number; open: number; completed: number };

function DashboardDesktop({ stats }: { stats: Stats }) {
  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="heading-fantasy text-display-md text-ash-100">Dashboard</div>
          <p className="text-ash-400 text-sm mt-1">League operations overview</p>
        </div>
        <div className="flex gap-2">
          <Link href="/tournaments/new">
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> New Tournament</Button>
          </Link>
          <Link href="/tournaments"><Button variant="outline" size="sm">Tournaments</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Tournaments" value={String(stats.tournaments)} />
        <KpiCard label="Live"        value={String(stats.live)} />
        <KpiCard label="Registering" value={String(stats.open)} />
        <KpiCard label="Completed"   value={String(stats.completed)} />
      </div>

      <Panel variant="quest" padding="lg">
        <RuneChip tone="rune" className="mb-3">Get Started</RuneChip>
        <h2 className="heading-fantasy text-xl text-ash-100 mb-2">
          {stats.tournaments === 0 ? "No tournaments yet" : "Manage your league"}
        </h2>
        <p className="text-ash-400 text-sm max-w-xl">
          {stats.tournaments === 0
            ? "Create your first tournament to start seeding brackets, tracking matches, and ranking players."
            : "Use the tournaments page to view live brackets, registrations, and results."}
        </p>
        <div className="mt-5 flex gap-2">
          {stats.tournaments === 0 ? (
            <Link href="/tournaments/new">
              <Button size="sm"><Plus className="h-3.5 w-3.5" /> Create First Tournament</Button>
            </Link>
          ) : (
            <Link href="/tournaments">
              <Button variant="outline" size="sm">View Tournaments →</Button>
            </Link>
          )}
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
        <KpiCard label="Tournaments" value={String(stats.tournaments)} compact />
        <KpiCard label="Live"        value={String(stats.live)}        compact />
        <KpiCard label="Registering" value={String(stats.open)}        compact />
        <KpiCard label="Completed"   value={String(stats.completed)}   compact />
      </div>

      <Panel variant="quest" padding="md">
        <RuneChip tone="rune" className="mb-2">Get Started</RuneChip>
        <h2 className="heading-fantasy text-lg text-ash-100 mb-1">
          {stats.tournaments === 0 ? "No tournaments yet" : "Manage your league"}
        </h2>
        <p className="text-ash-400 text-xs">
          {stats.tournaments === 0
            ? "Create your first tournament to start."
            : "View brackets, registrations, and results."}
        </p>
        <div className="mt-3">
          {stats.tournaments === 0 ? (
            <Link href="/tournaments/new">
              <Button size="sm" className="w-full"><Plus className="h-3.5 w-3.5" /> Create First Tournament</Button>
            </Link>
          ) : (
            <Link href="/tournaments">
              <Button variant="outline" size="sm" className="w-full">View Tournaments</Button>
            </Link>
          )}
        </div>
      </Panel>
    </div>
  );
}

function KpiCard({
  label, value, compact = false,
}: {
  label: string; value: string; compact?: boolean;
}) {
  return (
    <Panel variant="raised" padding={compact ? "sm" : "md"} className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.2em] text-ash-500">{label}</span>
      <div className={`font-mono ${compact ? "text-xl" : "text-2xl"} text-ash-100 tabular-nums`}>
        {value}
      </div>
    </Panel>
  );
}
