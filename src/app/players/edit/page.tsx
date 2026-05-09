"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { AccountSecurityPanel } from "@/components/player/AccountSecurityPanel";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { getPlayerProfile } from "@/lib/players/repo";
import { listVenues } from "@/lib/ladder/repo";
import { upsertPlayerProfile } from "@/lib/players/write";
import { uploadPlayerPhoto } from "@/lib/storage";
import { resolveSelectedLeagueId } from "@/lib/selectedLeague";
import { COMMUNITY_CLUB_ID } from "@/lib/community/constants";
import type {
  PlayerProfileDoc,
  DominantHand,
  VenueDoc,
} from "@/lib/firestore/types";
import type { ClubFacility } from "@/lib/permissions/types";

const PROVISIONAL_RANGES = [
  { id: "newer_player",              label: "Newer Player",              min: 2.0, max: 2.5, mid: 2.25 },
  { id: "developing_player",         label: "Developing Player",         min: 2.5, max: 3.0, mid: 2.75 },
  { id: "intermediate_player",       label: "Intermediate Player",       min: 3.0, max: 3.5, mid: 3.25 },
  { id: "strong_intermediate_player",label: "Strong Intermediate Player",min: 3.5, max: 4.0, mid: 3.75 },
  { id: "advanced_player",           label: "Advanced Player (4.0+)",    min: 4.0, max: null, mid: 4.25 },
] as const;

const HANDS: DominantHand[] = ["RIGHT", "LEFT", "AMBI"];

export default function PlayerEditPage() {
  return (
    <Suspense>
      <PlayerEditInner />
    </Suspense>
  );
}

function PlayerEditInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, ready, signIn } = useAuth();
  const selectedLeagueId = resolveSelectedLeagueId(searchParams);

  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<PlayerProfileDoc | null>(null);
  const [venues, setVenues] = useState<VenueDoc[]>([]);
  const [communityFacilities, setCommunityFacilities] = useState<ClubFacility[]>([]);
  const [facilitySearch, setFacilitySearch] = useState("");
  const [homeFacilityId, setHomeFacilityId] = useState("");
  const [homeFacilityName, setHomeFacilityName] = useState("");

  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [homeVenueId, setHomeVenueId] = useState("");
  const [dominantHand, setDominantHand] =
    useState<DominantHand | "">("");
  const [paddleBrand, setPaddleBrand] = useState("");
  const [paddleModel, setPaddleModel] = useState("");
  const [yearsPlaying, setYearsPlaying] = useState<number | "">("");
  const [bio, setBio] = useState("");
  const [duprRating, setDuprRating] = useState<number | "">("");
  const [duprId, setDuprId] = useState("");
  const [duprUnknown, setDuprUnknown] = useState(false);
  const [provisionalRangeId, setProvisionalRangeId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [prof, vs] = await Promise.all([
          getPlayerProfile(user.uid),
          listVenues().catch(() => []),
        ]);
        setVenues(vs);

        // Load community facilities for home facility picker
        if (isFirebaseConfigured()) {
          try {
            const { getDocs, query, collection, where, orderBy } = await import("firebase/firestore");
            const { db } = await import("@/lib/firebase");
            const { COLLECTIONS } = await import("@/lib/firestore/collections");
            const snap = await getDocs(
              query(
                collection(db(), COLLECTIONS.clubFacilities),
                where("clubId", "==", COMMUNITY_CLUB_ID),
                orderBy("facilityName"),
              ),
            );
            setCommunityFacilities(
              snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClubFacility)),
            );
          } catch {
            // community facilities are optional
          }
        }

        if (prof) {
          setExisting(prof);
          setPhotoURL(prof.photoURL ?? null);
          setDisplayName(prof.displayName ?? "");
          setCity(prof.city ?? "");
          setRegion(prof.region ?? "");
          setCountry(prof.country ?? "");
          setHomeVenueId(prof.homeVenueId ?? "");
          setHomeFacilityId(prof.homeFacilityId ?? "");
          setHomeFacilityName(prof.homeFacilityName ?? "");
          setDominantHand((prof.dominantHand as DominantHand) ?? "");
          setPaddleBrand(prof.paddleBrand ?? "");
          setPaddleModel(prof.paddleModel ?? "");
          setYearsPlaying(
            typeof prof.yearsPlaying === "number" ? prof.yearsPlaying : "",
          );
          setBio(prof.bio ?? "");
          setDuprRating(
            typeof prof.duprRating === "number" ? prof.duprRating : "",
          );
          setDuprId(prof.duprId ?? "");
        } else {
          setDisplayName(user.displayName ?? user.email ?? "Anonymous");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    if (!existing && duprUnknown && !provisionalRangeId) {
      setError("Select a skill level when DUPR rating is unknown.");
      return;
    }

    // Resolve effective DUPR rating from known value or provisional midpoint
    let effectiveDupr: number | undefined;
    if (duprUnknown && provisionalRangeId) {
      effectiveDupr = PROVISIONAL_RANGES.find((r) => r.id === provisionalRangeId)?.mid;
    } else if (typeof duprRating === "number") {
      effectiveDupr = duprRating;
    }

    setSubmitting(true);
    setError(null);
    try {
      const homeVenue = venues.find((v) => v.id === homeVenueId);
      await upsertPlayerProfile({
        userId: user.uid,
        displayName: displayName.trim(),
        photoURL: photoURL ?? user.photoURL ?? undefined,
        city,
        region,
        country,
        homeVenueId: homeVenueId || undefined,
        homeVenueName: homeVenue?.name,
        homeFacilityId: homeFacilityId || undefined,
        homeFacilityName: homeFacilityName || undefined,
        dominantHand: (dominantHand || undefined) as DominantHand | undefined,
        paddleBrand,
        paddleModel,
        yearsPlaying:
          typeof yearsPlaying === "number" ? yearsPlaying : undefined,
        bio,
        duprRating: effectiveDupr,
        duprId: duprId.trim() || null,
      });
      if (selectedLeagueId) {
        router.push(`/leagues/${selectedLeagueId}`);
      } else {
        router.push(`/players/view?uid=${user.uid}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isFirebaseConfigured()) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10">
          <Panel variant="base" padding="lg">
            <p className="text-ash-400 text-sm">Firebase is not configured.</p>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  if (ready && !user) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10">
          <Panel variant="quest" padding="lg">
            <RuneChip tone="rune" className="mb-3">
              Sign-in required
            </RuneChip>
            <h1 className="heading-fantasy text-2xl text-ash-100 mb-2">
              Sign in to edit your profile
            </h1>
            <Button size="sm" onClick={() => signIn().catch(() => {})}>
              Sign in with Google
            </Button>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-2xl">
        <div>
          <h1 className="heading-fantasy text-display-md text-ash-100">
            {existing ? "Edit Profile" : "Set Up Your Player Profile"}
          </h1>
          <p className="text-ash-400 text-sm mt-1">
            {existing
              ? "Profile identity, location, and equipment. ELO and stats update automatically from verified match results."
              : "Tell us enough to place you in the right group. You can add more details later."}
          </p>
          {!existing && selectedLeagueId && (
            <RuneChip tone="spectral" className="mt-2">
              Joining league · complete your profile to continue
            </RuneChip>
          )}
        </div>

        {loading ? (
          <Panel variant="base" padding="md">
            <p className="text-ash-400 text-sm">Loading…</p>
          </Panel>
        ) : (
          <Panel variant="quest" padding="lg">
            <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2 flex items-center gap-4">
                <ImageUpload
                  currentUrl={photoURL}
                  onUploaded={(url) => setPhotoURL(url || null)}
                  upload={(file) => uploadPlayerPhoto(user!.uid, file)}
                  shape="circle"
                  size="lg"
                  label="Profile photo"
                  disabled={submitting}
                />
                <div className="text-xs text-ash-500 leading-relaxed">
                  <p>Upload a profile photo.</p>
                  <p className="mt-0.5">JPG, PNG or WEBP · max 5 MB</p>
                </div>
              </div>

              <Field label="Display name" required className="md:col-span-2">
                <input
                  className={fieldCls}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={40}
                  required
                />
              </Field>
              <Field label="City">
                <input
                  className={fieldCls}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  maxLength={60}
                />
              </Field>
              <Field label="Region / State">
                <input
                  className={fieldCls}
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  maxLength={60}
                />
              </Field>
              <Field label="Country">
                <input
                  className={fieldCls}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  maxLength={60}
                  placeholder="US"
                />
              </Field>
              <Field label="Home venue">
                <select
                  className={fieldCls}
                  value={homeVenueId}
                  onChange={(e) => setHomeVenueId(e.target.value)}
                >
                  <option value="">— None —</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Community home court" className="md:col-span-2">
                {homeFacilityId ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex-1 bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100 truncate">
                      {homeFacilityName || homeFacilityId}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setHomeFacilityId(""); setHomeFacilityName(""); setFacilitySearch(""); }}
                      className="text-xs text-ash-500 hover:text-crimson-400 transition-colors shrink-0"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <input
                      className={fieldCls}
                      placeholder="Search community courts…"
                      value={facilitySearch}
                      onChange={(e) => setFacilitySearch(e.target.value)}
                    />
                    {facilitySearch.trim().length > 0 && (
                      <div className="border border-obsidian-500 rounded-pixel bg-obsidian-900 max-h-48 overflow-y-auto divide-y divide-obsidian-700">
                        {communityFacilities
                          .filter((f) =>
                            (f.facilityName ?? f.address ?? "")
                              .toLowerCase()
                              .includes(facilitySearch.toLowerCase()),
                          )
                          .slice(0, 12)
                          .map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-obsidian-700 transition-colors"
                              onClick={() => {
                                setHomeFacilityId(f.id);
                                setHomeFacilityName(f.facilityName ?? f.address ?? f.id);
                                setFacilitySearch("");
                              }}
                            >
                              <p className="text-ash-100 text-xs font-medium truncate">
                                {f.facilityName ?? <span className="italic text-ash-500">Unnamed</span>}
                              </p>
                              {f.address && (
                                <p className="text-ash-500 text-[10px] truncate">{f.address}</p>
                              )}
                            </button>
                          ))}
                        {communityFacilities.filter((f) =>
                          (f.facilityName ?? f.address ?? "")
                            .toLowerCase()
                            .includes(facilitySearch.toLowerCase()),
                        ).length === 0 && (
                          <p className="px-3 py-2 text-ash-600 text-xs italic">No courts found</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-ash-600 mt-1">
                  Public courts imported from OpenStreetMap — used as your default play location.
                </p>
              </Field>
              <Field label="Dominant hand">
                <select
                  className={fieldCls}
                  value={dominantHand}
                  onChange={(e) =>
                    setDominantHand(e.target.value as DominantHand | "")
                  }
                >
                  <option value="">— Prefer not to say —</option>
                  {HANDS.map((h) => (
                    <option key={h} value={h}>
                      {h === "AMBI" ? "Ambidextrous" : h}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Years playing">
                <input
                  type="number"
                  min={0}
                  max={99}
                  className={fieldCls}
                  value={yearsPlaying}
                  onChange={(e) =>
                    setYearsPlaying(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                />
              </Field>
              <Field label="Paddle brand">
                <input
                  className={fieldCls}
                  value={paddleBrand}
                  onChange={(e) => setPaddleBrand(e.target.value)}
                  placeholder="Selkirk, Joola, Engage…"
                  maxLength={40}
                />
              </Field>
              <Field label="Paddle model">
                <input
                  className={fieldCls}
                  value={paddleModel}
                  onChange={(e) => setPaddleModel(e.target.value)}
                  maxLength={60}
                />
              </Field>
              <div className="md:col-span-2 border-t border-obsidian-500 pt-3 mt-1">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <span className="text-xs uppercase tracking-[0.2em] text-ash-400">
                    Skill Rating
                  </span>
                  {duprId && (
                    <span className="text-[10px] text-emerald-400 font-mono">✓ DUPR linked ({duprId})</span>
                  )}
                </div>
                <label className="flex items-center gap-2 mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={duprUnknown}
                    onChange={(e) => {
                      setDuprUnknown(e.target.checked);
                      if (e.target.checked) setDuprRating("");
                      else setProvisionalRangeId("");
                    }}
                    className="accent-ember-500 h-4 w-4"
                  />
                  <span className="text-xs text-ash-300">I don&apos;t know my DUPR rating</span>
                </label>

                {duprUnknown ? (
                  <div className="space-y-2">
                    <p className="text-xs text-ash-500 mb-2">Select your approximate skill level:</p>
                    {PROVISIONAL_RANGES.map((range) => (
                      <label
                        key={range.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-pixel border cursor-pointer transition-colors ${
                          provisionalRangeId === range.id
                            ? "border-ember-500 bg-ember-900/20 text-ember-200"
                            : "border-obsidian-500 bg-obsidian-800 text-ash-300 hover:border-obsidian-400"
                        }`}
                      >
                        <input
                          type="radio"
                          name="provisionalRange"
                          value={range.id}
                          checked={provisionalRangeId === range.id}
                          onChange={() => setProvisionalRangeId(range.id)}
                          className="accent-ember-500 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{range.label}</span>
                          <span className="text-ash-500 text-xs ml-2">
                            DUPR {range.min}–{range.max ?? ""}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-3">
                    <Field label="DUPR rating">
                      <input
                        type="number"
                        step="0.001"
                        min={1}
                        max={8}
                        className={fieldCls}
                        value={duprRating}
                        onChange={(e) =>
                          setDuprRating(e.target.value === "" ? "" : Number(e.target.value))
                        }
                        placeholder="e.g. 4.25"
                      />
                    </Field>
                    <Field label="DUPR player id">
                      <input
                        className={fieldCls}
                        value={duprId}
                        onChange={(e) => setDuprId(e.target.value)}
                        placeholder="From mydupr.com profile URL"
                        maxLength={40}
                      />
                    </Field>
                  </div>
                )}
                <p className="text-[11px] text-ash-600 mt-2 leading-relaxed">
                  Find your DUPR rating at{" "}
                  <a href="https://mydupr.com" target="_blank" rel="noopener noreferrer" className="text-spectral-500 hover:underline">
                    mydupr.com
                  </a>.
                </p>
              </div>
              <Field label="Bio" className="md:col-span-2">
                <textarea
                  className={`${fieldCls} min-h-[90px]`}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={500}
                  placeholder="Playing style, goals, favorite shot…"
                />
              </Field>
              {error && (
                <p className="md:col-span-2 text-sm text-crimson-500">
                  {error}
                </p>
              )}
              <div className="md:col-span-2 flex gap-2 pt-2">
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting
                    ? "Saving…"
                    : existing
                      ? "Save Changes"
                      : "Create Profile"}
                </Button>
                <Link href="/players">
                  <Button type="button" size="sm" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </Panel>
        )}

        {!loading && <AccountSecurityPanel />}
      </main>
    </ResponsiveShell>
  );
}

const fieldCls =
  "w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100";

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`text-xs text-ash-400 space-y-1 block ${className ?? ""}`}
    >
      <span>
        {label}
        {required && <span className="text-crimson-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
