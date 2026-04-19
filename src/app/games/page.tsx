"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Swords,
  CalendarDays,
  MapPin,
  Trophy,
  Clock,
  Users,
} from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { Button } from "@/components/ui/Button";
import { isFirebaseConfigured } from "@/lib/firebase";
import { listTournaments } from "@/lib/firestore/repo";
import { listPlayDates, listVenues } from "@/lib/ladder/repo";
import { useAuth } from "@/lib/auth-context";
import { getPlayerProfile } from "@/lib/players/repo";
import type {
  TournamentDoc,
  TournamentStatus,
  PlayDateDoc,
  PlayDateStatus,
  VenueDoc,
  PlayerProfileDoc,
} from "@/lib/firestore/types";

const TOURNEY_TONE: Record<
  TournamentStatus,
  Parameters<typeof RuneChip>[0]["tone"]
> = {
  DRAFT: "neutral",
  REGISTRATION_OPEN: "spectral",
  REGISTRATION_CLOSED: "neutral",
  SEEDED: "rune",
  IN_PROGRESS: "ember",
  COMPLETED: "gold",
  CANCELLED: "crimson",
};

const PLAY_DATE_TONE: Record<
  PlayDateStatus,
  Parameters<typeof RuneChip>[0]["tone"]
> = {
  SCHEDULED: "neutral",
  CHECK_IN_OPEN: "spectral",
  IN_PROGRESS: "ember",
  CLOSED: "gold",
};

