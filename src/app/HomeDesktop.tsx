import Link from "next/link";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { Flame, Swords, Trophy } from "lucide-react";

// Desktop homepage — hero + empty-state CTAs. No demo content: real data
// populates Tournaments + Dashboard once leagues and events are created.

export function HomeDesktop() {
  return (
    <main>
  <section className="relative overflow-hidden border-b border-obsidian-400">
    <div className="absolute inset-0 bg-rune-grid bg-grid opacity-[0.08] pointer-events-none" />
    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-ember-crack opacity-60" />
    <div className="container relative py-20 md:py-28 grid lg:grid-cols-12 gap-10 items-center">
      <div className="lg:col-span-7">
        <RuneChip tone="rune" pulse className="mb-5">
          <Flame className="h-3 w-3" /> Ladder League
        </RuneChip>
        <h1 className="heading-fantasy text-display-lg md:text-display-xl text-ash-100 leading-[1.05]">
          Run your ladder.{" "}
          <span className="text-ember-500">Win the court.</span>
        </h1>
        <p className="mt-5 text-ash-300 max-w-xl text-lg leading-relaxed">
          A mobile-first doubles ladder platform. Check in, play your
          session, verify scores, climb the ladder. Admins run attendance,
          generation, live monitoring, and finalization.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/ladder/check-in"><Button size="lg">Player Check-in</Button></Link>
          <Link href="/dashboard"><Button variant="rune" size="lg">Admin Dashboard</Button></Link>
        </div>

        {/* Build/version badge */}
        <div className="mt-5">
          <BuildBadge />
        </div>
      </div>

      <Panel variant="hud" padding="lg" glow="rune" className="lg:col-span-5 relative">
        <RuneChip tone="spectral" className="mb-3">Get Started</RuneChip>
        <div className="heading-fantasy text-2xl text-ash-100">No play dates yet</div>
        <div className="text-sm text-ash-400 mt-1">
          Admins: create a season and schedule your first play date to open
          check-in for players.
        </div>
        <div className="ember-divider my-6" />
        <Link href="/ladder/seasons">
          <Button variant="outline" size="sm">Manage Seasons →</Button>
        </Link>
      </Panel>
    </div>
  </section>

  <section className="container py-16 grid md:grid-cols-3 gap-4">
    <FeatureCard
      icon={<Swords className="h-5 w-5" />} tone="ember"
      title="Court-Centric Play"
      copy="Check in, see your court, play your rotation, enter and verify scores — all one-handed."
    />
    <FeatureCard
      icon={<Trophy className="h-5 w-5" />} tone="gold"
      title="Ladder Standings"
      copy="Individual rankings generated from doubles play. Live standings update on verified scores only."
    />
    <FeatureCard
      icon={<Flame className="h-5 w-5" />} tone="rune"
      title="Admin Control"
      copy="Attendance review, deterministic session generation, live monitoring, and explicit finalization."
    />
  </section>
</main>
  );
}

function FeatureCard({
  icon, title, copy, tone,
}: {
  icon: React.ReactNode; title: string; copy: string;
  tone: "ember" | "rune" | "gold" | "spectral";
}) {
  return (
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
  );
}

function BuildBadge({ compact = false }: { compact?: boolean }) {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
  const build = process.env.NEXT_PUBLIC_BUILD_TIME ?? "local";
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA?.slice(0, 7) ?? "local";

  return (
    <div
      className={`
        inline-flex items-center gap-2 rounded-pixel border border-obsidian-300
        bg-obsidian-800/60 text-ash-500
        ${compact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs"}
      `}
      title={`Version ${version} • Build ${build} • Commit ${sha}`}
    >
      <span>Version {version}</span>
      <span className="text-ash-600">•</span>
      <span>Build {build}</span>
      <span className="text-ash-600">•</span>
      <span>{sha}</span>
    </div>
  );
}
