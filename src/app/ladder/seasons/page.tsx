"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Copy, Plus } from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { listLadderSeasons } from "@/lib/ladder/repo";
import {
  createLadderSeason,
  copyLadderSeason,
  type NewLadderSeason,
} from "@/lib/ladder/write";
import type {
  LadderSeasonDoc,
  MovementPattern,
  CourtDistributionPlacement,
} from "@/lib/firestore/types";

export default function SeasonsPage() {
  const { user, ready, signIn } = useAuth();
  const { isSiteAdmin, clubDirectorFor, leagueCoordinatorFor, coordinatorClubIds } = usePermissions();
  const isStaff =
    isSiteAdmin ||
    clubDirectorFor.length > 0 ||
    leagueCoordinatorFor.length > 0 ||
    coordinatorClubIds.length > 0;
  const [seasons, setSeasons] = useState<LadderSeasonDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [copyTarget, setCopyTarget] = useState<LadderSeasonDoc | null>(null);

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
          {ready && user && isStaff && (
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
              Sign in to view and manage league seasons.
            </p>
            <Button size="sm" onClick={() => signIn().catch(() => {})}>
              Sign in with Google
            </Button>
          </Panel>
        )}

        {showForm && user && isStaff && (
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
          <>
            {copyTarget && user && isStaff && (
              <CopySeasonForm
                source={copyTarget}
                createdBy={user.uid}
                onCreated={() => { setCopyTarget(null); refresh(); }}
                onCancel={() => setCopyTarget(null)}
              />
            )}

            <ul className="grid gap-3 md:grid-cols-2">
              {seasons.map((s) => (
                <li key={s.id}>
                  <Panel
                    variant="inventory"
                    padding="md"
                    className="h-full"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Link href={`/ladder/play-dates?season=${s.id}`} className="flex-1 min-w-0">
                        <h2 className="heading-fantasy text-lg text-ash-100 capitalize hover:text-ember-300 transition-colors">
                          {s.name}
                        </h2>
                      </Link>
                      <div className="flex items-center gap-1.5">
                        <RuneChip tone="rune">
                          {s.movementPattern.replace(/_/g, " ").toLowerCase()}
                        </RuneChip>
                        {user && isStaff && (
                          <button
                            title="Copy season"
                            onClick={() => { setCopyTarget(s); setShowForm(false); }}
                            className="p-1 rounded text-ash-500 hover:text-ember-400 transition-colors"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-ash-500 font-mono">
                      {s.startDate} → {s.endDate} · Score to {s.targetPoints}
                    </div>
                  </Panel>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </ResponsiveShell>
  );
}

function CopySeasonForm({
  source,
  createdBy,
  onCreated,
  onCancel,
}: {
  source: LadderSeasonDoc;
  createdBy: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(`${source.name} (Copy)`);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) {
      setError("All fields required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await copyLadderSeason(source.id, name.trim(), startDate, endDate, createdBy);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Copy failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel variant="quest" padding="lg">
      <h2 className="heading-fantasy text-xl text-ash-100 mb-1">Copy Season</h2>
      <p className="text-ash-400 text-xs mb-4">
        Cloning <strong className="text-ash-200">{source.name}</strong> — settings and movement rules will be preserved.
      </p>
      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
        <label className="md:col-span-2 text-xs text-ash-400 space-y-1">
          <span>New season name</span>
          <input
            className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
        {error && <p className="md:col-span-2 text-sm text-crimson-500">{error}</p>}
        <div className="md:col-span-2 flex gap-2 pt-2">
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? "Copying…" : "Copy Season"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </Panel>
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
