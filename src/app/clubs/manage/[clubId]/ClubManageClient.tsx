"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Car,
  CheckCircle,
  Layers,
  Lightbulb,
  Loader2,
  MapPin,
  Plus,
  Save,
  Trash2,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { useToast } from "@/lib/toast-context";
import {
  getClubById,
  getClubFacility,
  listClubLeagues,
  listClubCoordinators,
  getUserByEmail,
} from "@/lib/clubs/repo";
import { upsertClubFacility } from "@/lib/clubs/write";
import { createLeague } from "@/lib/leagues/write";
import { createVenue } from "@/lib/ladder/write";
import { assignRole, deactivateUserRole } from "@/lib/permissions/write";
import { listVenues } from "@/lib/ladder/repo";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import type { ClubDoc, ClubFacility } from "@/lib/permissions/types";
import type { LeagueDoc, VenueDoc } from "@/lib/firestore/types";
import type { CoordinatorEntry } from "@/lib/clubs/repo";

type Section = "overview" | "leagues" | "facilities" | "coordinators";

const AMENITY_OPTIONS = [
  "Restrooms",
  "Water Fountain",
  "Pro Shop",
  "Locker Rooms",
  "Seating / Bleachers",
  "Concessions",
  "Wheelchair Accessible",
  "Covered / Shade",
  "Ball Machine",
  "First Aid",
];

