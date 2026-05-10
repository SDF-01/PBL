"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Loader2, AlertCircle, Navigation, CalendarDays } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { listActiveLeagues } from "@/lib/leagues/repo";
import { haversineDistanceMiles, isValidCoordinate } from "@/lib/geo/geocode";
import type { LeagueDoc } from "@/lib/firestore/types";

type GeoState = "idle" | "requesting" | "granted" | "denied" | "error";

interface LeagueWithDistance extends LeagueDoc {
  distanceMiles: number;
}

export function NearbyLeaguesCard() {
  const [geoState, setGeoState] = useState<GeoState>("idle");
  const [leagues, setLeagues] = useState<LeagueWithDistance[]>([]);
  const [loading, setLoading] = useState(false);

  function requestLocation() {
    setGeoState("requesting");
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGeoState("granted");
        try {
          const all = await listActiveLeagues();
          const withDist: LeagueWithDistance[] = all
            .filter((l) => isValidCoordinate(l.latitude, l.longitude))
            .map((l) => ({
              ...l,
              distanceMiles: haversineDistanceMiles(
                pos.coords.latitude, pos.coords.longitude,
                l.latitude!, l.longitude!,
              ),
            }))
            .sort((a, b) => a.distanceMiles - b.distanceMiles);
          setLeagues(withDist);
        } catch {
          // network error — show empty state
          setLeagues([]);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setGeoState(err.code === 1 ? "denied" : "error");
        setLoading(false);
      },
      { timeout: 10_000 },
    );
  }

  const featured = leagues[0] ?? null;
  const alternatives = leagues.slice(1, 4);

  if (geoState === "idle") {
    return (
      <Panel variant="hud" padding="lg" glow="rune">
        <RuneChip tone="spectral" className="mb-2">
          <MapPin className="h-3 w-3 mr-1" /> League Discovery
        </RuneChip>
        <p className="heading-fantasy text-ash-100 text-base mb-1">Find the closest league near you</p>
        <p className="text-ash-400 text-sm mb-4">
          Allow location access to see nearby pickleball leagues.
        </p>
        <Button size="sm" variant="outline" onClick={requestLocation}>
          <Navigation className="h-3.5 w-3.5 mr-1" /> Use My Location
        </Button>
      </Panel>
    );
  }

  if (geoState === "requesting" || loading) {
    return (
      <Panel variant="hud" padding="lg">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-ember-400 animate-spin shrink-0" />
          <div>
            <p className="heading-fantasy text-ash-100 text-sm">Finding nearby leagues</p>
            <p className="text-ash-500 text-xs">Checking your location and looking for active leagues.</p>
          </div>
        </div>
      </Panel>
    );
  }

  if (geoState === "denied" || geoState === "error") {
    return (
      <Panel variant="hud" padding="lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-gold-400 shrink-0 mt-0.5" />
          <div>
            <p className="heading-fantasy text-ash-100 text-sm mb-1">Location Needed</p>
            <p className="text-ash-400 text-xs mb-3">
              Location access is required to show nearby leagues.
            </p>
            <Button size="sm" variant="outline" onClick={requestLocation}>Try Again</Button>
          </div>
        </div>
      </Panel>
    );
  }

  if (geoState === "granted" && leagues.length === 0) {
    return (
      <Panel variant="hud" padding="lg">
        <RuneChip tone="neutral" className="mb-2">No Leagues Found</RuneChip>
        <p className="text-ash-400 text-sm mb-4">
          No active league was found near your current location.
        </p>
        <Link href="/auth/signup">
          <Button size="sm">Create Account</Button>
        </Link>
      </Panel>
    );
  }

  return (
    <Panel variant="hud" padding="lg" className="space-y-4">
      <RuneChip tone="spectral" className="mb-1">
        <MapPin className="h-3 w-3 mr-1" /> Leagues Near You
      </RuneChip>

      {featured && (
        <div className="rounded-pixel border border-ember-500/40 bg-ember-900/10 p-3 space-y-2">
          <div className="flex items-center gap-1.5 mb-1">
            <RuneChip tone="ember" className="text-[9px]">Closest League</RuneChip>
            <span className="text-ash-500 text-[10px]">{featured.distanceMiles.toFixed(1)} mi away</span>
          </div>
          <p className="heading-fantasy text-ash-100 text-sm leading-snug">{featured.name}</p>
          {(featured.city || featured.state) && (
            <p className="text-ash-500 text-xs flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {[featured.city, featured.state].filter(Boolean).join(", ")}
            </p>
          )}
          {featured.next_play_date && (
            <p className="text-ash-400 text-xs flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              Next: {featured.next_play_date}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Link href={`/auth/login?leagueId=${featured.id}`}>
              <Button size="sm" variant="outline" className="text-xs">Login</Button>
            </Link>
            <Link href={`/auth/signup?leagueId=${featured.id}`}>
              <Button size="sm" className="text-xs">Create Account</Button>
            </Link>
          </div>
        </div>
      )}

      {alternatives.length > 0 && (
        <div>
          <p className="text-ash-500 text-[10px] uppercase tracking-widest mb-2">Nearby Alternatives</p>
          <div className="space-y-2">
            {alternatives.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-pixel border border-obsidian-600 bg-obsidian-800"
              >
                <div className="min-w-0">
                  <p className="text-ash-200 text-xs font-medium truncate">{l.name}</p>
                  <p className="text-ash-500 text-[10px]">
                    {[l.city, l.state].filter(Boolean).join(", ")} · {l.distanceMiles.toFixed(1)} mi
                  </p>
                </div>
                <Link href={`/leagues/${l.id}`} className="shrink-0">
                  <Button size="sm" variant="ghost" className="text-xs">View</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
