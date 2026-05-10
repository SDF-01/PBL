"use client";

import { useState } from "react";
import { Building2, CheckCircle, Clock, XCircle, MapPin, Calendar, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { approveClub, rejectClub } from "@/lib/permissions/write";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import type { ClubDoc } from "@/lib/permissions/types";

interface ClubApprovalQueueProps {
  clubs: ClubDoc[];
  onApproved?: (clubId: string) => void;
  onRejected?: (clubId: string) => void;
}

function formatDate(ts: unknown): string {
  if (!ts) return "—";
  const d =
    ts && typeof ts === "object" && "toDate" in ts
      ? (ts as { toDate(): Date }).toDate()
      : new Date(ts as string);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function ClubApprovalQueue({
  clubs,
  onApproved,
  onRejected,
}: ClubApprovalQueueProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes]     = useState<Record<string, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null);
  const [rejectError, setRejectError]     = useState<string | null>(null);

  async function handleApprove(club: ClubDoc) {
    if (!user) return;
    setProcessing(club.id);
    try {
      await approveClub(club.id, club.createdBy);
      toast(`"${club.clubName}" approved. Director role assigned.`, "success");
      onApproved?.(club.id);
    } catch (err) {
      toast(
        `Approval failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error",
      );
    } finally {
      setProcessing(null);
    }
  }

  function openRejectForm(clubId: string) {
    setShowRejectInput(clubId);
    setRejectError(null);
  }

  async function handleReject(club: ClubDoc) {
    if (!user) return;
    const notes = rejectNotes[club.id]?.trim() ?? "";
    if (!notes) {
      setRejectError("A rejection reason is required.");
      return;
    }
    setRejectError(null);
    setProcessing(club.id);
    try {
      await rejectClub(club.id, club.createdBy, notes);
      toast(`"${club.clubName}" rejected.`, "info");
      onRejected?.(club.id);
    } catch (err) {
      toast(
        `Rejection failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error",
      );
    } finally {
      setProcessing(null);
      setShowRejectInput(null);
    }
  }

  if (clubs.length === 0) {
    return (
      <Panel variant="base" padding="lg" className="text-center space-y-2">
        <Clock className="h-8 w-8 text-ash-600 mx-auto" />
        <p className="text-ash-400 text-sm">No pending club submissions.</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {clubs.map((club) => {
        const busy    = processing === club.id;
        const showing = showRejectInput === club.id;

        return (
          <Panel key={club.id} variant="quest" padding="lg">
            {/* Club header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-pixel bg-ember-500/15 mt-0.5 shrink-0">
                <Building2 className="h-5 w-5 text-ember-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="heading-fantasy text-ash-100 text-base">{club.clubName}</h3>
                  <RuneChip tone="rune">Pending Review</RuneChip>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-ash-400 text-xs mt-1">
                  {club.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {club.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 shrink-0" />
                    Submitted {formatDate(club.createdAt)}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-ash-500">
                    <User className="h-3 w-3 shrink-0" />
                    {club.createdBy}
                  </span>
                </div>

                {club.description && (
                  <p className="text-ash-400 text-sm mt-2 leading-relaxed">{club.description}</p>
                )}
              </div>
            </div>

            {/* Rejection form */}
            {showing && (
              <div className="mb-4 space-y-1.5">
                <label className="text-ash-400 text-xs font-medium">
                  Rejection reason <span className="text-crimson-400">*</span>
                </label>
                <textarea
                  value={rejectNotes[club.id] ?? ""}
                  onChange={(e) => {
                    setRejectNotes((prev) => ({ ...prev, [club.id]: e.target.value }));
                    if (rejectError) setRejectError(null);
                  }}
                  placeholder="Explain why this club is not approved (required)…"
                  rows={3}
                  className="w-full rounded-pixel border border-ash-700 bg-ash-900 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500 resize-none placeholder:text-ash-600"
                />
                {rejectError && (
                  <p className="text-crimson-400 text-xs">{rejectError}</p>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {!showing ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(club)}
                    disabled={busy}
                    className="flex-1"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    {busy ? "Processing…" : "Approve"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openRejectForm(club.id)}
                    disabled={busy}
                    className="flex-1"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleReject(club)}
                    disabled={busy}
                    className="flex-1"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    {busy ? "Processing…" : "Confirm Reject"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowRejectInput(null);
                      setRejectError(null);
                    }}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