export function ClubManageClient({ clubId: fallbackId }: { clubId: string }) {
  const routeParams = useParams<{ clubId: string }>();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { clubDirectorFor, isSiteAdmin, loading: permLoading } = usePermissions();
  const { toast } = useToast();

  // useParams() returns the real URL param on the client, even when Firebase Hosting
  // serves the __fallback shell. Fall back to the prop (which may be "__fallback")
  // only during SSR/build when window isn't available.
  const clubId =
    routeParams?.clubId && routeParams.clubId !== "__fallback"
      ? routeParams.clubId
      : fallbackId;

  const initialSection = (searchParams.get("section") as Section) ?? "overview";
  const [club, setClub] = useState<ClubDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>(initialSection);

  useEffect(() => {
    if (!clubId || clubId === "__fallback") return;
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
            <Link href="/clubs/my" className="text-ash-400 text-sm hover:text-ash-100 mt-2 inline-block">← Back to My Clubs</Link>
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
            <Link href="/clubs/my" className="text-ash-400 text-sm hover:text-ash-100 mt-2 inline-block">← Back to My Clubs</Link>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  const tabs: { id: Section; label: string; Icon: typeof Layers }[] = [
    { id: "overview",     label: "Overview",     Icon: Building2 },
    { id: "leagues",      label: "Leagues",      Icon: Layers },
    { id: "facilities",   label: "Facilities",   Icon: Wrench },
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
        {section === "facilities"   && <FacilitiesSection clubId={clubId} userId={user?.uid ?? ""} toast={toast} />}
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

function LeaguesSection({ clubId, userId, toast }: { clubId: string; userId: string; toast: ToastFn }) {
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
    listClubLeagues(clubId)
      .then((l) => { setLeagues(l); setLoading(false); })
      .catch(() => setLoading(false));
  }, [clubId]);

  async function handleCreate() {
    if (!name.trim()) { toast("League name is required.", "error"); return; }
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
      setLeagues((prev) => [{
        id, orgId: clubId, clubId, name: name.trim(),
        description: description.trim() || undefined,
        city: city.trim() || undefined, state: state.trim() || undefined,
        league_format: format, active: true, createdBy: userId,
      }, ...prev]);
      setName(""); setDescription(""); setCity(""); setState(""); setFormat("Doubles Ladder");
      setShowForm(false);
      toast(`"${name.trim()}" league created.`, "success");
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
          <Plus className="h-3.5 w-3.5" /> New League
        </Button>
      </div>

      {showForm && (
        <Panel variant="quest" padding="lg" className="space-y-3">
          <h3 className="heading-fantasy text-ash-100 text-sm">Create League</h3>
          <div className="space-y-2">
            <input className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500" placeholder="League name *" value={name} onChange={(e) => setName(e.target.value)} />
            <textarea className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500 resize-none" placeholder="Description (optional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
              <input className="rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500" placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
            </div>
            <select className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500" value={format} onChange={(e) => setFormat(e.target.value)}>
              <option>Doubles Ladder</option>
              <option>Singles Ladder</option>
              <option>Mixed Doubles Ladder</option>
              <option>Round Robin</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create League
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Panel>
      )}

      {loading ? (
        <Panel variant="base" padding="lg" className="flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-ember-400" /></Panel>
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
                <p className="text-ash-500 text-xs">{[league.city, league.state].filter(Boolean).join(", ")}{league.league_format ? ` · ${league.league_format}` : ""}</p>
              </div>
              <Link href={`/leagues/${league.id}`}><Button size="sm" variant="ghost">View</Button></Link>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// FACILITIES + VENUE
// ============================================================

function FacilitiesSection({ clubId, userId, toast }: { clubId: string; userId: string; toast: ToastFn }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingVenue, setSavingVenue] = useState(false);
  const [venues, setVenues] = useState<VenueDoc[]>([]);
  const [showVenueForm, setShowVenueForm] = useState(false);

  // Facility fields
  const [address, setAddress] = useState("");
  const [pickleballCourts, setPickleballCourts] = useState<number | "">("");
  const [tennisConversionCourts, setTennisConversionCourts] = useState<number | "">("");
  const [hasParking, setHasParking] = useState(false);
  const [hasLights, setHasLights] = useState(false);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  // Venue form fields
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueRadius, setVenueRadius] = useState<number>(200);

  useEffect(() => {
    Promise.all([getClubFacility(clubId), listVenues(clubId)]).then(([f, v]) => {
      if (f) {
        setAddress(f.address ?? "");
        setPickleballCourts(f.pickleballCourts ?? "");
        setTennisConversionCourts(f.tennisConversionCourts ?? "");
        setHasParking(f.hasParking ?? false);
        setHasLights(f.hasLights ?? false);
        setSelectedAmenities(f.amenities ?? []);
        setNotes(f.notes ?? "");
      }
      setVenues(v);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [clubId]);

  function toggleAmenity(amenity: string) {
    setSelectedAmenities((prev) =>
      prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity],
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await upsertClubFacility(clubId, {
        address: address.trim() || undefined,
        pickleballCourts: pickleballCourts !== "" ? Number(pickleballCourts) : undefined,
        tennisConversionCourts: tennisConversionCourts !== "" ? Number(tennisConversionCourts) : undefined,
        hasParking, hasLights,
        amenities: selectedAmenities.length > 0 ? selectedAmenities : undefined,
        notes: notes.trim() || undefined,
      }, userId);
      toast("Facility information saved.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateVenue() {
    if (!venueName.trim()) { toast("Venue name is required.", "error"); return; }
    setSavingVenue(true);
    try {
      const id = await createVenue({
        name: venueName.trim(),
        address: venueAddress.trim() || undefined,
        lat: 0,
        lng: 0,
        radiusMeters: venueRadius,
        createdBy: userId,
        clubId,
      });
      const newVenue: VenueDoc = { id, name: venueName.trim(), address: venueAddress.trim() || undefined, lat: 0, lng: 0, radiusMeters: venueRadius, createdBy: userId, createdAt: new Date().toISOString() };
      setVenues((prev) => [newVenue, ...prev]);
      setVenueName(""); setVenueAddress(""); setVenueRadius(200);
      setShowVenueForm(false);
      toast(`Venue "${venueName.trim()}" created.`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create venue.", "error");
    } finally {
      setSavingVenue(false);
    }
  }

  if (loading) {
    return <Panel variant="base" padding="lg" className="flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-ember-400" /></Panel>;
  }

  return (
    <div className="space-y-6">

      {/* Court Facilities */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest">Court Facilities</h2>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>

        <Panel variant="quest" padding="lg" className="space-y-4">
          <div>
            <label className="text-ash-300 text-xs font-medium mb-1.5 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-ember-400" /> Facility Address
            </label>
            <input
              className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
              placeholder="123 Court Ave, City, State 55555"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div>
            <label className="text-ash-300 text-xs font-medium mb-1.5 block">Court Count</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-ash-500 text-xs mb-1 block">Dedicated Pickleball</label>
                <input type="number" min={0} max={99}
                  className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
                  placeholder="0" value={pickleballCourts}
                  onChange={(e) => setPickleballCourts(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                />
              </div>
              <div>
                <label className="text-ash-500 text-xs mb-1 block">Tennis Conversion</label>
                <input type="number" min={0} max={99}
                  className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
                  placeholder="0" value={tennisConversionCourts}
                  onChange={(e) => setTennisConversionCourts(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-ash-300 text-xs font-medium mb-2 block">Infrastructure</label>
            <div className="grid grid-cols-2 gap-2">
              <ToggleRow icon={<Car className="h-4 w-4" />} label="On-Site Parking" value={hasParking} onChange={setHasParking} />
              <ToggleRow icon={<Lightbulb className="h-4 w-4" />} label="Court Lights" value={hasLights} onChange={setHasLights} />
            </div>
          </div>

          <div>
            <label className="text-ash-300 text-xs font-medium mb-2 block">Amenities</label>
            <div className="flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map((amenity) => {
                const active = selectedAmenities.includes(amenity);
                return (
                  <button key={amenity} type="button" onClick={() => toggleAmenity(amenity)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      active
                        ? "bg-ember-500/20 border-ember-500/60 text-ember-300"
                        : "bg-obsidian-700 border-ash-700 text-ash-400 hover:border-ash-500 hover:text-ash-200"
                    }`}
                  >
                    {active && "✓ "}{amenity}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-ash-300 text-xs font-medium mb-1.5 block">Additional Notes</label>
            <textarea
              className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500 resize-none"
              placeholder="Any other details players should know…"
              rows={3} value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </Panel>
      </div>

      {/* Venues */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest">Venues</h2>
          <Button size="sm" variant="outline" onClick={() => setShowVenueForm((v) => !v)}>
            <Plus className="h-3.5 w-3.5" /> Add Venue
          </Button>
        </div>
        <p className="text-ash-500 text-xs">Venues are used for GPS check-in during play dates. Add your court location here.</p>

        {showVenueForm && (
          <Panel variant="quest" padding="lg" className="space-y-3">
            <h3 className="heading-fantasy text-ash-100 text-sm">Create Venue</h3>
            <div className="space-y-2">
              <input
                className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
                placeholder="Venue name *"
                value={venueName} onChange={(e) => setVenueName(e.target.value)}
              />
              <input
                className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
                placeholder="Address (optional)"
                value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)}
              />
              <div>
                <label className="text-ash-500 text-xs mb-1 block">Check-in radius (meters)</label>
                <input
                  type="number" min={50} max={2000}
                  className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
                  value={venueRadius} onChange={(e) => setVenueRadius(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreateVenue} disabled={savingVenue}>
                {savingVenue && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create Venue
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowVenueForm(false)}>Cancel</Button>
            </div>
          </Panel>
        )}

        {venues.length === 0 ? (
          <Panel variant="base" padding="md" className="text-center">
            <p className="text-ash-500 text-sm">No venues yet. Add one above.</p>
          </Panel>
        ) : (
          <div className="space-y-2">
            {venues.map((venue) => (
              <Panel key={venue.id} variant="inventory" padding="md">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-ash-100 text-sm font-medium">{venue.name}</p>
                    {venue.address && <p className="text-ash-500 text-xs flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3 shrink-0" />{venue.address}</p>}
                    <p className="text-ash-600 text-[10px] mt-0.5">Check-in radius: {venue.radiusMeters}m</p>
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleRow({ icon, label, value, onChange }: { icon: React.ReactNode; label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-pixel border text-sm transition-colors text-left ${
        value ? "bg-ember-500/15 border-ember-500/50 text-ember-300" : "bg-obsidian-700 border-ash-700 text-ash-400 hover:border-ash-500"
      }`}
    >
      <span className={value ? "text-ember-400" : "text-ash-600"}>{icon}</span>
      <span className="text-xs font-medium">{label}</span>
      <span className={`ml-auto text-[10px] font-bold ${value ? "text-ember-400" : "text-ash-600"}`}>{value ? "YES" : "NO"}</span>
    </button>
  );
}

// ============================================================
// COORDINATORS
// ============================================================

function CoordinatorsSection({ clubId, userId, toast }: { clubId: string; userId: string; toast: ToastFn }) {
  const [coordinators, setCoordinators] = useState<CoordinatorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    listClubCoordinators(clubId)
      .then((c) => { setCoordinators(c); setLoading(false); })
      .catch(() => setLoading(false));
  }, [clubId]);

  async function handleAssign() {
    if (!email.trim()) return;
    setAssigning(true);
    try {
      const found = await getUserByEmail(email.trim());
      if (!found) { toast(`No account found for ${email.trim()}.`, "error"); return; }
      if (coordinators.some((c) => c.userId === found.uid)) { toast(`${found.displayName} is already a coordinator.`, "error"); return; }
      await assignRole(found.uid, "LeagueCoordinator", clubId, null, userId);
      setCoordinators((prev) => [...prev, { userRoleId: `pending-${Date.now()}`, userId: found.uid, displayName: found.displayName, assignedAt: new Date().toISOString() }]);
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
        <p className="text-ash-400 text-xs">Enter a player&apos;s email address to grant them League Coordinator access for this club.</p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
            placeholder="player@email.com" type="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAssign()}
          />
          <Button size="sm" onClick={handleAssign} disabled={assigning || !email.trim()}>
            {assigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />} Assign
          </Button>
        </div>
      </Panel>

      {loading ? (
        <Panel variant="base" padding="lg" className="flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-ember-400" /></Panel>
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
              <button onClick={() => handleRemove(entry)} disabled={removing === entry.userRoleId}
                className="text-ash-500 hover:text-rose-400 transition-colors disabled:opacity-50">
                {removing === entry.userRoleId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
