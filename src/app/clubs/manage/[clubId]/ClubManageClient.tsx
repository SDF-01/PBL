"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle,
  Layers,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { useToast } from "@/lib/toast-context";
import { getClubById, listClubLeagues, listClubCoordinators, getUserByEmail } from "@/lib/clubs/repo";
import { createLeague } from "@/lib/leagues/write";
import { createVenue, createPlayDate } from "@/lib/ladder/write";
import { assignRole, deactivateUserRole } from "@/lib/permissions/write";
import { listLadderSeasons, listVenues } from "@/lib/ladder/repo";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import type { ClubDoc } from "@/lib/permissions/types";
import type { LeagueDoc, LadderSeasonDoc, VenueDoc } from "@/lib/firestore/types";
import type { CoordinatorEntry } from "@/lib/clubs/repo";

type Section = "overview" | "leagues" | "playdates" | "coordinators";

function resolveClubId(param: string): string {
  if (typeof window === "undefined") return param;
  const segments = window.location.pathname.replace(/\/$/, "").split("/");
  const idx = segments.findIndex((s) => s === "manage");
  return idx >= 0 && segments[idx + 1] ? segments[idx + 1]! : param;
}

export function ClubManageClient({ clubId: rawId }: { clubId: string }) {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { clubDirectorFor, isSiteAdmin, loading: permLoading } = usePermissions();
  const { toast } = useToast();

  const clubId = resolveClubId(rawId);
  const initialSection = (searchParams.get("section") as Section) ?? "overview";

  const [club, setClub] = useState<ClubDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>(initialSection);

  useEffect(() => {
    if (clubId === "__fallback" || !clubId) return;
    getClubById(clubId).then((c) => {
      setClub(c);
      setLoading(false);
    });
  }, [clubId]);

  const canManage =
    !permLoading && (isSiteAdmin || clubDirectorFor.includes(clubId));

  if (loading || permLoading) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-2xl flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-ember-400" />
        </main>
      </ResponsiveShell>
    );
  }

  if (!club) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-2xl">
          <Panel variant="base" padding="lg">
            <p className="text-rose-400">Club not found.</p>
            <Link href="/clubs/my" className="text-ash-400 text-sm hover:text-ash-100 mt-2 inline-block">
              ← Back to My Clubs
            </Link>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  if (!canManage) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-2xl">
          <Panel variant="base" padding="lg">
            <p className="text-rose-400">You don&apos;t have director access to this club.</p>
            <Link href="/clubs/my" className="text-ash-400 text-sm hover:text-ash-100 mt-2 inline-block">
              ← Back to My Clubs
            </Link>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  const tabs: { id: Section; label: string; Icon: typeof Layers }[] = [
    { id: "overview",     label: "Overview",     Icon: Building2 },
    { id: "leagues",      label: "Leagues",      Icon: Layers },
    { id: "playdates",    label: "Play Dates",   Icon: CalendarDays },
    { id: "coordinators", label: "Coordinators", Icon: Users },
  ];

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <Link href="/clubs/my" className="text-ash-400 hover:text-ash-100 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <RuneChip tone="gold" className="mb-1">Club Director</RuneChip>
            <h1 className="heading-fantasy text-display-md text-ash-100">{club.clubName}</h1>
            <p className="text-ash-400 text-sm">{club.location}</p>
          </div>
        </div>

        <div className="flex gap-1 p-1 rounded-pixel bg-obsidian-700">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-medium tracking-wide transition-colors ${
                section === id
                  ? "bg-obsidian-900 text-ember-400"
                  : "text-ash-400 hover:text-ash-100"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {section === "overview"     && <OverviewSection club={club} />}
        {section === "leagues"      && <LeaguesSection clubId={clubId} userId={user?.uid ?? ""} toast={toast} />}
        {section === "playdates"    && <PlayDatesSection userId={user?.uid ?? ""} toast={toast} />}
        {section === "coordinators" && <CoordinatorsSection clubId={clubId} userId={user?.uid ?? ""} toast={toast} />}
      </main>
    </ResponsiveShell>
  );
}

