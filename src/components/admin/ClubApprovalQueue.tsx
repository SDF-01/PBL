"use client";

import { useState } from "react";
import { Building2, CheckCircle, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { approveClub, rejectClub } from "@/lib/permissions/write";
import { useAuth } from "@/lib/auth-context";
import type { ClubDoc } from "@/lib/permissions/types";

interface ClubApprovalQueueProps {
  clubs: ClubDoc[];
  onApproved?: (clubId: string) => void;
  onRejected?: (clubId: string) => void;
}

export function ClubApprovalQueue({
  clubs,
  onApproved,
  onRejected,
}: ClubApprovalQueueProps) {
  const { user } = useAuth();
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null);

  async function handleApprove(club: ClubDoc) {
    if (!user) return;
    setProcessing(club.id);
    try {
      await approveClub(club.id, user.uid, club.createdBy);
      onApproved?.(club.id);
    } catch (err) {
      alert(
        `Failed to approve: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(club: ClubDoc) {
    if (!user) return;
    setProcessing(club.id);
    try {
      await rejectClub(club.id, user.uid, club.createdBy, rejectNotes[club.id]);
      onRejected?.(club.id);
    } catch (err) {
      alert(
        `Failed to reject: ${err instanceof Error ? err.message : "Unknown error"}`,
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
    <div className="space-y-3">
      {clubs.map((club) => {
        const busy = processing === club.id;
        return (
          <Panel key={club.id} variant="quest" padding="lg">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 rounded bg-ash-800 mt-0.5 shrink-0">
                <Building2 className="h-5 w-5 text-ember-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="heading-fantasy text-ash-100 text-base">{club.clubName}</h3>
                  <RuneChip tone="rune">Pending</RuneChip>
                </div>
                <p className="text-ash-400 text-xs">{club.location}</p>
                {club.description && (
                  <p className="text-ash-500 text-sm mt-1">{club.description}</p>
                )}
                <p className="text-ash-600 text-xs mt-2 font-mono">
                  Submitted by: {club.createdBy}
                </p>
              </div>
            </div>

            {showRejectInput === club.id && (
              <div className="mb-3">
                <textarea
                  value={rejectNotes[club.id] ?? ""}
                  onChange={(e) =>
                    setRejectNotes((prev) => ({ ...prev, [club.id]: e.target.value }))
                  }
                  placeholder="Reason for rejection (optional)..."
                  rows={2}
                  className="w-full rounded border border-ash-700 bg-ash-900 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500 resize-none placeholder:text-ash-600"
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleApprove(club)}
                disabled={busy}
                className="flex-1"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                {busy ? "Processing…" : "Approve"}
              </Button>

              {showRejectInput === club.id ? (
                <>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleReject(club)}
                    disabled={busy}
                    className="flex-1"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Confirm Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowRejectInput(null)}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowRejectInput(club.id)}
                  disabled={busy}
                  className="flex-1"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </Button>
              )}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
