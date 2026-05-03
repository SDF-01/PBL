/**
 * Session Monitor Component
 * Admin view for monitoring live session progress
 * Shows match status across all courts
 */

"use client";

import React, { useEffect, useState } from "react";
import { LadderSessionDoc, LadderMatchDoc, LadderCourtDoc } from "@/lib/firestore/types";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import {
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  X,
} from "lucide-react";
import { subscribeLadderMatches, subscribeLadderCourts } from "@/lib/ladder/repo";

interface SessionMonitorProps {
  session: LadderSessionDoc;
  onClose: () => void;
  onFinalize: () => void;
}

type MatchStatus = "scheduled" | "submitted" | "awaiting-verification" | "verified" | "admin-assigned";

export function SessionMonitor({ session, onClose, onFinalize }: SessionMonitorProps) {
  const [matches, setMatches] = useState<LadderMatchDoc[]>([]);
  const [courts, setCourts] = useState<LadderCourtDoc[]>([]);

  useEffect(() => {
    // Subscribe to real-time updates
    const unsubscribeMatches = subscribeLadderMatches(session.id, setMatches);
    const unsubscribeCourts = subscribeLadderCourts(session.id, setCourts);

    return () => {
      unsubscribeMatches();
      unsubscribeCourts();
    };
  }, [session.id]);

  // Group matches by court
  const matchesByCourt = courts.map((court) => ({
    court,
    matches: matches.filter((m) => m.courtId === court.id),
  }));

  // Calculate status counts
  const statusCounts = {
    scheduled: matches.filter((m) => m.status === "SCHEDULED").length,
    submitted: matches.filter((m) => m.status === "SUBMITTED").length,
    awaitingVerification: matches.filter((m) => m.status === "AWAITING_VERIFICATION").length,
    verified: matches.filter((m) => m.status === "VERIFIED").length,
    adminAssigned: matches.filter((m) => m.status === "ADMIN_ASSIGNED").length,
  };

  const totalMatches = matches.length;
  const completedMatches = statusCounts.verified + statusCounts.adminAssigned;
  const progressPercent = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0;

  const getStatusIcon = (status: MatchStatus) => {
    switch (status) {
      case "scheduled":
        return <Clock className="w-4 h-4 text-slate-400" />;
      case "submitted":
      case "awaiting-verification":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "verified":
      case "admin-assigned":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
  };

  const getStatusColor = (status: MatchStatus) => {
    switch (status) {
      case "scheduled":
        return "text-slate-400";
      case "submitted":
      case "awaiting-verification":
        return "text-amber-500";
      case "verified":
      case "admin-assigned":
        return "text-green-500";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Panel className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Session Monitor</h2>
            <p className="text-sm text-slate-600">
              Session {session.kind} • {courts.length} courts • {totalMatches} matches
            </p>
          </div>
          <Button onClick={onClose} variant="ghost" size="sm">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Progress Overview */}
        <Panel className="bg-slate-50 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Session Progress</h3>
            <span className="text-sm font-mono">
              {completedMatches}/{totalMatches} matches completed
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 mb-3">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{statusCounts.scheduled} scheduled</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span>{statusCounts.submitted + statusCounts.awaitingVerification} pending</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-500" />
              <span>{statusCounts.verified} verified</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3 text-blue-500" />
              <span>{statusCounts.adminAssigned} assigned</span>
            </div>
            <div className="text-slate-600">
              {Math.round(progressPercent)}% complete
            </div>
          </div>
        </Panel>

        {/* Court-by-Court View */}
        <div className="space-y-4 mb-6">
          <h3 className="font-semibold">Court Status</h3>
          {matchesByCourt.map(({ court, matches: courtMatches }) => (
            <Panel key={court.id} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">Court {court.courtNumber}</h4>
                <div className="text-sm text-slate-600">
                  {court.playerIds.length} players
                </div>
              </div>

              <div className="space-y-2">
                {courtMatches.map((match) => {
                  const status = match.status.toLowerCase() as MatchStatus;
                  const isSideA = match.sideA.length > 0;
                  const isSideB = match.sideB.length > 0;

                  return (
                    <div
                      key={match.id}
                      className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {getStatusIcon(status)}
                        <span className="font-mono text-xs">Game {match.gameNumber}</span>
                        {match.sittingOut && (
                          <span className="text-xs text-slate-500">
                            (sit: {match.sittingOut.slice(0, 8)}...)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-xs">
                          {isSideA && isSideB ? (
                            <span>
                              {match.sideA[0]?.slice(0, 6)}... vs {match.sideB[0]?.slice(0, 6)}...
                            </span>
                          ) : (
                            <span className="text-slate-500">Teams TBD</span>
                          )}
                        </div>

                        {match.scoreA !== undefined && match.scoreB !== undefined ? (
                          <span className="font-mono font-semibold">
                            {match.scoreA}-{match.scoreB}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}

                        <span className={`text-xs ${getStatusColor(status)}`}>
                          {status.replace("-", " ")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Button onClick={onClose} variant="ghost">
            Close
          </Button>
          <Button
            onClick={onFinalize}
            disabled={completedMatches < totalMatches}
            className="gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Finalize Session
          </Button>
        </div>
      </Panel>
    </div>
  );
}