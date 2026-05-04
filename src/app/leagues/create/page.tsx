"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, ShieldAlert } from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { listUserClubs } from "@/lib/clubs/repo";
import { createLeague, type CreateLeagueInput } from "@/lib/leagues/write";
import { isFirebaseConfigured } from "@/lib/firebase";
import type { ClubDoc } from "@/lib/permissions/types";

const fieldCls =
  "w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100 placeholder:text-ash-600 focus:outline-none focus:border-ember-500";

export default function LeagueCreatePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { isSiteAdmin, clubDirectorFor, loading: permLoading } = usePermissions();

  const canCreate = isSiteAdmin || clubDirectorFor.length > 0;

  const [approvedClubs, setApprovedClubs] = useState<ClubDoc[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clubId, setClubId] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [leagueFormat, setLeagueFormat] = useState("Doubles Ladder");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user || !canCreate || !isFirebaseConfigured()) {
      setClubsLoading(false);
      return;
    }
    listUserClubs(user.uid)
      .then((clubs) => {
        const approved = clubs.filter((c) => c.status === "approved");
        setApprovedClubs(approved);
        if (approved[0]) setClubId(approved[0].id);
      })
      .finally(() => setClubsLoading(false));
  }, [user, canCreate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) { setError("League name is required."); return; }
    if (!clubId) { setError("Select a club for this league."); return; }

    setSubmitting(true);
    setError(null);
    try {
      const input: CreateLeagueInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        clubId,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        leagueFormat: leagueFormat.trim() || undefined,
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
            <p className="text-ash-400 text-sm">
              You need an approved club to create a league.
            </p>
            <Button size="sm" onClick={() => router.push("/clubs/create")}>
              Create a Club
            </Button>
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
            <p className="text-ash-400 text-sm">
              Your club submission is pending approval. You can create a league once approved.
            </p>
            <Button size="sm" variant="outline" onClick={() => router.push("/clubs/my")}>
              View Club Status
            </Button>
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

        <Panel variant="quest" padding="lg">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
              <span>Description</span>
              <textarea
                className={fieldCls}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the league…"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-ash-400 space-y-1 block">
                <span>City</span>
                <input
                  type="text"
                  className={fieldCls}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Austin"
                />
              </label>
              <label className="text-xs text-ash-400 space-y-1 block">
                <span>State</span>
                <input
                  type="text"
                  className={fieldCls}
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="TX"
                  maxLength={2}
                />
              </label>
            </div>

            <label className="text-xs text-ash-400 space-y-1 block">
              <span>Format</span>
              <input
                type="text"
                className={fieldCls}
                value={leagueFormat}
                onChange={(e) => setLeagueFormat(e.target.value)}
                placeholder="Doubles Ladder"
              />
            </label>

            {error && <p className="text-sm text-crimson-400">{error}</p>}

            <div className="flex gap-3 pt-1">
              <Button type="submit" size="md" className="flex-1" disabled={submitting}>
                {submitting ? "Creating…" : "Create League"}
              </Button>
              <Button type="button" variant="outline" size="md" onClick={() => router.back()} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </form>
        </Panel>
      </main>
    </ResponsiveShell>
  );
}
