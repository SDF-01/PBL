"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Plus, MapPin } from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import {
  listLadderSeasons,
  listPlayDates,
  listVenues,
} from "@/lib/ladder/repo";
import { createPlayDate, createVenue } from "@/lib/ladder/write";
import type {
  LadderSeasonDoc,
  PlayDateDoc,
  PlayDateStatus,
  VenueDoc,
} from "@/lib/firestore/types";

const STATUS_TONE: Record<
  PlayDateStatus,
  Parameters<typeof RuneChip>[0]["tone"]
> = {
  SCHEDULED: "neutral",
  CHECK_IN_OPEN: "spectral",
  IN_PROGRESS: "ember",
  CLOSED: "gold",
};

export default function PlayDatesPage() {
  const { user, ready, signIn } = useAuth();
  const [playDates, setPlayDates] = useState<PlayDateDoc[] | null>(null);
  const [seasons, setSeasons] = useState<LadderSeasonDoc[]>([]);
  const [venues, setVenues] = useState<VenueDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState<"none" | "playDate" | "venue">("none");

  async function refresh() {
    if (!isFirebaseConfigured()) {
      setPlayDates([]);
      return;
    }
    try {
      const [pd, s, v] = await Promise.all([
        listPlayDates(),
        listLadderSeasons(),
        listVenues(),
      ]);
      setPlayDates(pd);
      setSeasons(s);
      setVenues(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const seasonName = (id: string) =>
    seasons.find((s) => s.id === id)?.name ?? id;
  const venueName = (id: string) =>
    venues.find((v) => v.id === id)?.name ?? id;

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="heading-fantasy text-display-md text-ash-100">
              Play Dates
            </h1>
            <p className="text-ash-400 text-sm mt-1">
              Real-world session days: attendance, generation, live play,
              finalization.
            </p>
          </div>
          {ready && user && (
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setShow((s) => (s === "venue" ? "none" : "venue"))
                }
              >
                <MapPin className="h-3.5 w-3.5" /> Add Venue
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  setShow((s) => (s === "playDate" ? "none" : "playDate"))
                }
                disabled={seasons.length === 0 || venues.length === 0}
              >
                <Plus className="h-3.5 w-3.5" /> New Play Date
              </Button>
            </div>
          )}
        </div>

        {ready && !user && (
          <Panel variant="quest" padding="lg">
            <RuneChip tone="rune" className="mb-3">
              Sign-in required
            </RuneChip>
            <p className="text-ash-300 text-sm mb-3">
              Admins must sign in to schedule play dates.
            </p>
            <Button size="sm" onClick={() => signIn().catch(() => {})}>
              Sign in with Google
            </Button>
          </Panel>
        )}

        {user &&
          seasons.length === 0 &&
          playDates !== null && (
            <Panel variant="base" padding="md">
              <p className="text-sm text-ash-300">
                No seasons yet.{" "}
                <Link
                  href="/ladder/seasons"
                  className="text-spectral-500 hover:text-spectral-400"
                >
                  Create a season first →
                </Link>
              </p>
            </Panel>
          )}

        {show === "venue" && user && (
          <NewVenueForm
            createdBy={user.uid}
            onCreated={() => {
              setShow("none");
              refresh();
            }}
          />
        )}

        {show === "playDate" && user && (
          <NewPlayDateForm
            createdBy={user.uid}
            seasons={seasons}
            venues={venues}
            onCreated={() => {
              setShow("none");
              refresh();
            }}
          />
        )}

        {error && (
          <Panel variant="base" padding="md">
            <p className="text-crimson-500 text-sm">{error}</p>
          </Panel>
        )}

        {playDates === null ? (
          <Panel variant="base" padding="md">
            <p className="text-ash-400 text-sm">Loading play dates…</p>
          </Panel>
        ) : playDates.length === 0 ? (
          <Panel variant="base" padding="lg">
            <div className="flex items-center gap-3 text-ash-400">
              <CalendarDays className="h-5 w-5" />
              <span className="text-sm">No play dates scheduled yet.</span>
            </div>
          </Panel>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {playDates.map((pd) => (
              <li key={pd.id}>
                <Panel variant="inventory" padding="md">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h2 className="heading-fantasy text-lg text-ash-100">
                      {pd.date}
                    </h2>
                    <RuneChip tone={STATUS_TONE[pd.status]}>
                      {pd.status.replace(/_/g, " ").toLowerCase()}
                    </RuneChip>
                  </div>
                  <div className="text-xs text-ash-500 font-mono mb-3">
                    {seasonName(pd.seasonId)} · {venueName(pd.venueId)}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/ladder/check-in?playDate=${pd.id}`}>
                      <Button size="sm" variant="outline">
                        Check-In
                      </Button>
                    </Link>
                  </div>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </main>
    </ResponsiveShell>
  );
}

function NewVenueForm({
  createdBy,
  onCreated,
}: {
  createdBy: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radiusMeters, setRadiusMeters] = useState(150);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const latN = Number(lat);
    const lngN = Number(lng);
    if (!name.trim() || !Number.isFinite(latN) || !Number.isFinite(lngN)) {
      setError("Name, lat, and lng are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createVenue({
        name,
        address: address.trim() || undefined,
        lat: latN,
        lng: lngN,
        radiusMeters,
        createdBy,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel variant="quest" padding="lg">
      <h2 className="heading-fantasy text-xl text-ash-100 mb-3">New Venue</h2>
      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
        <label className="md:col-span-2 text-xs text-ash-400 space-y-1">
          <span>Name</span>
          <input
            className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="md:col-span-2 text-xs text-ash-400 space-y-1">
          <span>Address (optional)</span>
          <input
            className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
        <label className="text-xs text-ash-400 space-y-1">
          <span>Latitude</span>
          <input
            className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm font-mono text-ash-100"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="e.g. 40.7128"
            required
          />
        </label>
        <label className="text-xs text-ash-400 space-y-1">
          <span>Longitude</span>
          <input
            className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm font-mono text-ash-100"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="e.g. -74.0060"
            required
          />
        </label>
        <label className="text-xs text-ash-400 space-y-1">
          <span>Geofence radius (meters)</span>
          <input
            type="number"
            min={10}
            max={5000}
            className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
            value={radiusMeters}
            onChange={(e) => setRadiusMeters(Number(e.target.value))}
          />
        </label>
        <div className="flex items-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={useMyLocation}
          >
            Use my location
          </Button>
        </div>
        {error && (
          <p className="md:col-span-2 text-sm text-crimson-500">{error}</p>
        )}
        <div className="md:col-span-2 flex gap-2 pt-2">
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? "Creating…" : "Create Venue"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function NewPlayDateForm({
  createdBy,
  seasons,
  venues,
  onCreated,
}: {
  createdBy: string;
  seasons: LadderSeasonDoc[];
  venues: VenueDoc[];
  onCreated: () => void;
}) {
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? "");
  const [venueId, setVenueId] = useState(venues[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!seasonId || !venueId || !date) {
      setError("Season, venue, and date are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createPlayDate({ seasonId, venueId, date, createdBy });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel variant="quest" padding="lg">
      <h2 className="heading-fantasy text-xl text-ash-100 mb-3">
        New Play Date
      </h2>
      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
        <label className="text-xs text-ash-400 space-y-1">
          <span>Season</span>
          <select
            className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
            value={seasonId}
            onChange={(e) => setSeasonId(e.target.value)}
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ash-400 space-y-1">
          <span>Venue</span>
          <select
            className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
            value={venueId}
            onChange={(e) => setVenueId(e.target.value)}
          >
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label className="md:col-span-2 text-xs text-ash-400 space-y-1">
          <span>Date</span>
          <input
            type="date"
            className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        {error && (
          <p className="md:col-span-2 text-sm text-crimson-500">{error}</p>
        )}
        <div className="md:col-span-2 flex gap-2 pt-2">
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? "Creating…" : "Create Play Date"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
