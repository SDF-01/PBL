"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ListChecks,
  ShieldAlert,
  MapPin,
  Calendar,
  Users,
  Search,
  CheckCircle,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { getClubById, listUserClubs, getUserByEmail, listClubFacilities } from "@/lib/clubs/repo";
import { createLeague, type CreateLeagueInput, type NewFacilityInput } from "@/lib/leagues/write";
import { isFirebaseConfigured } from "@/lib/firebase";
import type { ClubDoc, ClubFacility } from "@/lib/permissions/types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const FORMATS = ["Doubles Ladder", "Singles Ladder", "Mixed Doubles Ladder", "Round Robin", "Tournament"];

const fieldCls =
  "w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100 placeholder:text-ash-600 focus:outline-none focus:border-ember-500";

function getDayOfWeek(dateStr: string): string {
  if (!dateStr) return "";
  return DAYS[new Date(dateStr + "T00:00:00").getDay()] ?? "";
}

function calculateSessionCount(first: string, last: string): number {
  if (!first || !last) return 0;
  const d1 = new Date(first + "T00:00:00").getTime();
  const d2 = new Date(last + "T00:00:00").getTime();
  if (d2 < d1) return 0;
  return Math.floor((d2 - d1) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

interface ResolvedUser {
  uid: string;
  displayName: string;
  email: string;
}

function UserLookup({
  label,
  resolved,
  onResolve,
  onClear,
}: {
  label: string;
  resolved: ResolvedUser | null;
  onResolve: (u: ResolvedUser) => void;
  onClear: () => void;
}) {
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);

  async function handleSearch() {
    if (!email.trim()) return;
    setSearching(true);
    setNotFound(false);
    try {
      const found = await getUserByEmail(email.trim());
      if (found) {
        onResolve(found);
        setEmail("");
      } else {
        setNotFound(true);
      }
    } finally {
      setSearching(false);
    }
  }

  if (resolved) {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-pixel bg-obsidian-800 border border-obsidian-500">
        <CheckCircle className="h-4 w-4 text-success-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-ash-100 text-sm font-medium truncate">{resolved.displayName}</p>
          <p className="text-ash-500 text-xs truncate">{resolved.email}</p>
        </div>
        <button type="button" onClick={onClear} className="text-ash-500 hover:text-ash-200 shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setNotFound(false); }}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearch())}
          placeholder={`Search ${label} by email…`}
          className={fieldCls}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleSearch}
          disabled={searching || !email.trim()}
        >
          <Search className="h-3.5 w-3.5" />
          {searching ? "…" : "Find"}
        </Button>
      </div>
      {notFound && (
        <p className="text-crimson-400 text-xs">No account found for that email.</p>
      )}
    </div>
  );
}

