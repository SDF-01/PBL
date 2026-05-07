"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Layers,
  Loader2,
  LogIn,
  MapPin,
  Save,
  Settings,
  ShieldCheck,
  Sun,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { listClubFacilities } from "@/lib/clubs/repo";
import { getLeague, getUserLeagueMembership } from "@/lib/leagues/repo";
import { joinLeague, leaveLeague, updateLeagueSettings, type UpdateLeagueInput } from "@/lib/leagues/write";
import type { ClubFacility } from "@/lib/permissions/types";
import { resolveSelectedLeagueId, storeSelectedLeagueId } from "@/lib/selectedLeague";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import type { LeagueDoc } from "@/lib/firestore/types";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getDayOfWeekFromDate(dateStr: string): string {
  if (!dateStr) return "";
  return DAYS_OF_WEEK[new Date(dateStr + "T00:00:00").getDay()] ?? "";
}

function calcSessionCount(first: string, last: string): number {
  if (!first || !last) return 0;
  const d1 = new Date(first + "T00:00:00").getTime();
  const d2 = new Date(last + "T00:00:00").getTime();
  if (d2 < d1) return 0;
  return Math.floor((d2 - d1) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

function LeagueSettingsEditor({
  league,
  leagueId,
  clubId,
  availableFacilities,
  onSaved,
}: {
  league: LeagueDoc;
  leagueId: string;
  clubId: string;
  availableFacilities: ClubFacility[];
  onSaved: (updated: Partial<LeagueDoc>) => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(league.name);
  const [description, setDescription] = useState(league.description ?? "");
  const [city, setCity] = useState(league.city ?? "");
  const [state, setState] = useState(league.state ?? "");
  const [format, setFormat] = useState(league.league_format ?? "Doubles Ladder");
  const [active, setActive] = useState(league.active !== false);
  const [regOpen, setRegOpen] = useState(league.registrationOpenDate ?? "");
  const [regClose, setRegClose] = useState(league.registrationCloseDate ?? "");
  const [firstSession, setFirstSession] = useState(league.firstSessionDate ?? "");
  const [lastSession, setLastSession] = useState(league.lastSessionDate ?? "");
  // Facility selection: existing id, "__new__", or ""
  const [facilityPick, setFacilityPick] = useState(league.facilityId ?? "");
  const [newFacilityName, setNewFacilityName] = useState("");
  const [newFacilityAddress, setNewFacilityAddress] = useState("");
  const [newFacilityCourts, setNewFacilityCourts] = useState("");
  const [newFacilityParking, setNewFacilityParking] = useState(false);
  const [newFacilityLights, setNewFacilityLights] = useState(false);
  const [newFacilityIndoor, setNewFacilityIndoor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayOfWeek = getDayOfWeekFromDate(firstSession);
  const sessionCount = calcSessionCount(firstSession, lastSession);
  const selectedFacility = availableFacilities.find((f) => f.id === facilityPick);

  const inputCls = "w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      let resolvedFacilityId: string | null | undefined = undefined;
      if (facilityPick === "__new__") {
        const { addClubFacility } = await import("@/lib/clubs/write");
        resolvedFacilityId = await addClubFacility(
          clubId,
          {
            facilityName: newFacilityName.trim() || undefined,
            address: newFacilityAddress.trim() || undefined,
            pickleballCourts: newFacilityCourts ? Number(newFacilityCourts) : undefined,
            hasParking: newFacilityParking || undefined,
            hasLights: newFacilityLights || undefined,
            isIndoor: newFacilityIndoor || undefined,
          },
          user.uid,
        );
      } else if (facilityPick) {
        resolvedFacilityId = facilityPick;
      } else {
        resolvedFacilityId = null;
      }

      const updates: UpdateLeagueInput = {
        name, description, city, state, leagueFormat: format, active,
        facilityId: resolvedFacilityId,
        registrationOpenDate: regOpen || undefined,
        registrationCloseDate: regClose || undefined,
        firstSessionDate: firstSession || undefined,
        lastSessionDate: lastSession || undefined,
        sessionDayOfWeek: dayOfWeek || undefined,
        sessionCount: sessionCount > 0 ? sessionCount : undefined,
      };
      await updateLeagueSettings(leagueId, updates);
      onSaved({
        name, description, city, state, league_format: format, active,
        facilityId: resolvedFacilityId ?? undefined,
        registrationOpenDate: regOpen || undefined,
        registrationCloseDate: regClose || undefined,
        firstSessionDate: firstSession || undefined,
        lastSessionDate: lastSession || undefined,
        sessionDayOfWeek: dayOfWeek || undefined,
        sessionCount: sessionCount > 0 ? sessionCount : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel variant="inventory" padding="lg">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-4 w-4 text-ember-400" />
        <h3 className="heading-fantasy text-ash-100">League Settings</h3>
      </div>
      <form onSubmit={handleSave} className="space-y-3">
        <Field label="League Name">
          <input
            className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City">
            <input
              className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </Field>
          <Field label="State">
            <input
              className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Format">
          <input
            className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          />
        </Field>
        <Field label="Description">
          <textarea
            className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100 resize-none"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-ash-300">League is active</span>
        </label>

        <div className="pt-3 border-t border-obsidian-600 space-y-3">
          <p className="text-[10px] uppercase tracking-[0.15em] text-ash-500">Facility</p>
          <Field label="Facility">
            <select className={inputCls} value={facilityPick} onChange={(e) => setFacilityPick(e.target.value)}>
              <option value="">— No facility —</option>
              {availableFacilities.map((f) => (
                <option key={f.id} value={f.id}>{f.facilityName ?? f.address ?? `Facility ${f.id.slice(0, 6)}`}</option>
              ))}
              <option value="__new__">＋ Create new facility…</option>
            </select>
          </Field>
          {selectedFacility && (
            <div className="rounded-pixel bg-obsidian-800 border border-ash-700 px-3 py-2 text-xs space-y-0.5">
              {selectedFacility.facilityName && <p className="text-ash-100 font-medium">{selectedFacility.facilityName}</p>}
              {selectedFacility.address && <p className="text-ash-400 flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{selectedFacility.address}</p>}
              {(selectedFacility.pickleballCourts ?? 0) > 0 && <p className="text-ash-500">{selectedFacility.pickleballCourts} pickleball court{selectedFacility.pickleballCourts !== 1 ? "s" : ""}</p>}
            </div>
          )}
          {facilityPick === "__new__" && (
            <div className="space-y-2 pt-1 border-t border-obsidian-700">
              <p className="text-[10px] uppercase tracking-[0.15em] text-ash-500">New Facility Details</p>
              <Field label="Facility Name">
                <input className={inputCls} value={newFacilityName} onChange={(e) => setNewFacilityName(e.target.value)} placeholder="Riverwind Park" />
              </Field>
              <Field label="Address">
                <input className={inputCls} value={newFacilityAddress} onChange={(e) => setNewFacilityAddress(e.target.value)} placeholder="1234 Main St, City, MN" />
              </Field>
              <Field label="Pickleball Courts">
                <input type="number" min="0" className={inputCls} value={newFacilityCourts} onChange={(e) => setNewFacilityCourts(e.target.value)} placeholder="0" />
              </Field>
              <div className="flex gap-4 text-xs text-ash-300 pt-1">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newFacilityParking} onChange={(e) => setNewFacilityParking(e.target.checked)} className="accent-ember-500" />Parking</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newFacilityLights} onChange={(e) => setNewFacilityLights(e.target.checked)} className="accent-ember-500" />Lights</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newFacilityIndoor} onChange={(e) => setNewFacilityIndoor(e.target.checked)} className="accent-ember-500" />Indoor</label>
              </div>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-obsidian-600 space-y-3">
          <p className="text-[10px] uppercase tracking-[0.15em] text-ash-500">Schedule</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Registration Opens">
              <input
                type="date"
                className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
                value={regOpen}
                onChange={(e) => setRegOpen(e.target.value)}
              />
            </Field>
            <Field label="Registration Closes">
              <input
                type="date"
                className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
                value={regClose}
                onChange={(e) => setRegClose(e.target.value)}
                min={regOpen || undefined}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Session">
              <input
                type="date"
                className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
                value={firstSession}
                onChange={(e) => setFirstSession(e.target.value)}
              />
            </Field>
            <Field label="Last Session">
              <input
                type="date"
                className="w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100"
                value={lastSession}
                onChange={(e) => setLastSession(e.target.value)}
                min={firstSession || undefined}
              />
            </Field>
          </div>
          {firstSession && lastSession && sessionCount > 0 && (
            <p className="text-ash-400 text-xs">
              {sessionCount} {dayOfWeek} session{sessionCount !== 1 ? "s" : ""} calculated.
            </p>
          )}
        </div>

        {error && <p className="text-crimson-500 text-sm">{error}</p>}
        <Button type="submit" size="sm" disabled={saving}>
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Save Settings"}
        </Button>
      </form>
    </Panel>
  );
}

interface WeatherDay {
  date: string;
  maxTemp: number;
  minTemp: number;
  precipProb: number;
  code: number;
}

function weatherIcon(code: number) {
  if (code === 0) return <Sun className="h-4 w-4 text-amber-400" />;
  if (code <= 2) return <CloudSun className="h-4 w-4 text-amber-300" />;
  if (code === 3) return <Cloud className="h-4 w-4 text-ash-400" />;
  if (code <= 48) return <CloudFog className="h-4 w-4 text-ash-400" />;
  if (code <= 55) return <CloudDrizzle className="h-4 w-4 text-spectral-400" />;
  if (code <= 65) return <CloudRain className="h-4 w-4 text-spectral-400" />;
  if (code <= 77) return <CloudSnow className="h-4 w-4 text-ash-300" />;
  if (code <= 82) return <CloudRain className="h-4 w-4 text-spectral-400" />;
  return <CloudLightning className="h-4 w-4 text-amber-400" />;
}

function weatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Mostly clear";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Foggy";
  if (code <= 55) return "Drizzle";
  if (code <= 65) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  return "Thunderstorm";
}

function shortDay(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs text-ash-400 space-y-1 block">
      <span>{label}</span>
      {children}
    </label>
  );
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value + "T00:00:00");
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
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

export function LeagueDetailsClient({ leagueId: fallbackId }: { leagueId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL shape: /leagues/{leagueId} → segment index 2
  // usePathname() always reflects the real browser URL; the prop may be "__fallback".
  const pathnameSegment = pathname.split("/")[2];
  const leagueId =
    pathnameSegment && pathnameSegment !== "__fallback"
      ? pathnameSegment
      : fallbackId;
  const { user } = useAuth();
  const {
    isSiteAdmin,
    clubDirectorFor,
    leagueCoordinatorFor,
    coordinatorClubIds,
    loading: permLoading,
  } = usePermissions();

  const [league, setLeague] = useState<LeagueDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // undefined = not yet checked, null = confirmed not a member
  const [membership, setMembership] = useState<{ id: string; status: string } | null | undefined>(
    undefined,
  );
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [facilities, setFacilities] = useState<ClubFacility[]>([]);
  const [weather, setWeather] = useState<WeatherDay[] | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState(false);

  useEffect(() => {
    const preserved = resolveSelectedLeagueId(searchParams) ?? leagueId;
    if (preserved) storeSelectedLeagueId(preserved);
  }, [leagueId, searchParams]);

  useEffect(() => {
    if (!leagueId || leagueId === "__fallback") { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const fetched = await getLeague(leagueId);
        setLeague(fetched);
        if (!fetched) setError("League not found.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load league details.");
      } finally {
        setLoading(false);
      }
    })();
  }, [leagueId]);

  // Check the logged-in user's membership once permissions + league are both ready.
  useEffect(() => {
    if (!user || !league || permLoading) return;
    getUserLeagueMembership(leagueId, user.uid)
      .then(setMembership)
      .catch(() => setMembership(null));
  }, [user, league, leagueId, permLoading]);

  // Fetch facilities for the club that owns this league.
  useEffect(() => {
    const cId = league?.clubId ?? league?.orgId;
    if (!cId) return;
    listClubFacilities(cId).then(setFacilities).catch(() => setFacilities([]));
  }, [league]);

  // Fetch 5-day weather forecast via Open-Meteo (no API key required).
  useEffect(() => {
    if (!league) return;
    const hasLocation = facilities[0]?.address || league.venueAddress || league.city;
    if (!hasLocation) return;
    setWeatherLoading(true);
    setWeatherError(false);
    (async () => {
      try {
        let lat = league.latitude;
        let lng = league.longitude;
        if (!lat || !lng) {
          // Prefer facility address for geocoding; fall back to league city.
          const cityName = league.city ?? facilities[0]?.address ?? league.venueAddress ?? "";
          const geoRes = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json&country_code=US`,
          );
          const geoData = await geoRes.json() as { results?: { latitude: number; longitude: number }[] };
          lat = geoData.results?.[0]?.latitude;
          lng = geoData.results?.[0]?.longitude;
        }
        if (!lat || !lng) { setWeatherError(true); return; }
        const wxRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&temperature_unit=fahrenheit&timezone=auto&forecast_days=5`,
        );
        const wxData = await wxRes.json() as {
          daily: {
            time: string[];
            temperature_2m_max: number[];
            temperature_2m_min: number[];
            precipitation_probability_max: number[];
            weathercode: number[];
          };
        };
        setWeather(
          wxData.daily.time.map((date, i) => ({
            date,
            maxTemp: Math.round(wxData.daily.temperature_2m_max[i]!),
            minTemp: Math.round(wxData.daily.temperature_2m_min[i]!),
            precipProb: wxData.daily.precipitation_probability_max[i]!,
            code: wxData.daily.weathercode[i]!,
          })),
        );
      } catch {
        setWeatherError(true);
      } finally {
        setWeatherLoading(false);
      }
    })();
  }, [league, facilities]);

  const clubId = league?.clubId ?? league?.orgId ?? "";
  const isDirector = !permLoading && (isSiteAdmin || clubDirectorFor.includes(clubId));
  const isCoordinator =
    !permLoading &&
    (leagueCoordinatorFor.includes(leagueId) || coordinatorClubIds.includes(clubId));
  const isStaff = isDirector || isCoordinator;
  const isMember = membership?.status === "active";
  const membershipChecked = membership !== undefined;

  async function handleJoin() {
    if (!user) return;
    setJoining(true);
    setJoinError(null);
    try {
      await joinLeague(user.uid, leagueId);
      setMembership({ id: `${leagueId}__${user.uid}`, status: "active" });
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Failed to join league.");
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    if (!user) return;
    setLeaving(true);
    try {
      await leaveLeague(user.uid, leagueId);
      setMembership((m) => m ? { ...m, status: "left" } : null);
    } finally {
      setLeaving(false);
    }
  }

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-10 max-w-4xl">
        <div className="space-y-6">
          <div className="flex flex-col gap-3">
            <Link href="/" className="text-ash-400 text-sm hover:text-ash-100">
              ← Back to home
            </Link>
            <RuneChip tone="rune" className="mb-1">League Details</RuneChip>
            <h1 className="heading-fantasy text-display-md text-ash-100">
              {league?.name ?? "League details"}
            </h1>
          </div>

          {loading ? (
            <Panel variant="base" padding="lg" className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-ember-400" />
              <p className="text-ash-400">Loading league details…</p>
            </Panel>
          ) : error ? (
            <Panel variant="base" padding="lg">
              <p className="text-rose-400">{error}</p>
            </Panel>
          ) : league ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* Left: league info */}
              <div className="space-y-5">
                <Panel variant="hud" padding="lg" className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-ash-400 text-sm">
                        {league.city ?? "Unknown city"}, {league.state ?? ""}
                      </p>
                      <h2 className="heading-fantasy text-2xl text-ash-100">{league.name}</h2>
                    </div>
                    <div className="rounded-pixel bg-obsidian-700 px-3 py-2 text-xs text-ash-300">
                      {league.active === false ? "Inactive" : "Active"}
                    </div>
                  </div>
                  <div className="grid gap-3 text-sm text-ash-300">
                    <div>
                      <span className="text-ash-100">Format:</span>{" "}
                      {league.league_format ?? "Pickleball league"}
                    </div>
                    {league.next_play_date && (
                      <div>
                        <span className="text-ash-100">Next play date:</span>{" "}
                        {formatNextPlayDate(league.next_play_date)}
                      </div>
                    )}
                    {league.check_in_status && (
                      <div>
                        <span className="text-ash-100">Check-in status:</span>{" "}
                        {league.check_in_status}
                      </div>
                    )}
                  </div>

                  {/* Schedule */}
                  {(league.firstSessionDate || league.registrationOpenDate) && (
                    <div className="pt-3 border-t border-obsidian-600">
                      <p className="text-[10px] uppercase tracking-[0.15em] text-ash-500 mb-2">Schedule</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {league.sessionDayOfWeek && league.sessionCount && (
                          <div className="col-span-2 flex items-center gap-3 mb-1">
                            <CalendarDays className="h-3.5 w-3.5 text-ember-400 shrink-0" />
                            <span className="text-ash-100 font-medium">
                              {league.sessionCount} {league.sessionDayOfWeek} session{league.sessionCount !== 1 ? "s" : ""}
                            </span>
                          </div>
                        )}
                        {league.firstSessionDate && (
                          <div>
                            <p className="text-ash-600 mb-0.5">First session</p>
                            <p className="text-ash-200">{formatDate(league.firstSessionDate)}</p>
                          </div>
                        )}
                        {league.lastSessionDate && (
                          <div>
                            <p className="text-ash-600 mb-0.5">Last session</p>
                            <p className="text-ash-200">{formatDate(league.lastSessionDate)}</p>
                          </div>
                        )}
                        {league.registrationOpenDate && (
                          <div>
                            <p className="text-ash-600 mb-0.5">Reg. opens</p>
                            <p className="text-ash-200">{formatDate(league.registrationOpenDate)}</p>
                          </div>
                        )}
                        {league.registrationCloseDate && (
                          <div>
                            <p className="text-ash-600 mb-0.5">Reg. closes</p>
                            <p className="text-ash-200">{formatDate(league.registrationCloseDate)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Staff */}
                  {(league.directorName || league.coordinatorName) && (
                    <div className="pt-3 border-t border-obsidian-600">
                      <p className="text-[10px] uppercase tracking-[0.15em] text-ash-500 mb-1.5">Staff</p>
                      <div className="space-y-1 text-xs">
                        {league.directorName && (
                          <div className="flex items-center gap-2">
                            <Users className="h-3 w-3 text-gold-400" />
                            <span className="text-ash-500">Director:</span>
                            <span className="text-ash-200">{league.directorName}</span>
                          </div>
                        )}
                        {league.coordinatorName && (
                          <div className="flex items-center gap-2">
                            <Users className="h-3 w-3 text-spectral-400" />
                            <span className="text-ash-500">Coordinator:</span>
                            <span className="text-ash-200">{league.coordinatorName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Panel>

                {/* Facility cards */}
                {facilities.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-ash-500 px-1">Facility</p>
                    {facilities.map((facility) => (
                      <Panel key={facility.id} variant="inventory" padding="lg" className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded bg-ash-800 shrink-0 mt-0.5">
                            <MapPin className="h-4 w-4 text-ember-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {facility.facilityName && (
                              <p className="heading-fantasy text-ash-100 text-sm">{facility.facilityName}</p>
                            )}
                            {facility.address && (
                              <p className="text-ash-400 text-xs mt-0.5">{facility.address}</p>
                            )}
                            <div className="flex flex-wrap gap-3 mt-1.5 text-ash-500 text-xs">
                              {(facility.pickleballCourts ?? 0) > 0 && (
                                <span>{facility.pickleballCourts} Pickleball Court{facility.pickleballCourts !== 1 ? "s" : ""}</span>
                              )}
                              {(facility.tennisConversionCourts ?? 0) > 0 && (
                                <span>{facility.tennisConversionCourts} Tennis Conversion</span>
                              )}
                              {facility.hasParking && <span>Parking</span>}
                              {facility.hasLights && <span>Lights</span>}
                              {facility.isIndoor && <span>Indoor</span>}
                            </div>
                            {(facility.amenities?.length ?? 0) > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {facility.amenities!.slice(0, 4).map((a) => (
                                  <span key={a} className="px-1.5 py-0.5 rounded-full text-[10px] bg-obsidian-700 border border-ash-700 text-ash-400">{a}</span>
                                ))}
                                {facility.amenities!.length > 4 && (
                                  <span className="px-1.5 py-0.5 text-[10px] text-ash-500">+{facility.amenities!.length - 4} more</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        {facility.address && (
                          <div className="rounded-pixel overflow-hidden border border-ash-700 h-48 w-full">
                            <iframe
                              title={`${facility.facilityName ?? "Facility"} location`}
                              src={`https://maps.google.com/maps?q=${encodeURIComponent(facility.address)}&output=embed`}
                              className="w-full h-full border-0"
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                            />
                          </div>
                        )}
                        {facility.notes && (
                          <p className="text-ash-500 text-xs leading-relaxed pt-2 border-t border-ash-800">{facility.notes}</p>
                        )}
                      </Panel>
                    ))}
                  </div>
                )}

                <Panel variant="inventory" padding="lg" className="space-y-2">
                  <h3 className="heading-fantasy text-xl text-ash-100">About this league</h3>
                  <p className="text-ash-300 text-sm leading-relaxed">
                    {league.description ?? "No description is available for this league yet."}
                  </p>
                </Panel>
              </div>

              {/* Right: sidebar */}
              <div className="space-y-4">

                {/* ── Weather forecast ── */}
                {(facilities[0]?.address || league.venueAddress || league.city) && (
                  <Panel variant="base" padding="lg" className="space-y-3">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-ash-500">Weather Forecast</p>
                    {weatherLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-ash-500" />
                        <p className="text-ash-500 text-xs">Loading forecast…</p>
                      </div>
                    ) : weatherError ? (
                      <p className="text-ash-500 text-xs">Forecast unavailable for this location.</p>
                    ) : weather ? (
                      <div className="space-y-2.5">
                        {weather.map((day) => (
                          <div key={day.date} className="flex items-center gap-2 text-xs">
                            <span className="text-ash-500 w-24 shrink-0">{shortDay(day.date)}</span>
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              {weatherIcon(day.code)}
                              <span className="text-ash-400 truncate">{weatherLabel(day.code)}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {day.precipProb > 0 && (
                                <span className="flex items-center gap-0.5 text-spectral-400">
                                  <Droplets className="h-3 w-3" />{day.precipProb}%
                                </span>
                              )}
                              <span className="text-ash-200 font-medium w-8 text-right">{day.maxTemp}°</span>
                              <span className="text-ash-500 w-8 text-right">{day.minTemp}°</span>
                            </div>
                          </div>
                        ))}
                        <p className="text-ash-600 text-[10px] pt-1 border-t border-ash-800">
                          {league.city && league.state ? `${league.city}, ${league.state}` : league.venueName ?? ""}
                          {" · "}Powered by Open-Meteo
                        </p>
                      </div>
                    ) : null}
                  </Panel>
                )}

                {/* ── Staff: Club Director or Coordinator ── */}
                {isStaff && (
                  <Panel variant="quest" padding="lg" className="space-y-4">
                    <div>
                      <RuneChip tone="gold" className="mb-2">
                        {isDirector ? "Club Director" : "Coordinator"}
                      </RuneChip>
                      <h2 className="heading-fantasy text-lg text-ash-100">Manage this league</h2>
                      <p className="text-ash-500 text-xs mt-1">
                        You have management access to this league.
                      </p>
                    </div>
                    <div className="grid gap-2">
                      {clubId && (
                        <Link href={`/clubs/manage/${clubId}?section=leagues`}>
                          <Button size="sm" className="w-full">
                            <ShieldCheck className="h-3.5 w-3.5" /> Club Hub
                          </Button>
                        </Link>
                      )}
                      <Link href={`/leagues/${leagueId}/roster`}>
                        <Button size="sm" variant="outline" className="w-full">
                          <Users className="h-3.5 w-3.5" /> Roster
                        </Button>
                      </Link>
                      <Link href="/ladder/play-dates">
                        <Button size="sm" variant="outline" className="w-full">
                          <CalendarDays className="h-3.5 w-3.5" /> Play Dates
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full"
                        onClick={() => setSettingsOpen((o) => !o)}
                      >
                        {settingsOpen ? "Hide Settings" : "Edit League Settings"}
                      </Button>
                    </div>
                  </Panel>
                )}

                {/* League settings editor (staff only) */}
                {isStaff && settingsOpen && league && (
                  <LeagueSettingsEditor
                    league={league}
                    leagueId={leagueId}
                    clubId={clubId}
                    availableFacilities={facilities}
                    onSaved={(updated) => {
                      setLeague((l) => l ? { ...l, ...updated } : l);
                      if (updated.facilityId !== undefined) {
                        listClubFacilities(clubId).then(setFacilities).catch(() => {});
                      }
                      setSettingsOpen(false);
                    }}
                  />
                )}

                {/* ── Active member ── */}
                {!isStaff && user && isMember && (
                  <Panel variant="hud" padding="lg" className="space-y-4">
                    <div>
                      <RuneChip tone="success" className="mb-2">
                        <CheckCircle2 className="h-3 w-3" /> Member
                      </RuneChip>
                      <h2 className="heading-fantasy text-lg text-ash-100">
                        You&apos;re in this league
                      </h2>
                      <p className="text-ash-500 text-xs mt-1">
                        Check in on play date days to get your court assignment.
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Link href="/ladder/check-in">
                        <Button size="sm" className="w-full">
                          <UserCheck className="h-3.5 w-3.5" /> Check In
                        </Button>
                      </Link>
                      <Link href={`/leagues/${leagueId}/roster`}>
                        <Button size="sm" variant="outline" className="w-full">
                          <Users className="h-3.5 w-3.5" /> Roster
                        </Button>
                      </Link>
                      <Link href="/ladder/play-dates">
                        <Button size="sm" variant="outline" className="w-full">
                          <CalendarDays className="h-3.5 w-3.5" /> Play Dates
                        </Button>
                      </Link>
                      <Link href="/ladder/standings">
                        <Button size="sm" variant="outline" className="w-full">
                          <Layers className="h-3.5 w-3.5" /> Standings
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full text-crimson-400 hover:text-crimson-300"
                        onClick={handleLeave}
                        disabled={leaving}
                      >
                        <UserX className="h-3.5 w-3.5" />
                        {leaving ? "Leaving…" : "Leave League"}
                      </Button>
                    </div>
                  </Panel>
                )}

                {/* ── Logged-in, not a member — show join ── */}
                {!isStaff && user && !isMember && membershipChecked && (
                  <Panel variant="quest" padding="lg" className="space-y-4">
                    <div>
                      <p className="text-ash-400 text-xs uppercase tracking-[0.24em]">
                        Join this league
                      </p>
                      <h2 className="heading-fantasy text-lg text-ash-100">
                        Join now to play.
                      </h2>
                    </div>
                    {joinError && <p className="text-rose-400 text-xs">{joinError}</p>}
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={handleJoin}
                      disabled={joining}
                    >
                      {joining ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Joining…
                        </>
                      ) : (
                        "Join League"
                      )}
                    </Button>
                  </Panel>
                )}

                {/* ── Logged-in but membership check still loading ── */}
                {!isStaff && user && !membershipChecked && !permLoading && (
                  <Panel variant="base" padding="lg" className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-ember-400" />
                    <p className="text-ash-500 text-sm">Loading your status…</p>
                  </Panel>
                )}

                {/* ── Not logged in ── */}
                {!user && (
                  <Panel variant="quest" padding="lg" className="space-y-4">
                    <div>
                      <p className="text-ash-400 text-xs uppercase tracking-[0.24em]">
                        Join this league
                      </p>
                      <h2 className="heading-fantasy text-lg text-ash-100">
                        Create an account to join.
                      </h2>
                    </div>
                    <div className="grid gap-2">
                      <Link href={`/auth/signup?leagueId=${league.id}`} className="w-full">
                        <Button size="sm" className="w-full">Create Account</Button>
                      </Link>
                      <Link href={`/auth/login?leagueId=${league.id}`} className="w-full">
                        <Button variant="outline" size="sm" className="w-full">
                          <LogIn className="h-3.5 w-3.5" /> Login
                        </Button>
                      </Link>
                    </div>
                  </Panel>
                )}

                <Panel variant="base" padding="lg">
                  <p className="text-ash-400 text-sm">
                    Standings and match history are available after joining the league.
                  </p>
                </Panel>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </ResponsiveShell>
  );
}
