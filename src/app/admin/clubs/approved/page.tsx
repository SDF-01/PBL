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
  Archive,
  Trash2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { Button } from "@/components/ui/Button";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { useAuth } from "@/lib/auth-context";
import { listApprovedClubs, listArchivedClubs } from "@/lib/clubs/repo";
import { archiveClub, deleteClub } from "@/lib/admin/write";
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

type Confirm = { type: "archive" | "delete"; clubId: string; clubName: string };

export default function AdminApprovedClubsPage() {
  const { isSiteAdmin, loading: permLoading } = usePermissions();
  const { user } = useAuth();

  const [clubs, setClubs]           = useState<ClubDoc[]>([]);
  const [archived, setArchived]     = useState<ClubDoc[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<"active" | "archived">("active");
  const [confirm, setConfirm]       = useState<Confirm | null>(null);
  const [working, setWorking]       = useState(false);

  function load() {
    if (!isFirebaseConfigured()) { setLoading(false); return; }
    setLoading(true);
    Promise.all([listApprovedClubs(), listArchivedClubs()])
      .then(([active, arch]) => { setClubs(active); setArchived(arch); })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (permLoading || !isSiteAdmin) { setLoading(false); return; }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSiteAdmin, permLoading]);

  async function handleConfirm() {
    if (!confirm || !user) return;
    setWorking(true);
    try {
      if (confirm.type === "archive") {
        await archiveClub(confirm.clubId, confirm.clubName, user.uid);
        setClubs((prev) => prev.filter((c) => c.id !== confirm.clubId));
        setArchived((prev) => [
          ...prev,
          { ...clubs.find((c) => c.id === confirm.clubId)!, status: "archived" },
        ]);
      } else {
        await deleteClub(confirm.clubId, confirm.clubName, user.uid);
        setClubs((prev) => prev.filter((c) => c.id !== confirm.clubId));
        setArchived((prev) => prev.filter((c) => c.id !== confirm.clubId));
      }
    } finally {
      setWorking(false);
      setConfirm(null);
    }
  }

  if (permLoading || loading) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-3xl">
          <Panel variant="base" padding="lg" className="text-center text-ash-500 text-sm">Loading…</Panel>
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
            <p className="text-ash-400 text-sm">This page requires Site Administrator privileges.</p>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  const displayList = tab === "active" ? clubs : archived;

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-3xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <RuneChip tone="ember" className="mb-2 inline-flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Admin
            </RuneChip>
            <h1 className="heading-fantasy text-display-md text-ash-100">Manage Clubs</h1>
            <p className="text-ash-400 text-sm mt-1">Archive or permanently delete clubs.</p>
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

        {/* Tabs */}
        <div className="flex gap-1 border-b border-obsidian-600">
          {(["active", "archived"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors -mb-px border-b-2 ${
                tab === t
                  ? "border-ember-500 text-ember-300"
                  : "border-transparent text-ash-400 hover:text-ash-200"
              }`}
            >
              {t === "active" ? `Active (${clubs.length})` : `Archived (${archived.length})`}
            </button>
          ))}
        </div>

        {/* Confirm banner */}
        {confirm && (
          <Panel variant="quest" padding="md" className="border-crimson-500/50 bg-crimson-900/20">
            <div className="flex items-start gap-3 flex-wrap">
              <AlertTriangle className="h-5 w-5 text-crimson-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-ash-100 text-sm font-medium">
                  {confirm.type === "archive"
                    ? `Archive "${confirm.clubName}"?`
                    : `Permanently delete "${confirm.clubName}"?`}
                </p>
                <p className="text-ash-400 text-xs mt-0.5">
                  {confirm.type === "archive"
                    ? "The club will be hidden from public listings. This can be reversed by approving it again."
                    : "The club document and all role assignments will be deleted. This cannot be undone. Leagues and match history are preserved."}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => setConfirm(null)} disabled={working}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={confirm.type === "delete"
                    ? "border-crimson-500/60 text-crimson-400 hover:bg-crimson-500/10"
                    : "border-gold-500/60 text-gold-400 hover:bg-gold-500/10"}
                  onClick={handleConfirm}
                  disabled={working}
                >
                  {working ? "Working…" : confirm.type === "archive" ? "Archive" : "Delete"}
                </Button>
              </div>
            </div>
          </Panel>
        )}

        {/* Count */}
        <Panel variant="base" padding="sm" className="flex items-center gap-3">
          <span className="text-ash-500 text-sm">
            {tab === "active" ? "Active clubs:" : "Archived clubs:"}
          </span>
          <span className={`heading-fantasy text-lg ${tab === "active" ? "text-emerald-400" : "text-gold-400"}`}>
            {displayList.length}
          </span>
        </Panel>

        {/* Club list */}
        {displayList.length === 0 ? (
          <Panel variant="base" padding="lg" className="text-center space-y-2">
            <Building2 className="h-8 w-8 text-ash-600 mx-auto" />
            <p className="text-ash-400 text-sm">
              {tab === "active" ? "No active clubs." : "No archived clubs."}
            </p>
          </Panel>
        ) : (
          <div className="space-y-3">
            {displayList.map((club) => (
              <Panel key={club.id} variant="inventory" padding="lg">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-pixel shrink-0 mt-0.5 ${
                    tab === "active" ? "bg-emerald-500/15" : "bg-gold-500/15"
                  }`}>
                    <Building2 className={`h-5 w-5 ${tab === "active" ? "text-emerald-400" : "text-gold-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="heading-fantasy text-ash-100 text-base">{club.clubName}</h3>
                      {tab === "active"
                        ? <RuneChip tone="success" className="text-[9px]">Active</RuneChip>
                        : <RuneChip tone="warning" className="text-[9px]">Archived</RuneChip>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-ash-400 text-xs">
                      {club.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />{club.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 shrink-0" />Created {formatDate(club.createdAt)}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-ash-500">
                        <User className="h-3 w-3 shrink-0" />{club.createdBy}
                      </span>
                    </div>
                    {club.description && (
                      <p className="text-ash-500 text-xs mt-2 leading-relaxed line-clamp-2">
                        {club.description}
                      </p>
                    )}
                    <p className="text-ash-700 text-[10px] font-mono mt-2">ID: {club.id}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 shrink-0 self-start">
                    {tab === "active" && (
                      <Link href={`/clubs/manage/${club.id}`}>
                        <Button size="sm" variant="outline" className="w-full border-ember-500/40 text-ember-400 hover:bg-ember-500/10">
                          <Settings className="h-3.5 w-3.5" /> Manage
                        </Button>
                      </Link>
                    )}
                    {tab === "active" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full text-gold-400 hover:bg-gold-500/10"
                        onClick={() => setConfirm({ type: "archive", clubId: club.id, clubName: club.clubName })}
                        disabled={confirm?.clubId === club.id}
                      >
                        <Archive className="h-3.5 w-3.5" /> Archive
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full text-ash-400 hover:bg-obsidian-600"
                        onClick={() => setConfirm({ type: "archive", clubId: club.id, clubName: club.clubName })}
                        disabled={confirm?.clubId === club.id}
                        title="Re-approve to restore"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Restore
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full text-crimson-400 hover:bg-crimson-500/10"
                      onClick={() => setConfirm({ type: "delete", clubId: club.id, clubName: club.clubName })}
                      disabled={confirm?.clubId === club.id}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </main>
    </ResponsiveShell>
  );
}