export default function GamesPage() {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<TournamentDoc[] | null>(null);
  const [playDates, setPlayDates] = useState<PlayDateDoc[] | null>(null);
  const [venues, setVenues] = useState<VenueDoc[]>([]);
  const [me, setMe] = useState<PlayerProfileDoc | null>(null);
  const [venueFilter, setVenueFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setTournaments([]);
      setPlayDates([]);
      return;
    }
    Promise.all([
      listTournaments().catch(() => [] as TournamentDoc[]),
      listPlayDates().catch(() => [] as PlayDateDoc[]),
      listVenues().catch(() => [] as VenueDoc[]),
    ])
      .then(([t, p, v]) => {
        setTournaments(t);
        setPlayDates(p);
        setVenues(v);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load."),
      );
  }, []);

  useEffect(() => {
    if (!user) return;
    getPlayerProfile(user.uid)
      .then((p) => {
        setMe(p);
        if (p?.homeVenueId) setVenueFilter(p.homeVenueId);
      })
      .catch(() => {});
  }, [user]);

  const venueById = useMemo(
    () => Object.fromEntries(venues.map((v) => [v.id, v])),
    [venues],
  );

  const liveTourneys = (tournaments ?? []).filter(
    (t) => t.status === "IN_PROGRESS" || t.status === "SEEDED",
  );
  const openTourneys = (tournaments ?? []).filter(
    (t) => t.status === "REGISTRATION_OPEN",
  );
  const today = new Date().toISOString().slice(0, 10);
  const activeDates = (playDates ?? [])
    .filter(
      (pd) =>
        pd.status === "CHECK_IN_OPEN" ||
        pd.status === "IN_PROGRESS" ||
        (pd.status === "SCHEDULED" && pd.date >= today),
    )
    .filter((pd) => !venueFilter || pd.venueId === venueFilter);

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6">
        <div>
          <h1 className="heading-fantasy text-display-md text-ash-100">
            Local Games
          </h1>
          <p className="text-ash-400 text-sm mt-1">
            Live tournament brackets and ladder play dates near you. Tap any
            card to view matches, scores, and standings.
          </p>
        </div>

        {venues.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-ash-500 uppercase tracking-[0.15em]">
              Venue:
            </span>
            <button
              type="button"
              onClick={() => setVenueFilter("")}
              className={`px-2.5 py-1 rounded-pixel border transition-colors ${
                !venueFilter
                  ? "border-ember-500 text-ember-400 bg-ember-500/10"
                  : "border-obsidian-400 text-ash-400 hover:text-ash-200"
              }`}
            >
              All
            </button>
            {venues.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVenueFilter(v.id)}
                className={`px-2.5 py-1 rounded-pixel border transition-colors ${
                  venueFilter === v.id
                    ? "border-ember-500 text-ember-400 bg-ember-500/10"
                    : "border-obsidian-400 text-ash-400 hover:text-ash-200"
                }`}
              >
                {v.name}
                {me?.homeVenueId === v.id && (
                  <span className="ml-1 text-[10px] text-gold-400">★</span>
                )}
              </button>
            ))}
          </div>
        )}

        {error && (
          <Panel variant="base" padding="md">
            <p className="text-crimson-500 text-sm">{error}</p>
          </Panel>
        )}

        {/* LADDER PLAY DATES */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Swords className="h-4 w-4 text-ember-500" />
            <h2 className="heading-fantasy text-lg text-ash-100">
              Ladder Play Dates
            </h2>
            <RuneChip tone="ember">{activeDates.length}</RuneChip>
          </div>
          {playDates === null ? (
            <Panel variant="base" padding="md">
              <p className="text-ash-500 text-sm">Loading…</p>
            </Panel>
          ) : activeDates.length === 0 ? (
            <Panel variant="base" padding="md">
              <p className="text-ash-500 text-sm">
                No upcoming play dates
                {venueFilter
                  ? ` at ${venueById[venueFilter]?.name ?? "this venue"}`
                  : ""}
                . Check back soon.
              </p>
              <div className="mt-3">
                <Link href="/ladder/play-dates">
                  <Button size="sm" variant="outline">
                    Browse All Play Dates
                  </Button>
                </Link>
              </div>
            </Panel>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {activeDates.map((pd) => {
                const v = venueById[pd.venueId];
                return (
                  <Panel
                    key={pd.id}
                    variant="inventory"
                    padding="md"
                    className="group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="heading-fantasy text-base text-ash-100 group-hover:text-ember-400 transition-colors truncate">
                          {v?.name ?? "Play Date"}
                        </div>
                        <div className="text-xs text-ash-400 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {pd.date}
                          </span>
                          {v?.address && (
                            <span className="inline-flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3" />
                              {v.address}
                            </span>
                          )}
                        </div>
                      </div>
                      <RuneChip
                        tone={PLAY_DATE_TONE[pd.status]}
                        pulse={pd.status === "IN_PROGRESS"}
                      >
                        {pd.status.replace("_", " ")}
                      </RuneChip>
                    </div>
                    <div className="flex gap-2 mt-4">
                      {pd.status === "IN_PROGRESS" && (
                        <Link href={`/ladder/session?playDate=${pd.id}`}>
                          <Button size="sm">
                            <Swords className="h-3.5 w-3.5" /> View Courts
                          </Button>
                        </Link>
                      )}
                      {pd.status === "CHECK_IN_OPEN" && (
                        <Link href={`/ladder/check-in?playDate=${pd.id}`}>
                          <Button size="sm">
                            <MapPin className="h-3.5 w-3.5" /> Check In
                          </Button>
                        </Link>
                      )}
                      {pd.status === "SCHEDULED" && (
                        <Link href={`/ladder/check-in?playDate=${pd.id}`}>
                          <Button size="sm" variant="outline">
                            <Clock className="h-3.5 w-3.5" /> Details
                          </Button>
                        </Link>
                      )}
                      <Link href={`/ladder/session?playDate=${pd.id}`}>
                        <Button size="sm" variant="ghost">
                          Session →
                        </Button>
                      </Link>
                    </div>
                  </Panel>
                );
              })}
            </div>
          )}
        </section>

        {/* TOURNAMENTS */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-gold-400" />
            <h2 className="heading-fantasy text-lg text-ash-100">
              Live Tournaments
            </h2>
            <RuneChip tone="ember">{liveTourneys.length}</RuneChip>
          </div>
          {tournaments === null ? (
            <Panel variant="base" padding="md">
              <p className="text-ash-500 text-sm">Loading…</p>
            </Panel>
          ) : liveTourneys.length === 0 ? (
            <Panel variant="base" padding="md">
              <p className="text-ash-500 text-sm">
                No tournaments are live right now.
              </p>
            </Panel>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {liveTourneys.map((t) => (
                <TournamentCard key={t.id} t={t} />
              ))}
            </div>
          )}

          {openTourneys.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-4">
                <Users className="h-4 w-4 text-spectral-500" />
                <h3 className="heading-fantasy text-base text-ash-100">
                  Registration Open
                </h3>
                <RuneChip tone="spectral">{openTourneys.length}</RuneChip>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {openTourneys.map((t) => (
                  <TournamentCard key={t.id} t={t} />
                ))}
              </div>
            </>
          )}

          <div className="pt-2">
            <Link href="/tournaments">
              <Button size="sm" variant="outline">
                <Trophy className="h-3.5 w-3.5" /> All Tournaments
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </ResponsiveShell>
  );
}

function TournamentCard({ t }: { t: TournamentDoc }) {
  return (
    <Panel variant="inventory" padding="md" className="group">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <Link
            href={`/tournaments/view?slug=${t.slug}`}
            className="heading-fantasy text-base text-ash-100 group-hover:text-ember-400 transition-colors truncate block"
          >
            {t.name}
          </Link>
          <div className="text-xs text-ash-400 capitalize">
            {t.format.replace(/_/g, " ").toLowerCase()}
          </div>
        </div>
        <RuneChip
          tone={TOURNEY_TONE[t.status]}
          pulse={t.status === "IN_PROGRESS"}
        >
          {t.status.replace(/_/g, " ")}
        </RuneChip>
      </div>
      <div className="flex items-center gap-3 text-xs text-ash-500">
        {t.startDate && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {String(t.startDate).slice(0, 10)}
          </span>
        )}
      </div>
      <div className="flex gap-2 mt-3">
        <Link href={`/tournaments/view?slug=${t.slug}`}>
          <Button size="sm">
            <Swords className="h-3.5 w-3.5" /> View Bracket
          </Button>
        </Link>
      </div>
    </Panel>
  );
}
