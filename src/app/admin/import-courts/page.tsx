"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, CheckSquare, ChevronDown, ChevronUp, ChevronsUpDown,
  Download, Filter, Loader2, MapPin, Search, Square, Trophy,
  AlertCircle, CheckCircle2, X,
} from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { searchPickleballCourts, osmToClubFacility, type OsmFacility } from "@/lib/osm/overpass";
import { COMMUNITY_CLUB_ID, COMMUNITY_CLUB_NAME } from "@/lib/community/constants";
import { isFirebaseConfigured } from "@/lib/firebase";
import type { ClubFacility } from "@/lib/permissions/types";

interface ImportRow extends OsmFacility {
  selected: boolean;
  alreadyImported: boolean;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

type SortCol = "name" | "address" | "courts" | "status";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "new" | "imported";

function SortIcon({ col, active, dir }: { col: SortCol; active: SortCol | null; dir: SortDir }) {
  if (active !== col) return <ChevronsUpDown className="h-3 w-3 text-ash-600 ml-1 inline" />;
  return dir === "asc"
    ? <ChevronUp className="h-3 w-3 text-ember-400 ml-1 inline" />
    : <ChevronDown className="h-3 w-3 text-ember-400 ml-1 inline" />;
}

export default function ImportCourtsPage() {
  const { user } = useAuth();
  const { isSiteAdmin, loading: permLoading } = usePermissions();

  const [areaQuery, setAreaQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);

  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const [existingOsmIds, setExistingOsmIds] = useState<Set<string>>(new Set());

  // Filter & sort state
  const [filterText, setFilterText] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [filterHasCourts, setFilterHasCourts] = useState(false);
  const [filterHideUnnamed, setFilterHideUnnamed] = useState(true);
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    if (!isFirebaseConfigured() || !isSiteAdmin) return;
    (async () => {
      const { getDocs, query, collection, where } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");
      const { COLLECTIONS } = await import("@/lib/firestore/collections");
      const snap = await getDocs(
        query(collection(db(), COLLECTIONS.clubFacilities), where("clubId", "==", COMMUNITY_CLUB_ID)),
      );
      const ids = new Set(snap.docs.map((d) => d.data().osmId as string).filter(Boolean));
      setExistingOsmIds(ids);
    })().catch(() => {});
  }, [isSiteAdmin]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!areaQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    setRows(null);
    setResult(null);
    setFilterText("");
    setFilterStatus("all");
    setFilterHasCourts(false);
    setFilterHideUnnamed(true);
    setSortCol(null);
    try {
      const results = await searchPickleballCourts(areaQuery.trim());
      setRows(
        results.map((r) => ({
          ...r,
          selected: !existingOsmIds.has(r.osmId),
          alreadyImported: existingOsmIds.has(r.osmId),
        })),
      );
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  }

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  function toggleRow(osmId: string) {
    setRows((prev) =>
      prev?.map((r) => (r.osmId === osmId ? { ...r, selected: !r.selected } : r)) ?? null,
    );
  }

  function selectAll() {
    setRows((prev) => prev?.map((r) => ({ ...r, selected: !r.alreadyImported })) ?? null);
  }

  function deselectAll() {
    setRows((prev) => prev?.map((r) => ({ ...r, selected: false })) ?? null);
  }

