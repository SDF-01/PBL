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
import { getPlayerSessionData } from "@/lib/ladder/repo";
import { useAuth } from "@/lib/auth-context";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  Swords,
  MapPin,
  Trophy,
} from "lucide-react";
import type { PlayerSessionData } from "@/lib/ladder/repo";

function PlayerSessionContent() {
  const params = useSearchParams();
  const playDateId = params.get("playDate");
  const { user } = useAuth();

  const [sessionData, setSessionData] = useState<PlayerSessionData | null>(null);
  const [scoreModal, setScoreModal] = useState<{
    match: any;
    action: "submit" | "verify";
  } | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured() || !user || !playDateId) return;

    getPlayerSessionData(user.uid, playDateId).then(setSessionData);
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
            // TODO: Navigate to courts view
          }}
        />

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
              // Refresh session data
              if (user && playDateId) {
                getPlayerSessionData(user.uid, playDateId).then(setSessionData);
              }
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
