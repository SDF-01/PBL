"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { useAuth } from "@/lib/auth-context";
import { isFirebaseConfigured } from "@/lib/firebase";
import { createTournament, notifyMany, slugify } from "@/lib/firestore/write";
import { listUserIds } from "@/lib/firestore/repo";
import type { TournamentDoc } from "@/lib/firestore/types";

const ORG_ID = "pickleball-league";

export default function NewTournamentPage() {
  const router = useRouter();
  const { user, ready, signIn } = useAuth();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState<TournamentDoc["format"]>("SINGLE_ELIM");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [targetPoints, setTargetPoints] = useState(11);
  const [winBy, setWinBy] = useState(2);
  const [bestOf, setBestOf] = useState(3);
  const [notify, setNotify] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) setSlug(slugify(name));
  }, [name, slug]);

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
            <RuneChip tone="rune" className="mb-3">Sign-in required</RuneChip>
            <h1 className="heading-fantasy text-2xl text-ash-100 mb-2">
              Sign in to create a tournament
            </h1>
            <p className="text-ash-400 text-sm mb-5">
              Tournaments are tied to your account so you can manage entrants,
              brackets, and results.
            </p>
            <Button onClick={() => signIn().catch(() => {})}>Sign in with Google</Button>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSubmitting(true);
    try {
      const finalSlug = slug || slugify(name);
      if (!finalSlug) throw new Error("Tournament name is required.");
      if (!startDate || !endDate) throw new Error("Start and end dates are required.");

      const id = await createTournament({
        orgId: ORG_ID,
        slug: finalSlug,
        name: name.trim(),
        status: "REGISTRATION_OPEN",
        format,
        startDate,
        endDate,
        description: description.trim() || undefined,
        targetPoints,
        winBy,
        bestOf,
        createdBy: user.uid,
      });

      if (notify) {
        try {
          const userIds = await listUserIds();
          await notifyMany(userIds, {
            title: `New tournament: ${name.trim()}`,
            body: description.trim() || `${formatLabel(format)} starting ${startDate}.`,
            href: `/tournaments/view?slug=${id}`,
            kind: "TOURNAMENT_CREATED",
            createdBy: user.uid,
          });
        } catch {
          // Non-fatal — tournament created either way.
        }
      }

      router.push(`/tournaments/view?slug=${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tournament.");
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-10 max-w-2xl">
        <div className="mb-6">
          <Link
            href="/tournaments"
            className="text-spectral-500 hover:text-spectral-400 text-sm"
          >
            ← All Tournaments
          </Link>
          <h1 className="heading-fantasy text-display-md text-ash-100 mt-2">
            New Tournament
          </h1>
          <p className="text-ash-400 text-sm mt-1">
            Configure the format and schedule. Players will be able to register
            once it&apos;s saved.
          </p>
        </div>

        <Panel variant="base" padding="lg">
          <form className="space-y-5" onSubmit={onSubmit}>
            <Field label="Name" required>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Spring Open 2026"
                className="input"
              />
            </Field>

            <Field label="URL Slug" hint="Auto-generated from name; change if needed.">
              <input
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="spring-open-2026"
                className="input font-mono text-sm"
              />
            </Field>

            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What division? What's at stake?"
                className="input resize-none"
              />
            </Field>

            <Field label="Format">
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as TournamentDoc["format"])}
                className="input"
              >
                <option value="SINGLE_ELIM">Single Elimination</option>
                <option value="DOUBLE_ELIM">Double Elimination</option>
                <option value="ROUND_ROBIN">Round Robin</option>
                <option value="POOL_PLAY_PLUS_BRACKET">Pool Play + Bracket</option>
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Date" required>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="input"
                />
              </Field>
              <Field label="End Date" required>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="input"
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Target Points">
                <input
                  type="number" min={1} max={50}
                  value={targetPoints}
                  onChange={(e) => setTargetPoints(Number(e.target.value))}
                  className="input"
                />
              </Field>
              <Field label="Win By">
                <input
                  type="number" min={1} max={10}
                  value={winBy}
                  onChange={(e) => setWinBy(Number(e.target.value))}
                  className="input"
                />
              </Field>
              <Field label="Best Of">
                <input
                  type="number" min={1} max={9} step={2}
                  value={bestOf}
                  onChange={(e) => setBestOf(Number(e.target.value))}
                  className="input"
                />
              </Field>
            </div>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                className="mt-1 h-4 w-4 accent-ember-500"
              />
              <span className="text-sm">
                <span className="text-ash-200">Notify all players</span>
                <span className="block text-ash-500 text-xs mt-0.5">
                  Sends an in-app notification to every registered user.
                </span>
              </span>
            </label>

            {error && (
              <div className="rounded-pixel border border-crimson-500/40 bg-crimson-500/10 px-3 py-2 text-sm text-crimson-400">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create Tournament"}
              </Button>
              <Link
                href="/tournaments"
                className="text-sm text-ash-400 hover:text-ash-200"
              >
                Cancel
              </Link>
            </div>
          </form>
        </Panel>
      </main>
    </ResponsiveShell>
  );
}

function Field({
  label, required, hint, children,
}: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs uppercase tracking-[0.15em] text-ash-400">
          {label}{required && <span className="text-ember-500"> *</span>}
        </span>
        {hint && <span className="text-[10px] text-ash-500">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function formatLabel(f: TournamentDoc["format"]): string {
  return f.replace(/_/g, " ").toLowerCase();
}
