"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { PlayerHome } from "@/components/player/PlayerHome";
import { LiveStandings } from "@/components/player/LiveStandings";
import { ScoreModal } from "@/components/player/ScoreModal";
import { getPlayerSessionData, subscribeSessionMatches } from "@/lib/ladder/repo";
import { LiveCourts } from "@/components/player/LiveCourts";
import { useAuth } from "@/lib/auth-context";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  Swords,
  MapPin,
  Trophy,
  LayoutGrid,
} from "lucide-react";
import type { PlayerSessionData } from "@/lib/ladder/repo";
import type { LadderMatchDoc } from "@/lib/firestore/types";

function deriveMatchesForPlayer(
  playerId: string,
  allMatches: LadderMatchDoc[],
  courtNumber: number,
): Pick<PlayerSessionData, "currentMatch" | "nextMatch" | "sitOutMatch" | "allMatches"> {
  const playerMatches = allMatches
    .filter(
      (m) =>
        m.sideA.includes(playerId) ||
        m.sideB.includes(playerId) ||
        m.sittingOut === playerId,
    )
    .sort((a, b) => a.gameNumber - b.gameNumber);

  let currentMatch: (LadderMatchDoc & { courtNumber: number }) | undefined;
  let nextMatch: (LadderMatchDoc & { courtNumber: number }) | undefined;
  let sitOutMatch: (LadderMatchDoc & { courtNumber: number }) | undefined;

  for (const match of playerMatches) {
    const matchWithCourt = { ...match, courtNumber };
    if (match.sittingOut === playerId) {
      if (!sitOutMatch) sitOutMatch = matchWithCourt;
      continue;
    }
    const isOnSideA = match.sideA.includes(playerId);
    const isOnSideB = match.sideB.includes(playerId);
    const needsSubmission = match.status === "SCHEDULED" && ((isOnSideA && !match.scoreA) || (isOnSideB && !match.scoreB));
    const needsVerification = match.status === "SUBMITTED" && ((isOnSideA && !match.verifiedAt) || (isOnSideB && !match.verifiedAt));
    if (needsSubmission || needsVerification) {
      if (!currentMatch) currentMatch = matchWithCourt;
      else if (!nextMatch) nextMatch = matchWithCourt;
    } else if (!currentMatch) {
      currentMatch = matchWithCourt;
    } else if (!nextMatch) {
      nextMatch = matchWithCourt;
    }
  }
  return { currentMatch, nextMatch, sitOutMatch, allMatches };
}

function PlayerSessionContent() {
  const params = useSearchParams();
  const playDateId = params.get("playDate");
  const { user } = useAuth();

  const [sessionData, setSessionData] = useState<PlayerSessionData | null>(null);
  const [showCourts, setShowCourts] = useState(false);
  const [scoreModal, setScoreModal] = useState<{
    match: any;
    action: "submit" | "verify";
  } | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured() || !user || !playDateId) return;

    let unsubMatches: (() => void) | null = null;

    getPlayerSessionData(user.uid, playDateId).then((data) => {
      setSessionData(data);

      if (data.currentSession && data.assignedCourt) {
        const sessionId = data.currentSession.id;
        const courtNumber = data.assignedCourt.courtNumber;
        const playerId = user.uid;

        unsubMatches = subscribeSessionMatches(sessionId, (matches) => {
          setSessionData((prev) =>
            prev
              ? {
                  ...prev,
                  ...deriveMatchesForPlayer(playerId, matches, courtNumber),
                }
              : prev,
          );
        });
      }
    });

    return () => { unsubMatches?.(); };
  }, [user, playDateId]);

  if (!sessionData?.currentSession) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-6 md:py-10 space-y-6 max-w-xl">
          <div>
            <RuneChip tone="rune" className="mb-2">
              Session Not Found
            </RuneChip>
            <h1 className="heading-fantasy text-display-md text-ash-100">
              No Active Session
            </h1>
            <p className="text-ash-400 text-sm mt-1">
              Check in to a play date first to access your session.
            </p>
          </div>

          <Panel variant="quest" padding="lg">
            <div className="flex items-center gap-2 mb-2 text-ash-200">
              <Swords className="h-5 w-5 text-ember-500" />
              <span className="heading-fantasy text-lg">
                Ready to play?
              </span>
            </div>
            <p className="text-ash-400 text-sm mb-3">
              Check in at your venue to join the ladder session.
            </p>
            <div className="flex gap-2">
              <Link href="/ladder/check-in">
                <Button size="sm">
                  <MapPin className="h-3.5 w-3.5" /> Check In
                </Button>
              </Link>
              <Link href="/ladder/play-dates">
                <Button size="sm" variant="outline">
                  Browse Play Dates
                </Button>
              </Link>
            </div>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6">
        <PlayerHome
          currentSession={sessionData.currentSession}
          assignedCourt={sessionData.assignedCourt}
          currentMatch={sessionData.currentMatch}
          nextMatch={sessionData.nextMatch}
          sitOutMatch={sessionData.sitOutMatch}
          playerId={user?.uid || ""}
          onEnterScore={() => {
            if (sessionData.currentMatch) {
              setScoreModal({
                match: sessionData.currentMatch,
                action: "submit",
              });
            }
          }}
          onVerifyScore={() => {
            if (sessionData.currentMatch) {
              setScoreModal({
                match: sessionData.currentMatch,
                action: "verify",
              });
            }
          }}
          onViewStandings={() => {
            // Scroll to standings section
            document.getElementById("standings")?.scrollIntoView({ behavior: "smooth" });
          }}
          onViewCourts={() => {
            setShowCourts((v) => !v);
            setTimeout(() => document.getElementById("live-courts")?.scrollIntoView({ behavior: "smooth" }), 50);
          }}
        />

        {showCourts && sessionData.allCourts && sessionData.allCourts.length > 0 && (
          <div id="live-courts" className="space-y-3">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-ember-400" />
              <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest">Live Courts</h2>
            </div>
            <LiveCourts
              courts={sessionData.allCourts}
              matches={sessionData.allMatches}
              currentPlayerId={user?.uid}
            />
          </div>
        )}

        <div id="standings">
          <LiveStandings
            sessionKind={sessionData.currentSession.kind}
            courtStandings={[]}
            currentPlayerId={user?.uid}
          />
        </div>

        {scoreModal && (
          <ScoreModal
            match={scoreModal.match}
            action={scoreModal.action}
            onClose={() => setScoreModal(null)}
            onSuccess={() => {
              setScoreModal(null);
              // Real-time subscription will update sessionData automatically
            }}
          />
        )}
      </main>
    </ResponsiveShell>
  );
}

export default function PlayerSessionPage() {
  return (
    <Suspense>
      <PlayerSessionContent />
    </Suspense>
  );
}
