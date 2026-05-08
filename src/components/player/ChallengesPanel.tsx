"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Swords, Check, X, ArrowRight, Trophy } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import {
  subscribeIncomingChallenges,
  listOutgoingChallenges,
  respondToChallenge,
} from "@/lib/players/challenges";
import { useAuth } from "@/lib/auth-context";
import { formatDistanceToNow } from "date-fns";
import type { PlayerChallengeDoc } from "@/lib/firestore/types";

interface Props {
  userId: string;
  displayName: string;
}

export function ChallengesPanel({ userId, displayName }: Props) {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<PlayerChallengeDoc[]>([]);
  const [outgoing, setOutgoing] = useState<PlayerChallengeDoc[]>([]);
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeIncomingChallenges(userId, setIncoming);
    listOutgoingChallenges(userId).then(setOutgoing).catch(() => {});
    return () => unsub();
  }, [userId]);

  async function handleRespond(challenge: PlayerChallengeDoc, accept: boolean) {
    if (!user) return;
    setResponding(challenge.id);
    try {
      await respondToChallenge(
        challenge.id,
        accept,
        userId,
        displayName,
        challenge.challengerId,
      );
      setIncoming((prev) => prev.filter((c) => c.id !== challenge.id));
    } finally {
      setResponding(null);
    }
  }

  const hasAny = incoming.length > 0 || outgoing.length > 0;

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
                {c.proposedDate && (
                  <p className="text-ash-600 text-[10px] mt-0.5">Proposed: {c.proposedDate}</p>
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

      {outgoing.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-ash-600">Sent</p>
          {outgoing.map((c) => (
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
              <RuneChip
                tone={c.status === "ACCEPTED" ? "success" : "neutral"}
                className="text-[9px] shrink-0"
              >
                {c.status === "ACCEPTED" ? "Accepted" : "Pending"}
              </RuneChip>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
