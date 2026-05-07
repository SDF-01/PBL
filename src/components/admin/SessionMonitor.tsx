"use client";

import React, { useEffect, useState } from "react";
import { LadderSessionDoc, LadderMatchDoc, LadderCourtDoc } from "@/lib/firestore/types";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { RuneChip } from "../ui/RuneChip";
import { CheckCircle, Clock, AlertTriangle, Shield, X } from "lucide-react";
import { subscribeLadderMatches, subscribeLadderCourts } from "@/lib/ladder/repo";

interface SessionMonitorProps {
  session: LadderSessionDoc;
  onClose: () => void;
  onFinalize: () => void;
}

type MatchStatusKey = "SCHEDULED" | "SUBMITTED" | "VERIFIED" | "ADMIN_ASSIGNED" | "DISPUTED";

const STATUS_ICON: Record<MatchStatusKey, React.ReactNode> = {
  SCHEDULED:     <Clock className="w-3.5 h-3.5 text-ash-500" />,
  SUBMITTED:     <AlertTriangle className="w-3.5 h-3.5 text-gold-400" />,
  VERIFIED:      <CheckCircle className="w-3.5 h-3.5 text-spectral-400" />,
  ADMIN_ASSIGNED: <Shield className="w-3.5 h-3.5 text-ember-400" />,
  DISPUTED:      <AlertTriangle className="w-3.5 h-3.5 text-crimson-400" />,
};

const STATUS_COLOR: Record<MatchStatusKey, string> = {
  SCHEDULED:      "text-ash-500",
  SUBMITTED:      "text-gold-400",
  VERIFIED:       "text-spectral-400",
  ADMIN_ASSIGNED: "text-ember-400",
  DISPUTED:       "text-crimson-400",
};

function getIcon(status: string) {
  return STATUS_ICON[status as MatchStatusKey] ?? <Clock className="w-3.5 h-3.5 text-ash-600" />;
}
function getColor(status: string) {
  return STATUS_COLOR[status as MatchStatusKey] ?? "text-ash-600";
}

export function SessionMonitor({ session, onClose, onFinalize }: SessionMonitorProps) {
  const [matches, setMatches] = useState<LadderMatchDoc[]>([]);
  const [courts, setCourts] = useState<LadderCourtDoc[]>([]);

  useEffect(() => {
    const unsub1 = subscribeLadderMatches(session.id, setMatches);
    const unsub2 = subscribeLadderCourts(session.id, setCourts);
    return () => { unsub1(); unsub2(); };
  }, [session.id]);

  const matchesByCourt = courts.map((court) => ({
    court,
    matches: matches.filter((m) => m.courtId === court.id),
  }));

  const completed = matches.filter((m) => m.status === "VERIFIED" || m.status === "ADMIN_ASSIGNED").length;
  const pending   = matches.filter((m) => m.status === "SUBMITTED").length;
  const disputed  = matches.filter((m) => m.status === "DISPUTED").length;
  const scheduled = matches.filter((m) => m.status === "SCHEDULED").length;
  const total = matches.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Panel variant="quest" padding="lg" className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="heading-fantasy text-xl text-ash-100">Session Monitor</h2>
            <p className="text-xs text-ash-500 mt-0.5">
              Session {session.kind} · {courts.length} courts · {total} matches
            </p>
          </div>
          <Button onClick={onClose} variant="ghost" size="sm">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Progress bar */}
        <Panel variant="base" padding="md" className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-ash-400 uppercase tracking-wider">Session Progress</span>
            <span className="text-xs font-mono text-ash-300">{completed}/{total} complete</span>
          </div>
          <div className="w-full bg-obsidian-600 rounded-full h-1.5 mb-3">
            <div
              className="bg-spectral-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1 text-ash-500">
              <Clock className="w-3 h-3" /> {scheduled} scheduled
            </span>
            <span className="flex items-center gap-1 text-gold-400">
              <AlertTriangle className="w-3 h-3" /> {pending} pending
            </span>
            {disputed > 0 && (
              <span className="flex items-center gap-1 text-crimson-400">
                <AlertTriangle className="w-3 h-3" /> {disputed} disputed
              </span>
            )}
            <span className="flex items-center gap-1 text-spectral-400">
              <CheckCircle className="w-3 h-3" /> {completed} verified
            </span>
            <span className="text-ash-500 font-mono">{progress}%</span>
          </div>
        </Panel>

        {/* Court breakdown */}
        <div className="space-y-3 mb-5">
          {matchesByCourt.map(({ court, matches: cm }) => (
            <Panel key={court.id} variant="inventory" padding="md">
              <div className="flex items-center justify-between mb-2">
                <h3 className="heading-fantasy text-sm text-ash-100">Court {court.courtNumber}</h3>
                <RuneChip tone="neutral" className="text-[9px]">{court.playerIds.length} players</RuneChip>
              </div>
              <div className="space-y-1.5">
                {cm.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between bg-obsidian-700 rounded-pixel px-3 py-1.5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      {getIcon(m.status)}
                      <span className="font-mono text-ash-300">Game {m.gameNumber}</span>
                      {m.sittingOut && (
                        <span className="text-ash-600">(sit out: {m.sittingOut.slice(0, 6)}…)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {m.sideA.length > 0 && m.sideB.length > 0 ? (
                        <span className="text-ash-400">
                          {m.sideA[0]?.slice(0, 6)}… vs {m.sideB[0]?.slice(0, 6)}…
                        </span>
                      ) : (
                        <span className="text-ash-600">TBD</span>
                      )}
                      {typeof m.scoreA === "number" && typeof m.scoreB === "number" ? (
                        <span className="font-mono text-ash-100">{m.scoreA}–{m.scoreB}</span>
                      ) : (
                        <span className="text-ash-600">—</span>
                      )}
                      <span className={`uppercase tracking-wider ${getColor(m.status)}`}>
                        {m.status.replace(/_/g, " ").toLowerCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button onClick={onClose} variant="ghost">Close</Button>
          <Button onClick={onFinalize} disabled={completed < total}>
            <CheckCircle className="w-4 h-4 mr-1" />
            Finalize Session
          </Button>
        </div>
      </Panel>
    </div>
  );
}