export default function LeagueCreatePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { isSiteAdmin, clubDirectorFor, coordinatorClubIds, loading: permLoading } = usePermissions();

  const canCreate = isSiteAdmin || clubDirectorFor.length > 0 || coordinatorClubIds.length > 0;

  const [approvedClubs, setApprovedClubs] = useState<ClubDoc[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [facilities, setFacilities] = useState<ClubFacility[]>([]);

  // Basic
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clubId, setClubId] = useState("");
  const [leagueFormat, setLeagueFormat] = useState("Doubles Ladder");

  // Facility — "__new__" means create inline, "" means none, otherwise existing facilityId
  const [facilityPick, setFacilityPick] = useState("");
  const [newFacilityName, setNewFacilityName] = useState("");
  const [newFacilityAddress, setNewFacilityAddress] = useState("");
  const [newFacilityCourts, setNewFacilityCourts] = useState("");
  const [newFacilityParking, setNewFacilityParking] = useState(false);
  const [newFacilityLights, setNewFacilityLights] = useState(false);
  const [newFacilityIndoor, setNewFacilityIndoor] = useState(false);

  // Schedule
  const [registrationOpenDate, setRegistrationOpenDate] = useState("");
  const [registrationCloseDate, setRegistrationCloseDate] = useState("");
  const [firstSessionDate, setFirstSessionDate] = useState("");
  const [lastSessionDate, setLastSessionDate] = useState("");

  // Staff
  const [director, setDirector] = useState<ResolvedUser | null>(null);
  const [coordinator, setCoordinator] = useState<ResolvedUser | null>(null);

  // UI
  const [openSection, setOpenSection] = useState<"location" | "schedule" | "staff" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const dayOfWeek = getDayOfWeek(firstSessionDate);
  const sessionCount = calculateSessionCount(firstSessionDate, lastSessionDate);
  const selectedFacility = facilities.find((f) => f.id === facilityPick);

  useEffect(() => {
    if (!user || !canCreate || !isFirebaseConfigured()) {
      setClubsLoading(false);
      return;
    }
    const directorIds = [...new Set([...clubDirectorFor, ...coordinatorClubIds])];
    Promise.all([
      listUserClubs(user.uid),
      Promise.all(directorIds.map((id) => getClubById(id))),
    ])
      .then(([created, directed]) => {
        const seen = new Set<string>();
        const merged: typeof created = [];
        for (const c of [...created, ...directed.filter((c): c is NonNullable<typeof c> => c !== null)]) {
          if (!seen.has(c.id)) { seen.add(c.id); merged.push(c); }
        }
        const approved = merged.filter((c) => c.status === "approved");
        setApprovedClubs(approved);
        if (approved[0]) setClubId(approved[0].id);
      })
      .finally(() => setClubsLoading(false));
  }, [user, canCreate]);

  // Load club facilities when club selection changes.
  useEffect(() => {
    if (!clubId || !isFirebaseConfigured()) { setFacilities([]); setFacilityPick(""); return; }
    listClubFacilities(clubId).then((f) => { setFacilities(f); setFacilityPick(""); }).catch(() => setFacilities([]));
  }, [clubId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) { setError("League name is required."); return; }
    if (!clubId) { setError("Select a club for this league."); return; }
    if (firstSessionDate && lastSessionDate && lastSessionDate < firstSessionDate) {
      setError("Last session date must be on or after the first session date."); return;
    }
    if (registrationCloseDate && registrationOpenDate && registrationCloseDate < registrationOpenDate) {
      setError("Registration close date must be on or after the open date."); return;
    }

    setSubmitting(true);
    setError(null);
    try {
      let facilityId: string | undefined;
      let newFacility: NewFacilityInput | undefined;
      if (facilityPick === "__new__") {
        newFacility = {
          facilityName: newFacilityName.trim() || undefined,
          address: newFacilityAddress.trim() || undefined,
          pickleballCourts: newFacilityCourts ? Number(newFacilityCourts) : undefined,
          hasParking: newFacilityParking || undefined,
          hasLights: newFacilityLights || undefined,
          isIndoor: newFacilityIndoor || undefined,
        };
      } else if (facilityPick) {
        facilityId = facilityPick;
      }
      const selectedFacility = facilities.find((f) => f.id === facilityPick);
      const input: CreateLeagueInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        clubId,
        leagueFormat: leagueFormat.trim() || undefined,
        facilityId,
        newFacility,
        registrationOpenDate: registrationOpenDate || undefined,
        registrationCloseDate: registrationCloseDate || undefined,
        firstSessionDate: firstSessionDate || undefined,
        lastSessionDate: lastSessionDate || undefined,
        sessionDayOfWeek: dayOfWeek || undefined,
        sessionCount: sessionCount > 0 ? sessionCount : undefined,
        directorId: director?.uid,
        directorName: director?.displayName,
        coordinatorId: coordinator?.uid,
        coordinatorName: coordinator?.displayName,
        // Derive city/state from selected facility address for weather/display.
        city: selectedFacility?.address?.split(",").slice(-2, -1)[0]?.trim() || undefined,
        state: selectedFacility?.address?.split(",").slice(-1)[0]?.trim().split(" ")[0] || undefined,
      };
      const leagueId = await createLeague(user.uid, input);
      setSuccess(true);
      setTimeout(() => router.push(`/leagues/${leagueId}`), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create league.");
    } finally {
      setSubmitting(false);
    }
  }

  if (permLoading || clubsLoading) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-xl">
          <Panel variant="base" padding="lg" className="text-center text-ash-500 text-sm">Loading…</Panel>
        </main>
      </ResponsiveShell>
    );
  }

  if (!canCreate) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-xl">
          <Panel variant="quest" padding="lg" className="text-center space-y-3">
            <ShieldAlert className="h-8 w-8 text-crimson-500 mx-auto" />
            <h2 className="heading-fantasy text-ash-100 text-base">Club Director Required</h2>
            <p className="text-ash-400 text-sm">You need an approved club to create a league.</p>
            <Button size="sm" onClick={() => router.push("/clubs/create")}>Create a Club</Button>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  if (approvedClubs.length === 0) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-xl">
          <Panel variant="quest" padding="lg" className="text-center space-y-3">
            <ListChecks className="h-8 w-8 text-ash-500 mx-auto" />
            <h2 className="heading-fantasy text-ash-100 text-base">No Approved Clubs</h2>
            <p className="text-ash-400 text-sm">Your club is pending approval. You can create a league once approved.</p>
            <Button size="sm" variant="outline" onClick={() => router.push("/clubs/my")}>View Club Status</Button>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  if (success) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-xl">
          <Panel variant="quest" padding="lg" className="text-center space-y-3">
            <ListChecks className="h-10 w-10 text-ember-400 mx-auto" />
            <h2 className="heading-fantasy text-display-sm text-ash-100">League Created!</h2>
            <p className="text-ash-400 text-sm">Redirecting to your league…</p>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  function SectionHeader({
    id,
    icon,
    title,
    subtitle,
    filled,
  }: {
    id: typeof openSection;
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    filled?: boolean;
  }) {
    const isOpen = openSection === id;
    return (
      <button
        type="button"
        onClick={() => setOpenSection(isOpen ? null : id)}
        className="w-full flex items-center gap-3 text-left"
      >
        <div className={`p-2 rounded-pixel shrink-0 ${filled ? "bg-ember-500/20 text-ember-400" : "bg-obsidian-700 text-ash-500"}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${filled ? "text-ash-100" : "text-ash-300"}`}>{title}</p>
          {subtitle && <p className="text-ash-500 text-xs truncate">{subtitle}</p>}
        </div>
        {filled && <RuneChip tone="success" className="text-[9px] shrink-0">Set</RuneChip>}
        {isOpen ? <ChevronUp className="h-4 w-4 text-ash-500 shrink-0" /> : <ChevronDown className="h-4 w-4 text-ash-500 shrink-0" />}
      </button>
    );
  }

  const facilityFilled = facilityPick !== "";
  const scheduleFilled = !!(firstSessionDate && lastSessionDate);
  const staffFilled = !!(director || coordinator);

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-xl">
        <div>
          <RuneChip tone="rune" className="mb-2">New League</RuneChip>
          <h1 className="heading-fantasy text-display-md text-ash-100">Create a League</h1>
          <p className="text-ash-400 text-sm mt-1">
            Set up a new league under one of your approved clubs.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">

          {/* ── Section 1: Basic Info ── */}
          <Panel variant="quest" padding="lg" className="space-y-4">
            <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest">Basic Info</h2>

            <label className="text-xs text-ash-400 space-y-1 block">
              <span>Club <span className="text-crimson-500">*</span></span>
              <select
                value={clubId}
                onChange={(e) => setClubId(e.target.value)}
                className={fieldCls}
                required
              >
                {approvedClubs.map((c) => (
                  <option key={c.id} value={c.id}>{c.clubName}</option>
                ))}
              </select>
            </label>

            <label className="text-xs text-ash-400 space-y-1 block">
              <span>League Name <span className="text-crimson-500">*</span></span>
              <input
                type="text"
                className={fieldCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tuesday Night Doubles"
                required
              />
            </label>

            <label className="text-xs text-ash-400 space-y-1 block">
              <span>Format</span>
              <select
                value={leagueFormat}
                onChange={(e) => setLeagueFormat(e.target.value)}
                className={fieldCls}
              >
                {FORMATS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </label>

            <label className="text-xs text-ash-400 space-y-1 block">
              <span>Description</span>
              <textarea
                className={fieldCls}
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the league…"
              />
            </label>
          </Panel>

          {/* ── Section 2: Facility (collapsible) ── */}
          <Panel variant="inventory" padding="lg" className="space-y-4">
            <SectionHeader
              id="location"
              icon={<MapPin className="h-4 w-4" />}
              title="Facility"
              subtitle={
                facilityPick === "__new__"
                  ? newFacilityName || newFacilityAddress || "New facility"
                  : selectedFacility
                  ? (selectedFacility.facilityName ?? selectedFacility.address ?? "Facility selected")
                  : "Where the league is played"
              }
              filled={facilityFilled}
            />
            {openSection === "location" && (
              <div className="space-y-3 pt-1 border-t border-obsidian-600">
                <label className="text-xs text-ash-400 space-y-1 block">
                  <span>Facility</span>
                  <select
                    value={facilityPick}
                    onChange={(e) => setFacilityPick(e.target.value)}
                    className={fieldCls}
                  >
                    <option value="">— No facility —</option>
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.facilityName ?? f.address ?? `Facility ${f.id.slice(0, 6)}`}
                      </option>
                    ))}
                    <option value="__new__">＋ Create new facility…</option>
                  </select>
                </label>

                {/* Show selected facility details */}
                {selectedFacility && (
                  <div className="rounded-pixel bg-obsidian-800 border border-ash-700 px-3 py-2 text-xs space-y-0.5">
                    {selectedFacility.facilityName && <p className="text-ash-100 font-medium">{selectedFacility.facilityName}</p>}
                    {selectedFacility.address && <p className="text-ash-400 flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{selectedFacility.address}</p>}
                    {(selectedFacility.pickleballCourts ?? 0) > 0 && <p className="text-ash-500">{selectedFacility.pickleballCourts} pickleball court{selectedFacility.pickleballCourts !== 1 ? "s" : ""}</p>}
                  </div>
                )}

                {/* Inline new facility form */}
                {facilityPick === "__new__" && (
                  <div className="space-y-3 pt-2 border-t border-obsidian-700">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-ash-500">New Facility Details</p>
                    <label className="text-xs text-ash-400 space-y-1 block">
                      <span>Facility Name</span>
                      <input type="text" className={fieldCls} value={newFacilityName} onChange={(e) => setNewFacilityName(e.target.value)} placeholder="Riverwind Park" />
                    </label>
                    <label className="text-xs text-ash-400 space-y-1 block">
                      <span>Address</span>
                      <input type="text" className={fieldCls} value={newFacilityAddress} onChange={(e) => setNewFacilityAddress(e.target.value)} placeholder="1234 Main St, Andover, MN 55304" />
                    </label>
                    <label className="text-xs text-ash-400 space-y-1 block">
                      <span>Pickleball Courts</span>
                      <input type="number" min="0" className={fieldCls} value={newFacilityCourts} onChange={(e) => setNewFacilityCourts(e.target.value)} placeholder="0" />
                    </label>
                    <div className="flex gap-4 text-xs text-ash-300">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={newFacilityParking} onChange={(e) => setNewFacilityParking(e.target.checked)} className="accent-ember-500" />
                        Parking
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={newFacilityLights} onChange={(e) => setNewFacilityLights(e.target.checked)} className="accent-ember-500" />
                        Lights
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={newFacilityIndoor} onChange={(e) => setNewFacilityIndoor(e.target.checked)} className="accent-ember-500" />
                        Indoor
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Panel>

          {/* ── Section 3: Schedule (collapsible) ── */}
          <Panel variant="inventory" padding="lg" className="space-y-4">
            <SectionHeader
              id="schedule"
              icon={<Calendar className="h-4 w-4" />}
              title="Schedule"
              subtitle={scheduleFilled ? `${sessionCount} ${dayOfWeek} sessions` : "Dates & session count"}
              filled={scheduleFilled}
            />
            {openSection === "schedule" && (
              <div className="space-y-4 pt-1 border-t border-obsidian-600">
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-ash-400 space-y-1 block">
                    <span>Registration Opens</span>
                    <input
                      type="date"
                      className={fieldCls}
                      value={registrationOpenDate}
                      onChange={(e) => setRegistrationOpenDate(e.target.value)}
                    />
                  </label>
                  <label className="text-xs text-ash-400 space-y-1 block">
                    <span>Registration Closes</span>
                    <input
                      type="date"
                      className={fieldCls}
                      value={registrationCloseDate}
                      onChange={(e) => setRegistrationCloseDate(e.target.value)}
                      min={registrationOpenDate || undefined}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-ash-400 space-y-1 block">
                    <span>First Session <span className="text-crimson-500">*</span></span>
                    <input
                      type="date"
                      className={fieldCls}
                      value={firstSessionDate}
                      onChange={(e) => setFirstSessionDate(e.target.value)}
                    />
                  </label>
                  <label className="text-xs text-ash-400 space-y-1 block">
                    <span>Last Session <span className="text-crimson-500">*</span></span>
                    <input
                      type="date"
                      className={fieldCls}
                      value={lastSessionDate}
                      onChange={(e) => setLastSessionDate(e.target.value)}
                      min={firstSessionDate || undefined}
                    />
                  </label>
                </div>

                {firstSessionDate && lastSessionDate && (
                  <div className="grid grid-cols-2 gap-3">
                    <Panel variant="base" padding="sm" className="text-center">
                      <p className="text-[10px] uppercase tracking-[0.15em] text-ash-500 mb-0.5">Day of Week</p>
                      <p className="heading-fantasy text-ash-100 text-lg">{dayOfWeek}</p>
                    </Panel>
                    <Panel variant="base" padding="sm" className={`text-center ${lastSessionDate < firstSessionDate ? "border-crimson-500/50" : ""}`}>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-ash-500 mb-0.5">Sessions</p>
                      <p className={`heading-fantasy text-lg ${sessionCount > 0 ? "text-ember-400" : "text-crimson-400"}`}>
                        {sessionCount > 0 ? sessionCount : "—"}
                      </p>
                      {sessionCount > 0 && (
                        <p className="text-ash-600 text-[10px]">{sessionCount} × {dayOfWeek}</p>
                      )}
                    </Panel>
                  </div>
                )}

                {firstSessionDate && lastSessionDate && lastSessionDate < firstSessionDate && (
                  <p className="text-crimson-400 text-xs">Last session must be on or after the first session.</p>
                )}
              </div>
            )}
          </Panel>

          {/* ── Section 4: Staff (collapsible) ── */}
          <Panel variant="inventory" padding="lg" className="space-y-4">
            <SectionHeader
              id="staff"
              icon={<Users className="h-4 w-4" />}
              title="Staff"
              subtitle={
                director && coordinator
                  ? `${director.displayName} · ${coordinator.displayName}`
                  : director
                  ? `Director: ${director.displayName}`
                  : coordinator
                  ? `Coordinator: ${coordinator.displayName}`
                  : "Optional: assign director & coordinator"
              }
              filled={staffFilled}
            />
            {openSection === "staff" && (
              <div className="space-y-4 pt-1 border-t border-obsidian-600">
                <div>
                  <p className="text-xs text-ash-400 mb-1.5 font-medium">League Director <span className="text-ash-600">(optional)</span></p>
                  <p className="text-ash-600 text-[11px] mb-2">The director oversees league operations. They must already have Club Director access.</p>
                  <UserLookup
                    label="director"
                    resolved={director}
                    onResolve={setDirector}
                    onClear={() => setDirector(null)}
                  />
                </div>
                <div>
                  <p className="text-xs text-ash-400 mb-1.5 font-medium">League Coordinator <span className="text-ash-600">(optional)</span></p>
                  <p className="text-ash-600 text-[11px] mb-2">The coordinator manages day-to-day operations. If left blank, you'll be assigned as coordinator.</p>
                  <UserLookup
                    label="coordinator"
                    resolved={coordinator}
                    onResolve={setCoordinator}
                    onClear={() => setCoordinator(null)}
                  />
                </div>
              </div>
            )}
          </Panel>

          {error && (
            <p className="text-sm text-crimson-400 px-1">{error}</p>
          )}

          <div className="flex gap-3">
            <Button type="submit" size="md" className="flex-1" disabled={submitting || !name.trim() || !clubId}>
              {submitting ? "Creating…" : "Create League"}
            </Button>
            <Button type="button" variant="outline" size="md" onClick={() => router.back()} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </form>
      </main>
    </ResponsiveShell>
  );
}
