"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MapPin, CheckCircle2 } from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { useAuth } from "@/lib/auth-context";
import { isFirebaseConfigured } from "@/lib/firebase";
import { COMMUNITY_CLUB_ID } from "@/lib/community/constants";
import type { FacilityAccessType, FacilityOwnershipType } from "@/lib/permissions/types";

const fieldCls =
  "w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100 placeholder:text-ash-600 focus:outline-none focus:border-ember-500";

function Field({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`text-xs text-ash-400 space-y-1 block ${className ?? ""}`}>
      <span>
        {label}
        {required && <span className="text-crimson-500"> *</span>}
      </span>
      {children}
      {hint && <span className="text-ash-600 text-[11px] block mt-0.5">{hint}</span>}
    </label>
  );
}

async function geocodeAddress(parts: {
  street: string; city: string; state: string; zip: string;
}): Promise<{ lat: number; lng: number } | null> {
  const q = [parts.street, parts.city, parts.state, parts.zip].filter(Boolean).join(", ");
  if (!q) return null;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "PBL-PickleballLeagueApp/1.0 (court-submit)" },
  });
  if (!res.ok) return null;
  const data = await res.json() as { lat: string; lon: string }[];
  const hit = data[0];
  if (!hit) return null;
  return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) };
}

export default function SubmitCourtPage() {
  const { user, signIn } = useAuth();
  const router = useRouter();

  const [facilityName, setFacilityName] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [courtCount, setCourtCount] = useState<number | "">("");
  const [isIndoor, setIsIndoor] = useState(false);
  const [hasLights, setHasLights] = useState(false);
  const [accessType, setAccessType] = useState<FacilityAccessType | "">("");
  const [ownershipType, setOwnershipType] = useState<FacilityOwnershipType | "">("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!facilityName.trim()) { setError("Facility name is required."); return; }
    if (!city.trim()) { setError("City is required."); return; }

    setSubmitting(true);
    setError(null);
    try {
      // Geocode the address
      const coords = await geocodeAddress({ street, city, state, zip });

      const streetLine = [street.trim()].filter(Boolean).join(" ");
      const cityLine = [city.trim(), state.trim(), zip.trim()].filter(Boolean).join(", ");
      const address = [streetLine, cityLine].filter(Boolean).join(", ") || undefined;

      const { addDoc, collection } = await import("firebase/firestore");
      const { serverTimestamp } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");
      const { COLLECTIONS } = await import("@/lib/firestore/collections");

      const payload: Record<string, unknown> = {
        clubId: COMMUNITY_CLUB_ID,
        facilityName: facilityName.trim(),
        address,
        isIndoor,
        hasLights,
        updatedBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (coords) {
        payload.lat = coords.lat;
        payload.lng = coords.lng;
        payload.geocodeProvider = "nominatim";
        payload.geofenceEnabled = true;
        payload.checkInRadiusMeters = 200;
      }
      if (typeof courtCount === "number") payload.pickleballCourts = courtCount;
      if (accessType) payload.accessType = accessType;
      if (ownershipType) payload.ownershipType = ownershipType;
      if (notes.trim()) payload.notes = notes.trim();

      await addDoc(collection(db(), COLLECTIONS.clubFacilities), payload);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-lg">
          <Panel variant="quest" padding="lg" className="text-center space-y-4">
            <CheckCircle2 className="h-10 w-10 text-spectral-400 mx-auto" />
            <div>
              <h2 className="heading-fantasy text-ash-100 text-xl">Court Submitted!</h2>
              <p className="text-ash-400 text-sm mt-2">
                <strong className="text-ash-200">{facilityName}</strong> has been added to the community courts directory.
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <Link href="/courts">
                <Button size="sm">View Courts</Button>
              </Link>
              <Button size="sm" variant="outline" onClick={() => {
                setFacilityName(""); setStreet(""); setCity(""); setState(""); setZip("");
                setCourtCount(""); setIsIndoor(false); setHasLights(false);
                setAccessType(""); setOwnershipType(""); setNotes(""); setDone(false);
              }}>
                Submit Another
              </Button>
            </div>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  if (!user) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-lg">
          <Panel variant="quest" padding="lg" className="text-center space-y-3">
            <MapPin className="h-8 w-8 text-spectral-400 mx-auto" />
            <h2 className="heading-fantasy text-ash-100 text-xl">Sign in to Submit</h2>
            <p className="text-ash-400 text-sm">You need an account to add courts to the directory.</p>
            <Button size="sm" onClick={() => signIn().catch(() => {})}>Sign in with Google</Button>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-2xl">

        {/* Header */}
        <div>
          <Link href="/courts" className="text-ash-400 hover:text-ash-200 text-sm inline-flex items-center gap-1 mb-3">
            <ArrowLeft className="h-4 w-4" /> Courts
          </Link>
          <RuneChip tone="spectral" className="mb-2 block w-fit">
            <MapPin className="h-3 w-3 inline mr-1" /> Submit
          </RuneChip>
          <h1 className="heading-fantasy text-display-md text-ash-100">Add a Court</h1>
          <p className="text-ash-400 text-sm mt-1">
            Know a pickleball court that&apos;s not in the directory? Add it for everyone to find.
          </p>
        </div>

        <Panel variant="quest" padding="lg">
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">

            <Field label="Facility / Court name" required className="md:col-span-2">
              <input
                className={fieldCls}
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                placeholder="e.g. Riverside Pickleball Complex"
                maxLength={80}
                required
              />
            </Field>

            <Field label="Street address" className="md:col-span-2"
              hint="House number and street — used to pin the court on the map.">
              <input
                className={fieldCls}
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="123 Main St"
                maxLength={120}
              />
            </Field>

            <Field label="City" required>
              <input
                className={fieldCls}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Minneapolis"
                maxLength={80}
                required
              />
            </Field>

            <Field label="State">
              <input
                className={fieldCls}
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="MN"
                maxLength={40}
              />
            </Field>

            <Field label="Zip / Postal code">
              <input
                className={fieldCls}
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="55401"
                maxLength={12}
              />
            </Field>

            <Field label="Number of pickleball courts">
              <input
                type="number"
                min={1}
                max={99}
                className={fieldCls}
                value={courtCount}
                onChange={(e) => setCourtCount(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="4"
              />
            </Field>

            <Field label="Access">
              <select
                className={fieldCls}
                value={accessType}
                onChange={(e) => setAccessType(e.target.value as FacilityAccessType | "")}
              >
                <option value="">— Unknown —</option>
                <option value="public">Public (free)</option>
                <option value="fee_required">Fee required</option>
                <option value="members_only">Members only</option>
                <option value="reservation_required">Reservation required</option>
              </select>
            </Field>

            <Field label="Ownership">
              <select
                className={fieldCls}
                value={ownershipType}
                onChange={(e) => setOwnershipType(e.target.value as FacilityOwnershipType | "")}
              >
                <option value="">— Unknown —</option>
                <option value="public">Public park</option>
                <option value="municipal">City / municipal</option>
                <option value="school">School / university</option>
                <option value="club_owned">Club owned</option>
                <option value="private">Private</option>
              </select>
            </Field>

            {/* Toggles */}
            <div className="md:col-span-2 flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isIndoor}
                  onChange={(e) => setIsIndoor(e.target.checked)}
                  className="accent-ember-500 h-4 w-4"
                />
                <span className="text-xs text-ash-300">Indoor courts</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasLights}
                  onChange={(e) => setHasLights(e.target.checked)}
                  className="accent-ember-500 h-4 w-4"
                />
                <span className="text-xs text-ash-300">Has lights (evening play)</span>
              </label>
            </div>

            <Field label="Notes" className="md:col-span-2"
              hint="Anything helpful — parking, hours, surface type, how to access, etc.">
              <textarea
                className={`${fieldCls} min-h-[80px]`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                placeholder="Open daily, free parking in lot B, asphalt surface…"
              />
            </Field>

            {error && (
              <p className="md:col-span-2 text-sm text-crimson-500">{error}</p>
            )}

            <div className="md:col-span-2 flex gap-2 pt-1">
              <Button type="submit" size="sm" disabled={submitting || !isFirebaseConfigured()}>
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
                {submitting ? "Submitting…" : "Submit Court"}
              </Button>
              <Link href="/courts">
                <Button type="button" size="sm" variant="outline">Cancel</Button>
              </Link>
            </div>

          </form>
        </Panel>
      </main>
    </ResponsiveShell>
  );
}