// ============================================================
// OVERVIEW
// ============================================================

function OverviewSection({ club }: { club: ClubDoc }) {
  return (
    <Panel variant="quest" padding="lg" className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded bg-ash-800">
          <Building2 className="h-5 w-5 text-ember-400" />
        </div>
        <div>
          <h2 className="heading-fantasy text-ash-100">{club.clubName}</h2>
          <p className="text-ash-400 text-sm">{club.location}</p>
        </div>
      </div>
      {club.description && (
        <p className="text-ash-300 text-sm leading-relaxed pt-3 border-t border-ash-800">
          {club.description}
        </p>
      )}
      <div className="flex items-center gap-2 pt-1">
        <RuneChip tone="success">
          <CheckCircle className="h-3 w-3" /> Approved
        </RuneChip>
        <span className="text-ash-500 text-xs">Use the tabs above to manage your club.</span>
      </div>
    </Panel>
  );
}

// ============================================================
// LEAGUES
// ============================================================

type ToastFn = (message: string, variant?: "success" | "error" | "info") => void;

function LeaguesSection({
  clubId,
  userId,
  toast,
}: {
  clubId: string;
  userId: string;
  toast: ToastFn;
}) {
  const [leagues, setLeagues] = useState<LeagueDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState("Doubles Ladder");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  useEffect(() => {
    listClubLeagues(clubId).then((l) => {
      setLeagues(l);
      setLoading(false);
    });
  }, [clubId]);

  async function handleCreate() {
    if (!name.trim()) {
      toast("League name is required.", "error");
      return;
    }
    setSaving(true);
    try {
      const id = await createLeague(userId, {
        name: name.trim(),
        description: description.trim() || undefined,
        clubId,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        leagueFormat: format,
      });
      const newLeague: LeagueDoc = {
        id,
        orgId: clubId,
        clubId,
        name: name.trim(),
        description: description.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        league_format: format,
        active: true,
        createdBy: userId,
      };
      setLeagues((prev) => [newLeague, ...prev]);
      setName(""); setDescription(""); setCity(""); setState(""); setFormat("Doubles Ladder");
      setShowForm(false);
      toast(`"${newLeague.name}" league created.`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create league.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest">Leagues</h2>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-3.5 w-3.5" />
          New League
        </Button>
      </div>

      {showForm && (
        <Panel variant="quest" padding="lg" className="space-y-3">
          <h3 className="heading-fantasy text-ash-100 text-sm">Create League</h3>
          <div className="space-y-2">
            <input
              className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
              placeholder="League name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <textarea
              className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500 resize-none"
              placeholder="Description (optional)"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <input
                className="rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
                placeholder="State"
                value={state}
                onChange={(e) => setState(e.target.value)}
              />
            </div>
            <select
              className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              <option>Doubles Ladder</option>
              <option>Singles Ladder</option>
              <option>Mixed Doubles Ladder</option>
              <option>Round Robin</option>
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create League
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Panel>
      )}

      {loading ? (
        <Panel variant="base" padding="lg" className="flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-ember-400" />
        </Panel>
      ) : leagues.length === 0 ? (
        <Panel variant="base" padding="lg" className="text-center">
          <Layers className="h-8 w-8 text-ash-600 mx-auto mb-2" />
          <p className="text-ash-400 text-sm">No leagues yet. Create your first league above.</p>
        </Panel>
      ) : (
        <div className="space-y-2">
          {leagues.map((league) => (
            <Panel key={league.id} variant="inventory" padding="md" className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="heading-fantasy text-ash-100 text-sm">{league.name}</span>
                  {league.active !== false && <RuneChip tone="success" className="text-[10px]">Active</RuneChip>}
                </div>
                <p className="text-ash-500 text-xs">
                  {[league.city, league.state].filter(Boolean).join(", ")}
                  {league.league_format ? ` · ${league.league_format}` : ""}
                </p>
              </div>
              <Link href={`/leagues/${league.id}`}>
                <Button size="sm" variant="ghost">View</Button>
              </Link>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// PLAY DATES
// ============================================================

function PlayDatesSection({
  userId,
  toast,
}: {
  userId: string;
  toast: ToastFn;
}) {
  const [seasons, setSeasons] = useState<LadderSeasonDoc[]>([]);
  const [venues, setVenues] = useState<VenueDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [useNewVenue, setUseNewVenue] = useState(false);

  const [seasonId, setSeasonId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [newVenueName, setNewVenueName] = useState("");
  const [newVenueAddress, setNewVenueAddress] = useState("");
  const [date, setDate] = useState("");
  const [checkInOpens, setCheckInOpens] = useState("");
  const [checkInCloses, setCheckInCloses] = useState("");

  useEffect(() => {
    Promise.all([listLadderSeasons(), listVenues()]).then(([s, v]) => {
      setSeasons(s);
      setVenues(v);
      if (s.length > 0) setSeasonId(s[0]!.id);
      setLoading(false);
    });
  }, []);

  async function handleSchedule() {
    if (!seasonId) { toast("Select a season.", "error"); return; }
    if (!date)     { toast("Date is required.", "error"); return; }
    setSaving(true);
    try {
      let resolvedVenueId = venueId;
      if (useNewVenue || !venueId) {
        if (!newVenueName.trim()) { toast("Venue name is required.", "error"); setSaving(false); return; }
        resolvedVenueId = await createVenue({
          name: newVenueName.trim(),
          address: newVenueAddress.trim() || undefined,
          lat: 0, lng: 0, radiusMeters: 200,
          createdBy: userId,
        });
      }
      await createPlayDate({
        seasonId,
        venueId: resolvedVenueId,
        date,
        checkInOpensAt: checkInOpens || undefined,
        checkInClosesAt: checkInCloses || undefined,
        createdBy: userId,
      });
      toast(`Play date scheduled for ${date}.`, "success");
      setShowForm(false);
      setDate(""); setCheckInOpens(""); setCheckInCloses("");
      setNewVenueName(""); setNewVenueAddress(""); setUseNewVenue(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to schedule play date.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest">Play Dates</h2>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-3.5 w-3.5" />
          Schedule
        </Button>
      </div>

      {showForm && (
        <Panel variant="quest" padding="lg" className="space-y-3">
          <h3 className="heading-fantasy text-ash-100 text-sm">Schedule Play Date</h3>
          {loading ? (
            <div className="flex justify-center py-2"><Loader2 className="h-5 w-5 animate-spin text-ember-400" /></div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-ash-400 text-xs mb-1 block">Season *</label>
                {seasons.length === 0 ? (
                  <p className="text-ash-500 text-xs bg-obsidian-700 rounded-pixel px-3 py-2">
                    No ladder seasons exist. Ask your Site Admin to create one first.
                  </p>
                ) : (
                  <select
                    className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
                    value={seasonId}
                    onChange={(e) => setSeasonId(e.target.value)}
                  >
                    {seasons.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.startDate} – {s.endDate})</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="text-ash-400 text-xs mb-1 block">Venue</label>
                {venues.length > 0 && !useNewVenue ? (
                  <div className="space-y-1">
                    <select
                      className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
                      value={venueId}
                      onChange={(e) => setVenueId(e.target.value)}
                    >
                      <option value="">-- Select venue --</option>
                      {venues.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                    <button type="button" className="text-ember-400 text-xs hover:text-ember-300" onClick={() => setUseNewVenue(true)}>
                      + Add new venue
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
                      placeholder="Venue name *"
                      value={newVenueName}
                      onChange={(e) => setNewVenueName(e.target.value)}
                    />
                    <input
                      className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
                      placeholder="Address (optional)"
                      value={newVenueAddress}
                      onChange={(e) => setNewVenueAddress(e.target.value)}
                    />
                    {venues.length > 0 && (
                      <button type="button" className="text-ash-400 text-xs hover:text-ash-100" onClick={() => setUseNewVenue(false)}>
                        ← Pick existing venue
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-ash-400 text-xs mb-1 block">Date *</label>
                <input
                  type="date"
                  className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-ash-400 text-xs mb-1 block">Check-in opens</label>
                  <input type="time" className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500" value={checkInOpens} onChange={(e) => setCheckInOpens(e.target.value)} />
                </div>
                <div>
                  <label className="text-ash-400 text-xs mb-1 block">Check-in closes</label>
                  <input type="time" className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500" value={checkInCloses} onChange={(e) => setCheckInCloses(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleSchedule} disabled={saving || loading}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Schedule
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Panel>
      )}

      <Panel variant="base" padding="lg" className="text-center space-y-2">
        <CalendarDays className="h-8 w-8 text-ash-600 mx-auto" />
        <p className="text-ash-400 text-sm">
          View all sessions on the{" "}
          <Link href="/ladder/play-dates" className="text-ember-400 hover:text-ember-300 underline">Play Dates</Link>{" "}
          page.
        </p>
      </Panel>
    </div>
  );
}

// ============================================================
// COORDINATORS
// ============================================================

function CoordinatorsSection({
  clubId,
  userId,
  toast,
}: {
  clubId: string;
  userId: string;
  toast: ToastFn;
}) {
  const [coordinators, setCoordinators] = useState<CoordinatorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    listClubCoordinators(clubId).then((c) => {
      setCoordinators(c);
      setLoading(false);
    });
  }, [clubId]);

  async function handleAssign() {
    if (!email.trim()) return;
    setAssigning(true);
    try {
      const found = await getUserByEmail(email.trim());
      if (!found) { toast(`No account found for ${email.trim()}.`, "error"); return; }
      if (coordinators.some((c) => c.userId === found.uid)) { toast(`${found.displayName} is already a coordinator.`, "error"); return; }
      await assignRole(found.uid, "LeagueCoordinator", clubId, null, userId);
      setCoordinators((prev) => [
        ...prev,
        { userRoleId: `pending-${Date.now()}`, userId: found.uid, displayName: found.displayName, assignedAt: new Date().toISOString() },
      ]);
      setEmail("");
      toast(`${found.displayName} assigned as day coordinator.`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Assignment failed.", "error");
    } finally {
      setAssigning(false);
    }
  }

  async function handleRemove(entry: CoordinatorEntry) {
    setRemoving(entry.userRoleId);
    try {
      await deactivateUserRole(entry.userRoleId);
      setCoordinators((prev) => prev.filter((c) => c.userRoleId !== entry.userRoleId));
      toast("Coordinator removed.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Remove failed.", "error");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest">Day Coordinators</h2>

      <Panel variant="quest" padding="lg" className="space-y-3">
        <h3 className="heading-fantasy text-ash-100 text-sm">Assign Coordinator</h3>
        <p className="text-ash-400 text-xs">
          Enter a player&apos;s email to grant them League Coordinator access for this club.
        </p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
            placeholder="player@email.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAssign()}
          />
          <Button size="sm" onClick={handleAssign} disabled={assigning || !email.trim()}>
            {assigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            Assign
          </Button>
        </div>
      </Panel>

      {loading ? (
        <Panel variant="base" padding="lg" className="flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-ember-400" />
        </Panel>
      ) : coordinators.length === 0 ? (
        <Panel variant="base" padding="lg" className="text-center">
          <Users className="h-8 w-8 text-ash-600 mx-auto mb-2" />
          <p className="text-ash-400 text-sm">No coordinators assigned yet.</p>
        </Panel>
      ) : (
        <div className="space-y-2">
          {coordinators.map((entry) => (
            <Panel key={entry.userRoleId} variant="inventory" padding="md" className="flex items-center justify-between gap-3">
              <div>
                <p className="text-ash-100 text-sm font-medium">{entry.displayName ?? "Player"}</p>
                <p className="text-ash-500 text-xs font-mono">{entry.userId}</p>
              </div>
              <button
                onClick={() => handleRemove(entry)}
                disabled={removing === entry.userRoleId}
                className="text-ash-500 hover:text-rose-400 transition-colors disabled:opacity-50"
              >
                {removing === entry.userRoleId
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Trash2 className="h-4 w-4" />}
              </button>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
