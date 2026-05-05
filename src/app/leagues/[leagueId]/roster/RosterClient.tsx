"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { SkeletonList } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getLeague, listLeagueMembers, type LeagueMemberEntry } from "@/lib/leagues/repo";
import { getPlayerProfile } from "@/lib/players/repo";
import { skillBand } from "@/lib/players/elo";
import { usePermissions } from "@/lib/permissions/usePermissions";
import type { LeagueDoc, PlayerProfileDoc } from "@/lib/firestore/types";

interface MemberRow extends LeagueMemberEntry {
  profile: PlayerProfileDoc | null;
}

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
  const { isSiteAdmin, leagueCoordinatorFor, clubDirectorFor } = usePermissions();
  const canManage =
    isSiteAdmin ||
    leagueCoordinatorFor.includes(leagueId) ||
    clubDirectorFor.length > 0;

  const [league, setLeague] = useState<LeagueDoc | null>(null);
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            <div className="grid grid-cols-[auto_4rem_4rem_5rem] gap-2 pb-2 border-b border-obsidian-500 text-[10px] uppercase tracking-widest text-ash-600">
              <span>Player</span>
              <span className="text-right hidden sm:block">ELO</span>
              <span className="text-right hidden sm:block">W–L</span>
              <span className="text-right">Status</span>
            </div>
            <ul className="divide-y divide-obsidian-600">
              {members.map((m) => {
                const p = m.profile;
                const band = p ? skillBand(p.elo) : null;
                const statusKey = m.status as keyof typeof STATUS_TONE;
                return (
                  <li
                    key={m.id}
                    className="grid grid-cols-[auto_4rem_4rem_5rem] gap-2 items-center py-2.5 first:pt-1 last:pb-1"
                  >
                    <Link
                      href={`/players/view?uid=${m.userId}`}
                      className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
                    >
                      <div className="h-7 w-7 rounded-pixel bg-obsidian-700 border border-obsidian-500 flex items-center justify-center text-xs text-ash-500 shrink-0">
                        {(m.profile?.displayName ?? m.displayName ?? "?").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-ash-100 truncate">
                          {p?.displayName ?? m.displayName ?? m.userId.slice(0, 8)}
                        </div>
                        {band && (
                          <RuneChip tone="neutral" className="text-[9px] mt-0.5">{band}</RuneChip>
                        )}
                      </div>
                    </Link>

                    <span className="text-right heading-fantasy text-sm text-ash-300 hidden sm:block">
                      {p?.elo ?? "—"}
                    </span>

                    <span className="text-right text-[11px] text-ash-500 font-mono hidden sm:block">
                      {p ? `${p.stats.wins}–${p.stats.losses}` : "—"}
                    </span>

                    <div className="flex justify-end">
                      <RuneChip
                        tone={STATUS_TONE[statusKey] ?? "neutral"}
                        className="text-[9px]"
                      >
                        {m.status.toLowerCase()}
                      </RuneChip>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}

        {canManage && (
          <Panel variant="base" padding="md">
            <p className="text-ash-400 text-xs">
              Coordinator view — manage memberships and seeding from the league settings.
            </p>
          </Panel>
        )}
      </main>
    </ResponsiveShell>
  );
}
