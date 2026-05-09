"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  MapPin, Search, Plus, Loader2, X, Lightbulb, DoorOpen,
  Building2, Filter, ExternalLink,
} from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { isFirebaseConfigured } from "@/lib/firebase";
import { COMMUNITY_CLUB_ID } from "@/lib/community/constants";
import type { ClubFacility } from "@/lib/permissions/types";

type AccessFilter = "all" | "public" | "fee_required" | "members_only";

export default function CourtsPage() {
  const [courts, setCourts] = useState<ClubFacility[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterAccess, setFilterAccess] = useState<AccessFilter>("all");
  const [filterIndoor, setFilterIndoor] = useState(false);
  const [filterLights, setFilterLights] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) { setLoading(false); return; }
    (async () => {
      try {
        const { getDocs, query, collection, where, orderBy } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");
        const { COLLECTIONS } = await import("@/lib/firestore/collections");
        const snap = await getDocs(
          query(
            collection(db(), COLLECTIONS.clubFacilities),
            where("clubId", "==", COMMUNITY_CLUB_ID),
            orderBy("facilityName"),
          ),
        );
        setCourts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClubFacility)));
      } catch {
        // non-fatal
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const displayed = useMemo(() => {
    let out = courts;

    if (filterAccess !== "all") out = out.filter((c) => c.accessType === filterAccess);
    if (filterIndoor) out = out.filter((c) => c.isIndoor === true);
    if (filterLights) out = out.filter((c) => c.hasLights === true);

    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (c) =>
          (c.facilityName ?? "").toLowerCase().includes(q) ||
          (c.address ?? "").toLowerCase().includes(q),
      );
    }

    return out;
  }, [courts, search, filterAccess, filterIndoor, filterLights]);

  const isFiltered = search.trim() || filterAccess !== "all" || filterIndoor || filterLights;

  function clearFilters() {
    setSearch("");
    setFilterAccess("all");
    setFilterIndoor(false);
    setFilterLights(false);
  }

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-6xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <RuneChip tone="spectral" className="mb-2 block w-fit">
              <MapPin className="h-3 w-3 inline mr-1" /> Community
            </RuneChip>
            <h1 className="heading-fantasy text-display-md text-ash-100">Courts Directory</h1>
            <p className="text-ash-400 text-sm mt-1">
              Browse {courts.length > 0 ? courts.length : ""} public pickleball courts — or submit one we&apos;re missing.
            </p>
          </div>
          <Link href="/courts/submit">
            <Button size="md">
              <Plus className="h-4 w-4" />
              Submit a Court
            </Button>
          </Link>
        </div>

        {/* Search + filters */}
        <Panel variant="inventory" padding="md" className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ash-600 pointer-events-none" />
              <input
                className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel pl-9 pr-9 py-2 text-sm text-ash-100 placeholder:text-ash-600 focus:outline-none focus:border-ember-500"
                placeholder="Search by name or city…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ash-600 hover:text-ash-300 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-ash-600 shrink-0" />

            {/* Access filter */}
            {(["all", "public", "fee_required", "members_only"] as AccessFilter[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setFilterAccess(a)}
                className={`px-2.5 py-1 text-[10px] uppercase tracking-wide rounded-pixel border transition-colors ${
                  filterAccess === a
                    ? "border-ember-500 bg-ember-500/15 text-ember-300"
                    : "border-obsidian-500 text-ash-500 hover:border-obsidian-400 hover:text-ash-300"
                }`}
              >
                {a === "all" ? "All" : a === "fee_required" ? "Fee" : a === "members_only" ? "Members" : "Public"}
              </button>
            ))}

            <span className="text-obsidian-500 text-xs">·</span>

            <button
              type="button"
              onClick={() => setFilterIndoor((v) => !v)}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] uppercase tracking-wide rounded-pixel border transition-colors ${
                filterIndoor
                  ? "border-spectral-500 bg-spectral-500/15 text-spectral-300"
                  : "border-obsidian-500 text-ash-500 hover:border-obsidian-400 hover:text-ash-300"
              }`}
            >
              <Building2 className="h-3 w-3" /> Indoor
            </button>

            <button
              type="button"
              onClick={() => setFilterLights((v) => !v)}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] uppercase tracking-wide rounded-pixel border transition-colors ${
                filterLights
                  ? "border-gold-500 bg-gold-500/15 text-gold-300"
                  : "border-obsidian-500 text-ash-500 hover:border-obsidian-400 hover:text-ash-300"
              }`}
            >
              <Lightbulb className="h-3 w-3" /> Lights
            </button>

            {isFiltered && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-0.5 text-[10px] text-ash-600 hover:text-crimson-400 transition-colors"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}

            {isFiltered && (
              <span className="ml-auto text-xs text-ash-500">
                {displayed.length} of {courts.length}
              </span>
            )}
          </div>
        </Panel>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-ember-400" />
          </div>
        ) : courts.length === 0 ? (
          <Panel variant="base" padding="lg" className="text-center space-y-3 py-16">
            <MapPin className="h-8 w-8 text-ash-600 mx-auto" />
            <p className="text-ash-400 text-sm">No community courts yet.</p>
            <p className="text-ash-600 text-xs">
              Site admins can import courts from OpenStreetMap, or you can submit one.
            </p>
            <Link href="/courts/submit">
              <Button size="sm" variant="outline" className="mt-2">Submit a Court</Button>
            </Link>
          </Panel>
        ) : displayed.length === 0 ? (
          <Panel variant="base" padding="lg" className="text-center space-y-3 py-12">
            <Filter className="h-6 w-6 text-ash-600 mx-auto" />
            <p className="text-ash-400 text-sm">No courts match your filters.</p>
            <button type="button" onClick={clearFilters} className="text-xs text-ember-400 hover:text-ember-300 transition-colors">
              Clear filters
            </button>
          </Panel>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {displayed.map((court) => (
              <CourtCard key={court.id} court={court} />
            ))}
          </div>
        )}
      </main>
    </ResponsiveShell>
  );
}

