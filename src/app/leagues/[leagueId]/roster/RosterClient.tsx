"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Loader2, Users } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { SkeletonList } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getLeague, listLeagueMembers, type LeagueMemberEntry } from "@/lib/leagues/repo";
import { getPlayerProfile } from "@/lib/players/repo";
import { skillBand } from "@/lib/players/elo";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import type { LeagueDoc, PlayerProfileDoc } from "@/lib/firestore/types";

type LeagueRole = "player" | "substitute" | "captain";

const ROLE_LABELS: Record<LeagueRole, string> = {
  player: "Player",
  substitute: "Sub",
  captain: "Captain",
};

const ROLE_TONE: Record<LeagueRole, Parameters<typeof RuneChip>[0]["tone"]> = {
  player: "neutral",
  substitute: "rune",
  captain: "gold",
};

const STATUS_TONE = {
  active: "success",
  ACTIVE: "success",
  pending: "warning",
  PENDING: "warning",
  left: "neutral",
  LEFT: "neutral",
  removed: "crimson",
  REMOVED: "crimson",
} as const;

interface MemberRow extends LeagueMemberEntry {
  profile: PlayerProfileDoc | null;
}

export function RosterClient({ leagueId: propLeagueId }: { leagueId: string }) {
  return (
    <Suspense fallback={<ResponsiveShell desktopChromeless><main className="container py-10 text-ash-400">Loading…</main></ResponsiveShell>}>
      <RosterInner propLeagueId={propLeagueId} />
    </Suspense>
  );
}

