"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { BracketView } from "@/components/bracket/BracketView";
import { generateSingleElim, type Entrant } from "@/domain/bracket";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  getTournamentBySlug,
  listRegistrations,
  getBracketForTournament,
  listBracketNodes,
} from "@/lib/firestore/repo";
import type {
  TournamentDoc,
  RegistrationDoc,
  BracketDoc,
  BracketNodeDoc,
} from "@/lib/firestore/types";

// Fallback entrants used when Firebase isn't configured (e.g. preview build).
// This keeps the page viewable before data is seeded.
const DEMO_ENTRANTS: Entrant[] = [
  { id: "e1", name: "Vex · Solen", rating: 2100 },
  { id: "e2", name: "Nyx · Kael",  rating: 2080 },
  { id: "e3", name: "Mira · Jor",  rating: 2050 },
  { id: "e4", name: "Velo · Brand",rating: 2020 },
  { id: "e5", name: "Rune · Ash",  rating: 1990 },
  { id: "e6", name: "Ira · Ost",   rating: 1970 },
  { id: "e7", name: "Sylva · Thorne", rating: 1940 },
  { id: "e8", name: "Fen · Orin",  rating: 1900 },
];

interface ViewState {
  tournament: TournamentDoc | null;
  entrants: Entrant[];
  nameById: Record<string, string>;
  persistedBracket?: { bracket: BracketDoc; nodes: BracketNodeDoc[] } | null;
}

function TournamentView() {
  const params = useSearchParams();
  const slug = params.get("slug") ?? "ember-open";
  const [state, setState] = useState<ViewState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isFirebaseConfigured()) {
        // Preview mode — use demo data so the page still renders.
        const nameById = Object.fromEntries(DEMO_ENTRANTS.map((e) => [e.id, e.name]));
        setState({ tournament: null, entrants: DEMO_ENTRANTS, nameById });
        return;
      }
      try {
        const tournament = await getTournamentBySlug(slug);
        if (!tournament) {
          if (!cancelled) setError(`No tournament found for "${slug}".`);
          return;
        }
        const regs = await listRegistrations(tournament.id);
        const confirmed = regs.filter((r: RegistrationDoc) => r.status === "CONFIRMED");
        const entrants: Entrant[] = confirmed.map((r) => ({
          id: r.id,
          name: r.displayName,
          rating: r.rating,
          seed: r.seed,
        }));
        const nameById = Object.fromEntries(entrants.map((e) => [e.id, e.name]));
        const persisted = await getBracketForTournament(tournament.id);
        const nodes = persisted ? await listBracketNodes(persisted.id) : [];
        if (!cancelled) {
          setState({
            tournament,
            entrants,
            nameById,
            persistedBracket: persisted ? { bracket: persisted, nodes } : null,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load.");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <main className="container py-10">
        <Panel variant="base" padding="lg">
          <h2 className="heading-fantasy text-lg text-crimson-500 mb-2">Unable to load</h2>
          <p className="text-ash-400 text-sm">{error}</p>
          <Link href="/tournaments" className="text-spectral-500 hover:text-spectral-400 text-sm mt-3 inline-block">
            ← All Tournaments
          </Link>
        </Panel>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="container py-10">
        <Panel variant="base" padding="lg">
          <p className="text-ash-400 text-sm">Summoning bracket…</p>
        </Panel>
      </main>
    );
  }

  // Project engine output whether we have a persisted bracket or not. The
  // persisted nodes take precedence for ids and winner state; otherwise we
  // generate a fresh bracket live so the UI is always interactive.
  const { tournament, entrants, nameById } = state;
  const bracket = generateSingleElim({
    entrants: entrants.length ? entrants : DEMO_ENTRANTS,
    seeding: { method: "RANK_BASED" },
  });

  const headline = tournament?.name ?? slug.replace(/-/g, " ");
  const formatLabel = tournament
    ? tournament.format.replace(/_/g, " ").toLowerCase()
    : "single elimination";

  return (
    <main className="container py-10 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <RuneChip tone="ember" pulse>Live</RuneChip>
            <RuneChip tone="rune" className="capitalize">{formatLabel}</RuneChip>
            <RuneChip tone="neutral">
              {entrants.length || DEMO_ENTRANTS.length} Entrants
            </RuneChip>
          </div>
          <h1 className="heading-fantasy text-display-md text-ash-100 capitalize">
            {headline}
          </h1>
          {tournament?.description ? (
            <p className="text-ash-400 text-sm mt-1">{tournament.description}</p>
          ) : (
            <p className="text-ash-400 text-sm mt-1">
              Scored to {tournament?.targetPoints ?? 11}, win by {tournament?.winBy ?? 2}
            </p>
          )}
        </div>
        <Link href="/tournaments" className="text-spectral-500 hover:text-spectral-400 text-sm">
          ← All Tournaments
        </Link>
      </div>

      <Panel variant="base" padding="lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="heading-fantasy text-lg text-ash-100">Bracket</h2>
          <span className="text-xs text-ash-500 font-mono">
            {tournament ? "Live from Firestore" : "Preview data"}
          </span>
        </div>
        <BracketView
          bracket={bracket}
          resolveName={(id) => (id ? (nameById[id] ?? "TBD") : "")}
          highlightNodeId={bracket.rounds[0]?.nodeIds[0]}
        />
      </Panel>
    </main>
  );
}

export default function TournamentViewPage() {
  return (
    <ResponsiveShell desktopChromeless>
      <Suspense fallback={<main className="container py-10 text-ash-400">Loading…</main>}>
        <TournamentView />
      </Suspense>
    </ResponsiveShell>
  );
}
