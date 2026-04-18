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
          <Flame className="h-3 w-3" /> Pickleball League
        </RuneChip>
        <h1 className="heading-fantasy text-3xl leading-[1.1] text-ash-100">
          Build your league.
        </h1>
        <p className="text-ember-500 heading-fantasy text-2xl leading-[1.1] mt-1">
          Run your tournaments.
        </p>
        <p className="text-ash-300 text-sm mt-3 leading-relaxed">
          Competitive leagues, tournaments, and clubs — brackets, rankings,
          and season-long play.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href="/tournaments"><Button size="md" className="w-full">Tournaments</Button></Link>
          <Link href="/dashboard"><Button variant="rune" size="md" className="w-full">Dashboard</Button></Link>
        </div>
      </section>

      <Panel variant="hud" padding="md" glow="rune">
        <RuneChip tone="spectral" className="mb-2">Get Started</RuneChip>
        <div className="heading-fantasy text-xl text-ash-100">No tournaments yet</div>
        <div className="text-xs text-ash-400 mt-1">
          Create your first event to see brackets and results.
        </div>
        <div className="ember-divider my-4" />
        <Link href="/tournaments">
          <Button variant="outline" size="sm" className="w-full">View Tournaments</Button>
        </Link>
      </Panel>

      <div className="grid grid-cols-1 gap-2">
        <FeatureRow icon={<Swords className="h-5 w-5" />} tone="ember"
          title="Live Brackets" copy="Single elim, double elim, round robin." />
        <FeatureRow icon={<Trophy className="h-5 w-5" />} tone="gold"
          title="Seasonal Rankings" copy="Ratings, standings, progression." />
        <FeatureRow icon={<Flame className="h-5 w-5" />} tone="rune"
          title="League Ops" copy="Venues, courts, referees, registrations." />
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
