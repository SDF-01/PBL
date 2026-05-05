"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Building2,
  UserCog,
  ShieldAlert,
  ClipboardList,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  Crown,
  Megaphone,
  Send,
  Loader2,
} from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { Button } from "@/components/ui/Button";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { useToast } from "@/lib/toast-context";
import { getAdminStats, listRecentRoleEvents, type AdminStats } from "@/lib/admin/repo";
import { listAllUsers } from "@/lib/firestore/userRepo";
import { writeNotification } from "@/lib/ladder/write";
import { isFirebaseConfigured } from "@/lib/firebase";
import type { RoleEventDoc } from "@/lib/permissions/types";

const EVENT_LABELS: Record<string, string> = {
  ClubApproved: "Club approved",
  ClubRejected: "Club rejected",
  RoleAssigned: "Role assigned",
  RoleRemoved:  "Role removed",
};

const EVENT_TONES: Record<string, string> = {
  ClubApproved: "success",
  ClubRejected: "crimson",
  RoleAssigned: "rune",
  RoleRemoved:  "warning",
} as const;

function formatEventTime(ts: unknown): string {
  if (!ts) return "—";
  // Firestore Timestamps have a toDate() method; ISO strings parse directly.
  const d =
    ts && typeof ts === "object" && "toDate" in ts
      ? (ts as { toDate(): Date }).toDate()
      : new Date(ts as string);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: string;
  href?: string;
  badge?: number;
}