  // Derived: filtered + sorted rows
  const displayedRows = useMemo(() => {
    if (!rows) return [];
    let out = rows;

    if (filterStatus === "new") out = out.filter((r) => !r.alreadyImported);
    else if (filterStatus === "imported") out = out.filter((r) => r.alreadyImported);

    if (filterHideUnnamed) out = out.filter((r) => !!r.facilityName);

    if (filterHasCourts) out = out.filter((r) => (r.pickleballCourts ?? 0) > 0);

    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      out = out.filter(
        (r) =>
          (r.facilityName ?? "").toLowerCase().includes(q) ||
          (r.address ?? "").toLowerCase().includes(q),
      );
    }

    if (sortCol) {
      out = [...out].sort((a, b) => {
        let av: string | number = 0;
        let bv: string | number = 0;
        if (sortCol === "name") {
          av = (a.facilityName ?? "").toLowerCase();
          bv = (b.facilityName ?? "").toLowerCase();
        } else if (sortCol === "address") {
          av = (a.address ?? "").toLowerCase();
          bv = (b.address ?? "").toLowerCase();
        } else if (sortCol === "courts") {
          av = a.pickleballCourts ?? -1;
          bv = b.pickleballCourts ?? -1;
        } else if (sortCol === "status") {
          av = a.alreadyImported ? 1 : 0;
          bv = b.alreadyImported ? 1 : 0;
        }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    return out;
  }, [rows, filterText, filterStatus, filterHasCourts, filterHideUnnamed, sortCol, sortDir]);

  async function handleImport() {
    if (!user || !rows) return;
    const toImport = rows.filter((r) => r.selected && !r.alreadyImported);
    if (toImport.length === 0) return;

    setImporting(true);
    setResult(null);

    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;

    try {
      const { addClubFacility } = await import("@/lib/clubs/write");
      const { doc, setDoc } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");
      const { COLLECTIONS } = await import("@/lib/firestore/collections");

      const communityRef = doc(db(), COLLECTIONS.clubs, COMMUNITY_CLUB_ID);
      await setDoc(
        communityRef,
        {
          clubName: COMMUNITY_CLUB_NAME,
          location: "Community",
          description: "Platform-managed community courts imported from OpenStreetMap.",
          logoUrl: null,
          status: "approved",
          createdBy: user.uid,
          memberIds: [],
          followerIds: [],
        },
        { merge: true },
      );

      for (const osm of toImport) {
        if (existingOsmIds.has(osm.osmId)) { skipped++; continue; }
        try {
          const payload = osmToClubFacility(osm, user.uid);
          const { clubId: _clubId, createdAt: _ca, updatedAt: _ua, updatedBy: _ub, ...rest } = payload;
          await addClubFacility(COMMUNITY_CLUB_ID, rest as Parameters<typeof addClubFacility>[1], user.uid);
          setExistingOsmIds((prev) => new Set([...prev, osm.osmId]));
          imported++;
        } catch (err) {
          errors.push(`${osm.facilityName ?? osm.osmId}: ${err instanceof Error ? err.message : "failed"}`);
        }
      }

      setRows((prev) =>
        prev?.map((r) => {
          const wasImported = toImport.some((t) => t.osmId === r.osmId);
          return wasImported && !errors.some((e) => e.startsWith(r.facilityName ?? r.osmId))
            ? { ...r, alreadyImported: true, selected: false }
            : r;
        }) ?? null,
      );

      setResult({ imported, skipped, errors });
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Import failed");
      setResult({ imported, skipped, errors });
    } finally {
      setImporting(false);
    }
  }

  // ── Auth / role guard ──────────────────────────────────────
  if (permLoading) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-ember-400" />
        </main>
      </ResponsiveShell>
    );
  }

  if (!isSiteAdmin) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-lg">
          <Panel variant="base" padding="lg" className="text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-crimson-500 mx-auto" />
            <p className="text-ash-300">Site Admin access required.</p>
            <Link href="/admin"><Button variant="outline" size="sm">Back to Admin</Button></Link>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  const selectedCount = rows?.filter((r) => r.selected && !r.alreadyImported).length ?? 0;
  const newCount = rows?.filter((r) => !r.alreadyImported).length ?? 0;
  const alreadyCount = rows?.filter((r) => r.alreadyImported).length ?? 0;
  const isFiltered = filterText.trim() || filterStatus !== "all" || filterHasCourts || filterHideUnnamed;

  const thCls = "text-[10px] uppercase tracking-widest text-ash-500 hover:text-ash-300 transition-colors cursor-pointer select-none flex items-center";

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-5xl">

