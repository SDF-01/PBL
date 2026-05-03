import Link from "next/link";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import type { LeagueDoc } from "@/lib/firestore/types";

interface LeagueResultCardProps {
  league: LeagueDoc;
  distanceLabel: string;
  nextPlayDateLabel: string;
  statusLabel?: string;
  actionLabel: string;
  actionHref: string;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
}

export function LeagueResultCard({
  league,
  distanceLabel,
  nextPlayDateLabel,
  statusLabel,
  actionLabel,
  actionHref,
  secondaryActionLabel,
  secondaryActionHref,
}: LeagueResultCardProps) {
  return (
    <Panel variant="inventory" padding="lg" className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-ash-400">{league.city}, {league.state ?? ""}</div>
          <h2 className="heading-fantasy text-lg text-ash-100">{league.name}</h2>
        </div>
        <div className="rounded-pixel bg-obsidian-800 px-3 py-2 text-xs text-ash-300">
          {distanceLabel}
        </div>
      </div>

      {statusLabel ? (
        <div className="text-xs uppercase tracking-[0.24em] text-ember-300">
          {statusLabel}
        </div>
      ) : null}

      <div className="grid gap-2 text-sm text-ash-300">
        <div>
          <span className="text-ash-100">Next play date:</span> {nextPlayDateLabel}
        </div>
        <div>
          <span className="text-ash-100">Format:</span> {league.league_format ?? "Pickleball league"}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href={actionHref} className="w-full">
          <Button size="sm" className="w-full">{actionLabel}</Button>
        </Link>
        {secondaryActionLabel && secondaryActionHref ? (
          <Link href={secondaryActionHref} className="w-full">
            <Button variant="outline" size="sm" className="w-full">
              {secondaryActionLabel}
            </Button>
          </Link>
        ) : null}
      </div>
    </Panel>
  );
}
