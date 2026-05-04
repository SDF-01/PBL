"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert, ClipboardList, ArrowLeft, RefreshCw } from "lucide-react";
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

export default function AdminAuditPage() {
  const { isSiteAdmin, loading: permLoading } = usePermissions();
  const [events, setEvents]   = useState<RoleEventDoc[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!isFirebaseConfigured()) { setLoading(false); return; }
    setLoading(true);
    listRecentRoleEvents(50)
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
          </div>
        </div>

        {/* Stats */}
        <Panel variant="base" padding="sm" className="flex items-center gap-3">
          <span className="text-ash-500 text-sm">Events shown:</span>
          <span className="heading-fantasy text-ember-300 text-lg">{events.length}</span>
          <span className="text-ash-600 text-xs">(last 50)</span>
        </Panel>

        {/* Event list */}
        {events.length === 0 ? (
          <Panel variant="base" padding="lg" className="text-center space-y-2">
            <ClipboardList className="h-8 w-8 text-ash-600 mx-auto" />
            <p className="text-ash-400 text-sm">No audit events found.</p>
          </Panel>
        ) : (
          <div className="space-y-2">
            {events.map((ev) => (
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
