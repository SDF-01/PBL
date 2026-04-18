"use client";

import Link from "next/link";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { Crown, Flame, Swords, Trophy } from "lucide-react";

// Mobile homepage — thumb-first, single-column, stacked storytelling. No
// horizontal scroll, large tap targets, essential info surfaced first.

export function HomeMobile() {
  return (
    <div className="px-4 py-5 space-y-5">
      {/* Hero */}
      <section>
        <RuneChip tone="rune" pulse className="mb-3">
          <Flame className="h-3 w-3" /> Season IV Live
        </RuneChip>
        <h1 className="heading-fantasy text-3xl leading-[1.1] text-ash-100">
          The arena is open.
        </h1>
        <p className="text-ember-500 heading-fantasy text-2xl leading-[1.1] mt-1">
          Claim your court.
        </p>
        <p className="text-ash-300 text-sm mt-3 leading-relaxed">
          Leagues, tournaments, and clubs — live brackets and season-long progression.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href="/tournaments"><Button size="md" className="w-full">Enter Tournament</Button></Link>
          <Link href="/leagues"><Button variant="rune" size="md" className="w-full">Join League</Button></Link>
        </div>
      </section>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <MiniStat value="1,284" label="Players" />
        <MiniStat value="42"    label="Live" />
        <MiniStat value="7"     label="Clubs" />
      </div>

      {/* Featured tournament HUD */}
      <Panel variant="hud" padding="md" glow="rune">
        <div className="flex items-center justify-between mb-2">
          <RuneChip tone="ember" pulse>Featured</RuneChip>
          <RuneChip tone="spectral">In Arena</RuneChip>
        </div>
        <div className="heading-fantasy text-xl text-ash-100">The Ember Open</div>
        <div className="text-xs text-ash-400 mt-0.5">Mixed Doubles · Double Elim</div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <HudMini label="Entrants"   value="64" />
          <HudMini label="Round"      value="QF" />
          <HudMini label="Courts"     value="8" />
          <HudMini label="Next"       value="12:40" />
        </div>
        <div className="ember-divider my-4" />
        <div className="flex items-center gap-2 mb-3">
          <Crown className="h-4 w-4 text-gold-500" />
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-ash-500">Defending</div>
            <div className="font-heading text-ash-100 text-sm">Vex · Solen (MYTHIC)</div>
          </div>
        </div>
        <Link href="/tournaments/view?slug=ember-open">
          <Button variant="outline" size="sm" className="w-full">View Bracket</Button>
        </Link>
      </Panel>

      {/* Next battles */}
      <Panel variant="raised" padding="md">
        <div className="flex items-center justify-between mb-3">
          <h3 className="heading-fantasy text-base text-ash-100">Next Battles</h3>
          <Link href="/schedule" className="text-xs text-spectral-500">All →</Link>
        </div>
        <ul className="space-y-2.5 text-sm">
          <MobileMatchRow when="12:40" court="3" a="Vex · Solen" b="Rune · Ash" />
          <MobileMatchRow when="13:10" court="1" a="Nyx · Kael"  b="Mira · Jor" />
          <MobileMatchRow when="13:45" court="5" a="Sylva"       b="Thorne" />
          <MobileMatchRow when="14:20" court="2" a="Velo"        b="Ira" />
        </ul>
      </Panel>

      {/* Features as touch tiles */}
      <div className="grid grid-cols-1 gap-2">
        <MobileFeatureRow icon={<Swords className="h-5 w-5" />} tone="ember"
          title="Live Brackets" copy="Single, double elim, pool play." href="/tournaments" />
        <MobileFeatureRow icon={<Trophy className="h-5 w-5" />} tone="gold"
          title="Seasonal Glory" copy="Ratings, points, hall of fame." href="/hall-of-fame" />
      </div>
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="slab-raised px-2 py-2 text-center">
      <div className="font-mono tabular-nums text-lg text-ash-100 leading-none">{value}</div>
      <div className="text-[9px] uppercase tracking-[0.15em] text-ash-500 mt-1">{label}</div>
    </div>
  );
}

function HudMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="slab-raised px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-widest text-ash-500">{label}</div>
      <div className="font-mono text-ash-100 text-base mt-0.5 tabular-nums leading-none">{value}</div>
    </div>
  );
}

function MobileMatchRow({ when, court, a, b }: { when: string; court: string; a: string; b: string }) {
  return (
    <li className="flex items-center gap-2 min-w-0">
      <div className="font-mono text-ash-400 text-xs w-12 tabular-nums">{when}</div>
      <RuneChip tone="neutral" className="shrink-0 text-[10px]">Ct {court}</RuneChip>
      <div className="flex-1 text-ash-100 text-sm truncate">
        <span>{a}</span>
        <span className="text-ash-500 mx-1.5">vs</span>
        <span>{b}</span>
      </div>
    </li>
  );
}

function MobileFeatureRow({
  icon, title, copy, href, tone,
}: {
  icon: React.ReactNode; title: string; copy: string; href: string;
  tone: "ember" | "rune" | "gold" | "spectral";
}) {
  const toneBg =
    tone === "ember"    ? "bg-ember-500/15 text-ember-glow" :
    tone === "rune"     ? "bg-rune-500/15 text-rune-glow" :
    tone === "gold"     ? "bg-gold-500/15 text-gold-400" :
                          "bg-spectral-500/15 text-spectral-glow";
  return (
    <Link href={href}>
      <Panel variant="inventory" padding="md" className="flex items-center gap-3">
        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-pixel ${toneBg}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="heading-fantasy text-ash-100 text-sm">{title}</div>
          <div className="text-xs text-ash-400 truncate">{copy}</div>
        </div>
        <span className="text-ash-500 text-lg">›</span>
      </Panel>
    </Link>
  );
}
