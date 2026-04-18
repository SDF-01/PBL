"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { BracketView } from "@/components/bracket/BracketView";
import { generateSingleElim, type Entrant, type Bracket } from "@/domain/bracket";
import { isFirebaseConfigured } from "@/lib/firebase";
import { getTournamentBySlug, listRegistrations } from "@/lib/firestore/repo";
import type { TournamentDoc, RegistrationDoc } from "@/lib/firestore/types";

interface ViewState {
  tournament: TournamentDoc;
  entrants: Entrant[];
  nameById: Record<string, string>;
  bracket: Bracket | null;
}

function TournamentView() {
  const params = useSearchParams();
  const slug = params.get("slug");
  const [state, setState] = useState<ViewState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!slug) { setError("No tournament selected."); setLoading(false); return; }
      if (!isFirebaseConfigured()) { setError("Firebase is not configured."); setLoading(false); return; }
      try {
        const tournament = await getTournamentBySlug(slug);
        if (!tournament) {
          if (!cancelled) { setError(`No tournament found for "${slug}".`); setLoading(false); }
          return;
        }
        const regs = await listRegistrations(tournament.id);
        const entrants: Entrant[] = regs
          .filter((r: RegistrationDoc) => r.status === "CONFIRMED")
          .map((r) => ({ id: r.id, name: r.displayName, rating: r.rating, seed: r.seed }));
        const nameById = Object.fromEntries(entrants.map((e) => [e.id, e.name]));
        const bracket = entrants.length >= 2
          ? generateSingleElim({ entrants, seeding: { method: "RANK_BASED" } })
          : null;
        if (!cancelled) { setState({ tournament, entrants, nameById, bracket }); setLoading(false); }
      } catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : "Failed to load."); setLoading(false); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <main className="container py-10">
        <Panel variant="base" padding="lg">
          <p className="text-ash-400 text-sm">Loading tournament…</p>
        </Panel>
      </main>
    );
  }

  if (error || !state) {
    return (
      <main className="container py-10">
        <Panel variant="base" padding="lg">
          <h2 className="heading-fantasy text-lg text-crimson-500 mb-2">Unable to load</h2>
          <p className="text-ash-400 text-sm">{error ?? "Unknown error."}</p>
          <Link href="/tournaments" className="text-spectral-500 hover:text-spectral-400 text-sm mt-3 inline-block">← All Tournaments</Link>
        </Panel>
      </main>
    );
  }

  const { tournament, entrants, nameById, bracket } = state;
  const formatLabel = tournament.format.replace(/_/g, " ").toLowerCase();

  return (
    <main className="container py-10 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <RuneChip tone="rune" className="capitalize">{formatLabel}</RuneChip>
            <RuneChip tone="neutral">{entrants.length} Entrants</RuneChip>
          </div>
          <h1 className="heading-fantasy text-display-md text-ash-100 capitalize">{tournament.name}</h1>
          {tournament.description ? (
            <p className="text-ash-400 text-sm mt-1">{tournament.description}</p>
          ) : (
            <p className="text-ash-400 text-sm mt-1">Scored to {tournament.targetPoints ?? 11}, win by {tournament.winBy ?? 2}</p>
          )}
        </div>
        <Link href="/tournaments" className="text-spectral-500 hover:text-spectral-400 text-sm">← All Tournaments</Link>
      </div>

      <Panel variant="base" padding="lg">
        <h2 className="heading-fantasy text-lg text-ash-100 mb-4">Bracket</h2>
        {bracket ? (
          <BracketView bracket={bracket} resolveName={(id) => (id ? (nameById[id] ?? "TBD") : "")} highlightNodeId={bracket.rounds[0]?.nodeIds[0]} />
        ) : (
          <p className="text-ash-400 text-sm">Bracket will appear once at least 2 entrants are confirmed.</p>
        )}
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