function StatCard({ label, value, icon, tone = "text-ash-400", href, badge }: StatCardProps) {
  const inner = (
    <Panel
      variant="raised"
      padding="md"
      className="flex items-start gap-3 h-full relative hover:border-obsidian-400 transition-colors"
    >
      <div className={`mt-0.5 shrink-0 ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <div className="font-mono text-2xl text-ash-100 tabular-nums">{value}</div>
        <div className="text-[10px] uppercase tracking-[0.15em] text-ash-500 mt-0.5">{label}</div>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-ember-500 text-[9px] font-bold text-obsidian-900 tabular-nums">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Panel>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

export default function AdminHubPage() {
  const { isSiteAdmin, clubDirectorFor, loading: permLoading } = usePermissions();
  const { toast } = useToast();
  const isStaff = isSiteAdmin || clubDirectorFor.length > 0;

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentEvents, setRecentEvents] = useState<RoleEventDoc[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceBody, setAnnounceBody] = useState("");
  const [announcing, setAnnouncing] = useState(false);

  useEffect(() => {
    if (permLoading || !isSiteAdmin || !isFirebaseConfigured()) {
      setStatsLoading(false);
      return;
    }
    Promise.all([getAdminStats(), listRecentRoleEvents(6)])
      .then(([s, events]) => {
        setStats(s);
        setRecentEvents(events);
      })
      .finally(() => setStatsLoading(false));
  }, [isSiteAdmin, permLoading]);

  async function handleAnnounce() {
    if (!announceTitle.trim() || !announceBody.trim()) {
      toast("Title and message are required.", "error");
      return;
    }
    setAnnouncing(true);
    try {
      const allUsers = await listAllUsers(1000);
      await Promise.allSettled(
        allUsers.map((u) =>
          writeNotification({
            userId: u.uid,
            title: announceTitle.trim(),
            body: announceBody.trim(),
            kind: "ANNOUNCEMENT",
            href: "/",
          }),
        ),
      );
      toast(`Platform announcement sent to ${allUsers.length} users.`, "success");
      setAnnounceTitle("");
      setAnnounceBody("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to send announcement.", "error");
    } finally {
      setAnnouncing(false);
    }
  }

  if (permLoading) {
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

  if (!isStaff) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-3xl">
          <Panel variant="quest" padding="lg" className="text-center space-y-2">
            <ShieldAlert className="h-8 w-8 text-crimson-500 mx-auto" />
            <h2 className="heading-fantasy text-ash-100 text-base">Access Denied</h2>
            <p className="text-ash-400 text-sm">Staff access required.</p>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-8 max-w-3xl">

        {/* Header */}
        <div>
          <RuneChip tone="ember" className="mb-2 inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            {isSiteAdmin ? "Site Admin" : "Staff"}
          </RuneChip>
          <h1 className="heading-fantasy text-display-md text-ash-100">Admin Control Panel</h1>
          <p className="text-ash-400 text-sm mt-1">
            Platform governance, club approvals, and role management.
          </p>
        </div>

        {/* Stats grid — site admins only */}
        {isSiteAdmin && (
          <section>
            <h2 className="heading-fantasy text-xs uppercase tracking-[0.2em] text-ash-500 mb-3">
              Platform Overview
            </h2>
            {statsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Panel key={i} variant="raised" padding="md" className="h-20 animate-pulse bg-obsidian-800" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard
                  label="Pending Clubs"
                  value={stats?.pendingClubs ?? 0}
                  icon={<Clock className="h-5 w-5" />}
                  tone="text-ember-400"
                  href="/admin/clubs"
                  badge={stats?.pendingClubs}
                />
                <StatCard
                  label="Approved Clubs"
                  value={stats?.approvedClubs ?? 0}
                  icon={<CheckCircle className="h-5 w-5" />}
                  tone="text-emerald-400"
                  href="/admin/clubs/approved"
                />
                <StatCard
                  label="Rejected Clubs"
                  value={stats?.rejectedClubs ?? 0}
                  icon={<XCircle className="h-5 w-5" />}
                  tone="text-ash-500"
                />
                <StatCard
                  label="Total Users"
                  value={stats?.totalUsers ?? 0}
                  icon={<Users className="h-5 w-5" />}
                  tone="text-spectral-400"
                  href="/admin/users"
                />
                <StatCard
                  label="Elevated Roles"
                  value={stats?.elevatedUsers ?? 0}
                  icon={<Crown className="h-5 w-5" />}
                  tone="text-gold-400"
                  href="/admin/users"
                />
              </div>
            )}
          </section>
        )}

        {/* Navigation cards */}
        <section>
          <h2 className="heading-fantasy text-xs uppercase tracking-[0.2em] text-ash-500 mb-3">
            Quick Actions
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {isSiteAdmin && (
              <>
                <Link href="/admin/clubs">
                  <Panel
                    variant="quest"
                    padding="lg"
                    className="h-full flex items-start gap-4 hover:border-ember-500/40 transition-colors cursor-pointer relative"
                  >
                    <div className="shrink-0 p-2 rounded-pixel bg-ember-500/15 text-ember-400">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="heading-fantasy text-ash-100 text-base">Club Approvals</h3>
                        <RuneChip tone="ember" className="text-[9px]">Admin</RuneChip>
                        {(stats?.pendingClubs ?? 0) > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-ember-500 px-1 text-[9px] font-bold text-obsidian-900">
                            {stats!.pendingClubs}
                          </span>
                        )}
                      </div>
                      <p className="text-ash-400 text-sm leading-relaxed">
                        Review pending club submissions. Approve or reject with reason.
                      </p>
                    </div>
                  </Panel>
                </Link>

                <Link href="/admin/clubs/approved">
                  <Panel
                    variant="quest"
                    padding="lg"
                    className="h-full flex items-start gap-4 hover:border-ember-500/40 transition-colors cursor-pointer"
                  >
                    <div className="shrink-0 p-2 rounded-pixel bg-emerald-500/15 text-emerald-400">
                      <CheckCircle className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="heading-fantasy text-ash-100 text-base">Manage Clubs</h3>
                        <RuneChip tone="ember" className="text-[9px]">Admin</RuneChip>
                      </div>
                      <p className="text-ash-400 text-sm leading-relaxed">
                        View approved clubs, their directors, and membership details.
                      </p>
                    </div>
                  </Panel>
                </Link>

                <Link href="/admin/users">
                  <Panel
                    variant="quest"
                    padding="lg"
                    className="h-full flex items-start gap-4 hover:border-ember-500/40 transition-colors cursor-pointer"
                  >
                    <div className="shrink-0 p-2 rounded-pixel bg-spectral-500/15 text-spectral-400">
                      <UserCog className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="heading-fantasy text-ash-100 text-base">Manage Users</h3>
                        <RuneChip tone="ember" className="text-[9px]">Admin</RuneChip>
                      </div>
                      <p className="text-ash-400 text-sm leading-relaxed">
                        View all users, assign roles, and manage elevated access.
                      </p>
                    </div>
                  </Panel>
                </Link>

                <Link href="/admin/audit">
                  <Panel
                    variant="quest"
                    padding="lg"
                    className="h-full flex items-start gap-4 hover:border-ember-500/40 transition-colors cursor-pointer"
                  >
                    <div className="shrink-0 p-2 rounded-pixel bg-gold-500/15 text-gold-400">
                      <ClipboardList className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="heading-fantasy text-ash-100 text-base">Audit Log</h3>
                        <RuneChip tone="ember" className="text-[9px]">Admin</RuneChip>
                      </div>
                      <p className="text-ash-400 text-sm leading-relaxed">
                        Full history of all administrative actions on the platform.
                      </p>
                    </div>
                  </Panel>
                </Link>
              </>
            )}

            {/* Staff-accessible actions */}
            <Link href="/leagues/create">
              <Panel
                variant="quest"
                padding="lg"
                className="h-full flex items-start gap-4 hover:border-ember-500/40 transition-colors cursor-pointer"
              >
                <div className="shrink-0 p-2 rounded-pixel bg-ash-700 text-ash-300">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="heading-fantasy text-ash-100 text-base mb-1">Create League</h3>
                  <p className="text-ash-400 text-sm leading-relaxed">
                    Set up a new league under one of your approved clubs.
                  </p>
                </div>
              </Panel>
            </Link>

            <Link href="/clubs/my">
              <Panel
                variant="quest"
                padding="lg"
                className="h-full flex items-start gap-4 hover:border-ember-500/40 transition-colors cursor-pointer"
              >
                <div className="shrink-0 p-2 rounded-pixel bg-ash-700 text-ash-300">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="heading-fantasy text-ash-100 text-base mb-1">My Clubs</h3>
                  <p className="text-ash-400 text-sm leading-relaxed">
                    View and manage your club submissions and directorships.
                  </p>
                </div>
              </Panel>
            </Link>
          </div>
        </section>

        {/* Platform announcement — site admins only */}
        {isSiteAdmin && (
          <section>
            <h2 className="heading-fantasy text-xs uppercase tracking-[0.2em] text-ash-500 mb-3 flex items-center gap-2">
              <Megaphone className="h-3.5 w-3.5" /> Platform Announcement
            </h2>
            <Panel variant="quest" padding="lg" className="space-y-3">
              <p className="text-ash-400 text-xs">
                Sends an in-app notification to every registered user on the platform.
              </p>
              <input
                type="text"
                placeholder="Announcement title…"
                value={announceTitle}
                onChange={(e) => setAnnounceTitle(e.target.value)}
                className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500 placeholder:text-ash-600"
              />
              <textarea
                placeholder="Message body…"
                value={announceBody}
                onChange={(e) => setAnnounceBody(e.target.value)}
                rows={3}
                className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500 placeholder:text-ash-600 resize-none"
              />
              <Button
                size="sm"
                onClick={handleAnnounce}
                disabled={announcing || !announceTitle.trim() || !announceBody.trim()}
              >
                {announcing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {announcing ? "Sending…" : "Send to All Users"}
              </Button>
            </Panel>
          </section>
        )}

        {/* Recent actions — site admins only */}
        {isSiteAdmin && !statsLoading && recentEvents.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="heading-fantasy text-xs uppercase tracking-[0.2em] text-ash-500">
                Recent Actions
              </h2>
              <Link href="/admin/audit" className="text-xs text-ember-400 hover:text-ember-300 transition-colors">
                View all →
              </Link>
            </div>
            <div className="space-y-2">
              {recentEvents.map((ev) => (
                <Panel key={ev.id} variant="inventory" padding="sm">
                  <div className="flex items-center gap-3 flex-wrap">
                    <RuneChip
                      tone={(EVENT_TONES[ev.eventType] as "success" | "crimson" | "rune" | "warning") ?? "neutral"}
                      className="text-[9px] shrink-0"
                    >
                      {EVENT_LABELS[ev.eventType] ?? ev.eventType}
                    </RuneChip>
                    <span className="text-ash-300 text-xs flex-1 truncate min-w-0">
                      {ev.notes}
                    </span>
                    <span className="text-ash-600 text-[10px] shrink-0 font-mono">
                      {formatEventTime(ev.eventTimestamp)}
                    </span>
                  </div>
                </Panel>
              ))}
            </div>
          </section>
        )}

      </main>
    </ResponsiveShell>
  );
}
