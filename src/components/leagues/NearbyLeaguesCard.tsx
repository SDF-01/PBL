"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Flame, MapPin, Search } from "lucide-react";
import { listActiveLeagues } from "@/lib/leagues/repo";
import { distanceMeters } from "@/lib/ladder/geofence";
import type { LeagueDoc } from "@/lib/firestore/types";
import { LeagueResultCard } from "@/components/leagues/LeagueResultCard";

interface NearbyLeague extends LeagueDoc {
  distanceMeters: number;
}

type Status =
  | "idle"
  | "requesting"
  | "loading"
  | "ready"
  | "empty"
  | "denied"
  | "error";

function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  return `${miles.toFixed(1)} mi`;
}

function formatNextPlayDate(value?: string): string {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function NearbyLeaguesCard() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [leagues, setLeagues] = useState<NearbyLeague[]>([]);

  async function fetchNearbyLeagues(position: GeolocationCoordinates) {
    setStatus("loading");
    setError(null);
    try {
      const rows = await listActiveLeagues();
      const nearby = rows
        .filter((league) =>
          typeof league.latitude === "number" &&
          typeof league.longitude === "number",
        )
        .map((league) => ({
          ...league,
          distanceMeters: distanceMeters(
            { lat: position.latitude, lng: position.longitude },
            { lat: league.latitude as number, lng: league.longitude as number },
          ),
        }))
        .sort((a, b) => a.distanceMeters - b.distanceMeters);

      if (nearby.length === 0) {
        setLeagues([]);
        setStatus("empty");
        return;
      }

      setLeagues(nearby);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load nearby leagues.");
      setStatus("error");
    }
  }

  function requestLocation() {
    setStatus("requesting");
    setError(null);

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError("Location is not supported by this browser.");
      setStatus("denied");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchNearbyLeagues(position.coords);
      },
      (geoError) => {
        setError(geoError.message || "Location permission was denied.");
        setStatus("denied");
      },
      { timeout: 15000 },
    );
  }

  const featured = useMemo(() => leagues[0], [leagues]);
  const alternatives = useMemo(() => leagues.slice(1, 4), [leagues]);

  return (
    <Panel variant="hud" padding="lg" className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="rounded-pixel bg-rune-600/10 p-3 text-rune-300">
          <MapPin className="h-5 w-5" />
        </div>
        <div>
          <div className="text-ash-400 text-xs uppercase tracking-[0.2em]">
            Leagues Near You
          </div>
          <h2 className="heading-fantasy text-2xl text-ash-100">Find the closest league near you</h2>
        </div>
      </div>

      {status === "idle" ? (
        <div className="space-y-4">
          <p className="text-ash-400 text-sm">
            Allow location access to see nearby pickleball leagues.
          </p>
          <Button onClick={requestLocation} size="md">
            <Search className="h-4 w-4" /> Use My Location
          </Button>
        </div>
      ) : status === "requesting" || status === "loading" ? (
        <div className="space-y-4">
          <p className="text-ash-400 text-sm">Finding nearby leagues…</p>
          <div className="h-24 rounded-pixel bg-obsidian-700" />
        </div>
      ) : status === "denied" || status === "error" ? (
        <div className="space-y-4">
          <p className="text-ash-100 text-base">Location Needed</p>
          <p className="text-ash-400 text-sm">
            {error ?? "Location access is required to show nearby leagues."}
          </p>
          <Button onClick={requestLocation} size="md">
            Try Again
          </Button>
        </div>
      ) : status === "empty" ? (
        <div className="space-y-4">
          <p className="text-ash-100 text-base">No Nearby League Found</p>
          <p className="text-ash-400 text-sm">
            No active league was found near your current location.
          </p>
          <Link href="/auth/signup?leagueId=" className="block w-full">
            <Button size="md" className="w-full">Create Account</Button>
          </Link>
        </div>
      ) : featured ? (
        <div className="space-y-5">
          <div className="space-y-4">
            <div className="text-ash-100 text-base">Closest League</div>
            <LeagueResultCard
              league={featured}
              distanceLabel={formatDistance(featured.distanceMeters)}
              nextPlayDateLabel={formatNextPlayDate(featured.next_play_date as string | undefined)}
              statusLabel={featured.check_in_status ?? "Active"}
              actionLabel="Login"
              actionHref={`/auth/login?leagueId=${featured.id}`}
              secondaryActionLabel="Create Account"
              secondaryActionHref={`/auth/signup?leagueId=${featured.id}`}
            />
          </div>

          {alternatives.length > 0 ? (
            <div className="space-y-3">
              <div className="text-ash-400 text-xs uppercase tracking-[0.2em]">
                Nearby Alternatives
              </div>
              <div className="space-y-3">
                {alternatives.map((league) => (
                  <LeagueResultCard
                    key={league.id}
                    league={league}
                    distanceLabel={formatDistance(league.distanceMeters)}
                    nextPlayDateLabel={formatNextPlayDate(league.next_play_date as string | undefined)}
                    statusLabel={league.check_in_status ?? "Active"}
                    actionLabel="View League"
                    actionHref={`/leagues/${league.id}`}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
