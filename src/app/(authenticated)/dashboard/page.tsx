"use client";

import { useDevice } from "@/lib/device";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { ArrowUpRight, Flame, Swords, Trophy } from "lucide-react";

interface Kpi {
  label: string; value: string; delta: string;
  tone: "ember" | "rune" | "gold" | "spectral";
  icon: React.ReactNode;
}
const KPIS: Kpi[] = [
  { label: "Rating",      value: "1742", delta: "+24",  tone: "rune",     icon: <Flame className="h-4 w-4" /> },
  { label: "Season Rank", value: "#18",  delta: "▲ 5",  tone: "spectral", icon: <ArrowUpRight className="h-4 w-4" /> },
  { label: "Win Streak",  value: "6",    delta: "Hot",  tone: "ember",    icon: <Swords className="h-4 w-4" /> },
  { label: "Trophies",    value: "3",    delta: "Gold", tone: "gold",     icon: <Trophy className="h-4 w-4" /> },
];

interface LogEntry { d: string; e: string; o: string; s: string; r: string; w: boolean; }
const LOG: LogEntry[] = [
  { d: "Apr 14", e: "Ember Open",    o: "Rune · Ash",  s: "11-7, 11-5",        r: "+14", w: true  },
  { d: "Apr 13", e: "Ember Open",    o: "Ira · Ost",   s: "11-9, 8-11, 12-10", r: "+11", w: true  },
  { d: "Apr 10", e: "Spring Ladder", o: "Thorne",      s: "9-11, 6-11",        r: "-8",  w: false },
  { d: "Apr 07", e: "Spring Ladder", o: "Velo",        s: "11-3, 11-6",        r: "+7",  w: true  },
];

export default function DashboardHome() {
  const { isMobile } = useDevice();
  return isMobile ? <DashboardMobile /> : <DashboardDesktop />;
}

