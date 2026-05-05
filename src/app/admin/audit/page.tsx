"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShieldAlert, ClipboardList, ArrowLeft, RefreshCw, Download, X } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { Button } from "@/components/ui/Button";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { listRecentRoleEvents } from "@/lib/admin/repo";
import { isFirebaseConfigured } from "@/lib/firebase";
import type { RoleEventDoc, RoleEventType } from "@/lib/permissions/types";

const EVENT_LABEL: Record<RoleEventType, string> = {
  ClubApproved: "Club Approved",
  ClubRejected: "Club Rejected",
  RoleAssigned: "Role Assigned",
  RoleRemoved:  "Role Removed",
};

const EVENT_TONE: Record<RoleEventType, "success" | "crimson" | "rune" | "warning"> = {
  ClubApproved: "success",
  ClubRejected: "crimson",
  RoleAssigned: "rune",
  RoleRemoved:  "warning",
};

function formatTimestamp(ts: unknown): string {
  if (!ts) return "—";
  const d =
    ts && typeof ts === "object" && "toDate" in ts
      ? (ts as { toDate(): Date }).toDate()
      : new Date(ts as string);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RoleLabel({ roleId }: { roleId: string | null }) {
  if (!roleId) return <span className="text-ash-600">—</span>;
  const labels: Record<string, string> = {
    SiteAdmin:            "Site Admin",
    ClubDirector:         "Club Director",
    LeagueCoordinator:    "League Coordinator",
    Player:               "Player",
    ClubCreatorProvisional: "Provisional",
  };
  return <span className="font-mono text-ash-200">{labels[roleId] ?? roleId}</span>;
}

const ALL_EVENT_TYPES = Object.keys(EVENT_LABEL) as RoleEventType[];

function toISODate(ts: unknown): string {
  if (!ts) return "";
  const d =
    ts && typeof ts === "object" && "toDate" in ts
      ? (ts as { toDate(): Date }).toDate()
      : new Date(ts as string);
  return d.toISOString().slice(0, 10);
}

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function exportCsv(rows: RoleEventDoc[]) {
  const headers = ["ID", "Type", "User ID", "Club ID", "Old Role", "New Role", "Timestamp", "Notes"];
  const lines = [
    headers.join(","),
    ...rows.map((ev) =>
      [
        ev.id,
        ev.eventType,
        ev.userId,
        ev.clubId ?? "",
        ev.oldRoleId ?? "",
        ev.newRoleId ?? "",
        toISODate(ev.eventTimestamp),
        escapeCsv(ev.notes),
      ].join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminAuditPage() {
  const { isSiteAdmin, loading: permLoading } = usePermissions();
  const [events, setEvents]   = useState<RoleEventDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<RoleEventType | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredEvents = useMemo(() => {
    let r = events;
    if (typeFilter) r = r.filter((ev) => ev.eventType === typeFilter);
    if (dateFrom) r = r.filter((ev) => toISODate(ev.eventTimestamp) >= dateFrom);
    if (dateTo) r = r.filter((ev) => toISODate(ev.eventTimestamp) <= dateTo);
    return r;
  }, [events, typeFilter, dateFrom, dateTo]);

  function load() {
    if (!isFirebaseConfigured()) { setLoading(false); return; }
    setLoading(true);
    listRecentRoleEvents(200)
      .then(setEvents)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (permLoading || !isSiteAdmin) { setLoading(false); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSiteAdmin, permLoading]);

  if (permLoading || loading) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-3xl">
          <Panel variant="base" padding="lg" className="text-center text-ash-500 text-sm">
            Loading…
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  if (!isSiteAdmin) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-3xl">
          <Panel variant="quest" padding="lg" className="text-center space-y-2">
            <ShieldAlert className="h-8 w-8 text-crimson-500 mx-auto" />
            <h2 className="heading-fantasy text-ash-100 text-base">Access Denied</h2>
            <p className="text-ash-400 text-sm">Site Administrator privileges required.</p>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-3xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <RuneChip tone="ember" className="mb-2 inline-flex items-center gap-1">
              <ClipboardList className="h-3 w-3" /> Admin
            </RuneChip>
            <h1 className="heading-fantasy text-display-md text-ash-100">Audit Log</h1>
            <p className="text-ash-400 text-sm mt-1">
              All administrative role changes and club decisions — most recent first.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/admin">
              <Button size="sm" variant="outline">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportCsv(filteredEvents)} disabled={filteredEvents.length === 0}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Panel variant="base" padding="md" className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-ash-500 text-xs uppercase tracking-widest">Filter:</span>
            <select
              className="rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-2 py-1.5 text-xs focus:outline-none focus:border-ember-500"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as RoleEventType | "")}
            >
              <option value="">All types</option>
              {ALL_EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{EVENT_LABEL[t]}</option>
              ))}
            </select>
            <input
              type="date"
              className="rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-2 py-1.5 text-xs focus:outline-none focus:border-ember-500"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From"
            />
            <span className="text-ash-600 text-xs">→</span>
            <input
              type="date"
              className="rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-2 py-1.5 text-xs focus:outline-none focus:border-ember-500"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To"
            />
            {(typeFilter || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => { setTypeFilter(""); setDateFrom(""); setDateTo(""); }}
                className="flex items-center gap-1 text-ash-500 hover:text-ash-100 text-xs transition-colors"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
          <p className="text-ash-500 text-xs">
            Showing {filteredEvents.length} of {events.length} events
          </p>
        </Panel>

        {/* Event list */}
        {filteredEvents.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-8 w-8" />}
            title={events.length === 0 ? "No audit events found" : "No events match filters"}
            description={events.length === 0 ? "Administrative actions will appear here." : "Try adjusting the date range or event type filter."}
          />
        ) : (
          <div className="space-y-2">
            {filteredEvents.map((ev) => (
              <Panel key={ev.id} variant="inventory" padding="md">
                <div className="flex items-start gap-3 flex-wrap">
                  <RuneChip
                    tone={EVENT_TONE[ev.eventType]}
                    className="text-[9px] shrink-0 mt-0.5"
                  >
                    {EVENT_LABEL[ev.eventType] ?? ev.eventType}
                  </RuneChip>

                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-ash-300 text-sm leading-relaxed">{ev.notes}</p>

                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-ash-500">
                      {ev.clubId && (
                        <span>Club: <span className="font-mono text-ash-400">{ev.clubId}</span></span>
                      )}
                      {ev.oldRoleId && (
                        <span>
                          From: <RoleLabel roleId={ev.oldRoleId} />
                        </span>
                      )}
                      {ev.newRoleId && (
                        <span>
                          To: <RoleLabel roleId={ev.newRoleId} />
                        </span>
                      )}
                      <span className="font-mono">
                        User: {ev.userId}
                      </span>
                    </div>
                  </div>

                  <span className="text-ash-600 text-[10px] font-mono shrink-0 whitespace-nowrap">
                    {formatTimestamp(ev.eventTimestamp)}
                  </span>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </main>
    </ResponsiveShell>
  );
}
