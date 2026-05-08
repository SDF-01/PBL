"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Crown,
  Loader2,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { SkeletonCard } from "@/components/ui/Skeleton";
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

interface MemberRow extends LeagueMemberEntry {
  profile: PlayerProfileDoc | null;
}

const isActive = (m: MemberRow) =>
  m.status === "active" || m.status === "ACTIVE";

export function RosterClient({ leagueId: propLeagueId }: { leagueId: string }) {
  return (
    <Suspense
      fallback={
        <ResponsiveShell desktopChromeless>
          <main className="container py-10 text-ash-400">Loading…</main>
        </ResponsiveShell>
      }
    >
      <RosterInner propLeagueId={propLeagueId} />
    </Suspense>
  );
}

function RosterInner({ propLeagueId }: { propLeagueId: string }) {
  const pathname = usePathname();
  const pathnameSegment = pathname.split("/")[2];
  const leagueId =
    pathnameSegment && pathnameSegment !== "__fallback"
      ? pathnameSegment
      : propLeagueId;
  const { user } = useAuth();
  const {
    isSiteAdmin,
    leagueCoordinatorFor,
    clubDirectorFor,
    coordinatorClubIds,
    loading: permLoading,
  } = usePermissions();

  const [league, setLeague] = useState<LeagueDoc | null>(null);
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const clubId = league?.clubId ?? league?.orgId ?? "";
  const isDirector =
    !permLoading && (isSiteAdmin || clubDirectorFor.includes(clubId));
  const isCoordinator =
    !permLoading &&
    (leagueCoordinatorFor.includes(leagueId) ||
      coordinatorClubIds.includes(clubId));
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
          // Captains first, then by ELO descending
          const roleRank = (r: string | undefined) =>
            r === "captain" ? 0 : r === "substitute" ? 2 : 1;
          const rankDiff = roleRank(a.role) - roleRank(b.role);
          if (rankDiff !== 0) return rankDiff;
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
      await updateDoc(
        doc(db(), COLLECTIONS.leagueMemberships, membershipId),
        { role: newRole },
      );
      setMembers((prev) =>
        prev
          ? prev.map((m) =>
              m.id === membershipId ? { ...m, role: newRole } : m,
            )
          : prev,
      );
    } finally {
      setUpdatingId(null);
    }
  }

  const enrolled = members?.filter(isActive) ?? [];
  const others = members?.filter((m) => !isActive(m)) ?? [];
  const displayed = showAll ? (members ?? []) : enrolled;
  const totalCount = members?.length ?? 0;

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link
              href={`/leagues/${leagueId}`}
              className="text-ash-400 hover:text-ash-200 text-sm inline-flex items-center gap-1 mb-3"
            >
              <ArrowLeft className="h-4 w-4" /> League
            </Link>
            <RuneChip tone="spectral" className="mb-2 flex w-fit items-center gap-1">
              <Users className="h-3 w-3" /> Roster
            </RuneChip>
            <h1 className="heading-fantasy text-display-md text-ash-100">
              {league?.name ?? "League Roster"}
            </h1>
            <p className="text-ash-400 text-sm mt-1">
              <span className="text-spectral-400 heading-fantasy">{enrolled.length}</span>
              {" "}enrolled player{enrolled.length !== 1 ? "s" : ""}
              {totalCount > enrolled.length && (
                <span className="text-ash-600"> · {totalCount} total</span>
              )}
            </p>
          </div>

          {canManage && others.length > 0 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="text-xs text-ash-500 hover:text-ash-200 border border-obsidian-500 rounded-pixel px-3 py-1.5 transition-colors mt-auto"
            >
              {showAll ? "Show enrolled only" : `Show all (${totalCount})`}
            </button>
          )}
        </div>

        {error && (
          <Panel variant="base" padding="sm">
            <p className="text-crimson-500 text-sm">{error}</p>
          </Panel>
        )}

        {/* Loading */}
        {members === null ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} className="h-20" />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <Panel variant="quest" padding="lg" className="text-center space-y-3">
            <Users className="mx-auto h-10 w-10 text-ash-600" />
            <p className="heading-fantasy text-ash-100">No enrolled players yet</p>
            <p className="text-ash-400 text-sm">
              Players will appear here once they join this league.
            </p>
            <Link
              href={`/leagues/${leagueId}`}
              className="text-spectral-500 hover:text-spectral-400 text-sm"
            >
              ← Back to league
            </Link>
          </Panel>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {displayed.map((m, idx) => (
              <PlayerCard
                key={m.id}
                m={m}
                rank={idx + 1}
                isMe={user?.uid === m.userId}
                canManage={canManage}
                updatingId={updatingId}
                onRoleChange={handleRoleChange}
                showAll={showAll}
              />
            ))}
          </div>
        )}

        {/* Role legend for coordinators */}
        {canManage && members !== null && members.length > 0 && (
          <Panel variant="base" padding="md" className="flex flex-wrap gap-4 text-xs text-ash-400">
            <p className="w-full text-ash-500 text-[10px] uppercase tracking-wider">
              Role legend · tap role to change
            </p>
            {(Object.keys(ROLE_LABELS) as LeagueRole[]).map((r) => (
              <div key={r} className="flex items-center gap-1.5">
                <RuneChip tone={ROLE_TONE[r]} className="text-[9px]">
                  {ROLE_LABELS[r]}
                </RuneChip>
                <span className="text-ash-500">
                  {r === "player"
                    ? "default"
                    : r === "substitute"
                    ? "fill-in"
                    : "team captain"}
                </span>
              </div>
            ))}
          </Panel>
        )}
      </main>
    </ResponsiveShell>
  );
}

