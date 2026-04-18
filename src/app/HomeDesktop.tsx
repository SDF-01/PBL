"use client";

import Link from "next/link";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { CalendarDays, Crown, Flame, Swords, Trophy, Users } from "lucide-react";

// Desktop homepage — original hero-first, multi-column layout. Extracted
// verbatim from the prior server component; now a client component so the
// root page can branch by device.

export function HomeDesktop() {
  return (
    <main>
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden border-b border-obsidian-400">
        <div className="absolute inset-0 bg-rune-grid bg-grid opacity-[0.08] pointer-events-none" />
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-ember-crack opacity-60" />
        <div className="container relative py-20 md:py-28 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <RuneChip tone="rune" pulse className="mb-5">
              <Flame className="h-3 w-3" /> Season IV · Now Forging
            </RuneChip>
            <h1 className="heading-fantasy text-display-lg md:text-display-xl text-ash-100 leading-[1.05]">
              The arena is open.{" "}
              <span className="text-ember-500">Claim your court.</span>
            </h1>
            <p className="mt-5 text-ash-300 max-w-xl text-lg leading-relaxed">
              A competitive pickleball platform for leagues, tournaments, and clubs — live brackets,
              elite rankings, and season-long progression, cast in obsidian.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/tournaments"><Button size="lg">Enter Tournament</Button></Link>
              <Link href="/leagues"><Button variant="rune" size="lg">Join a League</Button></Link>
              <Link href="/tournaments"><Button variant="outline" size="lg">View Live Brackets</Button></Link>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-4 max-w-lg">
              <Stat value="1,284" label="Active Players" />
              <Stat value="42"    label="Live Tournaments" />
              <Stat value="7"     label="Partner Clubs" />
            </div>
          </div>

          <Panel variant="hud" padding="lg" glow="rune" className="lg:col-span-5 relative">
            <div className="flex items-center justify-between mb-4">
              <RuneChip tone="ember" pulse>Featured</RuneChip>
              <RuneChip tone="spectral">In Arena</RuneChip>
            </div>
            <div className="heading-fantasy text-2xl text-ash-100">The Ember Open</div>
            <div className="text-sm text-ash-400 mt-1">Mixed Doubles · Open · Double Elimination</div>

            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <HudStat label="Entrants"   value="64" />
              <HudStat label="Courts"     value="8" />
              <HudStat label="Round"      value="Quarterfinals" />
              <HudStat label="Next Match" value="12:40" />
            </div>

            <div className="ember-divider my-6" />

            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-gold-500" />
              <span className="text-xs text-ash-400">Defending Champions</span>
            </div>
            <div className="mt-1 font-heading text-ash-100">Vex · Solen (MYTHIC)</div>

            <Link href="/tournaments/view?slug=ember-open" className="mt-6 inline-block">
              <Button variant="outline" size="sm">View Bracket →</Button>
            </Link>
          </Panel>
        </div>
      </section>

      {/* ===== QUICK GRID ===== */}
      <section className="container py-16 grid md:grid-cols-3 gap-4">
        <FeatureCard
          icon={<Swords className="h-5 w-5" />} tone="ember"
          title="Live Brackets"
          copy="Battle-tree visualization for single, double elimination, and pool-to-bracket formats."
          href="/tournaments"
        />
        <FeatureCard
          icon={<Trophy className="h-5 w-5" />} tone="gold"
          title="Seasonal Glory"
          copy="ELO-like ratings, league points, and a hall of fame that persists across seasons."
          href="/hall-of-fame"
        />
        <FeatureCard
          icon={<Users className="h-5 w-5" />} tone="rune"
          title="Guild Clubs"
          copy="Organize clubs, run internal ladders, host open tournaments, and rally your community."
          href="/clubs"
        />
      </section>

      <section className="container pb-16 grid lg:grid-cols-3 gap-4">
        <Panel variant="quest" padding="lg" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="heading-fantasy text-lg text-ash-100">Kingdom Notices</h3>
            <Link href="/news" className="text-xs text-spectral-500 hover:text-spectral-400">All announcements →</Link>
          </div>
          <ul className="divide-y divide-obsidian-500">
            <Notice kind="BRACKET_PUBLISHED" title="Ember Open — Quarterfinals Published" when="2h ago" />
            <Notice kind="RESULT"            title="Ember Cup — Champion crowned: Nyx · Kael" when="Yesterday" />
            <Notice kind="REGISTRATION"      title="Spring League IV — Registration opens Friday" when="2d ago" />
            <Notice kind="SPOTLIGHT"         title="Player of the Week: Sylva 'Stormwake' Renn" when="3d ago" />
          </ul>
        </Panel>

        <Panel variant="raised" padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="h-4 w-4 text-spectral-500" />
            <h3 className="heading-fantasy text-lg text-ash-100">Next Battles</h3>
          </div>
          <ul className="space-y-3 text-sm">
            <UpcomingMatch when="12:40" court="3" a="Vex · Solen" b="Rune · Ash" />
            <UpcomingMatch when="13:10" court="1" a="Nyx · Kael"  b="Mira · Jor" />
            <UpcomingMatch when="13:45" court="5" a="Sylva"       b="Thorne" />
            <UpcomingMatch when="14:20" court="2" a="Velo · Brand" b="Ira · Ost" />
          </ul>
          <Link href="/schedule" className="mt-5 inline-block">
            <Button variant="ghost" size="sm">View Full Schedule →</Button>
          </Link>
        </Panel>
      </section>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-mono tabular-nums text-2xl text-ash-100">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-ash-500 mt-1">{label}</div>
    </div>
  );
}

function HudStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="slab-raised px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-widest text-ash-500">{label}</div>
      <div className="font-mono text-ash-100 text-lg mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

function FeatureCard({
  icon, title, copy, href, tone,
}: {
  icon: React.ReactNode; title: string; copy: string; href: string;
  tone: "ember" | "rune" | "gold" | "spectral";
}) {
  return (
    <Link href={href}>
      <Panel variant="inventory" padding="lg" className="h-full">
        <div className="flex items-center gap-3">
          <div className={`
            inline-flex h-9 w-9 items-center justify-center rounded-pixel
            ${tone === "ember"    ? "bg-ember-500/15 text-ember-glow" : ""}
            ${tone === "rune"     ? "bg-rune-500/15 text-rune-glow" : ""}
            ${tone === "gold"     ? "bg-gold-500/15 text-gold-400" : ""}
            ${tone === "spectral" ? "bg-spectral-500/15 text-spectral-glow" : ""}
          `}>{icon}</div>
          <h3 className="heading-fantasy text-lg text-ash-100">{title}</h3>
        </div>
        <p className="mt-3 text-sm text-ash-300 leading-relaxed">{copy}</p>
      </Panel>
    </Link>
  );
}

function Notice({ kind, title, when }: { kind: string; title: string; when: string }) {
  const toneMap: Record<string, "ember" | "rune" | "gold" | "spectral"> = {
    BRACKET_PUBLISHED: "rune",
    RESULT: "gold",
    REGISTRATION: "spectral",
    SPOTLIGHT: "ember",
  };
  return (
    <li className="flex items-center justify-between py-3 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <RuneChip tone={toneMap[kind] ?? "neutral"} className="shrink-0">{kind.replace("_", " ")}</RuneChip>
        <span className="text-ash-200 truncate">{title}</span>
      </div>
      <span className="text-xs text-ash-500 shrink-0">{when}</span>
    </li>
  );
}

function UpcomingMatch({ when, court, a, b }: { when: string; court: string; a: string; b: string }) {
  return (
    <li className="flex items-center gap-3">
      <div className="font-mono text-ash-400 w-14 tabular-nums">{when}</div>
      <RuneChip tone="neutral" className="w-14 justify-center">Ct {court}</RuneChip>
      <div className="flex-1 text-ash-100 text-sm truncate">
        <span className="text-ash-100">{a}</span>
        <span className="text-ash-500 mx-2">vs</span>
        <span className="text-ash-100">{b}</span>
      </div>
    </li>
  );
}
