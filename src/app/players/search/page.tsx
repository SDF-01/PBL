"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Search, UserSearch, X } from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth-context";
import { listAllPlayers, getPlayerProfile } from "@/lib/players/repo";
import { isFirebaseConfigured } from "@/lib/firebase";
import { skillBand } from "@/lib/players/elo";
import type { PlayerProfileDoc } from "@/lib/firestore/types";

type Band = ReturnType<typeof skillBand>;

const BAND_TONE: Record<Band, Parameters<typeof RuneChip>[0]["tone"]> = {
  NOVICE: "neutral",
  BEGINNER: "spectral",
  INTERMEDIATE: "rune",
  ADVANCED: "ember",
  EXPERT: "gold",
  ELITE: "crimson",
};
const ALL_BANDS: Band[] = ["NOVICE", "BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT", "ELITE"];

function PlayerSearchContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [allPlayers, setAllPlayers] = useState<PlayerProfileDoc[] | null>(null);
  const [uidResult, setUidResult] = useState<PlayerProfileDoc | null | "not-found">(null);
  const [loading, setLoading] = useState(true);
  const [uidLoading, setUidLoading] = useState(false);

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [bandFilter, setBandFilter] = useState<Band | null>(
    (searchParams.get("band") as Band | null) ?? null,
  );
  const [cityFilter, setCityFilter] = useState(searchParams.get("city") ?? "");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync URL with current filter state (debounced)
  const syncUrl = useCallback(
    (q: string, band: Band | null, city: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (band) params.set("band", band);
        if (city) params.set("city", city);
        router.replace(`/players/search${params.size ? `?${params}` : ""}`, { scroll: false });
      }, 300);
    },
    [router],
  );

  function handleQuery(v: string) {
    setQuery(v);
    setUidResult(null);
    syncUrl(v, bandFilter, cityFilter);
  }
  function handleBand(b: Band) {
    const next = bandFilter === b ? null : b;
    setBandFilter(next);
    syncUrl(query, next, cityFilter);
  }
  function handleCity(v: string) {
    setCityFilter(v);
    syncUrl(query, bandFilter, v);
  }
  function clearAll() {
    setQuery("");
    setBandFilter(null);
    setCityFilter("");
    setUidResult(null);
    router.replace("/players/search", { scroll: false });
  }

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setAllPlayers([]);
      setLoading(false);
      return;
    }
    listAllPlayers(500)
      .then(setAllPlayers)
      .finally(() => setLoading(false));
  }, []);

  // Extract unique cities from loaded players for the filter
  const cities = useMemo(() => {
    if (!allPlayers) return [];
    const set = new Set<string>();
    for (const p of allPlayers) {
      if (p.city) set.add(p.city);
    }
    return Array.from(set).sort();
  }, [allPlayers]);

  const filtered = useMemo(() => {
    if (!allPlayers) return null;
    let r = allPlayers;
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter(
        (p) =>
          p.displayName.toLowerCase().includes(q) ||
          p.city?.toLowerCase().includes(q) ||
          p.region?.toLowerCase().includes(q),
      );
    }
    if (bandFilter) r = r.filter((p) => skillBand(p.elo) === bandFilter);
    if (cityFilter) r = r.filter((p) => p.city === cityFilter);
    return r;
  }, [allPlayers, query, bandFilter, cityFilter]);

  // UID direct lookup: if query looks like a UID (no spaces, 20+ chars)
  const looksLikeUid = query.trim().length >= 20 && !query.trim().includes(" ");

  async function handleUidLookup() {
    if (!looksLikeUid || uidLoading) return;
    setUidLoading(true);
    setUidResult(null);
    try {
      const profile = await getPlayerProfile(query.trim());
      setUidResult(profile ?? "not-found");
    } finally {
      setUidLoading(false);
    }
  }

  const hasFilters = !!query || !!bandFilter || !!cityFilter;

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-3xl">
        {/* Header */}
        <div>
          <h1 className="heading-fantasy text-display-md text-ash-100 flex items-center gap-3">
            <UserSearch className="h-6 w-6 text-spectral-400" />
            Find a Player
          </h1>
          <p className="text-ash-400 text-sm mt-1">
            Search across all registered players by name, city, or skill band.
          </p>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          {/* Name search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ash-500 pointer-events-none" />
            <input
              autoFocus
              type="search"
              className="w-full rounded-pixel bg-obsidian-800 border border-ash-700 text-ash-100 pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:border-ember-500 placeholder:text-ash-600"
              placeholder="Name, city, or region…"
              value={query}
              onChange={(e) => handleQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => handleQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ash-500 hover:text-ash-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Band filter chips */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] text-ash-500 uppercase tracking-widest mr-1">Band</span>
            {ALL_BANDS.map((band) => (
              <button
                key={band}
                type="button"
                onClick={() => handleBand(band)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  bandFilter === band
                    ? "bg-ember-500/20 border-ember-500/60 text-ember-300"
                    : "bg-obsidian-700 border-ash-700 text-ash-400 hover:border-ash-500 hover:text-ash-200"
                }`}
              >
                {band.charAt(0) + band.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* City filter */}
          {cities.length > 0 && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-ash-500 shrink-0" />
              <select
                value={cityFilter}
                onChange={(e) => handleCity(e.target.value)}
                className="flex-1 rounded-pixel bg-obsidian-800 border border-ash-700 text-ash-300 px-2 py-1.5 text-sm focus:outline-none focus:border-ember-500"
              >
                <option value="">All cities</option>
                {cities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-ash-500 hover:text-ash-300 transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* UID direct lookup hint */}
        {looksLikeUid && uidResult === null && (
          <Panel variant="base" padding="md" className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-ash-400 text-sm">
              That looks like a player ID — look them up directly?
            </p>
            <Button size="sm" variant="outline" onClick={handleUidLookup} loading={uidLoading}>
              Look up by ID
            </Button>
          </Panel>
        )}

        {uidResult === "not-found" && (
          <Panel variant="base" padding="md">
            <p className="text-ash-500 text-sm">No player found with that ID.</p>
          </Panel>
        )}

        {uidResult && uidResult !== "not-found" && (
          <div>
            <p className="text-[10px] text-ash-500 uppercase tracking-widest mb-2">Direct match</p>
            <PlayerRow p={uidResult} rank={null} isMe={user?.uid === uidResult.userId} />
          </div>
        )}

        {/* Results */}
        {loading ? (
          <SkeletonList count={5} />
        ) : filtered === null ? null : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-ash-500 text-xs">
                {filtered.length === 0
                  ? "No players match"
                  : `${filtered.length} player${filtered.length === 1 ? "" : "s"}`}
                {allPlayers && allPlayers.length > 0 && (
                  <span className="text-ash-600"> · across {allPlayers.length} registered</span>
                )}
              </p>
              {filtered.length > 0 && (
                <Link href="/players" className="text-xs text-spectral-400 hover:text-spectral-300 transition-colors">
                  Full leaderboard →
                </Link>
              )}
            </div>

            {filtered.length === 0 ? (
              <Panel variant="base" padding="lg" className="text-center space-y-2">
                <UserSearch className="h-8 w-8 text-ash-600 mx-auto" />
                <p className="text-ash-400 text-sm">No players match your search.</p>
                <p className="text-ash-600 text-xs">
                  Try a broader name or remove filters.
                </p>
              </Panel>
            ) : (
              <Panel variant="inventory" padding="md">
                <ol className="divide-y divide-obsidian-400">
                  {filtered.map((p, i) => (
                    <PlayerRow
                      key={p.id}
                      p={p}
                      rank={i + 1}
                      isMe={user?.uid === p.userId}
                    />
                  ))}
                </ol>
              </Panel>
            )}
          </div>
        )}
      </main>
    </ResponsiveShell>
  );
}

function PlayerRow({
  p,
  rank,
  isMe,
}: {
  p: PlayerProfileDoc;
  rank: number | null;
  isMe: boolean;
}) {
  const band = skillBand(p.elo);
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      {rank !== null && (
        <span className="w-8 text-right heading-fantasy text-sm text-ash-500 shrink-0">
          {rank}
        </span>
      )}
      <Link
        href={`/players/view?uid=${p.userId}`}
        className="flex-1 min-w-0 flex items-center gap-3 hover:bg-obsidian-700/30 rounded-pixel px-2 py-1 -mx-2 transition-colors"
      >
        {p.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.photoURL}
            alt=""
            className="h-9 w-9 rounded-pixel object-cover border border-obsidian-400 shrink-0"
          />
        ) : (
          <div className="h-9 w-9 rounded-pixel bg-obsidian-700 border border-obsidian-400 flex items-center justify-center text-sm text-ash-500 shrink-0">
            {p.displayName.slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="text-sm text-ash-100 truncate flex items-center gap-2">
            {p.displayName}
            {isMe && (
              <span className="text-[10px] text-ember-400 uppercase tracking-widest">You</span>
            )}
          </div>
          <div className="text-[11px] text-ash-500 font-mono flex items-center gap-2 flex-wrap">
            {p.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {p.city}{p.region ? `, ${p.region}` : ""}
              </span>
            )}
            {p.homeVenueName && <span>· {p.homeVenueName}</span>}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <RuneChip tone={BAND_TONE[band]} className="hidden sm:inline-flex">{band}</RuneChip>
          <div className="w-14 text-right">
            <div className="heading-fantasy text-sm text-ash-100">{p.elo}</div>
            <div className="text-[10px] text-ash-600 font-mono">
              {p.stats.wins}W–{p.stats.losses}L
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}

export default function PlayerSearchPage() {
  return (
    <Suspense>
      <PlayerSearchContent />
    </Suspense>
  );
}
