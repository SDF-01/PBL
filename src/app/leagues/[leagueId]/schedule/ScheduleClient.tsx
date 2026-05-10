"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, CalendarRange, History, Loader2, RefreshCw, RotateCcw, Swords } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { listLeagueMembers, getLeague } from "@/lib/leagues/repo";
import {
  listScheduleMatches,
  generateLeagueSchedule,
  listScheduleSnapshots,
  restoreScheduleSnapshot,
  type ScheduleSnapshot,
} from "@/lib/leagues/schedule";
import { getPlayerProfile } from "@/lib/players/repo";
import type { LeagueDoc, LeagueScheduleMatchDoc } from "@/lib/firestore/types";

interface Props {
  leagueId: string;
}

export function ScheduleClient({ leagueId: propLeagueId }: Props) {
  const pathname = usePathname();
  const pathnameSegment = pathname.split("/")[2];
  const leagueId =
    pathnameSegment && pathnameSegment !== "__fallback"
      ? pathnameSegment
      : propLeagueId;

  const { user } = useAuth();
  const { isSiteAdmin, leagueCoordinatorFor } = usePermissions();
  const canManage =
    isSiteAdmin || leagueCoordinatorFor.includes(leagueId);

  const [league, setLeague] = useState<LeagueDoc | null>(null);
  const [matches, setMatches] = useState<LeagueScheduleMatchDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<ScheduleSnapshot[]>([]);
  const [snapshotsLoaded, setSnapshotsLoaded] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listScheduleMatches(leagueId), getLeague(leagueId)])
      .then(([m, l]) => {
        setMatches(m);
        setLeague(l);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load."))
      .finally(() => setLoading(false));
  }, [leagueId]);

  async function ensureSnapshotsLoaded() {
    if (snapshotsLoaded) return;
    try {
      const rows = await listScheduleSnapshots(leagueId);
      setSnapshots(rows);
    } finally {
      setSnapshotsLoaded(true);
    }
  }

  async function handleGenerate() {
    if (!canManage || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const members = await listLeagueMembers(leagueId);
      const active = members.filter((m) => m.status === "active");

      const players = await Promise.all(
        active.map(async (m) => {
          const profile = await getPlayerProfile(m.userId).catch(() => null);
          return {
            userId: m.userId,
            displayName: profile?.displayName ?? m.displayName ?? m.userId.slice(0, 8),
          };
        }),
      );

      const created = await generateLeagueSchedule(leagueId, players);
      setMatches(created);
      // Force snapshot list refresh on next open
      setSnapshotsLoaded(false);
      setSnapshots([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate schedule.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRestore(snapshotId: string) {
    if (!canManage) return;
    setRestoringId(snapshotId);
    setError(null);
    try {
      const restored = await restoreScheduleSnapshot(leagueId, snapshotId);
      setMatches(restored);
      setSnapshotsLoaded(false);
      setSnapshots([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed.");
    } finally {
      setRestoringId(null);
    }
  }

  const completedCount = matches.filter((m) => m.status === "COMPLETED").length;
  const hasPlayedMatches = completedCount > 0;

  const rounds = new Map<number, LeagueScheduleMatchDoc[]>();
  for (const m of matches) {
    if (!rounds.has(m.round)) rounds.set(m.round, []);
    rounds.get(m.round)!.push(m);
  }
  const sortedRounds = Array.from(rounds.entries()).sort(([a], [b]) => a - b);

  return (
    <>
      {confirmRegenerate && (
        <RegenerateConfirmDialog
          matchCount={matches.length}
          completedCount={completedCount}
          leagueName={league?.name ?? ""}
          submitting={generating}
          onConfirm={async () => {
            setConfirmRegenerate(false);
            await handleGenerate();
          }}
          onCancel={() => setConfirmRegenerate(false)}
        />
      )}
      <ResponsiveShell desktopChromeless>
        <main className="container py-6 md:py-10 space-y-6 max-w-3xl">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Link
              href={`/leagues/${leagueId}`}
              className="text-ash-400 hover:text-ash-200 text-sm inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" /> League
            </Link>
            {canManage && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={ensureSnapshotsLoaded}
                  disabled={generating}
                >
                  <History className="h-3.5 w-3.5" /> History
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() =>
                    matches.length > 0 ? setConfirmRegenerate(true) : handleGenerate()
                  }
                  disabled={generating}
                >
                  {generating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {matches.length > 0 ? "Regenerate" : "Generate Schedule"}
                </Button>
              </div>
            )}
          </div>

          <header>
            <RuneChip tone="spectral" className="mb-2 inline-flex items-center gap-1">
              <CalendarRange className="h-3 w-3" /> Round-Robin Schedule
            </RuneChip>
            <h1 className="heading-fantasy text-display-md text-ash-100">
              League Schedule
            </h1>
            <p className="text-sm text-ash-400 mt-1">
              Every player faces every other player once.
              {hasPlayedMatches && (
                <span className="ml-2 text-gold-400">
                  {completedCount} match{completedCount === 1 ? "" : "es"} already played.
                </span>
              )}
            </p>
          </header>

          {error && (
            <Panel variant="base" padding="md">
              <p className="text-crimson-400 text-sm">{error}</p>
            </Panel>
          )}

          {canManage && snapshotsLoaded && (
            <Panel variant="inventory" padding="md" className="space-y-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-spectral-400" />
                <h2 className="heading-fantasy text-ash-100 text-sm">Schedule history</h2>
              </div>
              {snapshots.length === 0 ? (
                <p className="text-ash-500 text-xs">
                  No prior schedules. Snapshots are taken automatically before each regeneration.
                </p>
              ) : (
                <ul className="divide-y divide-obsidian-600">
                  {snapshots.map((snap) => (
                    <li
                      key={snap.id}
                      className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-ash-200 text-sm font-mono truncate">
                          {snap.snapshotAt
                            ? new Date(snap.snapshotAt).toLocaleString()
                            : snap.id}
                        </p>
                        <p className="text-ash-500 text-[11px]">
                          {snap.matchCount} matches · {snap.completedCount} completed
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestore(snap.id)}
                        disabled={restoringId === snap.id}
                      >
                        {restoringId === snap.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        Restore
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {loading ? (
            <Panel variant="base" padding="md" className="text-center text-ash-500 text-sm py-10">
              Loading schedule…
            </Panel>
          ) : matches.length === 0 ? (
            <Panel variant="quest" padding="lg" className="text-center space-y-3">
              <CalendarRange className="mx-auto h-10 w-10 text-ash-600" />
              <p className="text-ash-400 text-sm">
                No schedule yet.{" "}
                {canManage
                  ? 'Click "Generate Schedule" to create round-robin pairings for all active members.'
                  : "A league coordinator will generate the schedule soon."}
              </p>
            </Panel>
          ) : (
            <div className="space-y-5">
              {sortedRounds.map(([round, roundMatches]) => (
                <section key={round}>
                  <h2 className="heading-fantasy text-xs uppercase tracking-[0.2em] text-ash-500 mb-2">
                    Round {round}
                  </h2>
                  <div className="space-y-2">
                    {roundMatches.map((m) => (
                      <MatchRow key={m.id} match={m} viewerId={user?.uid} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </main>
      </ResponsiveShell>
    </>
  );
}

function RegenerateConfirmDialog({
  matchCount,
  completedCount,
  leagueName,
  submitting,
  onConfirm,
  onCancel,
}: {
  matchCount: number;
  completedCount: number;
  leagueName: string;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Strict mode: any completed match means we require the league name typed verbatim.
  const requiresTypedName = completedCount > 0 && leagueName.trim().length > 0;
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === leagueName.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80 backdrop-blur-sm p-4">
      <div className="max-w-md w-full bg-obsidian-900 border border-crimson-500/40 rounded-pixel p-5 space-y-4">
        <div>
          <h2 className="heading-fantasy text-ash-100 text-lg">Regenerate schedule?</h2>
          <p className="text-ash-400 text-sm mt-2">
            This will delete all {matchCount} existing matches and create fresh
            round-robin pairings. The current schedule is snapshotted first, so
            you can restore it from the History panel.
          </p>
          {completedCount > 0 && (
            <p className="text-crimson-300 text-sm mt-2">
              <strong>{completedCount}</strong> match{completedCount === 1 ? " has" : "es have"} already
              been completed and will be lost from the live schedule.
            </p>
          )}
        </div>
        {requiresTypedName && (
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.15em] text-ash-500">
              Type the league name to confirm
            </p>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={leagueName}
              className="w-full bg-obsidian-950 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
            />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={onConfirm}
            disabled={submitting || (requiresTypedName && !matches)}
            className="text-crimson-100"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Regenerate
          </Button>
        </div>
      </div>
    </div>
  );
}

function MatchRow({
  match,
  viewerId,
}: {
  match: LeagueScheduleMatchDoc;
  viewerId?: string;
}) {
  const isCompleted = match.status === "COMPLETED";
  const isForfeit = match.status === "FORFEIT";
  const isViewer = viewerId === match.playerAId || viewerId === match.playerBId;

  return (
    <Panel
      variant={isViewer ? "quest" : "base"}
      padding="md"
      className="flex items-center gap-3 flex-wrap"
    >
      <Swords className="h-4 w-4 text-ember-500/60 shrink-0" />

      <div className="flex-1 flex items-center gap-2 min-w-0 flex-wrap">
        <Link
          href={`/players/view?uid=${match.playerAId}`}
          className="text-ash-100 hover:text-spectral-400 font-mono text-sm truncate"
        >
          {match.playerAName}
        </Link>
        <span className="text-ash-600 text-xs">vs</span>
        <Link
          href={`/players/view?uid=${match.playerBId}`}
          className="text-ash-100 hover:text-spectral-400 font-mono text-sm truncate"
        >
          {match.playerBName}
        </Link>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isCompleted && match.scoreA !== undefined && match.scoreB !== undefined && (
          <span className="text-ash-300 font-mono text-sm">
            {match.scoreA}–{match.scoreB}
          </span>
        )}
        <RuneChip
          tone={isCompleted ? "ember" : isForfeit ? "neutral" : "neutral"}
          className="text-[10px]"
        >
          {match.status}
        </RuneChip>
      </div>
    </Panel>
  );
}
