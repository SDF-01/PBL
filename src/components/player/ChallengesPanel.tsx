"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Hourglass,
  Swords,
  Trophy,
  X,
} from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import {
  subscribeIncomingChallenges,
  listPendingSent,
  listActiveChallenges,
  respondToChallenge,
  withdrawChallenge,
} from "@/lib/players/challenges";
import type { PlayerChallengeDoc } from "@/lib/firestore/types";

interface Props {
  userId: string;
  displayName: string;
}

export function ChallengesPanel({ userId, displayName }: Props) {
  const [incoming, setIncoming] = useState<PlayerChallengeDoc[]>([]);
  const [active, setActive] = useState<PlayerChallengeDoc[]>([]);
  const [pendingSent, setPendingSent] = useState<PlayerChallengeDoc[]>([]);
  const [responding, setResponding] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeIncomingChallenges(userId, setIncoming);
    listPendingSent(userId).then(setPendingSent).catch(() => {});
    listActiveChallenges(userId).then(setActive).catch(() => {});
    return () => unsub();
  }, [userId]);

  async function handleRespond(challenge: PlayerChallengeDoc, accept: boolean) {
    setResponding(challenge.id);
    try {
      await respondToChallenge(challenge.id, accept, userId, displayName, challenge.challengerId);
      setIncoming((prev) => prev.filter((c) => c.id !== challenge.id));
      if (accept) {
        // Move to active after accept
        listActiveChallenges(userId).then(setActive).catch(() => {});
      }
    } finally {
      setResponding(null);
    }
  }

  async function handleWithdraw(challenge: PlayerChallengeDoc) {
    setWithdrawing(challenge.id);
    setConfirmWithdraw(null);
    try {
      await withdrawChallenge(challenge.id, userId, displayName, challenge.challengeeId);
      setPendingSent((prev) => prev.filter((c) => c.id !== challenge.id));
    } finally {
      setWithdrawing(null);
    }
  }

  const hasAny = incoming.length > 0 || active.length > 0 || pendingSent.length > 0;

  return (
    <Panel variant="base" padding="md">
      <div className="flex items-center justify-between mb-3">
        <h2 className="heading-fantasy text-ash-100 text-base flex items-center gap-2">
          <Swords className="h-4 w-4 text-ember-400" /> Challenges
          {incoming.length > 0 && (
            <span className="h-5 w-5 rounded-full bg-crimson-600 text-white text-[10px] flex items-center justify-center font-bold">
              {incoming.length}
            </span>
          )}
        </h2>
        <Link href="/players">
          <button className="text-[11px] text-ash-500 hover:text-ash-300 transition-colors flex items-center gap-0.5">
            Find players <ArrowRight className="h-3 w-3" />
          </button>
        </Link>
      </div>

      {!hasAny && (
        <p className="text-ash-500 text-sm">
          No open challenges. Visit a player profile to send one.
        </p>
      )}

      {/* ── Incoming (PENDING, challengee) ─────────────────────────────────── */}
      {incoming.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-[10px] uppercase tracking-widest text-ash-600">Incoming</p>
          {incoming.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 p-3 rounded-pixel bg-obsidian-800 border border-obsidian-600"
            >
              <div className="flex-1 min-w-0">
                <Link
                  href={`/players/view?uid=${c.challengerId}`}
                  className="text-sm text-ash-100 font-medium hover:text-ember-300 transition-colors"
                >
                  {c.challengerName}
                </Link>
                {c.message && (
                  <p className="text-ash-500 text-xs truncate mt-0.5">"{c.message}"</p>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={responding === c.id}
                  onClick={() => handleRespond(c, true)}
                  className="px-2"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={responding === c.id}
                  onClick={() => handleRespond(c, false)}
                  className="px-2 text-crimson-400"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Active (ACCEPTED / SCHEDULED / SCORE_SUBMITTED) ───────────────── */}
      {active.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-[10px] uppercase tracking-widest text-ash-600">Active</p>
          {active.map((c) => {
            const isChallenger = c.challengerId === userId;
            const opponentName = isChallenger ? c.challengeeName : c.challengerName;
            const opponentId = isChallenger ? c.challengeeId : c.challengerId;
            const needsAction = activeNeedsAction(c, userId);

            return (
              <Link key={c.id} href={`/challenges/${c.id}`}>
                <div className={`flex items-center gap-3 p-3 rounded-pixel border transition-colors cursor-pointer ${
                  needsAction
                    ? "bg-ember-950/30 border-ember-600 hover:border-ember-400"
                    : "bg-obsidian-800/50 border-obsidian-700 hover:border-obsidian-500"
                }`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm text-ash-200 font-medium">{opponentName}</span>
                      <ActiveStatusIcon challenge={c} userId={userId} />
                    </div>
                    <p className="text-ash-500 text-[10px] mt-0.5">
                      {activeStatusLabel(c, userId)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {needsAction && (
                      <span className="text-[9px] text-ember-400 font-medium uppercase tracking-wide">Action needed</span>
                    )}
                    <ArrowRight className="h-3 w-3 text-ash-600" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Pending sent (PENDING, challenger) ───────────────────────────── */}
      {pendingSent.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-ash-600">Sent</p>
          {pendingSent.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 p-3 rounded-pixel bg-obsidian-800/50 border border-obsidian-700"
            >
              <div className="flex-1 min-w-0">
                <Link
                  href={`/players/view?uid=${c.challengeeId}`}
                  className="text-sm text-ash-300 hover:text-ash-100 transition-colors"
                >
                  {c.challengeeName}
                </Link>
                {c.message && (
                  <p className="text-ash-500 text-xs truncate mt-0.5">"{c.message}"</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {confirmWithdraw === c.id ? (
                  <>
                    <button
                      onClick={() => handleWithdraw(c)}
                      disabled={withdrawing === c.id}
                      className="text-[10px] text-crimson-400 hover:text-crimson-300 font-medium disabled:opacity-50"
                    >
                      {withdrawing === c.id ? "Cancelling…" : "Confirm"}
                    </button>
                    <button
                      onClick={() => setConfirmWithdraw(null)}
                      className="text-[10px] text-ash-500 hover:text-ash-300"
                    >
                      Keep
                    </button>
                  </>
                ) : (
                  <>
                    <RuneChip tone="neutral" className="text-[9px]">Pending</RuneChip>
                    <button
                      onClick={() => setConfirmWithdraw(c.id)}
                      className="text-ash-600 hover:text-crimson-400 transition-colors"
                      title="Cancel challenge"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if the current user needs to take an action on this challenge. */
function activeNeedsAction(c: PlayerChallengeDoc, userId: string): boolean {
  if (c.status === "ACCEPTED") {
    // Needs action if conditions not yet proposed, or opponent proposed and I haven't accepted
    if (!c.conditions) return true;
    if (c.conditionsProposedBy !== userId) return true; // opponent proposed, I must accept
    return false;
  }
  if (c.status === "SCORE_SUBMITTED") {
    // Needs action if opponent submitted and I haven't verified
    return c.submittedBy !== userId;
  }
  return false;
}

function activeStatusLabel(c: PlayerChallengeDoc, userId: string): string {
  const isChallenger = c.challengerId === userId;
  switch (c.status) {
    case "ACCEPTED":
      if (!c.conditions) return "Set match conditions";
      if (c.conditionsProposedBy === userId) return "Conditions proposed — waiting for reply";
      return "Conditions proposed — your response needed";
    case "SCHEDULED":
      return "Match scheduled — ready to play";
    case "SCORE_SUBMITTED":
      if (c.submittedBy === userId) return "Score submitted — awaiting verification";
      return "Score submitted — please verify";
    default:
      return c.status;
  }
}

function ActiveStatusIcon({ challenge: c, userId }: { challenge: PlayerChallengeDoc; userId: string }) {
  if (c.status === "ACCEPTED") {
    return <CalendarDays className="h-3 w-3 text-ember-500" />;
  }
  if (c.status === "SCHEDULED") {
    return <Trophy className="h-3 w-3 text-gold-400" />;
  }
  if (c.status === "SCORE_SUBMITTED") {
    return c.submittedBy === userId
      ? <Hourglass className="h-3 w-3 text-ash-500" />
      : <Clock className="h-3 w-3 text-ember-400" />;
  }
  return null;
}
