"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { listLadderSeasons } from "@/lib/ladder/repo";
import {
  createLadderSeason,
  type NewLadderSeason,
} from "@/lib/ladder/write";
import type {
  LadderSeasonDoc,
  MovementPattern,
  CourtDistributionPlacement,
} from "@/lib/firestore/types";

export default function SeasonsPage() {
  const { user, ready, signIn } = useAuth();
  const [seasons, setSeasons] = useState<LadderSeasonDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setSeasons([]);
      return;
    }
    listLadderSeasons()
      .then(setSeasons)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load."),
      );
  }, []);

  async function refresh() {
    try {
      setSeasons(await listLadderSeasons());
    } catch {
      /* ignore */
    }
  }

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="heading-fantasy text-display-md text-ash-100">
              Seasons
            </h1>
            <p className="text-ash-400 text-sm mt-1">
              Long-running containers for many play dates.
            </p>
          </div>
          {ready && user && (
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-3.5 w-3.5" />
              {showForm ? "Close" : "New Season"}
            </Button>
          )}
        </div>

        {ready && !user && (
          <Panel variant="quest" padding="lg">
            <RuneChip tone="rune" className="mb-3">
              Sign-in required
            </RuneChip>
            <p className="text-ash-300 text-sm mb-3">
              Admins must sign in to create a season.
            </p>
            <Button size="sm" onClick={() => signIn().catch(() => {})}>
              Sign in with Google
            </Button>
          </Panel>
        )}

        {showForm && user && (
          <NewSeasonForm
            createdBy={user.uid}
            onCreated={() => {
              setShowForm(false);
              refresh();
            }}
          />
        )}

        {error && (
          <Panel variant="base" padding="md">
            <p className="text-crimson-500 text-sm">{error}</p>
          </Panel>
        )}

        {seasons === null ? (
          <Panel variant="base" padding="md">
            <p className="text-ash-400 text-sm">Loading seasons…</p>
          </Panel>
        ) : seasons.length === 0 ? (
          <Panel variant="base" padding="lg">
            <div className="flex items-center gap-3 text-ash-400">
              <CalendarDays className="h-5 w-5" />
              <span className="text-sm">
                No seasons yet. Create one to start scheduling play dates.
              </span>
            </div>
          </Panel>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {seasons.map((s) => (
              <li key={s.id}>
                <Link href={`/ladder/play-dates?season=${s.id}`}>
                  <Panel
                    variant="inventory"
                    padding="md"
                    className="h-full hover:border-ember-500/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h2 className="heading-fantasy text-lg text-ash-100 capitalize">
                        {s.name}
                      </h2>
                      <RuneChip tone="rune">
                        {s.movementPattern.replace(/_/g, " ").toLowerCase()}
                      </RuneChip>
                    </div>
                    <div className="text-xs text-ash-500 font-mono">
                      {s.startDate} → {s.endDate} · Score to {s.targetPoints}
                    </div>
                  </Panel>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </ResponsiveShell>
  );
}

function NewSeasonForm({
  createdBy,
  onCreated,
}: {
  createdBy: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [targetPoints, setTargetPoints] = useState(11);
  const [movementPattern, setMovementPattern] =
    useState<MovementPattern>("ONE_UP_ONE_DOWN");
  const [courtDistributionPlacement, setCourtDistributionPlacement] =
    useState<CourtDistributionPlacement>("MIDDLE");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) {
      setError("Name, start and end dates are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const input: NewLadderSeason = {
        name,
        startDate,
        endDate,
        targetPoints,
        movementPattern,
        courtDistributionPlacement,
        createdBy,
      };
      await createLadderSeason(input);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel variant="quest" padding="lg">
      <h2 className="heading-fantasy text-xl text-ash-100 mb-3">New Season</h2>
      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
        <label className="md:col-span-2 text-xs text-ash-400 space-y-1">
          <span>Name</span>
          <input
            className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Spring 2026"
            required
          />
        </label>
        <label className="text-xs text-ash-400 space-y-1">
          <span>Start date</span>
          <input
            type="date"
            className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </label>
        <label className="text-xs text-ash-400 space-y-1">
          <span>End date</span>
          <input
            type="date"
            className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </label>
        <label className="text-xs text-ash-400 space-y-1">
          <span>Score to</span>
          <input
            type="number"
            min={5}
            max={21}
            className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
            value={targetPoints}
            onChange={(e) => setTargetPoints(Number(e.target.value))}
          />
        </label>
        <label className="text-xs text-ash-400 space-y-1">
          <span>Movement pattern</span>
          <select
            className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
            value={movementPattern}
            onChange={(e) =>
              setMovementPattern(e.target.value as MovementPattern)
            }
          >
            <option value="ONE_UP_ONE_DOWN">One up / one down</option>
            <option value="TWO_UP_TWO_DOWN">Two up / two down</option>
          </select>
        </label>
        <label className="text-xs text-ash-400 space-y-1 md:col-span-2">
          <span>Larger-court placement</span>
          <select
            className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
            value={courtDistributionPlacement}
            onChange={(e) =>
              setCourtDistributionPlacement(
                e.target.value as CourtDistributionPlacement,
              )
            }
          >
            <option value="TOP_HEAVY">Top-heavy</option>
            <option value="MIDDLE">Middle</option>
            <option value="BOTTOM_HEAVY">Bottom-heavy</option>
          </select>
        </label>
        {error && (
          <p className="md:col-span-2 text-sm text-crimson-500">{error}</p>
        )}
        <div className="md:col-span-2 flex gap-2 pt-2">
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? "Creating…" : "Create Season"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
