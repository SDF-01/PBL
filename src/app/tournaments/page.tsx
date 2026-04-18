"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { Button } from "@/components/ui/Button";
import { isFirebaseConfigured } from "@/lib/firebase";
import { listTournaments } from "@/lib/firestore/repo";
import type { TournamentDoc, TournamentStatus } from "@/lib/firestore/types";

const STATUS_TONE: Record<TournamentStatus, Parameters<typeof RuneChip>[0]["tone"]> = {
  DRAFT: "neutral",
  REGISTRATION_OPEN: "spectral",
  REGISTRATION_CLOSED: "neutral",
  SEEDED: "rune",
  IN_PROGRESS: "ember",
  COMPLETED: "gold",
  CANCELLED: "crimson",
};
const STATUS_LABEL: Record<TournamentStatus, string> = {
  DRAFT: "Draft",
  REGISTRATION_OPEN: "Registration Open",
  REGISTRATION_CLOSED: "Registration Closed",
  SEEDED: "Seeded",
  IN_PROGRESS: "Live",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<TournamentDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setTournaments([]);
      return;
    }
    listTournaments()
      .then(setTournaments)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load."));
  }, []);

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="heading-fantasy text-display-md text-ash-100">Tournaments</h1>
            <p className="text-ash-400 text-sm mt-1">
              Open registrations, live brackets, and resolved campaigns.
            </p>
          </div>
        </div>

        {error ? (
          <Panel variant="base" padding="lg">
            <h2 className="heading-fantasy text-lg text-crimson-500 mb-2">Unable to load</h2>
            <p className="text-ash-400 text-sm">{error}</p>
          </Panel>
        ) : tournaments === null ? (
          <Panel variant="base" padding="lg">
            <p className="text-ash-400 text-sm">Loading tournaments…</p>
          </Panel>
        ) : tournaments.length === 0 ? (
          <Panel variant="quest" padding="lg">
            <h2 className="heading-fantasy text-xl text-ash-100 mb-2">No tournaments yet</h2>
            <p className="text-ash-400 text-sm max-w-lg">
              This league hasn&apos;t hosted any tournaments yet. Once a
              director creates an event, it will appear here with registration,
              brackets, and standings.
            </p>
            <div className="mt-5">
              <Link href="/dashboard">
                <Button variant="outline" size="sm">Open Dashboard</Button>
              </Link>
            </div>
          </Panel>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {tournaments.map((t) => (
              <Panel key={t.id} variant="inventory" padding="lg" className="group">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <Link
                      href={`/tournaments/view?slug=${t.slug}`}
                      className="heading-fantasy text-xl text-ash-100 group-hover:text-ember-400 transition-colors"
                    >
                      {t.name}
                    </Link>
                    <div className="text-sm text-ash-400 mt-1 capitalize">
                      {t.format.replace(/_/g, " ").toLowerCase()}
                    </div>
                  </div>
                  <RuneChip tone={STATUS_TONE[t.status]} pulse={t.status === "IN_PROGRESS"}>
                    {STATUS_LABEL[t.status]}
                  </RuneChip>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  {t.startDate && (
                    <Meta icon={<CalendarDays className="h-3.5 w-3.5" />} label={String(t.startDate).slice(0, 10)} />
                  )}
                  {t.venueId && <Meta icon={<MapPin className="h-3.5 w-3.5" />} label={t.venueId} />}
                </div>

                <div className="ember-divider my-5" />

                <div className="flex justify-end items-center">
                  <Link href={`/tournaments/view?slug=${t.slug}`}>
                    <Button variant="ghost" size="sm">View →</Button>
                  </Link>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </main>
    </ResponsiveShell>
  );
}

function Meta({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-ash-300">
      <span className="text-ash-500">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
