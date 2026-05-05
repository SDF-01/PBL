"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  MapPin,
  Search,
  X,
  ChevronRight,
  Layers,
  Users,
  Loader2,
} from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { listApprovedClubs, listClubLeagues } from "@/lib/clubs/repo";
import type { ClubDoc } from "@/lib/permissions/types";
import type { LeagueDoc } from "@/lib/firestore/types";

type ClubWithMeta = ClubDoc & { leagueCount: number };

export default function ClubsPage() {
  const [clubs, setClubs] = useState<ClubWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  useEffect(() => {
    listApprovedClubs()
      .then(async (raw) => {
        // Fetch league counts in parallel
        const withCounts = await Promise.all(
          raw.map(async (club) => {
            try {
              const leagues = await listClubLeagues(club.id);
              return { ...club, leagueCount: leagues.length };
            } catch {
              return { ...club, leagueCount: 0 };
            }
          }),
        );
        setClubs(withCounts);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Unique location tokens for filter chips (city or state from location string)
  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of clubs) {
      const parts = c.location.split(",").map((s) => s.trim());
      for (const p of parts) {
        if (p) set.add(p);
      }
    }
    return [...set].sort();
  }, [clubs]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return clubs.filter((c) => {
      const matchesQuery =
        !q ||
        c.clubName.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        (c.description?.toLowerCase().includes(q) ?? false);
      const matchesLocation =
        !locationFilter || c.location.toLowerCase().includes(locationFilter.toLowerCase());
      return matchesQuery && matchesLocation;
    });
  }, [clubs, query, locationFilter]);

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-8 max-w-5xl">

        {/* ── Header ── */}
        <div className="space-y-1">
          <RuneChip tone="rune" className="mb-2">Browse</RuneChip>
          <h1 className="heading-fantasy text-display-md text-ash-100">Find a Club</h1>
          <p className="text-ash-400 text-sm mt-1 max-w-lg">
            Discover pickleball clubs near you. Each club hosts leagues you can join and play in.
          </p>
        </div>

        {/* ── Search bar ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ash-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search clubs by name or location…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 rounded-pixel bg-obsidian-800 border border-ash-700 text-ash-100 placeholder:text-ash-600 text-sm focus:outline-none focus:border-ember-500 transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ash-500 hover:text-ash-200 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-ash-500">
            {loading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </span>
            ) : (
              <span>
                {filtered.length} club{filtered.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* ── Location filter chips ── */}
        {!loading && locationOptions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLocationFilter("")}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                !locationFilter
                  ? "bg-ember-500/20 border-ember-500/60 text-ember-300"
                  : "bg-obsidian-800 border-ash-700 text-ash-400 hover:border-ash-500 hover:text-ash-200"
              }`}
            >
              All
            </button>
            {locationOptions.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setLocationFilter(locationFilter === loc ? "" : loc)}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  locationFilter === loc
                    ? "bg-ember-500/20 border-ember-500/60 text-ember-300"
                    : "bg-obsidian-800 border-ash-700 text-ash-400 hover:border-ash-500 hover:text-ash-200"
                }`}
              >
                {loc}
              </button>
            ))}
          </div>
        )}

        {/* ── Club grid ── */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Panel key={i} variant="base" padding="lg" className="animate-pulse space-y-3">
                <div className="h-4 bg-obsidian-600 rounded w-2/3" />
                <div className="h-3 bg-obsidian-600 rounded w-1/2" />
                <div className="h-3 bg-obsidian-600 rounded w-full" />
                <div className="h-3 bg-obsidian-600 rounded w-3/4" />
              </Panel>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Panel variant="base" padding="lg" className="text-center space-y-3 py-16">
            <Building2 className="h-10 w-10 text-ash-700 mx-auto" />
            <p className="text-ash-400">
              {query || locationFilter
                ? "No clubs match your search. Try different terms."
                : "No clubs have been approved yet."}
            </p>
            {(query || locationFilter) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setQuery(""); setLocationFilter(""); }}
              >
                Clear filters
              </Button>
            )}
          </Panel>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((club) => (
              <ClubCard key={club.id} club={club} />
            ))}
          </div>
        )}

        {/* ── CTA for directors ── */}
        {!loading && (
          <Panel variant="quest" padding="lg" className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="heading-fantasy text-ash-100 text-base">Run a club?</h2>
              <p className="text-ash-400 text-sm mt-0.5">
                Submit your club for approval and start hosting leagues.
              </p>
            </div>
            <Link href="/clubs/create" className="shrink-0">
              <Button size="sm">
                <Building2 className="h-3.5 w-3.5" /> Create a Club
              </Button>
            </Link>
          </Panel>
        )}
      </main>
    </ResponsiveShell>
  );
}

function ClubCard({ club }: { club: ClubWithMeta }) {
  return (
    <Link href={`/clubs/${club.id}`} className="group block h-full">
      <Panel
        variant="hud"
        padding="lg"
        className="h-full flex flex-col gap-3 group-hover:border-ember-500/40 transition-colors cursor-pointer"
      >
        {/* Card header */}
        <div className="flex items-start gap-3">
          <div className="p-2 rounded bg-ember-900/40 border border-ember-800/40 shrink-0 group-hover:border-ember-700/60 transition-colors">
            <Building2 className="h-4 w-4 text-ember-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="heading-fantasy text-ash-100 text-sm leading-tight group-hover:text-ember-300 transition-colors truncate">
              {club.clubName}
            </h2>
            <p className="text-ash-500 text-xs flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{club.location}</span>
            </p>
          </div>
        </div>

        {/* Description */}
        {club.description && (
          <p className="text-ash-500 text-xs leading-relaxed line-clamp-2 flex-1">
            {club.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-ash-800 mt-auto">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-ash-500 text-xs">
              <Layers className="h-3 w-3 text-ember-400" />
              {club.leagueCount} league{club.leagueCount !== 1 ? "s" : ""}
            </span>
          </div>
          <span className="flex items-center gap-0.5 text-ember-400 text-xs font-medium group-hover:gap-1.5 transition-all">
            View <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </Panel>
    </Link>
  );
}