function CourtCard({ court }: { court: ClubFacility }) {
  return (
    <Panel
      variant="inventory"
      padding="md"
      className="flex flex-col gap-3 hover:border-obsidian-400 transition-colors"
    >
      {/* Name + OSM link */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-ash-100 text-sm font-medium leading-snug truncate">
            {court.facilityName ?? <span className="italic text-ash-500">Unnamed Court</span>}
          </h3>
          {court.address && (
            <p className="text-ash-500 text-xs mt-0.5 leading-relaxed line-clamp-2">{court.address}</p>
          )}
        </div>
        {court.osmId && (
          <a
            href={`https://www.openstreetmap.org/${court.osmId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-ash-600 hover:text-spectral-400 transition-colors mt-0.5"
            title="View on OpenStreetMap"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Court count */}
      {court.pickleballCourts && (
        <div className="flex items-center gap-1.5">
          <div className="grid grid-cols-4 gap-0.5">
            {Array.from({ length: Math.min(court.pickleballCourts, 8) }).map((_, i) => (
              <div key={i} className="h-1.5 w-4 rounded-sm bg-ember-500/60" />
            ))}
            {court.pickleballCourts > 8 && (
              <div className="h-1.5 w-4 rounded-sm bg-obsidian-600" />
            )}
          </div>
          <span className="text-ash-400 text-[11px]">
            {court.pickleballCourts} court{court.pickleballCourts !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Feature chips */}
      <div className="flex flex-wrap gap-1.5 mt-auto">
        {court.accessType && (
          <RuneChip
            tone={court.accessType === "public" ? "spectral" : court.accessType === "fee_required" ? "warning" : "neutral"}
            className="text-[9px]"
          >
            <DoorOpen className="h-2.5 w-2.5 inline mr-0.5" />
            {court.accessType === "public" ? "Public" : court.accessType === "fee_required" ? "Fee" : court.accessType === "members_only" ? "Members" : court.accessType}
          </RuneChip>
        )}
        {court.isIndoor && (
          <RuneChip tone="rune" className="text-[9px]">
            <Building2 className="h-2.5 w-2.5 inline mr-0.5" /> Indoor
          </RuneChip>
        )}
        {court.hasLights && (
          <RuneChip tone="ember" className="text-[9px]">
            <Lightbulb className="h-2.5 w-2.5 inline mr-0.5" /> Lights
          </RuneChip>
        )}
        {court.ownershipType === "municipal" && (
          <RuneChip tone="neutral" className="text-[9px]">City</RuneChip>
        )}
      </div>

      {court.notes && (
        <p className="text-ash-600 text-[10px] leading-relaxed border-t border-obsidian-700 pt-2 line-clamp-2">
          {court.notes}
        </p>
      )}
    </Panel>
  );
}