/* ============ DESKTOP ============ */
function DashboardDesktop() {
  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="heading-fantasy text-display-md text-ash-100">Welcome back, Champion</div>
          <p className="text-ash-400 text-sm mt-1">Season IV · Spring Campaign · Week 4</p>
        </div>
        <div className="flex gap-2">
          <Link href="/my-matches"><Button variant="outline" size="sm">My Matches</Button></Link>
          <Link href="/tournaments"><Button size="sm">Enter Tournament</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {KPIS.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel variant="hud" padding="lg" glow="ember" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <RuneChip tone="ember" pulse>Match Ready</RuneChip>
            <span className="text-xs text-ash-500 font-mono">Court 3 · 12:40</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <ScorePill name="You · Solen" seed={4} align="left" />
            <div className="heading-display text-ember-500 text-xs">VS</div>
            <ScorePill name="Rune · Ash" seed={13} align="right" />
          </div>
          <div className="ember-divider my-5" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm">Check In</Button>
            <Button variant="outline" size="sm">View Bracket</Button>
            <Button variant="ghost" size="sm">Report an Issue</Button>
          </div>
        </Panel>

        <Panel variant="raised" padding="lg">
          <h3 className="heading-fantasy text-lg text-ash-100 mb-3">Recent Form</h3>
          <FormRow size="md" />
          <div className="mt-5 text-xs text-ash-400">6-match streak · +24 rating this week</div>
        </Panel>
      </div>

      <Panel variant="raised" padding="none">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="heading-fantasy text-lg text-ash-100">Battle Log</h3>
          <Link href="/my-stats" className="text-xs text-spectral-500 hover:text-spectral-400">View full history →</Link>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th><th>Event</th><th>Opponent</th>
              <th className="text-right">Score</th>
              <th className="text-right">Rating Δ</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {LOG.map((row, i) => (
              <tr key={i}>
                <td className="font-mono text-ash-400">{row.d}</td>
                <td className="text-ash-200">{row.e}</td>
                <td className="text-ash-200">{row.o}</td>
                <td className="num text-ash-100">{row.s}</td>
                <td className={`num ${row.w ? "text-rune-glow" : "text-crimson-400"}`}>{row.r}</td>
                <td>{row.w ? <RuneChip tone="rune">Win</RuneChip> : <RuneChip tone="crimson">Loss</RuneChip>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

/* ============ MOBILE ============ */
function DashboardMobile() {
  return (
    <div className="space-y-4">
      <div>
        <div className="heading-fantasy text-2xl text-ash-100 leading-tight">Welcome back, Champion</div>
        <p className="text-ash-400 text-xs mt-1">Season IV · Week 4</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {KPIS.map((k) => <KpiCard key={k.label} {...k} compact />)}
      </div>

      <Panel variant="hud" padding="md" glow="ember">
        <div className="flex items-center justify-between mb-3">
          <RuneChip tone="ember" pulse>Match Ready</RuneChip>
          <span className="text-xs text-ash-500 font-mono">Ct 3 · 12:40</span>
        </div>
        <div className="space-y-2">
          <ScorePill name="You · Solen" seed={4} align="left" />
          <div className="text-center heading-display text-ember-500 text-[10px]">VS</div>
          <ScorePill name="Rune · Ash" seed={13} align="left" />
        </div>
        <div className="ember-divider my-4" />
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" className="w-full">Check In</Button>
          <Button variant="outline" size="sm" className="w-full">Bracket</Button>
        </div>
      </Panel>

      <Panel variant="raised" padding="md">
        <h3 className="heading-fantasy text-sm text-ash-100 mb-2">Recent Form</h3>
        <FormRow size="sm" />
        <div className="mt-3 text-[11px] text-ash-400">6-streak · +24 rating this week</div>
      </Panel>

      <Panel variant="raised" padding="md">
        <div className="flex items-center justify-between mb-3">
          <h3 className="heading-fantasy text-sm text-ash-100">Battle Log</h3>
          <Link href="/my-stats" className="text-[11px] text-spectral-500">All →</Link>
        </div>
        <ul className="divide-y divide-obsidian-500">
          {LOG.map((row, i) => (
            <li key={i} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-ash-100 text-sm truncate">vs {row.o}</div>
                  <div className="text-[11px] text-ash-500 mt-0.5">
                    <span className="font-mono">{row.d}</span> · {row.e}
                  </div>
                </div>
                {row.w
                  ? <RuneChip tone="rune" className="shrink-0">Win</RuneChip>
                  : <RuneChip tone="crimson" className="shrink-0">Loss</RuneChip>}
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="font-mono text-xs text-ash-300">{row.s}</span>
                <span className={`font-mono text-xs ${row.w ? "text-rune-glow" : "text-crimson-400"}`}>{row.r}</span>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

/* ============ SHARED ============ */

function KpiCard({
  label, value, delta, tone, icon, compact = false,
}: Kpi & { compact?: boolean }) {
  const toneClass = {
    ember: "text-ember-glow", rune: "text-rune-glow",
    gold: "text-gold-400",    spectral: "text-spectral-glow",
  }[tone];
  return (
    <Panel variant="raised" padding={compact ? "sm" : "md"} className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-ash-500">{label}</span>
        <span className={toneClass}>{icon}</span>
      </div>
      <div className={`font-mono ${compact ? "text-xl" : "text-2xl"} text-ash-100 tabular-nums`}>{value}</div>
      <div className={`text-xs ${toneClass}`}>{delta}</div>
    </Panel>
  );
}

function ScorePill({ name, seed, align }: { name: string; seed: number; align: "left" | "right" }) {
  return (
    <div className={`flex items-center gap-3 ${align === "right" ? "justify-end" : ""}`}>
      <RuneChip tone="neutral">#{seed}</RuneChip>
      <div className="heading-fantasy text-ash-100 text-base md:text-lg truncate">{name}</div>
    </div>
  );
}

function FormRow({ size }: { size: "sm" | "md" }) {
  const box = size === "sm" ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm";
  return (
    <div className="flex gap-1.5">
      {["W","W","L","W","W","W"].map((r, i) => (
        <span
          key={i}
          className={`${box} inline-flex items-center justify-center font-mono rounded-pixel border ${
            r === "W"
              ? "bg-rune-500/15 border-rune-500/40 text-rune-glow"
              : "bg-crimson-500/15 border-crimson-500/40 text-crimson-400"
          }`}
        >{r}</span>
      ))}
    </div>
  );
}
