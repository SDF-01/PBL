import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { CalendarDays, MapPin, Users } from "lucide-react";

const TOURNAMENTS = [
  { slug: "ember-open",       name: "The Ember Open",      format: "Mixed Doubles · Open",      type: "Double Elim", entrants: 64, status: "LIVE",       starts: "Apr 18", venue: "Ember Hall" },
  { slug: "ember-cup",         name: "Ember Cup",           format: "Men's Singles · Open",      type: "Single Elim", entrants: 32, status: "COMPLETED",  starts: "Apr 05", venue: "Rune Courts" },
  { slug: "spring-ladder",     name: "Spring Ladder IV",    format: "All Formats · Intermediate",type: "Ladder",      entrants: 48, status: "REG_OPEN",   starts: "May 02", venue: "Obsidian Gym" },
  { slug: "masters-invitational", name: "Masters Invitational", format: "50+ Masters",           type: "Pool → Bracket", entrants: 16, status: "SEEDING", starts: "May 11", venue: "Stonekeep" },
] as const;

const STATUS_TONE: Record<string, Parameters<typeof RuneChip>[0]["tone"]> = {
  LIVE: "ember",
  REG_OPEN: "spectral",
  SEEDING: "rune",
  COMPLETED: "gold",
};
const STATUS_LABEL: Record<string, string> = {
  LIVE: "Live",
  REG_OPEN: "Registration Open",
  SEEDING: "Seeding",
  COMPLETED: "Completed",
};

export default function TournamentsPage() {
  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="heading-fantasy text-display-md text-ash-100">Tournaments</h1>
            <p className="text-ash-400 text-sm mt-1">Open registrations, live brackets, and resolved campaigns.</p>
          </div>
          <Link href="/admin/tournaments"><Button variant="outline">Create Tournament</Button></Link>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {TOURNAMENTS.map((t) => (
            <Panel key={t.slug} variant="inventory" padding="lg" className="group">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <Link href={`/tournaments/view?slug=${t.slug}`} className="heading-fantasy text-xl text-ash-100 group-hover:text-ember-400 transition-colors">
                    {t.name}
                  </Link>
                  <div className="text-sm text-ash-400 mt-1">{t.format}</div>
                </div>
                <RuneChip tone={STATUS_TONE[t.status]} pulse={t.status === "LIVE"}>
                  {STATUS_LABEL[t.status]}
                </RuneChip>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4">
                <Meta icon={<CalendarDays className="h-3.5 w-3.5" />} label={t.starts} />
                <Meta icon={<Users className="h-3.5 w-3.5" />} label={`${t.entrants} entrants`} />
                <Meta icon={<MapPin className="h-3.5 w-3.5" />} label={t.venue} />
              </div>

              <div className="ember-divider my-5" />

              <div className="flex justify-between items-center">
                <span className="text-xs text-ash-500">{t.type}</span>
                <Link href={`/tournaments/view?slug=${t.slug}`}>
                  <Button variant="ghost" size="sm">View →</Button>
                </Link>
              </div>
            </Panel>
          ))}
        </div>
      </main>
    </ResponsiveShell>
  );
}

function Meta({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-ash-300">
      <span className="text-ash-500">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
