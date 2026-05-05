import Link from "next/link";
import { Building2, CalendarDays, Eye, Layers, Settings, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import type { ClubDoc } from "@/lib/permissions/types";

interface ActiveClubCardProps {
  club: ClubDoc;
}

export function ActiveClubCard({ club }: ActiveClubCardProps) {
  const manageBase = `/clubs/manage/${club.id}`;
  const publicBase = `/clubs/${club.slug ?? club.id}`;

  return (
    <Panel variant="hud" padding="lg" className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 p-2 rounded bg-ember-900/50 shrink-0">
          <Building2 className="h-5 w-5 text-ember-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="heading-fantasy text-ash-100 text-base">{club.clubName}</h3>
            <RuneChip tone="gold">Club Director</RuneChip>
          </div>
          <p className="text-ash-400 text-xs mb-1">{club.location}</p>
          {club.description && (
            <p className="text-ash-500 text-xs line-clamp-2">{club.description}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-ash-800">
        <Link href={`${manageBase}?section=leagues`}>
          <button className="w-full flex flex-col items-center gap-1.5 p-2.5 rounded bg-obsidian-700 hover:bg-obsidian-600 text-ash-300 hover:text-ash-100 transition-colors text-center">
            <Layers className="h-4 w-4 text-ember-400" />
            <span className="text-[10px] font-medium tracking-wide uppercase">Leagues</span>
          </button>
        </Link>
        <Link href={`${manageBase}?section=facilities`}>
          <button className="w-full flex flex-col items-center gap-1.5 p-2.5 rounded bg-obsidian-700 hover:bg-obsidian-600 text-ash-300 hover:text-ash-100 transition-colors text-center">
            <CalendarDays className="h-4 w-4 text-ember-400" />
            <span className="text-[10px] font-medium tracking-wide uppercase">Facilities</span>
          </button>
        </Link>
        <Link href={`${manageBase}?section=coordinators`}>
          <button className="w-full flex flex-col items-center gap-1.5 p-2.5 rounded bg-obsidian-700 hover:bg-obsidian-600 text-ash-300 hover:text-ash-100 transition-colors text-center">
            <Users className="h-4 w-4 text-ember-400" />
            <span className="text-[10px] font-medium tracking-wide uppercase">Coordinators</span>
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link href={publicBase}>
          <Button size="sm" variant="ghost" className="w-full border border-ash-700 text-ash-300 hover:text-ash-100">
            <Eye className="h-3.5 w-3.5" /> View Page
          </Button>
        </Link>
        <Link href={manageBase}>
          <Button size="sm" className="w-full">
            <Settings className="h-3.5 w-3.5" /> Manage Club
          </Button>
        </Link>
      </div>
    </Panel>
  );
}