function RosterInner({ propLeagueId }: { propLeagueId: string }) {
  const pathname = usePathname();
  const leagueId = propLeagueId || pathname.split("/")[2] || "";
  const { user } = useAuth();
  const { isSiteAdmin, leagueCoordinatorFor, clubDirectorFor, coordinatorClubIds, loading: permLoading } = usePermissions();

  const [league, setLeague] = useState<LeagueDoc | null>(null);
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const clubId = league?.clubId ?? league?.orgId ?? "";
  const isDirector = !permLoading && (isSiteAdmin || clubDirectorFor.includes(clubId));
  const isCoordinator = !permLoading && (leagueCoordinatorFor.includes(leagueId) || coordinatorClubIds.includes(clubId));
  const canManage = isDirector || isCoordinator;

  useEffect(() => {
    if (!leagueId) return;
    (async () => {
      try {
        const [lg, raw] = await Promise.all([
          getLeague(leagueId),
          listLeagueMembers(leagueId),
        ]);
        setLeague(lg);
        const rows = await Promise.all(
          raw.map(async (m) => {
            const profile = await getPlayerProfile(m.userId).catch(() => null);
            return { ...m, profile };
          }),
        );
        rows.sort((a, b) => {
          const aActive = a.status === "active" || a.status === "ACTIVE" ? 0 : 1;
          const bActive = b.status === "active" || b.status === "ACTIVE" ? 0 : 1;
          if (aActive !== bActive) return aActive - bActive;
          return (b.profile?.elo ?? 0) - (a.profile?.elo ?? 0);
        });
        setMembers(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load roster");
      }
    })();
  }, [leagueId]);

  async function handleRoleChange(membershipId: string, newRole: LeagueRole) {
    setUpdatingId(membershipId);
    try {
      await updateDoc(doc(db(), COLLECTIONS.leagueMemberships, membershipId), { role: newRole });
      setMembers((prev) =>
        prev ? prev.map((m) => (m.id === membershipId ? { ...m, role: newRole } : m)) : prev,
      );
    } finally {
      setUpdatingId(null);
    }
  }

  const activeCount = members?.filter((m) => m.status === "active" || m.status === "ACTIVE").length ?? 0;

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-3xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link
              href={`/leagues/${leagueId}`}
              className="text-ash-400 hover:text-ash-200 text-sm inline-flex items-center gap-1 mb-2"
            >
              <ArrowLeft className="h-4 w-4" /> League
            </Link>
            <RuneChip tone="spectral" className="mb-2 block w-fit">Roster</RuneChip>
            <h1 className="heading-fantasy text-display-md text-ash-100">
              {league?.name ?? "League Roster"}
            </h1>
            <p className="text-ash-400 text-sm mt-1">
              {activeCount} active member{activeCount !== 1 ? "s" : ""}
              {canManage && " · tap a role to change it"}
            </p>
          </div>
        </div>

        {error && (
          <Panel variant="base" padding="sm">
            <p className="text-crimson-500 text-sm">{error}</p>
          </Panel>
        )}

        {members === null ? (
          <SkeletonList count={5} />
        ) : members.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="No members yet"
            description="Players will appear here once they join this league."
          />
        ) : (
          <Panel variant="inventory" padding="md">
            {/* Table header */}
            <div className={`grid gap-2 pb-2 border-b border-obsidian-500 text-[10px] uppercase tracking-widest text-ash-600 ${canManage ? "grid-cols-[1fr_4rem_4rem_5rem_6rem]" : "grid-cols-[1fr_4rem_4rem_5rem_5rem]"}`}>
              <span>Player</span>
              <span className="text-right hidden sm:block">ELO</span>
              <span className="text-right hidden sm:block">W–L</span>
              <span className="text-right">Status</span>
              <span className="text-right">Role</span>
            </div>

            <ul className="divide-y divide-obsidian-600">
              {members.map((m) => {
                const p = m.profile;
                const band = p ? skillBand(p.elo) : null;
                const statusKey = m.status as keyof typeof STATUS_TONE;
                const role = (m.role ?? "player") as LeagueRole;
                const isMe = user?.uid === m.userId;

                return (
                  <li
                    key={m.id}
                    className={`grid gap-2 items-center py-2.5 first:pt-1 last:pb-1 ${canManage ? "grid-cols-[1fr_4rem_4rem_5rem_6rem]" : "grid-cols-[1fr_4rem_4rem_5rem_5rem]"} ${isMe ? "bg-ember-900/10 -mx-4 px-4" : ""}`}
                  >
                    {/* Player */}
                    <Link
                      href={`/players/view?uid=${m.userId}`}
                      className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
                    >
                      <div className="h-7 w-7 rounded-pixel bg-obsidian-700 border border-obsidian-500 flex items-center justify-center text-xs text-ash-500 shrink-0">
                        {(p?.displayName ?? m.displayName ?? "?").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className={`text-sm truncate ${isMe ? "text-ember-300 font-medium" : "text-ash-100"}`}>
                          {p?.displayName ?? m.displayName ?? m.userId.slice(0, 8)}
                          {isMe && <span className="ml-1 text-[10px] text-ember-500">you</span>}
                        </div>
                        {band && (
                          <RuneChip tone="neutral" className="text-[9px] mt-0.5">{band}</RuneChip>
                        )}
                      </div>
                    </Link>

                    {/* ELO */}
                    <span className="text-right heading-fantasy text-sm text-ash-300 hidden sm:block">
                      {p?.elo ?? "—"}
                    </span>

                    {/* W–L */}
                    <span className="text-right text-[11px] text-ash-500 font-mono hidden sm:block">
                      {p ? `${p.stats.wins}–${p.stats.losses}` : "—"}
                    </span>

                    {/* Status */}
                    <div className="flex justify-end">
                      <RuneChip
                        tone={STATUS_TONE[statusKey] ?? "neutral"}
                        className="text-[9px]"
                      >
                        {m.status.toLowerCase()}
                      </RuneChip>
                    </div>

                    {/* Role */}
                    <div className="flex justify-end">
                      {canManage ? (
                        updatingId === m.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-ember-400" />
                        ) : (
                          <select
                            value={role}
                            onChange={(e) => handleRoleChange(m.id, e.target.value as LeagueRole)}
                            className="rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-200 text-xs px-1.5 py-1 focus:outline-none focus:border-ember-500 max-w-[5.5rem]"
                          >
                            {(Object.keys(ROLE_LABELS) as LeagueRole[]).map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                        )
                      ) : (
                        <RuneChip tone={ROLE_TONE[role]} className="text-[9px]">
                          {ROLE_LABELS[role]}
                        </RuneChip>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}

        {canManage && members !== null && members.length > 0 && (
          <Panel variant="base" padding="md" className="flex flex-wrap gap-4 text-xs text-ash-400">
            <p className="w-full text-ash-500 text-[10px] uppercase tracking-wider mb-1">Role legend</p>
            {(Object.keys(ROLE_LABELS) as LeagueRole[]).map((r) => (
              <div key={r} className="flex items-center gap-1.5">
                <RuneChip tone={ROLE_TONE[r]} className="text-[9px]">{ROLE_LABELS[r]}</RuneChip>
                <span className="text-ash-500">{r === "player" ? "default — all new joins" : r === "substitute" ? "fill-in player" : "team captain"}</span>
              </div>
            ))}
          </Panel>
        )}
      </main>
    </ResponsiveShell>
  );
}
