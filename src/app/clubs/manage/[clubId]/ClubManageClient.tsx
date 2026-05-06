"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Building2,
  Car,
  ChevronRight,
  CheckCircle,
  Copy,
  Edit2,
  Layers,
  Lightbulb,
  Link as LinkIcon,
  Loader2,
  MapPin,
  Megaphone,
  Plus,
  Save,
  Send,
  Trash2,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/lib/toast-context";
import {
  countClubPlayers,
  getClubById,
  getClubFacility,
  listClubLeagues,
  listClubCoordinators,
  getUserByEmail,
} from "@/lib/clubs/repo";
import { upsertClubFacility, deleteClubFacility, updateClubLogo } from "@/lib/clubs/write";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { uploadClubLogo } from "@/lib/storage";
import { createLeague, leaveLeague } from "@/lib/leagues/write";
import { listLeagueMembers, type LeagueMemberEntry } from "@/lib/leagues/repo";
import { getPlayerProfile } from "@/lib/players/repo";
import { createVenue, writeNotification } from "@/lib/ladder/write";
import { assignRole, deactivateUserRole } from "@/lib/permissions/write";
import { listVenues } from "@/lib/ladder/repo";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import type { ClubDoc, ClubFacility } from "@/lib/permissions/types";
import type { LeagueDoc, VenueDoc } from "@/lib/firestore/types";
import type { CoordinatorEntry } from "@/lib/clubs/repo";

type Section = "overview" | "leagues" | "facilities" | "coordinators" | "members";

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { clubDirectorFor, isSiteAdmin, loading: permLoading } = usePermissions();
  const { toast } = useToast();

  // usePathname() always reflects the real browser URL; useParams() may return
  // "__fallback" when the fallback shell is served for a dynamic URL.
  // URL shape: /clubs/manage/{clubId} → segment index 3
  const pathnameSegment = pathname.split("/")[3];
  const clubId =
    pathnameSegment && pathnameSegment !== "__fallback"
      ? pathnameSegment
      : routeParams?.clubId && routeParams.clubId !== "__fallback"
      ? routeParams.clubId
      : fallbackId;

  const initialSection = (searchParams.get("section") as Section) ?? "overview";
  const [club, setClub] = useState<ClubDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>(initialSection);

  useEffect(() => {
    if (!clubId || clubId === "__fallback") { setLoading(false); return; }
    getClubById(clubId)
      .then((c) => { setClub(c); setLoading(false); })
      .catch(() => { setClub(null); setLoading(false); });
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
    { id: "members",      label: "Members",      Icon: Users },
    { id: "coordinators", label: "Coordinators", Icon: UserPlus },
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

        {section === "overview"     && <OverviewSection club={club} clubId={clubId} onNavigate={setSection} />}
        {section === "leagues"      && <LeaguesSection clubId={clubId} userId={user?.uid ?? ""} toast={toast} />}
        {section === "facilities"   && <FacilitiesSection clubId={clubId} userId={user?.uid ?? ""} toast={toast} />}
        {section === "members"      && <MembersSection clubId={clubId} toast={toast} />}
        {section === "coordinators" && <CoordinatorsSection clubId={clubId} userId={user?.uid ?? ""} toast={toast} />}
      </main>
    </ResponsiveShell>
  );
}

// ============================================================
// OVERVIEW
// ============================================================

function StatCard({
  label,
  value,
  icon,
  onClick,
}: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="heading-fantasy text-ash-100 text-2xl">
        {value === null ? (
          <Loader2 className="h-5 w-5 animate-spin text-ember-400 mx-auto" />
        ) : (
          value
        )}
      </p>
      <p className="text-ash-500 text-[10px] uppercase tracking-wider mt-0.5">{label}</p>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-center p-4 rounded-pixel bg-obsidian-800 border border-ash-800 hover:border-ember-500/50 transition-colors group"
      >
        {inner}
      </button>
    );
  }
  return (
    <div className="text-center p-4 rounded-pixel bg-obsidian-800 border border-ash-800">
      {inner}
    </div>
  );
}

