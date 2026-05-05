"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle,
  ClipboardList,
  Clock,
  Crown,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { getAdminStats, type AdminStats } from "@/lib/admin/repo";
import { isFirebaseConfigured } from "@/lib/firebase";
import type {
  LadderSeasonDoc,
  PlayDateDoc,
  LadderSessionDoc,
} from "@/lib/firestore/types";

export interface AdminDashboardProps {
  currentSeason?: LadderSeasonDoc;
  upcomingPlayDates: PlayDateDoc[];
  selectedPlayDate?: PlayDateDoc;
  onSelectPlayDate: (pd: PlayDateDoc) => void;
  onCreateSeason: () => void;
  onCreatePlayDate: () => void;
  onReviewAttendance: (pd: PlayDateDoc) => void;
  onGenerateSession: (pd: PlayDateDoc) => void;
  onMonitorSession: (session: LadderSessionDoc) => void;
  onFinalizeSession: (session: LadderSessionDoc) => void;
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: string;
  href?: string;
  badge?: number;
}

interface ActionCardProps {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconClassName: string;
  admin?: boolean;
  badge?: number;
}

export function AdminDashboard(_props: AdminDashboardProps) {
  const { isSiteAdmin, clubDirectorFor, leagueCoordinatorFor, coordinatorClubIds, loading } =
    usePermissions();
  const isStaff =
    isSiteAdmin ||
    clubDirectorFor.length > 0 ||
    leagueCoordinatorFor.length > 0 ||
    coordinatorClubIds.length > 0;

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (loading || !isSiteAdmin || !isFirebaseConfigured()) {
      setStatsLoading(false);
      return;
    }

    getAdminStats()
      .then(setStats)
      .finally(() => setStatsLoading(false));
  }, [isSiteAdmin, loading]);

  if (loading) {
    return (
      <Panel variant="base" padding="lg" className="max-w-3xl text-center text-sm text-ash-500">
        Loading...
      </Panel>
    );
  }

  if (!isStaff) {
    return (
      <Panel variant="quest" padding="lg" className="max-w-3xl space-y-2 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-crimson-500" />
        <h2 className="heading-fantasy text-base text-ash-100">Access Denied</h2>
        <p className="text-sm text-ash-400">Staff access required.</p>
      </Panel>
    );
  }

  return (
    <div className="w-full max-w-[920px] space-y-8">
      <header>
        <RuneChip tone="ember" className="mb-3 inline-flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" />
          {isSiteAdmin ? "Site Admin" : "Staff"}
        </RuneChip>
        <h1 className="heading-fantasy text-display-md text-ash-100">
          Admin Control Panel
        </h1>
        <p className="mt-1 text-sm text-ash-400">
          Platform governance, club approvals, and role management.
        </p>
      </header>

      {isSiteAdmin && (
        <section>
          <h2 className="heading-fantasy mb-3 text-xs uppercase tracking-[0.2em] text-ash-500">
            Platform Overview
          </h2>
          {statsLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Panel
                  key={index}
                  variant="raised"
                  padding="md"
                  className="h-[104px] animate-pulse bg-obsidian-800"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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

      <section>
        <h2 className="heading-fantasy mb-3 text-xs uppercase tracking-[0.2em] text-ash-500">
          Quick Actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {isSiteAdmin && (
            <>
              <ActionCard
                href="/admin/clubs"
                title="Club Approvals"
                description="Review pending club submissions. Approve or reject with reason."
                icon={<Building2 className="h-6 w-6" />}
                iconClassName="bg-ember-500/15 text-ember-400"
                admin
                badge={stats?.pendingClubs}
              />
              <ActionCard
                href="/admin/clubs/approved"
                title="Manage Clubs"
                description="View approved clubs, their directors, and membership details."
                icon={<CheckCircle className="h-6 w-6" />}
                iconClassName="bg-emerald-500/15 text-emerald-400"
                admin
              />
              <ActionCard
                href="/admin/users"
                title="Manage Users"
                description="View all users, assign roles, and manage elevated access."
                icon={<UserCog className="h-6 w-6" />}
                iconClassName="bg-spectral-500/15 text-spectral-400"
                admin
              />
              <ActionCard
                href="/admin/audit"
                title="Audit Log"
                description="Full history of all administrative actions on the platform."
                icon={<ClipboardList className="h-6 w-6" />}
                iconClassName="bg-gold-500/15 text-gold-400"
                admin
              />
            </>
          )}

          <ActionCard
            href="/leagues/create"
            title="Create League"
            description="Set up a new league under one of your approved clubs."
            icon={<ClipboardList className="h-6 w-6" />}
            iconClassName="bg-ash-700 text-ash-300"
          />
          <ActionCard
            href="/clubs/my"
            title="My Clubs"
            description="View and manage your club submissions and directorships."
            icon={<Building2 className="h-6 w-6" />}
            iconClassName="bg-ash-700 text-ash-300"
          />
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, icon, tone, href, badge }: StatCardProps) {
  const inner = (
    <Panel
      variant="raised"
      padding="md"
      className="relative flex h-full min-h-[104px] items-start gap-3 hover:border-obsidian-400 transition-colors"
    >
      <div className={`mt-1 shrink-0 ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <div className="font-mono text-2xl tabular-nums text-ash-100">{value}</div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-ash-500">
          {label}
        </div>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-ember-500 px-1 text-[9px] font-bold tabular-nums text-obsidian-900">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Panel>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function ActionCard({
  href,
  title,
  description,
  icon,
  iconClassName,
  admin,
  badge,
}: ActionCardProps) {
  return (
    <Link href={href} className="block h-full">
      <Panel
        variant="quest"
        padding="lg"
        className="relative flex h-full min-h-[126px] cursor-pointer items-start gap-4 hover:border-ember-500/40 transition-colors"
      >
        <div className={`shrink-0 rounded-pixel p-2 ${iconClassName}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="heading-fantasy text-base text-ash-100">{title}</h3>
            {admin && (
              <RuneChip tone="ember" className="text-[9px]">
                Admin
              </RuneChip>
            )}
            {badge !== undefined && badge > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-ember-500 px-1 text-[9px] font-bold tabular-nums text-obsidian-900">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-ash-400">{description}</p>
        </div>
      </Panel>
    </Link>
  );
}
