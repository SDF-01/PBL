"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import type {
  PlayerProfileDoc,
  DominantHand,
  VenueDoc,
} from "@/lib/firestore/types";

const HANDS: DominantHand[] = ["RIGHT", "LEFT", "AMBI"];

export default function PlayerEditPage() {
  const router = useRouter();
  const { user, ready, signIn } = useAuth();

  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<PlayerProfileDoc | null>(null);
  const [venues, setVenues] = useState<VenueDoc[]>([]);

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
        if (prof) {
          setExisting(prof);
          setPhotoURL(prof.photoURL ?? null);
          setDisplayName(prof.displayName ?? "");
          setCity(prof.city ?? "");
          setRegion(prof.region ?? "");
          setCountry(prof.country ?? "");
          setHomeVenueId(prof.homeVenueId ?? "");
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
        dominantHand: (dominantHand || undefined) as DominantHand | undefined,
        paddleBrand,
        paddleModel,
        yearsPlaying:
          typeof yearsPlaying === "number" ? yearsPlaying : undefined,
        bio,
        duprRating:
          typeof duprRating === "number" ? duprRating : undefined,
        duprId: duprId.trim() || null,
      });
      router.push(`/players/view?uid=${user.uid}`);
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
            {existing ? "Edit Profile" : "Create Profile"}
          </h1>
          <p className="text-ash-400 text-sm mt-1">
            Profile identity, location, and equipment. ELO and stats update
            automatically from verified match results.
          </p>
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
                    DUPR Rating
                  </span>
                  {duprId ? (
                    <span className="text-[10px] text-emerald-400 font-mono">
                      ✓ linked ({duprId})
                    </span>
                  ) : (
                    <a
                      href="https://mydupr.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-spectral-500 hover:text-spectral-400"
                    >
                      Find your DUPR ID →
                    </a>
                  )}
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <Field label="DUPR rating">
                    <input
                      type="number"
                      step="0.001"
                      min={2}
                      max={8}
                      className={fieldCls}
                      value={duprRating}
                      onChange={(e) =>
                        setDuprRating(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
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
                <p className="text-[11px] text-ash-600 mt-1.5 leading-relaxed">
                  Enter your DUPR rating manually from{" "}
                  <a href="https://mydupr.com" target="_blank" rel="noopener noreferrer" className="text-spectral-500 hover:underline">
                    mydupr.com
                  </a>
                  . Your ID appears in your profile URL.
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
