"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Building2,
  MapPin,
  Calendar,
  User,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  Settings,
} from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { Button } from "@/components/ui/Button";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { listApprovedClubs } from "@/lib/clubs/repo";
import { isFirebaseConfigured } from "@/lib/firebase";
import type { ClubDoc } from "@/lib/permissions/types";

function formatDate(ts: unknown): string {
  if (!ts) return "—";
  const d =
    ts && typeof ts === "object" && "toDate" in ts
      ? (ts as { toDate(): Date }).toDate()
      : new Date(ts as string);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminApprovedClubsPage() {
  const { isSiteAdmin, loading: permLoading } = usePermissions();
  const [clubs, setClubs]     = useState<ClubDoc[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!isFirebaseConfigured()) { setLoading(false); return; }
    setLoading(true);
    listApprovedClubs()
      .then(setClubs)
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
            <p className="text-ash-400 text-sm">
              This page requires Site Administrator privileges.
            </p>
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
              <CheckCircle className="h-3 w-3" /> Admin
            </RuneChip>
            <h1 className="heading-fantasy text-display-md text-ash-100">Approved Clubs</h1>
            <p className="text-ash-400 text-sm mt-1">
              All active clubs on the platform.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/admin/clubs">
              <Button size="sm" variant="outline">
                <ArrowLeft className="h-3.5 w-3.5" /> Pending Queue
              </Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Count */}
        <Panel variant="base" padding="sm" className="flex items-center gap-3">
          <span className="text-ash-500 text-sm">Active clubs:</span>
          <span className="heading-fantasy text-emerald-400 text-lg">{clubs.length}</span>
        </Panel>

        {/* Club list */}
        {clubs.length === 0 ? (
          <Panel variant="base" padding="lg" className="text-center space-y-2">
            <Building2 className="h-8 w-8 text-ash-600 mx-auto" />
            <p className="text-ash-400 text-sm">No approved clubs yet.</p>
          </Panel>
        ) : (
          <div className="space-y-3">
            {clubs.map((club) => (
              <Panel key={club.id} variant="inventory" padding="lg">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-pixel bg-emerald-500/15 shrink-0 mt-0.5">
                    <Building2 className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="heading-fantasy text-ash-100 text-base">{club.clubName}</h3>
                      <RuneChip tone="success" className="text-[9px]">Active</RuneChip>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-ash-400 text-xs">
                      {club.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {club.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 shrink-0" />
                        Created {formatDate(club.createdAt)}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-ash-500">
                        <User className="h-3 w-3 shrink-0" />
                        {club.createdBy}
                      </span>
                    </div>

                    {club.description && (
                      <p className="text-ash-500 text-xs mt-2 leading-relaxed line-clamp-2">
                        {club.description}
                      </p>
                    )}

                    <p className="text-ash-700 text-[10px] font-mono mt-2">ID: {club.id}</p>
                  </div>
                  <Link href={`/clubs/manage/${club.id}`} className="shrink-0 self-start">
                    <Button size="sm" variant="outline" className="border-ember-500/40 text-ember-400 hover:bg-ember-500/10">
                      <Settings className="h-3.5 w-3.5" /> Manage
                    </Button>
                  </Link>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </main>
    </ResponsiveShell>
  );
}
