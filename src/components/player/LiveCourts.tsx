"use client";

import { Users } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import type { LadderCourtDoc, LadderMatchDoc } from "@/lib/firestore/types";

interface LiveCourtsProps {
  courts: LadderCourtDoc[];
  matches: LadderMatchDoc[];
  currentPlayerId?: string;
}

function currentRoundForCourt(
  courtId: string,
  matches: LadderMatchDoc[],
): LadderMatchDoc | undefined {
  const courtMatches = matches
    .filter((m) => m.courtId === courtId)
    .sort((a, b) => a.gameNumber - b.gameNumber);
  return (
    courtMatches.find((m) => m.status === "SCHEDULED" || m.status === "SUBMITTED") ??
    courtMatches[courtMatches.length - 1]
  );
}

const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "rune"> = {
  SCHEDULED: "rune",
  SUBMITTED: "warning",
  AWAITING_VERIFICATION: "warning",
  VERIFIED: "success",
  DISPUTED: "danger" as "neutral",
  ADMIN_ASSIGNED: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Playing",
  SUBMITTED: "Awaiting verify",
  AWAITING_VERIFICATION: "Awaiting verify",
  VERIFIED: "Done",
  DISPUTED: "Disputed",
  ADMIN_ASSIGNED: "Admin assigned",
};

export function LiveCourts({ courts, matches, currentPlayerId }: LiveCourtsProps) {
  if (courts.length === 0) {
    return (
      <Panel variant="base" padding="md" className="text-center text-ash-500 text-sm">
        No courts generated yet.
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      {courts.map((court) => {
        const round = currentRoundForCourt(court.id, matches);
        const isMyC = court.playerIds.includes(currentPlayerId ?? "");
        const completedGames = matches.filter(
          (m) => m.courtId === court.id && (m.status === "VERIFIED" || m.status === "ADMIN_ASSIGNED"),
        ).length;
        const totalGames = matches.filter((m) => m.courtId === court.id).length;

        return (
          <Panel
            key={court.id}
            variant={isMyC ? "quest" : "inventory"}
            padding="md"
            className={isMyC ? "border-ember-500/50" : ""}
          >
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-pixel bg-obsidian-700 border border-obsidian-500 flex items-center justify-center heading-fantasy text-sm text-ember-400">
                  {court.courtNumber}
                </div>
                <div>
                  <span className="heading-fantasy text-ash-100 text-sm">Court {court.courtNumber}</span>
                  {isMyC && <RuneChip tone="ember" className="ml-2 text-[9px]">Your court</RuneChip>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {round && (
                  <RuneChip
                    tone={(STATUS_TONE[round.status] as any) ?? "neutral"}
                    className="text-[9px]"
                  >
                    {STATUS_LABEL[round.status] ?? round.status}
                  </RuneChip>
                )}
                {totalGames > 0 && (
                  <span className="text-[10px] text-ash-500 font-mono">
                    {completedGames}/{totalGames} games
                  </span>
                )}
              </div>
            </div>

            {round ? (
              <div className="grid grid-cols-3 gap-2 items-center">
                <PlayerSide
                  playerIds={round.sideA}
                  currentPlayerId={currentPlayerId}
                  score={round.scoreA}
                />
                <div className="text-center">
                  <p className="heading-fantasy text-ash-500 text-xs">vs</p>
                  <p className="text-ash-600 text-[10px] font-mono">game {round.gameNumber}</p>
                </div>
                <PlayerSide
                  playerIds={round.sideB}
                  currentPlayerId={currentPlayerId}
                  score={round.scoreB}
                  reverse
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-ash-500 text-sm">
                <Users className="h-4 w-4 shrink-0" />
                <span>{court.playerIds.length} players assigned</span>
              </div>
            )}

            {round?.sittingOut && (
              <p className="mt-2 text-[10px] text-ash-600 font-mono">
                Sitting out:{" "}
                <span className={round.sittingOut === currentPlayerId ? "text-ember-400 font-bold" : "text-ash-400"}>
                  {round.sittingOut === currentPlayerId ? "You" : round.sittingOut.slice(0, 8) + "…"}
                </span>
              </p>
            )}
          </Panel>
        );
      })}
    </div>
  );
}

function PlayerSide({
  playerIds,
  currentPlayerId,
  score,
  reverse,
}: {
  playerIds: readonly string[];
  currentPlayerId?: string;
  score?: number;
  reverse?: boolean;
}) {
  const names = playerIds.map((id) =>
    id === currentPlayerId ? "You" : id.slice(0, 8) + "…",
  );

  return (
    <div className={`space-y-0.5 ${reverse ? "text-right" : ""}`}>
      {names.map((name, i) => (
        <p
          key={i}
          className={`text-xs font-mono truncate ${
            playerIds[i] === currentPlayerId
              ? "text-ember-300 font-bold"
              : "text-ash-300"
          }`}
        >
          {name}
        </p>
      ))}
      {score !== undefined && (
        <p className={`heading-fantasy text-lg mt-1 ${reverse ? "" : ""} ${score !== undefined ? "text-ash-100" : "text-ash-600"}`}>
          {score ?? "—"}
        </p>
      )}
    </div>
  );
}