        {/* Header */}
        <div>
          <Link href="/admin" className="text-ash-400 hover:text-ash-200 text-sm inline-flex items-center gap-1 mb-3">
            <ArrowLeft className="h-4 w-4" /> Admin
          </Link>
          <RuneChip tone="spectral" className="mb-2 block w-fit">
            <MapPin className="h-3 w-3 inline mr-1" /> Court Import
          </RuneChip>
          <h1 className="heading-fantasy text-display-md text-ash-100">Import Community Courts</h1>
          <p className="text-ash-400 text-sm mt-1">
            Search OpenStreetMap for pickleball courts and import them into the <strong className="text-ash-200">{COMMUNITY_CLUB_NAME}</strong> facility pool.
            Players can select a community court as their home venue.
          </p>
        </div>

        {/* Search */}
        <Panel variant="inventory" padding="lg">
          <form onSubmit={handleSearch} className="space-y-3">
            <label className="text-ash-300 text-xs font-medium block">
              Area to Search
              <span className="text-ash-500 ml-2 font-normal">city, county, or state name</span>
            </label>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100 placeholder:text-ash-600 focus:outline-none focus:border-ember-500"
                placeholder="e.g. Minneapolis, MN  •  Anoka County, Minnesota  •  Minnesota"
                value={areaQuery}
                onChange={(e) => setAreaQuery(e.target.value)}
                disabled={searching}
              />
              <Button type="submit" size="md" disabled={searching || !areaQuery.trim()}>
                {searching
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Search className="h-4 w-4" />}
                {searching ? "Searching…" : "Search OSM"}
              </Button>
            </div>
            <p className="text-ash-600 text-[11px]">
              Data sourced from OpenStreetMap contributors — coverage varies by region.
            </p>
          </form>
        </Panel>

        {searchError && (
          <Panel variant="base" padding="md">
            <div className="flex items-center gap-2 text-crimson-500">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="text-sm">{searchError}</p>
            </div>
          </Panel>
        )}