function OverviewSection({
  club,
  clubId,
  onNavigate,
}: {
  club: ClubDoc;
  clubId: string;
  onNavigate: (section: Section) => void;
}) {
  const { toast } = useToast();
  const [leagues, setLeagues] = useState<LeagueDoc[]>([]);
  const [coordinators, setCoordinators] = useState<CoordinatorEntry[]>([]);
  const [facility, setFacility] = useState<ClubFacility | null | undefined>(undefined);
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(club.logoUrl ?? null);

  useEffect(() => {
    Promise.all([listClubLeagues(clubId), listClubCoordinators(clubId), getClubFacility(clubId)])
      .then(async ([l, c, f]) => {
        setLeagues(l);
        setCoordinators(c);
        setFacility(f);
        const count = await countClubPlayers(l.map((x) => x.id));
        setPlayerCount(count);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [clubId]);

  async function handleLogoUploaded(url: string) {
    const newUrl = url || null;
    setLogoUrl(newUrl);
    try {
      await updateClubLogo(clubId, newUrl);
      toast("Logo updated", "success");
    } catch {
      toast("Failed to save logo", "error");
    }
  }

  return (
    <div className="space-y-6">
      {/* Club info */}
      <Panel variant="quest" padding="lg" className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0">
            <ImageUpload
              currentUrl={logoUrl}
              onUploaded={handleLogoUploaded}
              upload={(file) => uploadClubLogo(clubId, file)}
              shape="square"
              size="md"
              label="Club logo"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="heading-fantasy text-ash-100">{club.clubName}</h2>
              <RuneChip tone="success">
                <CheckCircle className="h-3 w-3" /> Approved
              </RuneChip>
            </div>
            <p className="text-ash-400 text-sm">{club.location}</p>
            {club.description && (
              <p className="text-ash-500 text-xs mt-1 leading-relaxed">{club.description}</p>
            )}
          </div>
        </div>
      </Panel>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Leagues"
          value={loading ? null : leagues.length}
          icon={<Layers className="h-5 w-5 text-ember-400" />}
          onClick={() => onNavigate("leagues")}
        />
        <StatCard
          label="Coordinators"
          value={loading ? null : coordinators.length}
          icon={<Users className="h-5 w-5 text-ember-400" />}
          onClick={() => onNavigate("coordinators")}
        />
        <StatCard
          label="Players"
          value={loading ? null : (playerCount ?? 0)}
          icon={<Trophy className="h-5 w-5 text-ember-400" />}
        />
      </div>

      {/* Leagues */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest">Leagues</h2>
          <button
            type="button"
            onClick={() => onNavigate("leagues")}
            className="text-ember-400 hover:text-ember-300 text-xs flex items-center gap-0.5 transition-colors"
          >
            Manage <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {loading ? (
          <Panel variant="base" padding="md" className="flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-ember-400" />
          </Panel>
        ) : leagues.length === 0 ? (
          <Panel variant="base" padding="md" className="text-center space-y-2">
            <Layers className="h-6 w-6 text-ash-600 mx-auto" />
            <p className="text-ash-500 text-sm">No leagues yet.</p>
            <button
              type="button"
              onClick={() => onNavigate("leagues")}
              className="text-ember-400 hover:text-ember-300 text-xs transition-colors"
            >
              Create your first league →
            </button>
          </Panel>
        ) : (
          <div className="space-y-2">
            {leagues.map((league) => (
              <Panel key={league.id} variant="inventory" padding="md" className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="heading-fantasy text-ash-100 text-sm">{league.name}</span>
                    {league.active !== false && (
                      <RuneChip tone="success" className="text-[10px]">Active</RuneChip>
                    )}
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

      {/* Facilities */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest">Facilities</h2>
          <button
            type="button"
            onClick={() => onNavigate("facilities")}
            className="text-ember-400 hover:text-ember-300 text-xs flex items-center gap-0.5 transition-colors"
          >
            Edit <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {loading ? (
          <Panel variant="base" padding="md" className="flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-ember-400" />
          </Panel>
        ) : !facility ? (
          <Panel variant="base" padding="md" className="text-center space-y-2">
            <MapPin className="h-6 w-6 text-ash-600 mx-auto" />
            <p className="text-ash-500 text-sm">No facility info added yet.</p>
            <button
              type="button"
              onClick={() => onNavigate("facilities")}
              className="text-ember-400 hover:text-ember-300 text-xs transition-colors"
            >
              Add facility info →
            </button>
          </Panel>
        ) : (
          <Panel variant="inventory" padding="md" className="space-y-3">
            {/* Name + address */}
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-ash-800 shrink-0 mt-0.5">
                <MapPin className="h-4 w-4 text-ember-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    {facility.facilityName && (
                      <p className="heading-fantasy text-ash-100 text-sm">{facility.facilityName}</p>
                    )}
                    {facility.address && (
                      <p className="text-ash-400 text-xs mt-0.5">{facility.address}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="bg-obsidian-700 border border-ash-700 rounded-pixel px-2 py-1 flex items-center gap-1.5">
                      <Layers className="h-3 w-3 text-ember-400" />
                      <span className="heading-fantasy text-ash-100 text-sm">{leagues.length}</span>
                      <span className="text-ash-500 text-[10px]">{leagues.length === 1 ? "league" : "leagues"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate("facilities")}
                      className="p-1.5 rounded text-ash-500 hover:text-ember-400 transition-colors"
                      title="Edit facility"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {facility.isIndoor && (
                    <RuneChip tone="rune" className="text-[10px]">Indoor</RuneChip>
                  )}
                  {facility.surfaceType && (
                    <RuneChip tone="neutral" className="text-[10px] capitalize">{facility.surfaceType}</RuneChip>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 mt-1.5 text-ash-500 text-xs">
                  {(facility.pickleballCourts ?? 0) > 0 && (
                    <span>{facility.pickleballCourts} Pickleball Courts</span>
                  )}
                  {(facility.tennisConversionCourts ?? 0) > 0 && (
                    <span>{facility.tennisConversionCourts} Tennis Conversion</span>
                  )}
                  {facility.hasParking && <span className="flex items-center gap-1"><Car className="h-3 w-3" /> Parking</span>}
                  {facility.hasLights && <span className="flex items-center gap-1"><Lightbulb className="h-3 w-3" /> Lights</span>}
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

            {/* Map embed */}
            {facility.address && (
              <div className="rounded-pixel overflow-hidden border border-ash-700 h-40 w-full">
                <iframe
                  title="Facility location"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(facility.address)}&output=embed`}
                  className="w-full h-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}
          </Panel>
        )}
      </div>

      {/* Coordinators */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest">Coordinators</h2>
          <button
            type="button"
            onClick={() => onNavigate("coordinators")}
            className="text-ember-400 hover:text-ember-300 text-xs flex items-center gap-0.5 transition-colors"
          >
            Manage <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {loading ? (
          <Panel variant="base" padding="md" className="flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-ember-400" />
          </Panel>
        ) : coordinators.length === 0 ? (
          <Panel variant="base" padding="md" className="text-center space-y-2">
            <Users className="h-6 w-6 text-ash-600 mx-auto" />
            <p className="text-ash-500 text-sm">No coordinators assigned.</p>
            <button
              type="button"
              onClick={() => onNavigate("coordinators")}
              className="text-ember-400 hover:text-ember-300 text-xs transition-colors"
            >
              Assign a coordinator →
            </button>
          </Panel>
        ) : (
          <div className="space-y-2">
            {coordinators.map((entry) => (
              <Panel key={entry.userRoleId} variant="inventory" padding="md" className="flex items-center gap-3">
                <div className="p-1.5 rounded-full bg-obsidian-700 shrink-0">
                  <Users className="h-3.5 w-3.5 text-ember-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-ash-100 text-sm font-medium">{entry.displayName ?? "Player"}</p>
                  <RuneChip tone="rune" className="text-[10px]">Coordinator</RuneChip>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// LEAGUES
// ============================================================

type ToastFn = (message: string, variant?: "success" | "error" | "info") => void;

function getDayOfWeek(dateStr: string): string {
  if (!dateStr) return "";
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const d = new Date(dateStr + "T12:00:00");
  return days[d.getDay()] ?? "";
}

function calcSessionCount(first: string, last: string): number | null {
  if (!first || !last) return null;
  const firstMs = new Date(first + "T12:00:00").getTime();
  const lastMs = new Date(last + "T12:00:00").getTime();
  if (lastMs < firstMs) return null;
  return Math.floor((lastMs - firstMs) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

function UserLookup({
  label,
  onSelect,
  onClear,
}: {
  label: string;
  onSelect: (id: string, name: string) => void;
  onClear: () => void;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "searching" | "found" | "notfound">("idle");
  const [found, setFound] = useState<{ uid: string; displayName: string } | null>(null);

  async function handleLookup() {
    if (!email.trim()) return;
    setStatus("searching");
    try {
      const u = await getUserByEmail(email.trim());
      if (u) {
        setFound({ uid: u.uid, displayName: u.displayName });
        setStatus("found");
        onSelect(u.uid, u.displayName);
      } else {
        setFound(null);
        setStatus("notfound");
      }
    } catch {
      setFound(null);
      setStatus("notfound");
    }
  }

  function handleClear() {
    setEmail(""); setFound(null); setStatus("idle"); onClear();
  }

  return (
    <div className="space-y-1.5">
      <label className="text-ash-400 text-xs block">{label}</label>
      {found ? (
        <div className="flex items-center justify-between gap-2 rounded-pixel bg-obsidian-700 border border-success-500/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <UserCheck className="h-3.5 w-3.5 text-success-400 shrink-0" />
            <span className="text-ash-100 text-sm">{found.displayName}</span>
          </div>
          <button type="button" onClick={handleClear} className="text-ash-500 hover:text-ash-300 text-xs">Clear</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
            placeholder="Email address"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (status !== "idle") setStatus("idle"); }}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
          />
          <Button size="sm" variant="outline" onClick={handleLookup} disabled={status === "searching" || !email.trim()}>
            {status === "searching" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Find"}
          </Button>
        </div>
      )}
      {status === "notfound" && (
        <p className="text-crimson-400 text-xs">No account found for that email.</p>
      )}
    </div>
  );
}

function LeaguesSection({ clubId, userId, toast }: { clubId: string; userId: string; toast: ToastFn }) {
  const [leagues, setLeagues] = useState<LeagueDoc[]>([]);
  const [venues, setVenues] = useState<VenueDoc[]>([]);
  const [facility, setFacility] = useState<ClubFacility | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Basic
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState("Doubles Ladder");

  // Location
  const [venueId, setVenueId] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  // Schedule
  const [registrationOpenDate, setRegistrationOpenDate] = useState("");
  const [registrationCloseDate, setRegistrationCloseDate] = useState("");
  const [firstSessionDate, setFirstSessionDate] = useState("");
  const [lastSessionDate, setLastSessionDate] = useState("");

  // Staff
  const [directorId, setDirectorId] = useState("");
  const [directorName, setDirectorName] = useState("");
  const [coordinatorId, setCoordinatorId] = useState("");
  const [coordinatorName, setCoordinatorName] = useState("");

  useEffect(() => {
    Promise.all([listClubLeagues(clubId), listVenues(clubId), getClubFacility(clubId)])
      .then(([l, v, f]) => { setLeagues(l); setVenues(v); setFacility(f); setLoading(false); })
      .catch(() => setLoading(false));
  }, [clubId]);

  const selectedVenue = venues.find((v) => v.id === venueId);
  const dayOfWeek = getDayOfWeek(firstSessionDate);
  const sessionCount = calcSessionCount(firstSessionDate, lastSessionDate);

  function handleVenueChange(id: string) {
    setVenueId(id);
    const v = venues.find((x) => x.id === id);
    if (v?.address) {
      const parts = v.address.split(",");
      if (parts.length >= 3) {
        setCity(parts[parts.length - 2]?.trim() ?? "");
        setState(parts[parts.length - 1]?.trim().split(" ")[0] ?? "");
      }
    }
  }

  function fillFromFacility() {
    if (!facility) return;
    if (facility.address) {
      const parts = facility.address.split(",");
      if (parts.length >= 2) {
        setCity(parts[parts.length - 2]?.trim() ?? "");
        setState(parts[parts.length - 1]?.trim().split(" ")[0] ?? "");
      }
    }
  }

  function resetForm() {
    setName(""); setDescription(""); setFormat("Doubles Ladder");
    setVenueId(""); setCity(""); setState("");
    setRegistrationOpenDate(""); setRegistrationCloseDate("");
    setFirstSessionDate(""); setLastSessionDate("");
    setDirectorId(""); setDirectorName(""); setCoordinatorId(""); setCoordinatorName("");
  }

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
        venueId: venueId || undefined,
        venueName: selectedVenue?.name,
        venueAddress: selectedVenue?.address,
        registrationOpenDate: registrationOpenDate || undefined,
        registrationCloseDate: registrationCloseDate || undefined,
        firstSessionDate: firstSessionDate || undefined,
        lastSessionDate: lastSessionDate || undefined,
        sessionDayOfWeek: dayOfWeek || undefined,
        sessionCount: sessionCount ?? undefined,
        directorId: directorId || undefined,
        directorName: directorName || undefined,
        coordinatorId: coordinatorId || undefined,
        coordinatorName: coordinatorName || undefined,
      });
      setLeagues((prev) => [{
        id, orgId: clubId, clubId, name: name.trim(),
        description: description.trim() || undefined,
        city: city.trim() || undefined, state: state.trim() || undefined,
        league_format: format, active: true, createdBy: userId,
      }, ...prev]);
      resetForm();
      setShowForm(false);
      toast(`"${name.trim()}" league created.`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create league.", "error");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest">Leagues</h2>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-3.5 w-3.5" /> New League
        </Button>
      </div>

      {showForm && (
        <Panel variant="quest" padding="lg" className="space-y-5">
          <h3 className="heading-fantasy text-ash-100">Create League</h3>

          {/* Basic Info */}
          <div className="space-y-3">
            <p className="text-ash-500 text-[10px] uppercase tracking-widest font-medium border-b border-ash-800 pb-1">Basic Info</p>
            <input className={inputCls} placeholder="League name *" value={name} onChange={(e) => setName(e.target.value)} />
            <textarea className={`${inputCls} resize-none`} placeholder="Description (optional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            <select className={inputCls} value={format} onChange={(e) => setFormat(e.target.value)}>
              <option>Doubles Ladder</option>
              <option>Singles Ladder</option>
              <option>Mixed Doubles Ladder</option>
              <option>Round Robin</option>
            </select>
          </div>

          {/* Location */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-ash-800 pb-1">
              <p className="text-ash-500 text-[10px] uppercase tracking-widest font-medium">Location</p>
              {facility && (
                <button
                  type="button"
                  onClick={fillFromFacility}
                  className="text-[10px] text-spectral-400 hover:text-spectral-300 transition-colors flex items-center gap-1"
                >
                  <MapPin className="h-3 w-3" />
                  Use club facility
                  {facility.facilityName && <span className="text-ash-500">({facility.facilityName})</span>}
                </button>
              )}
            </div>
            {venues.length > 0 && (
              <div>
                <label className="text-ash-500 text-xs mb-1 block">Venue (court location)</label>
                <select className={inputCls} value={venueId} onChange={(e) => handleVenueChange(e.target.value)}>
                  <option value="">— No venue —</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                {selectedVenue?.address && (
                  <p className="text-ash-500 text-xs mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />{selectedVenue.address}
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
              <input className={inputCls} placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-3">
            <p className="text-ash-500 text-[10px] uppercase tracking-widest font-medium border-b border-ash-800 pb-1">Schedule</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-ash-500 text-xs block">Registration Opens</span>
                <input type="date" className={inputCls} value={registrationOpenDate} onChange={(e) => setRegistrationOpenDate(e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="text-ash-500 text-xs block">Registration Closes</span>
                <input type="date" className={inputCls} value={registrationCloseDate} onChange={(e) => setRegistrationCloseDate(e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="text-ash-500 text-xs block">First Session</span>
                <input type="date" className={inputCls} value={firstSessionDate} onChange={(e) => setFirstSessionDate(e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="text-ash-500 text-xs block">Last Session</span>
                <input type="date" className={inputCls} value={lastSessionDate} onChange={(e) => setLastSessionDate(e.target.value)} />
              </label>
            </div>
            {(dayOfWeek || sessionCount !== null) && (
              <div className="flex gap-3">
                {dayOfWeek && (
                  <div className="flex-1 bg-obsidian-800 border border-ash-700 rounded-pixel px-3 py-2 text-center">
                    <p className="text-ash-500 text-[10px] uppercase tracking-wide">Day of Week</p>
                    <p className="heading-fantasy text-ember-400 text-sm mt-0.5">{dayOfWeek}</p>
                  </div>
                )}
                {sessionCount !== null && (
                  <div className="flex-1 bg-obsidian-800 border border-ash-700 rounded-pixel px-3 py-2 text-center">
                    <p className="text-ash-500 text-[10px] uppercase tracking-wide">Sessions</p>
                    <p className="heading-fantasy text-ember-400 text-sm mt-0.5">{sessionCount}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Staff */}
          <div className="space-y-3">
            <p className="text-ash-500 text-[10px] uppercase tracking-widest font-medium border-b border-ash-800 pb-1">Staff</p>
            <UserLookup
              label="League Director"
              onSelect={(id, n) => { setDirectorId(id); setDirectorName(n); }}
              onClear={() => { setDirectorId(""); setDirectorName(""); }}
            />
            <UserLookup
              label="League Coordinator"
              onSelect={(id, n) => { setCoordinatorId(id); setCoordinatorName(n); }}
              onClear={() => { setCoordinatorId(""); setCoordinatorName(""); }}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create League
            </Button>
            <Button size="sm" variant="outline" onClick={() => { resetForm(); setShowForm(false); }}>Cancel</Button>
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
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savingVenue, setSavingVenue] = useState(false);
  const [venues, setVenues] = useState<VenueDoc[]>([]);
  const [showVenueForm, setShowVenueForm] = useState(false);
  const [hasFacility, setHasFacility] = useState(false);

  // Facility fields
  const [facilityName, setFacilityName] = useState("");
  const [address, setAddress] = useState("");
  const [pickleballCourts, setPickleballCourts] = useState<number>(0);
  const [tennisConversionCourts, setTennisConversionCourts] = useState<number>(0);
  const [hasParking, setHasParking] = useState(false);
  const [hasLights, setHasLights] = useState(false);
  const [isIndoor, setIsIndoor] = useState(false);
  const [surfaceType, setSurfaceType] = useState<"hard" | "clay" | "turf" | "indoor" | "">("");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  // Venue form fields
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueRadius, setVenueRadius] = useState<number>(200);

  useEffect(() => {
    Promise.all([getClubFacility(clubId), listVenues(clubId)]).then(([f, v]) => {
      if (f) {
        setHasFacility(true);
        setFacilityName(f.facilityName ?? "");
        setAddress(f.address ?? "");
        setPickleballCourts(f.pickleballCourts ?? 0);
        setTennisConversionCourts(f.tennisConversionCourts ?? 0);
        setHasParking(f.hasParking ?? false);
        setHasLights(f.hasLights ?? false);
        setIsIndoor(f.isIndoor ?? false);
        setSurfaceType(f.surfaceType ?? "");
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
        facilityName: facilityName.trim() || undefined,
        address: address.trim() || undefined,
        pickleballCourts,
        tennisConversionCourts,
        hasParking, hasLights,
        isIndoor,
        surfaceType: surfaceType || undefined,
        amenities: selectedAmenities.length > 0 ? selectedAmenities : undefined,
        notes: notes.trim() || undefined,
      }, userId);
      setHasFacility(true);
      toast("Facility information saved.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteClubFacility(clubId);
      setHasFacility(false);
      setFacilityName(""); setAddress(""); setPickleballCourts(0); setTennisConversionCourts(0);
      setHasParking(false); setHasLights(false); setIsIndoor(false); setSurfaceType("");
      setSelectedAmenities([]); setNotes("");
      setConfirmDelete(false);
      toast("Facility information removed.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete.", "error");
    } finally {
      setDeleting(false);
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
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest">Court Facilities</h2>
          <div className="flex items-center gap-2">
            {hasFacility && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-pixel text-xs text-ash-500 hover:text-crimson-400 border border-transparent hover:border-crimson-500/40 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
            {confirmDelete && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-crimson-400">Remove all facility info?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-2.5 py-1.5 rounded-pixel text-xs bg-crimson-500/20 text-crimson-400 border border-crimson-500/40 hover:bg-crimson-500/30 transition-colors disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : "Confirm"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1.5 rounded-pixel text-xs text-ash-400 border border-ash-700 hover:text-ash-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>

        <Panel variant="quest" padding="lg" className="space-y-4">
          <div>
            <label className="text-ash-300 text-xs font-medium mb-1.5 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-ember-400" /> Facility Name
            </label>
            <input
              className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
              placeholder="e.g. Coon Rapids Community Center"
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
            />
          </div>

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
                  value={pickleballCourts}
                  onChange={(e) => setPickleballCourts(parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div>
                <label className="text-ash-500 text-xs mb-1 block">Tennis Conversion</label>
                <input type="number" min={0} max={99}
                  className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
                  value={tennisConversionCourts}
                  onChange={(e) => setTennisConversionCourts(parseInt(e.target.value, 10) || 0)}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-ash-300 text-xs font-medium mb-2 block">Court Type &amp; Surface</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <ToggleRow icon={<Building2 className="h-4 w-4" />} label="Indoor Facility" value={isIndoor} onChange={setIsIndoor} />
            </div>
            <div>
              <label className="text-ash-500 text-xs mb-1 block">Surface Type</label>
              <select
                className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
                value={surfaceType}
                onChange={(e) => setSurfaceType(e.target.value as typeof surfaceType)}
              >
                <option value="">— Not specified —</option>
                <option value="hard">Hard (Concrete / Asphalt)</option>
                <option value="clay">Clay</option>
                <option value="turf">Turf / Synthetic</option>
                <option value="indoor">Indoor (Gymnasium / Sport Court)</option>
              </select>
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
// MEMBERS
// ============================================================

interface ClubMemberRow {
  userId: string;
  displayName: string;
  elo: number;
  memberships: Array<{ id: string; leagueId: string; leagueName: string; status: string }>;
}

interface PendingRemove {
  userId: string;
  membershipId: string;
  leagueId: string;
  leagueName: string;
  displayName: string;
}

function MembersSection({ clubId, toast }: { clubId: string; toast: ToastFn }) {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<ClubMemberRow[]>([]);
  const [leagues, setLeagues] = useState<LeagueDoc[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<PendingRemove | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [sending, setSending] = useState(false);

  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/clubs/${clubId}` : `/clubs/${clubId}`;

  async function handleSendAnnouncement() {
    if (!announcementTitle.trim() || !announcementBody.trim()) {
      toast("Title and message are required.", "error");
      return;
    }
    const recipients = members.map((m) => m.userId);
    if (recipients.length === 0) { toast("No members to notify.", "error"); return; }
    setSending(true);
    try {
      await Promise.all(
        recipients.map((uid) =>
          writeNotification({
            userId: uid,
            title: announcementTitle.trim(),
            body: announcementBody.trim(),
            kind: "ANNOUNCEMENT",
            href: `/clubs/${clubId}`,
          }),
        ),
      );
      toast(`Announcement sent to ${recipients.length} member${recipients.length === 1 ? "" : "s"}.`, "success");
      setAnnouncementTitle(""); setAnnouncementBody(""); setShowAnnouncement(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to send.", "error");
    } finally {
      setSending(false);
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      toast("Invite link copied to clipboard.", "success");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => toast("Could not copy link.", "error"));
  }

  useEffect(() => {
    async function load() {
      const clubLeagues = await listClubLeagues(clubId);
      setLeagues(clubLeagues);
      const allMemberships = await Promise.all(
        clubLeagues.map((l) => listLeagueMembers(l.id).then((ms) => ms.map((m) => ({ ...m, leagueName: l.name })))),
      );
      const flat = allMemberships.flat().filter((m) => m.status === "active");
      const byUser = new Map<string, typeof flat>();
      for (const m of flat) {
        if (!byUser.has(m.userId)) byUser.set(m.userId, []);
        byUser.get(m.userId)!.push(m);
      }
      const profiles = await Promise.all(
        Array.from(byUser.keys()).map((uid) => getPlayerProfile(uid)),
      );
      const rows: ClubMemberRow[] = Array.from(byUser.entries()).map(([uid, ms], i) => ({
        userId: uid,
        displayName: profiles[i]?.displayName ?? uid,
        elo: profiles[i]?.elo ?? 1500,
        memberships: ms.map((m) => ({ id: m.id, leagueId: m.leagueId, leagueName: m.leagueName, status: m.status })),
      }));
      rows.sort((a, b) => b.elo - a.elo);
      setMembers(rows);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [clubId]);

  async function handleRemove(userId: string, membershipId: string, leagueId: string, leagueName: string) {
    setRemoving(membershipId);
    try {
      await leaveLeague(userId, leagueId);
      setMembers((prev) =>
        prev
          .map((m) =>
            m.userId === userId
              ? { ...m, memberships: m.memberships.filter((ms) => ms.id !== membershipId) }
              : m,
          )
          .filter((m) => m.memberships.length > 0),
      );
      toast(`Removed from ${leagueName}.`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Remove failed.", "error");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest">Members</h2>
        <span className="text-ash-500 text-xs">{loading ? "…" : `${members.length} active`}</span>
      </div>

      {/* Announcement composer */}
      <div>
        <button
          type="button"
          onClick={() => setShowAnnouncement((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-pixel bg-obsidian-700 border border-ash-700 hover:border-ember-500/40 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-ember-400" />
            <span className="text-ash-200 text-sm font-medium">Send Announcement</span>
          </div>
          <span className="text-ash-500 text-xs">{members.length} recipients</span>
        </button>
        {showAnnouncement && (
          <Panel variant="quest" padding="lg" className="mt-2 space-y-3">
            <input
              className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500"
              placeholder="Announcement title *"
              value={announcementTitle}
              onChange={(e) => setAnnouncementTitle(e.target.value)}
            />
            <textarea
              className="w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500 resize-none"
              placeholder="Message body *"
              rows={3}
              value={announcementBody}
              onChange={(e) => setAnnouncementBody(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSendAnnouncement} disabled={sending || members.length === 0}>
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {sending ? "Sending…" : `Send to ${members.length}`}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAnnouncement(false)}>Cancel</Button>
            </div>
          </Panel>
        )}
      </div>

      {/* Invite link */}
      <Panel variant="quest" padding="md">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded bg-ash-800 shrink-0">
            <LinkIcon className="h-4 w-4 text-ember-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-ash-100 text-sm font-medium mb-0.5">Invite Link</p>
            <p className="text-ash-400 text-xs mb-2">Share this link so players can view your club and join its active leagues.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate bg-obsidian-900 border border-ash-700 rounded px-2 py-1.5 text-xs text-ash-300 font-mono">
                {inviteUrl}
              </code>
              <button
                type="button"
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-pixel text-xs border transition-colors shrink-0 ${
                  copied
                    ? "bg-success-500/20 border-success-500/40 text-success-400"
                    : "bg-obsidian-700 border-ash-700 text-ash-300 hover:border-ember-500/40 hover:text-ember-300"
                }`}
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </Panel>

      {loading ? (
        <Panel variant="base" padding="lg" className="flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-ember-400" />
        </Panel>
      ) : members.length === 0 ? (
        <Panel variant="base" padding="lg" className="text-center">
          <Users className="h-8 w-8 text-ash-600 mx-auto mb-2" />
          <p className="text-ash-400 text-sm">No active members yet.</p>
        </Panel>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <Panel key={member.userId} variant="inventory" padding="md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ash-100 text-sm font-medium">{member.displayName}</p>
                  <p className="text-ash-500 text-xs">ELO {member.elo}</p>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                {member.memberships.map((ms) => (
                  <div key={ms.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <RuneChip tone="rune" className="text-[10px] shrink-0">League</RuneChip>
                      <span className="text-ash-300 text-xs truncate">{ms.leagueName}</span>
                    </div>
                    <button
                      onClick={() => setConfirmRemove({ userId: member.userId, membershipId: ms.id, leagueId: ms.leagueId, leagueName: ms.leagueName, displayName: member.displayName })}
                      disabled={removing === ms.id}
                      className="text-ash-500 hover:text-crimson-400 transition-colors disabled:opacity-50 shrink-0"
                      title="Remove from league"
                    >
                      {removing === ms.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {confirmRemove && (
        <ConfirmDialog
          title="Remove from League"
          description={`Remove ${confirmRemove.displayName} from "${confirmRemove.leagueName}"? Their match history will be preserved.`}
          confirmLabel="Remove"
          variant="danger"
          submitting={removing === confirmRemove.membershipId}
          onConfirm={() => {
            handleRemove(confirmRemove.userId, confirmRemove.membershipId, confirmRemove.leagueId, confirmRemove.leagueName);
            setConfirmRemove(null);
          }}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
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
