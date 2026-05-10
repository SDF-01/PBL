"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MapPin, CheckCircle2, XCircle, Compass, ShieldCheck, Users, KeyRound, Hourglass, UserPlus2 } from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { getPlayDate, getVenue, listPlayDates, subscribeCheckIns } from "@/lib/ladder/repo";
import {
  createCheckIn,
  adminOverrideCheckIn,
  createCheckInByCode,
  markLateArrival,
} from "@/lib/ladder/write";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { distanceMeters } from "@/lib/ladder/geofence";
import { getLeague, getUserLeagueMembership } from "@/lib/leagues/repo";
import { getClubFacilityById } from "@/lib/clubs/repo";
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
  const initialCode = params.get("code") ?? "";
  const { user, ready, signIn } = useAuth();

  const { isSiteAdmin, leagueCoordinatorFor, coordinatorClubIds } = usePermissions();
  const isAdmin = isSiteAdmin || leagueCoordinatorFor.length > 0 || coordinatorClubIds.length > 0;

  const [playDates, setPlayDates] = useState<PlayDateDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string>(initialId ?? "");
  const [playDate, setPlayDate] = useState<PlayDateDoc | null>(null);
  const [venue, setVenue] = useState<VenueDoc | null>(null);
  /** True when the associated league has geoLocationAssistedCheckIn disabled. */
  const [geoRequired, setGeoRequired] = useState<boolean>(true);
  /** Resolved geofence center + radius from venue or facility. */
  const [geofence, setGeofence] = useState<{ lat: number; lng: number; radiusMeters: number; name: string } | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [checkIns, setCheckIns] = useState<CheckInDoc[]>([]);
  const [overriding, setOverriding] = useState<string | null>(null);
  const [memberCheck, setMemberCheck] = useState<"idle" | "checking" | "member" | "not-member">("idle");
  const [code, setCode] = useState<string>(initialCode);
  const [codeBusy, setCodeBusy] = useState(false);

  // Global (admin-only) selector list. Regular players never see it.
  useEffect(() => {
    if (!isFirebaseConfigured() || !isAdmin) return;
    listPlayDates().then(setPlayDates).catch(() => setPlayDates([]));
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedId) {
      setPlayDate(null);
      setVenue(null);
      setGeofence(null);
      setGeoRequired(true);
      setMemberCheck("idle");
      return;
    }
    (async () => {
      const pd = await getPlayDate(selectedId).catch(() => null);
      setPlayDate(pd);
      if (!pd) return;

      // Resolve geofence: prefer venue, fall back to facility coords
      const v = await getVenue(pd.venueId).catch(() => null);
      setVenue(v);

      let resolvedGeofence: typeof geofence = null;
      if (v && v.lat && v.lng) {
        resolvedGeofence = { lat: v.lat, lng: v.lng, radiusMeters: v.radiusMeters, name: v.name };
      } else if (pd.facilityId) {
        const facility = await getClubFacilityById(pd.facilityId).catch(() => null);
        if (facility?.lat && facility?.lng) {
          resolvedGeofence = {
            lat: facility.lat,
            lng: facility.lng,
            radiusMeters: facility.checkInRadiusMeters ?? 200,
            name: facility.facilityName ?? facility.address ?? "Facility",
          };
        }
      }
      setGeofence(resolvedGeofence);

      // Resolve league geo flag — geoRequired is true unless league explicitly disables it
      if (pd.leagueId) {
        const league = await getLeague(pd.leagueId).catch(() => null);
        setGeoRequired(league?.geoLocationAssistedCheckIn !== false);
      } else {
        // No league link — require geo only when we have valid geofence coords
        setGeoRequired(resolvedGeofence !== null);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Membership guard — non-admins must be a member of the league this play date belongs to.
  useEffect(() => {
    if (!user || !playDate || isAdmin) {
      setMemberCheck("idle");
      return;
    }
    if (!playDate.leagueId) {
      // Without a league link we can't gate; trust the existing geo gate.
      setMemberCheck("member");
      return;
    }
    setMemberCheck("checking");
    getUserLeagueMembership(playDate.leagueId, user.uid)
      .then((m) => setMemberCheck(m?.status === "active" ? "member" : "not-member"))
      .catch(() => setMemberCheck("not-member"));
  }, [user, playDate, isAdmin]);

  // If the QR deep link supplied a code, attempt code check-in once the play date loads.
  useEffect(() => {
    if (!user || !playDate || !initialCode || phase !== "idle") return;
    if (memberCheck !== "member") return;
    void submitCode(initialCode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, playDate, initialCode, memberCheck]);

  async function submitCode(rawCode: string) {
    if (!user || !playDate) return;
    setCodeBusy(true);
    setPhase("submitting");
    setMessage(null);
    try {
      await createCheckInByCode({
        playDateId: playDate.id,
        userId: user.uid,
        displayName: user.displayName ?? user.email ?? "Anonymous",
        code: rawCode,
        method: initialCode ? "QR" : "CODE",
      });
      setPhase("confirmed");
    } catch (err) {
      setPhase("error");
      setMessage(err instanceof Error ? err.message : "Code check-in failed.");
    } finally {
      setCodeBusy(false);
    }
  }

  async function onCheckIn() {
    if (!user || !playDate) return;

    // Manual check-in: league has disabled GPS requirement
    if (!geoRequired) {
      setPhase("submitting");
      setMessage(null);
      try {
        await createCheckIn({
          playDateId: playDate.id,
          userId: user.uid,
          displayName: user.displayName ?? user.email ?? "Anonymous",
          status: "CONFIRMED",
          method: "MANUAL",
        });
        setPhase("confirmed");
      } catch (err) {
        setPhase("error");
        setMessage(err instanceof Error ? err.message : "Check-in failed.");
      }
      return;
    }

    if (!("geolocation" in navigator)) {
      setPhase("error");
      setMessage("Geolocation is not supported by this browser.");
      return;
    }
    setPhase("locating");
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        let d: number | undefined;
        let within = true;
        if (geofence) {
          d = distanceMeters(
            { lat: pos.coords.latitude, lng: pos.coords.longitude },
            { lat: geofence.lat, lng: geofence.lng },
          );
          setDistance(d);
          within = d <= geofence.radiusMeters;
        }
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
            method: "GEO",
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

  async function handleMarkLate(checkInId: string) {
    if (!user) return;
    setOverriding(checkInId);
    try {
      await markLateArrival(checkInId, user.uid);
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
        method: "OVERRIDE",
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
              You&apos;re confirmed for this play date. Wait for the coordinator
              to generate Session A.
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
              {geofence?.radiusMeters ?? "?"}m). Try the code your coordinator
              posted, or request an override.
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
  }, [phase, distance, message, geofence?.radiusMeters]);

  // ── Non-admin without a playDate query param: guide back to leagues ──
  if (ready && user && !isAdmin && !selectedId) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-6 md:py-10 space-y-4 max-w-xl">
          <h1 className="heading-fantasy text-display-md text-ash-100">Check-In</h1>
          <Panel variant="quest" padding="lg" className="space-y-3">
            <p className="text-ash-300 text-sm">
              Pick a match day from your league page to check in. Check-in is
              always tied to a specific league play date.
            </p>
            <Link href="/leagues">
              <Button size="sm" className="w-full">Go to my leagues</Button>
            </Link>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

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

        {/* Admin-only global play-date selector. Players come here via a deep link. */}
        {user && isAdmin && !initialId && (
          <Panel variant="base" padding="md">
            <label className="text-xs text-ash-400 space-y-1 block">
              <span>Play date (admin view)</span>
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

        {user && playDate && memberCheck === "not-member" && (
          <Panel variant="base" padding="md" className="space-y-2">
            <p className="text-crimson-400 text-sm">
              You&apos;re not registered for this league. Join from the league
              page to check in.
            </p>
            {playDate.leagueId && (
              <Link href={`/leagues/${playDate.leagueId}`}>
                <Button size="sm" variant="outline">Go to league</Button>
              </Link>
            )}
          </Panel>
        )}

        {playDate && user && (isAdmin || memberCheck === "member") && (
          <Panel variant="inventory" padding="md">
            <div className="flex items-center gap-2 text-ash-200">
              <MapPin className="h-4 w-4 text-ember-500" />
              <span className="heading-fantasy text-lg">
                {geofence?.name ?? venue?.name ?? "Venue"}
              </span>
              {!geoRequired && (
                <RuneChip tone="spectral" className="text-[9px]">Manual Check-in</RuneChip>
              )}
            </div>
            <div className="text-xs text-ash-500 font-mono mt-1">
              Play date {playDate.date}
              {geoRequired && geofence ? ` · Allowed radius ${geofence.radiusMeters}m` : " · GPS not required"}
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
                    : geoRequired
                      ? "Check In Now"
                      : "Confirm Attendance"}
              </Button>
              <Link href={playDate.leagueId ? `/leagues/${playDate.leagueId}` : "/leagues"}>
                <Button size="md" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </Panel>
        )}

        {/* Short-code fallback for geofence trouble */}
        {playDate && user && (isAdmin || memberCheck === "member") && phase !== "confirmed" && (
          <Panel variant="base" padding="md" className="space-y-2">
            <div className="flex items-center gap-2 text-ash-200">
              <KeyRound className="h-4 w-4 text-spectral-400" />
              <span className="text-sm">Have a check-in code?</span>
            </div>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="6-char code"
                className="flex-1 bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100 font-mono uppercase tracking-widest"
                maxLength={12}
              />
              <Button
                size="md"
                variant="outline"
                disabled={!code.trim() || codeBusy}
                onClick={() => submitCode(code)}
              >
                {codeBusy ? "…" : "Use code"}
              </Button>
            </div>
            <p className="text-[11px] text-ash-500">
              Your coordinator shares this on the live session screen when GPS isn&apos;t working.
            </p>
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
                          {ci.distanceMeters != null ? `${Math.round(ci.distanceMeters)}m` : "No GPS"}
                          {ci.method ? ` · ${ci.method}` : ""}
                        </p>
                      </div>
                      <RuneChip
                        tone={
                          ci.status === "CONFIRMED" || ci.status === "ADMIN_CONFIRMED"
                            ? "success"
                            : ci.status === "PENDING" || ci.status === "LATE"
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
                      {ci.status === "NO_SHOW" && (
                        <button
                          onClick={() => handleMarkLate(ci.id)}
                          disabled={overriding === ci.id}
                          className="shrink-0 text-[11px] px-2 py-1 rounded bg-spectral-500/20 border border-spectral-500/40 text-spectral-300 hover:bg-spectral-500/30 transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          {overriding === ci.id ? "…" : (<><UserPlus2 className="h-3 w-3" /> Late</>)}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {playDate?.leagueId && (
                  <p className="text-[10px] text-ash-500 mt-3 flex items-center gap-1">
                    <Hourglass className="h-3 w-3" />
                    <Link
                      href={`/ladder/coordinator/${selectedId}`}
                      className="underline hover:text-ash-200"
                    >
                      Open live coordinator dashboard
                    </Link>
                  </p>
                )}
              </Panel>
            )}
          </div>
        )}
      </main>
    </ResponsiveShell>
  );
}
