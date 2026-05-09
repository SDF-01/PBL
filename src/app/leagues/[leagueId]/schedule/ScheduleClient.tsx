"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, CalendarRange, Loader2, RefreshCw, Swords } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RuneChip } from "@/components/ui/RuneChip";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { listLeagueMembers } from "@/lib/leagues/repo";
import { listScheduleMatches, generateLeagueSchedule } from "@/lib/leagues/schedule";
import { getPlayerProfile } from "@/lib/players/repo";
import type { LeagueScheduleMatchDoc } from "@/lib/firestore/types";

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

  const [matches, setMatches] = useState<LeagueScheduleMatchDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listScheduleMatches(leagueId)
      .then(setMatches)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load."))
      .finally(() => setLoading(false));
  }, [leagueId]);

  async function handleGenerate() {
    if (!canManage || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const members = await listLeagueMembers(leagueId);
      const active = members.filter((m) => m.status === "active");

      // Enrich with display names from player profiles (best-effort)
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate schedule.");
    } finally {
      setGenerating(false);
    }
  }

  // Group matches by round
  const rounds = new Map<number, LeagueScheduleMatchDoc[]>();
  for (const m of matches) {
    if (!rounds.has(m.round)) rounds.set(m.round, []);
    rounds.get(m.round)!.push(m);
  }
  const sortedRounds = Array.from(rounds.entries()).sort(([a], [b]) => a - b);

  return (
    <>
    {confirmRegenerate && (
      <ConfirmDialog
        title="Regenerate Schedule?"
        description={`This will delete all ${matches.length} existing matches and create fresh round-robin pairings. Match results will be lost.`}
        confirmLabel="Regenerate"
        variant="danger"
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
          </p>
        </header>

        {error && (
          <Panel variant="base" padding="md">
            <p className="text-crimson-400 text-sm">{error}</p>
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
