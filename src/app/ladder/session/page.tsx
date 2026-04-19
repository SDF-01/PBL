"use client";

import Link from "next/link";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { Swords, MapPin } from "lucide-react";

// Stub for the court-centric player home. Generation + rotation logic
// ships in a later patch; this page answers "what's happening right now?"
// with directional guidance until the session is generated.

export default function PlayerSessionPage() {
  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-xl">
        <div>
          <RuneChip tone="rune" className="mb-2">
            Player Home
          </RuneChip>
          <h1 className="heading-fantasy text-display-md text-ash-100">
            Your Court
          </h1>
          <p className="text-ash-400 text-sm mt-1">
            Court, current match, next match, and score actions will appear
            here once the admin generates the session.
          </p>
        </div>

        <Panel variant="quest" padding="lg">
          <div className="flex items-center gap-2 mb-2 text-ash-200">
            <Swords className="h-5 w-5 text-ember-500" />
            <span className="heading-fantasy text-lg">
              Awaiting session generation
            </span>
          </div>
          <p className="text-ash-400 text-sm mb-3">
            Check in first, then wait for the event admin to lock attendance
            and generate Session A.
          </p>
          <div className="flex gap-2">
            <Link href="/ladder/check-in">
              <Button size="sm">
                <MapPin className="h-3.5 w-3.5" /> Go to Check-In
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