function PlayerCard({
  m,
  rank,
  isMe,
  canManage,
  updatingId,
  onRoleChange,
  showAll,
}: {
  m: MemberRow;
  rank: number;
  isMe: boolean;
  canManage: boolean;
  updatingId: string | null;
  onRoleChange: (id: string, role: LeagueRole) => void;
  showAll: boolean;
}) {
  const p = m.profile;
  const band = p ? skillBand(p.elo) : null;
  const role = (m.role ?? "player") as LeagueRole;
  const active = isActive(m);
  const winRate =
    p && p.stats.matches > 0
      ? Math.round((p.stats.wins / p.stats.matches) * 100)
      : null;

  return (
    <Panel
      variant={isMe ? "quest" : "inventory"}
      padding="md"
      className={`flex gap-3 items-start transition-colors ${!active ? "opacity-50" : ""}`}
    >
      {/* Rank number */}
      <div className="shrink-0 w-6 text-center">
        {role === "captain" ? (
          <Crown className="h-4 w-4 text-gold-400 mx-auto mt-1" />
        ) : (
          <span className="text-ash-600 font-mono text-xs leading-7">{rank}</span>
        )}
      </div>

      {/* Avatar — clickable */}
      <Link
        href={`/players/view?uid=${m.userId}`}
        className="shrink-0 hover:opacity-80 transition-opacity"
        tabIndex={-1}
        aria-hidden
      >
        {p?.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.photoURL}
            alt=""
            className="h-11 w-11 rounded-pixel object-cover border border-obsidian-400"
          />
        ) : (
          <div className="h-11 w-11 rounded-pixel bg-obsidian-700 border border-obsidian-500 flex items-center justify-center heading-fantasy text-lg text-ash-400">
            {(p?.displayName ?? m.displayName ?? "?").slice(0, 1).toUpperCase()}
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/players/view?uid=${m.userId}`}
          className="hover:text-spectral-400 transition-colors"
        >
          <p className={`text-sm font-medium truncate ${isMe ? "text-ember-300" : "text-ash-100"}`}>
            {p?.displayName ?? m.displayName ?? m.userId.slice(0, 8)}
            {isMe && <span className="ml-1.5 text-[10px] text-ember-500">you</span>}
          </p>
        </Link>

        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          {band && (
            <RuneChip tone="neutral" className="text-[9px]">{band}</RuneChip>
          )}
          {showAll && !active && (
            <RuneChip tone="neutral" className="text-[9px]">{m.status}</RuneChip>
          )}
        </div>

        {/* Stats row */}
        {p && (
          <div className="flex items-center gap-3 mt-1.5 text-[11px] font-mono text-ash-500">
            <span className="flex items-center gap-1">
              <Trophy className="h-3 w-3 text-gold-500/70" />
              {p.elo}
            </span>
            <span>
              {p.stats.wins}W–{p.stats.losses}L
            </span>
            {winRate !== null && (
              <span className={winRate >= 50 ? "text-ember-400" : ""}>
                {winRate}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Role control */}
      <div className="shrink-0 flex items-start pt-0.5">
        {canManage ? (
          updatingId === m.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-ember-400" />
          ) : (
            <select
              value={role}
              onChange={(e) => onRoleChange(m.id, e.target.value as LeagueRole)}
              className="rounded-pixel bg-obsidian-800 border border-obsidian-500 text-ash-300 text-[11px] px-1.5 py-1 focus:outline-none focus:border-ember-500"
            >
              {(Object.keys(ROLE_LABELS) as LeagueRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          )
        ) : (
          <RuneChip tone={ROLE_TONE[role]} className="text-[9px]">
            {ROLE_LABELS[role]}
          </RuneChip>
        )}
      </div>
    </Panel>
  );
}