        {/* Import result */}
        {result && (
          <Panel variant="base" padding="md">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-spectral-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-ash-200 text-sm font-medium">
                  Import complete — <span className="text-spectral-400">{result.imported}</span> courts added
                  {result.skipped > 0 && <>, {result.skipped} skipped (already imported)</>}
                </p>
                {result.errors.length > 0 && (
                  <ul className="text-crimson-500 text-xs space-y-0.5">
                    {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                )}
              </div>
            </div>
          </Panel>
        )}

        {/* Results table */}
        {rows !== null && (
          <Panel variant="inventory" padding="md" className="space-y-3">

            {/* Toolbar row 1 — counts + select actions */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap text-sm">
                <span className="text-ash-200 font-medium">
                  {isFiltered
                    ? <>{displayedRows.length} <span className="text-ash-500 font-normal">of {rows.length}</span></>
                    : rows.length} results
                </span>
                {newCount > 0 && (
                  <RuneChip tone="spectral" className="text-[9px]">{newCount} new</RuneChip>
                )}
                {alreadyCount > 0 && (
                  <RuneChip tone="neutral" className="text-[9px]">{alreadyCount} already imported</RuneChip>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-ash-400 hover:text-ash-200 flex items-center gap-1 transition-colors"
                >
                  <CheckSquare className="h-3.5 w-3.5" /> Select new
                </button>
                <span className="text-ash-600">·</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-xs text-ash-400 hover:text-ash-200 flex items-center gap-1 transition-colors"
                >
                  <Square className="h-3.5 w-3.5" /> Deselect all
                </button>
              </div>
            </div>

            {/* Toolbar row 2 — filters */}
            {rows.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap border-t border-obsidian-700 pt-3">
                <Filter className="h-3.5 w-3.5 text-ash-500 shrink-0" />

                {/* Text search */}
                <div className="relative flex-1 min-w-[160px] max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-ash-600 pointer-events-none" />
                  <input
                    className="w-full bg-obsidian-900 border border-obsidian-500 rounded-pixel pl-7 pr-7 py-1.5 text-xs text-ash-100 placeholder:text-ash-600 focus:outline-none focus:border-ember-500"
                    placeholder="Name or address…"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                  />
                  {filterText && (
                    <button
                      type="button"
                      onClick={() => setFilterText("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-ash-600 hover:text-ash-300 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Status pills */}
                <div className="flex items-center gap-1">
                  {(["all", "new", "imported"] as StatusFilter[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFilterStatus(s)}
                      className={`px-2 py-1 text-[10px] uppercase tracking-wide rounded-pixel border transition-colors ${
                        filterStatus === s
                          ? "border-ember-500 bg-ember-500/15 text-ember-300"
                          : "border-obsidian-500 text-ash-500 hover:border-obsidian-400 hover:text-ash-300"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {/* Hide unnamed toggle — on by default */}
                <button
                  type="button"
                  onClick={() => setFilterHideUnnamed((v) => !v)}
                  className={`px-2 py-1 text-[10px] uppercase tracking-wide rounded-pixel border transition-colors ${
                    filterHideUnnamed
                      ? "border-ember-500 bg-ember-500/15 text-ember-300"
                      : "border-obsidian-500 text-ash-500 hover:border-obsidian-400 hover:text-ash-300"
                  }`}
                >
                  Hide unnamed
                </button>

                {/* Has courts toggle */}
                <button
                  type="button"
                  onClick={() => setFilterHasCourts((v) => !v)}
                  className={`px-2 py-1 text-[10px] uppercase tracking-wide rounded-pixel border transition-colors ${
                    filterHasCourts
                      ? "border-spectral-500 bg-spectral-500/15 text-spectral-300"
                      : "border-obsidian-500 text-ash-500 hover:border-obsidian-400 hover:text-ash-300"
                  }`}
                >
                  Has court count
                </button>

                {/* Clear all filters */}
                {isFiltered && (
                  <button
                    type="button"
                    onClick={() => { setFilterText(""); setFilterStatus("all"); setFilterHasCourts(false); setFilterHideUnnamed(false); }}
                    className="text-[10px] text-ash-600 hover:text-crimson-400 transition-colors flex items-center gap-0.5"
                  >
                    <X className="h-3 w-3" /> Clear filters
                  </button>
                )}
              </div>
            )}

            {rows.length === 0 ? (
              <div className="text-center py-6 space-y-1">
                <Trophy className="h-6 w-6 text-ash-600 mx-auto" />
                <p className="text-ash-500 text-sm">No pickleball courts found in this area.</p>
                <p className="text-ash-600 text-xs">Try a broader area like a county or state.</p>
              </div>
            ) : displayedRows.length === 0 ? (
              <div className="text-center py-6 space-y-1">
                <Filter className="h-6 w-6 text-ash-600 mx-auto" />
                <p className="text-ash-500 text-sm">No results match your filters.</p>
                <button
                  type="button"
                  onClick={() => { setFilterText(""); setFilterStatus("all"); setFilterHasCourts(false); }}
                  className="text-xs text-ember-400 hover:text-ember-300 transition-colors"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                {/* Column headers — sortable */}
                <div className="grid grid-cols-[2rem_1.5fr_1fr_0.8fr_5rem_5rem_5rem] gap-2 pb-2 border-b border-obsidian-600">
                  <span />
                  <button type="button" className={thCls} onClick={() => toggleSort("name")}>
                    Facility <SortIcon col="name" active={sortCol} dir={sortDir} />
                  </button>
                  <button type="button" className={thCls} onClick={() => toggleSort("address")}>
                    Street <SortIcon col="address" active={sortCol} dir={sortDir} />
                  </button>
                  <button type="button" className={thCls} onClick={() => toggleSort("address")}>
                    City <SortIcon col="address" active={sortCol} dir={sortDir} />
                  </button>
                  <span className={thCls}>Zip</span>
                  <button type="button" className={`${thCls} justify-end`} onClick={() => toggleSort("courts")}>
                    <SortIcon col="courts" active={sortCol} dir={sortDir} /> Courts
                  </button>
                  <button type="button" className={`${thCls} justify-center`} onClick={() => toggleSort("status")}>
                    Status <SortIcon col="status" active={sortCol} dir={sortDir} />
                  </button>
                </div>

                <div className="divide-y divide-obsidian-700 max-h-[60vh] overflow-y-auto -mx-4 px-4">
                  {displayedRows.map((row) => (
                    <div
                      key={row.osmId}
                      className={`grid grid-cols-[2rem_1.5fr_1fr_0.8fr_5rem_5rem_5rem] gap-2 items-start py-2.5 ${
                        row.alreadyImported ? "opacity-40" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        type="button"
                        disabled={row.alreadyImported}
                        onClick={() => toggleRow(row.osmId)}
                        className="mt-0.5 text-ash-400 hover:text-ember-400 disabled:cursor-not-allowed transition-colors"
                      >
                        {row.selected
                          ? <CheckSquare className="h-4 w-4 text-ember-400" />
                          : <Square className="h-4 w-4" />}
                      </button>

                      {/* Facility name */}
                      <div className="min-w-0">
                        <p className="text-ash-100 text-xs font-medium truncate">
                          {row.facilityName ?? <span className="text-ash-500 italic">Unnamed</span>}
                        </p>
                        <p className="text-ash-600 text-[10px] font-mono mt-0.5">
                          {row.lat.toFixed(5)}, {row.lng.toFixed(5)}
                        </p>
                        {row.osmId && (
                          <a
                            href={`https://www.openstreetmap.org/${row.osmId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[9px] text-ash-600 hover:text-spectral-400 transition-colors"
                          >
                            {row.osmId} ↗
                          </a>
                        )}
                      </div>

                      {/* Street */}
                      <p className="text-ash-400 text-xs truncate">
                        {row.streetAddress ?? <span className="text-ash-600 italic">—</span>}
                      </p>

                      {/* City + State */}
                      <p className="text-ash-400 text-xs truncate">
                        {row.addressCity
                          ? [row.addressCity, row.addressState].filter(Boolean).join(", ")
                          : <span className="text-ash-600 italic">—</span>}
                      </p>

                      {/* Zip */}
                      <p className="text-ash-400 text-xs font-mono">
                        {row.addressPostcode ?? <span className="text-ash-600 italic">—</span>}
                      </p>

                      {/* Courts */}
                      <p className="text-ash-300 text-xs text-right font-mono">
                        {row.pickleballCourts ?? "—"}
                      </p>

                      {/* Status */}
                      <div className="flex justify-center">
                        {row.alreadyImported ? (
                          <RuneChip tone="neutral" className="text-[9px]">Imported</RuneChip>
                        ) : (
                          <RuneChip tone="spectral" className="text-[9px]">New</RuneChip>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Import action */}
                <div className="flex items-center gap-3 pt-2 border-t border-obsidian-600">
                  <Button
                    size="md"
                    onClick={handleImport}
                    disabled={importing || selectedCount === 0}
                  >
                    {importing
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Download className="h-4 w-4" />}
                    {importing
                      ? "Importing…"
                      : `Import ${selectedCount > 0 ? selectedCount : ""} Selected`}
                  </Button>
                  {selectedCount > 0 && (
                    <p className="text-ash-500 text-xs">
                      {selectedCount} court{selectedCount !== 1 ? "s" : ""} will be added to <span className="text-ash-300">{COMMUNITY_CLUB_NAME}</span>
                    </p>
                  )}
                </div>
              </>
            )}
          </Panel>
        )}
      </main>
    </ResponsiveShell>
  );
}
