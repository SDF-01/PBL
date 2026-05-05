"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MapPin, CheckCircle2, XCircle, Compass, ShieldCheck, Users } from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { getPlayDate, getVenue, listPlayDates, subscribeCheckIns } from "@/lib/ladder/repo";
import { createCheckIn, adminOverrideCheckIn } from "@/lib/ladder/write";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { distanceMeters } from "@/lib/ladder/geofence";
import type {
  CheckInDoc,
  PlayDateDoc,
  VenueDoc,
  CheckInStatus,
} from "@/lib/firestore/types";

type Phase =
  | "idle"
  | "locating"
  | "submitting"
  | "confirmed"
  | "geo-rejected"
  | "pending-admin"
  | "error";

export default function CheckInPage() {
  return (
    <Suspense
      fallback={
        <ResponsiveShell desktopChromeless>
          <main className="container py-10 text-ash-400">Loading…</main>
        </ResponsiveShell>
      }
    >
      <CheckInInner />
    </Suspense>
  );
}

function CheckInInner() {
  const params = useSearchParams();
  const initialId = params.get("playDate");
  const { user, ready, signIn } = useAuth();

  const { isSiteAdmin, leagueCoordinatorFor, coordinatorClubIds } = usePermissions();
  const isAdmin = isSiteAdmin || leagueCoordinatorFor.length > 0 || coordinatorClubIds.length > 0;

  const [playDates, setPlayDates] = useState<PlayDateDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string>(initialId ?? "");
  const [playDate, setPlayDate] = useState<PlayDateDoc | null>(null);
  const [venue, setVenue] = useState<VenueDoc | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [checkIns, setCheckIns] = useState<CheckInDoc[]>([]);
  const [overriding, setOverriding] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    listPlayDates().then(setPlayDates).catch(() => setPlayDates([]));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setPlayDate(null);
      setVenue(null);
      return;
    }
    (async () => {
      const pd = await getPlayDate(selectedId).catch(() => null);
      setPlayDate(pd);
      if (pd) {
        const v = await getVenue(pd.venueId).catch(() => null);
        setVenue(v);
      }
    })();
  }, [selectedId]);

  async function onCheckIn() {
    if (!user || !playDate || !venue) return;
    if (!("geolocation" in navigator)) {
      setPhase("error");
      setMessage("Geolocation is not supported by this browser.");
      return;
    }
    setPhase("locating");
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const d = distanceMeters(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          { lat: venue.lat, lng: venue.lng },
        );
        setDistance(d);
        const within = d <= venue.radiusMeters;
        const status: CheckInStatus = within ? "CONFIRMED" : "GEO_REJECTED";
        setPhase("submitting");
        try {
          await createCheckIn({
            playDateId: playDate.id,
            userId: user.uid,
            displayName: user.displayName ?? user.email ?? "Anonymous",
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            distanceMeters: d,
            status,
          });
          setPhase(within ? "confirmed" : "geo-rejected");
        } catch (err) {
          setPhase("error");
          setMessage(err instanceof Error ? err.message : "Check-in failed.");
        }
      },
      (err) => {
        setPhase("error");
        setMessage(err.message);
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  // Subscribe to check-ins when a play date is selected (admin view)
  useEffect(() => {
    if (!selectedId || !isAdmin) return;
    const unsub = subscribeCheckIns(selectedId, setCheckIns);
    return () => unsub();
  }, [selectedId, isAdmin]);

  async function handleAdminOverride(checkInId: string) {
    if (!user) return;
    setOverriding(checkInId);
    try {
      await adminOverrideCheckIn(checkInId, user.uid);
    } finally {
      setOverriding(null);
    }
  }

  async function onRequestAdminOverride() {
    if (!user || !playDate) return;
    setPhase("submitting");
    setMessage(null);
    try {
      await createCheckIn({
        playDateId: playDate.id,
        userId: user.uid,
        displayName: user.displayName ?? user.email ?? "Anonymous",
        distanceMeters: distance ?? undefined,
        status: "PENDING",
      });
      setPhase("pending-admin");
    } catch (err) {
      setPhase("error");
      setMessage(err instanceof Error ? err.message : "Request failed.");
    }
  }

  const statusCard = useMemo(() => {
    switch (phase) {
      case "confirmed":
        return (
          <Panel variant="quest" padding="md" glow="ember">
            <div className="flex items-center gap-2 text-ember-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="heading-fantasy text-lg">Checked in</span>
            </div>
            <p className="text-ash-400 text-sm mt-1">
              You&apos;re within the venue geofence. Wait for the admin to
              generate Session A.
            </p>
          </Panel>
        );
      case "geo-rejected":
        return (
          <Panel variant="base" padding="md">
            <div className="flex items-center gap-2 text-crimson-500">
              <XCircle className="h-5 w-5" />
              <span className="heading-fantasy text-lg">
                Outside geofence
              </span>
            </div>
            <p className="text-ash-400 text-sm mt-1">
              You&apos;re{" "}
              <span className="font-mono text-ash-200">
                {distance != null ? Math.round(distance) : "?"}m
              </span>{" "}
              from the venue center (allowed radius{" "}
              {venue?.radiusMeters ?? "?"}m). Ask an admin for an override.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={onRequestAdminOverride}
            >
              Request admin override
            </Button>
          </Panel>
        );
      case "pending-admin":
        return (
          <Panel variant="base" padding="md">
            <div className="flex items-center gap-2 text-spectral-500">
              <Compass className="h-5 w-5" />
              <span className="heading-fantasy text-lg">
                Awaiting admin override
              </span>
            </div>
            <p className="text-ash-400 text-sm mt-1">
              Your check-in request is pending. Flag down the event admin.
            </p>
          </Panel>
        );
      case "error":
        return (
          <Panel variant="base" padding="md">
            <p className="text-crimson-500 text-sm">
              {message ?? "Something went wrong."}
            </p>
          </Panel>
        );
      default:
        return null;
    }
  }, [phase, distance, message, venue?.radiusMeters]);

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-xl">
        <div>
          <h1 className="heading-fantasy text-display-md text-ash-100">
            Check-In
          </h1>
          <p className="text-ash-400 text-sm mt-1">
            Confirm your attendance within the venue geofence to join
            Session A.
          </p>
        </div>

        {ready && !user && (
          <Panel variant="quest" padding="lg">
            <RuneChip tone="rune" className="mb-3">
              Sign-in required
            </RuneChip>
            <Button size="sm" onClick={() => signIn().catch(() => {})}>
              Sign in with Google
            </Button>
          </Panel>
        )}

        {user && (
          <Panel variant="base" padding="md">
            <label className="text-xs text-ash-400 space-y-1 block">
              <span>Play date</span>
              <select
                className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setPhase("idle");
                  setDistance(null);
                  setMessage(null);
                }}
              >
                <option value="">— Select —</option>
                {playDates.map((pd) => (
                  <option key={pd.id} value={pd.id}>
                    {pd.date}
                  </option>
                ))}
              </select>
            </label>
          </Panel>
        )}

        {playDate && venue && user && (
          <Panel variant="inventory" padding="md">
            <div className="flex items-center gap-2 text-ash-200">
              <MapPin className="h-4 w-4 text-ember-500" />
              <span className="heading-fantasy text-lg">{venue.name}</span>
            </div>
            <div className="text-xs text-ash-500 font-mono mt-1">
              Play date {playDate.date} · Allowed radius{" "}
              {venue.radiusMeters}m
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                size="md"
                onClick={onCheckIn}
                disabled={phase === "locating" || phase === "submitting"}
              >
                {phase === "locating"
                  ? "Locating…"
                  : phase === "submitting"
                    ? "Checking in…"
                    : "Check In Now"}
              </Button>
              <Link href="/ladder/play-dates">
                <Button size="md" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </Panel>
        )}

        {statusCard}

        {/* Coordinator override panel */}
        {isAdmin && selectedId && (
          <div className="space-y-3 border-t border-obsidian-600 pt-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-ember-400" />
              <h2 className="heading-fantasy text-ash-100 text-base">Check-In Management</h2>
              <RuneChip tone="ember" className="text-[9px]">Coordinator</RuneChip>
            </div>

            {checkIns.length === 0 ? (
              <Panel variant="base" padding="md" className="flex items-center gap-3 text-ash-500">
                <Users className="h-4 w-4" />
                <span className="text-sm">No check-ins yet for this play date.</span>
              </Panel>
            ) : (
              <Panel variant="inventory" padding="md">
                <ul className="divide-y divide-obsidian-600">
                  {checkIns.map((ci) => (
                    <li key={ci.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-ash-200 text-sm truncate">{ci.displayName}</p>
                        <p className="text-ash-500 text-[11px] font-mono">
                          {ci.distanceMeters != null ? `${Math.round(ci.distanceMeters)}m from venue` : "No GPS"}
                        </p>
                      </div>
                      <RuneChip
                        tone={
                          ci.status === "CONFIRMED" || ci.status === "ADMIN_CONFIRMED"
                            ? "success"
                            : ci.status === "PENDING"
                            ? "warning"
                            : "crimson"
                        }
                        className="text-[9px] shrink-0"
                      >
                        {ci.status}
                      </RuneChip>
                      {(ci.status === "GEO_REJECTED" || ci.status === "PENDING") && (
                        <button
                          onClick={() => handleAdminOverride(ci.id)}
                          disabled={overriding === ci.id}
                          className="shrink-0 text-[11px] px-2 py-1 rounded bg-ember-500/20 border border-ember-500/40 text-ember-400 hover:bg-ember-500/30 transition-colors disabled:opacity-50"
                        >
                          {overriding === ci.id ? "…" : "Override"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        )}
      </main>
    </ResponsiveShell>
  );
}
