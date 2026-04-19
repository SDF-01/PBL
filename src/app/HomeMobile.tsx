"use client";

import Link from "next/link";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { Flame, Swords, Trophy } from "lucide-react";

export function HomeMobile() {
  return (
    <div className="px-4 py-5 space-y-5">
      <section>
        <RuneChip tone="rune" pulse className="mb-3">
          <Flame className="h-3 w-3" /> Ladder League
        </RuneChip>
        <h1 className="heading-fantasy text-3xl leading-[1.1] text-ash-100">
          Run your ladder.
        </h1>
        <p className="text-ember-500 heading-fantasy text-2xl leading-[1.1] mt-1">
          Win the court.
        </p>
        <p className="text-ash-300 text-sm mt-3 leading-relaxed">
          Mobile-first doubles ladder play — check in, rotate, verify,
          climb.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href="/ladder/check-in"><Button size="md" className="w-full">Check In</Button></Link>
          <Link href="/dashboard"><Button variant="rune" size="md" className="w-full">Dashboard</Button></Link>
        </div>
      </section>

      <Panel variant="hud" padding="md" glow="rune">
        <RuneChip tone="spectral" className="mb-2">Get Started</RuneChip>
        <div className="heading-fantasy text-xl text-ash-100">No play dates yet</div>
        <div className="text-xs text-ash-400 mt-1">
          Admins: create a season and schedule a play date to open check-in.
        </div>
        <div className="ember-divider my-4" />
        <Link href="/ladder/seasons">
          <Button variant="outline" size="sm" className="w-full">Manage Seasons</Button>
        </Link>
      </Panel>

      <div className="grid grid-cols-1 gap-2">
        <FeatureRow icon={<Swords className="h-5 w-5" />} tone="ember"
          title="Court-Centric Play" copy="Check in, rotate, verify, climb." />
        <FeatureRow icon={<Trophy className="h-5 w-5" />} tone="gold"
          title="Ladder Standings" copy="Individual rankings from doubles play." />
        <FeatureRow icon={<Flame className="h-5 w-5" />} tone="rune"
          title="Admin Control" copy="Attendance, generation, monitoring, finalization." />
      </div>
    </div>
  );
}

function FeatureRow({
  icon, title, copy, tone,
}: {
  icon: React.ReactNode; title: string; copy: string;
  tone: "ember" | "rune" | "gold" | "spectral";
}) {
  const toneBg =
    tone === "ember"    ? "bg-ember-500/15 text-ember-glow" :
    tone === "rune"     ? "bg-rune-500/15 text-rune-glow" :
    tone === "gold"     ? "bg-gold-500/15 text-gold-400" :
                          "bg-spectral-500/15 text-spectral-glow";
  return (
    <Panel variant="inventory" padding="md" className="flex items-center gap-3">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-pixel ${toneBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="heading-fantasy text-ash-100 text-sm">{title}</div>
        <div className="text-xs text-ash-400 truncate">{copy}</div>
      </div>
    </Panel>
  );
}
