"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState, Suspense } from "react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { Button } from "@/components/ui/Button";
import { BracketView } from "@/components/bracket/BracketView";
import type { Bracket, BracketNode as EngineNode, Entrant } from "@/domain/bracket";
import { useAuth } from "@/lib/auth-context";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  getTournamentBySlug,
  subscribeRegistrations,
  subscribeBracket,
  subscribeBracketNodes,
  subscribeMatches,
} from "@/lib/firestore/repo";
import {
  createRegistration,
  updateRegistrationStatus,
  publishBracket,
  recordMatchScore,
  notifyMany,
  notifyUser,
  startTournament,
} from "@/lib/firestore/write";
import type {
  TournamentDoc,
  RegistrationDoc,
  BracketDoc,
  BracketNodeDoc,
  MatchDoc,
} from "@/lib/firestore/types";

type Tab = "overview" | "entrants" | "bracket" | "matches";

function TournamentView() {
  const params = useSearchParams();
  const slug = params.get("slug");
  const { user, signIn } = useAuth();

  const [tournament, setTournament] = useState<TournamentDoc | null>(null);
  const [regs, setRegs] = useState<RegistrationDoc[]>([]);
  const [bracket, setBracket] = useState<BracketDoc | null>(null);
  const [nodes, setNodes] = useState<BracketNodeDoc[]>([]);
  const [matches, setMatches] = useState<MatchDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState(false);

  // Load tournament by slug (once).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!slug) { setError("No tournament selected."); setLoading(false); return; }
      if (!isFirebaseConfigured()) { setError("Firebase is not configured."); setLoading(false); return; }
      try {
        const t = await getTournamentBySlug(slug);
        if (!t) { if (!cancelled) { setError(`No tournament found for "${slug}".`); setLoading(false); } return; }
        if (!cancelled) { setTournament(t); setLoading(false); }
      } catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : "Failed to load."); setLoading(false); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [slug]);

  // Realtime subs for registrations, bracket, nodes, matches.
  useEffect(() => {
    if (!tournament) return;
    const unsubs = [
      subscribeRegistrations(tournament.id, setRegs),
      subscribeBracket(tournament.id, setBracket),
      subscribeBracketNodes(tournament.id, setNodes),
      subscribeMatches(tournament.id, setMatches),
    ];
    return () => { unsubs.forEach((u) => u()); };
  }, [tournament]);

  const isDirector = !!(user && tournament && "createdBy" in tournament &&
    (tournament as unknown as { createdBy?: string }).createdBy === user.uid);
  const myReg = user ? regs.find((r) => r.userId === user.uid) : undefined;
  const confirmed = regs.filter((r) => r.status === "CONFIRMED");
  const nameById = useMemo(
    () => Object.fromEntries(regs.map((r) => [r.id, r.displayName])),
    [regs],
  );

  if (loading) {
    return (
      <main className="container py-10">
        <Panel variant="base" padding="lg"><p className="text-ash-400 text-sm">Loading tournament…</p></Panel>
      </main>
    );
  }
  if (error || !tournament) {
    return (
      <main className="container py-10">
        <Panel variant="base" padding="lg">
          <h2 className="heading-fantasy text-lg text-crimson-500 mb-2">Unable to load</h2>
          <p className="text-ash-400 text-sm">{error ?? "Unknown error."}</p>
          <Link href="/tournaments" className="text-spectral-500 hover:text-spectral-400 text-sm mt-3 inline-block">← All Tournaments</Link>
        </Panel>
      </main>
    );
  }

  // --- Actions ---
  async function onRegister() {
    if (!user || !tournament) return;
    setBusy(true);
    try {
      await createRegistration({
        tournamentId: tournament.id,
        userId: user.uid,
        displayName: user.displayName ?? user.email ?? "Anonymous",
      });
      if (isDirector === false) {
        // Notify the director.
        const createdBy = (tournament as unknown as { createdBy?: string }).createdBy;
        if (createdBy) {
          notifyUser({
            userId: createdBy,
            title: "New registration",
            body: `${user.displayName ?? user.email} registered for ${tournament.name}.`,
            href: `/tournaments/view?slug=${tournament.slug}`,
            kind: "GENERAL",
            createdBy: user.uid,
          }).catch(() => {});
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Registration failed.");
    } finally { setBusy(false); }
  }

  async function onWithdraw() {
    if (!myReg) return;
    setBusy(true);
    try { await updateRegistrationStatus(myReg.id, "WITHDRAWN"); }
    catch (err) { alert(err instanceof Error ? err.message : "Withdraw failed."); }
    finally { setBusy(false); }
  }

  async function onSetStatus(id: string, status: RegistrationDoc["status"]) {
    setBusy(true);
    try {
      await updateRegistrationStatus(id, status);
      const reg = regs.find((r) => r.id === id);
      if (reg?.userId && user) {
        notifyUser({
          userId: reg.userId,
          title: `Registration ${status.toLowerCase()}`,
          body: `Your registration for ${tournament?.name} is now ${status.toLowerCase()}.`,
          href: `/tournaments/view?slug=${tournament?.slug}`,
          kind: "GENERAL",
          createdBy: user.uid,
        }).catch(() => {});
      }
    } catch (err) { alert(err instanceof Error ? err.message : "Update failed."); }
    finally { setBusy(false); }
  }

  async function onPublishBracket() {
    if (!tournament || !user) return;
    if (confirmed.length < 2) { alert("Need at least 2 confirmed entrants."); return; }
    if (!confirm(`Publish bracket with ${confirmed.length} entrants? Existing bracket (if any) will be replaced.`)) return;
    setBusy(true);
    try {
      const entrants: Entrant[] = confirmed.map((r) => ({
        id: r.id, name: r.displayName, seed: r.seed, rating: r.rating,
      }));
      await publishBracket({
        tournamentId: tournament.id,
        format: tournament.format,
        entrants,
        targetPoints: tournament.targetPoints ?? 11,
        winBy: tournament.winBy ?? 2,
        bestOf: tournament.bestOf ?? 3,
        createdBy: user.uid,
      });
      // Notify confirmed entrants.
      const userIds = confirmed.map((r) => r.userId).filter((x): x is string => !!x);
      notifyMany(userIds, {
        title: `Bracket published: ${tournament.name}`,
        body: `Check the bracket — your first match is ready.`,
        href: `/tournaments/view?slug=${tournament.slug}`,
        kind: "BRACKET_PUBLISHED",
        createdBy: user.uid,
      }).catch(() => {});
    } catch (err) {
      alert(err instanceof Error ? err.message : "Publish failed.");
    } finally { setBusy(false); }
  }

  async function onStart() {
    if (!tournament) return;
    setBusy(true);
    try { await startTournament(tournament.id); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed."); }
    finally { setBusy(false); }
  }

  // Build in-memory Bracket for rendering from the persisted nodes.
  const renderBracket: Bracket | null = useMemo(() => {
    if (!bracket || nodes.length === 0) return null;
    const engineNodes: EngineNode[] = nodes.map((n) => ({
      id: n.id, roundIndex: n.roundIndex, positionInRound: n.positionInRound,
      a: n.a ?? null, b: n.b ?? null,
      isByeA: n.isByeA, isByeB: n.isByeB,
      seedA: n.seedA ?? undefined, seedB: n.seedB ?? undefined,
      winnerNext: n.winnerNext ?? undefined,
      loserNext: n.loserNext ?? undefined,
    }));
    return {
      type: bracket.format === "DOUBLE_ELIM" ? "DOUBLE_ELIM"
          : bracket.format === "ROUND_ROBIN" ? "ROUND_ROBIN" : "SINGLE_ELIM",
      side: "main",
      nodes: Object.fromEntries(engineNodes.map((n) => [n.id, n])),
      initialSeeding: [],
      rounds: bracket.rounds.map((r, i) => ({ index: i, label: r.label, nodeIds: r.nodeIds })),
    };
  }, [bracket, nodes]);

  const formatLabel = tournament.format.replace(/_/g, " ").toLowerCase();
  const statusChip = (
    <RuneChip tone={
      tournament.status === "IN_PROGRESS" ? "ember"
      : tournament.status === "COMPLETED" ? "neutral"
      : "rune"
    }>
      {tournament.status.replace(/_/g, " ").toLowerCase()}
    </RuneChip>
  );

  return (
    <main className="container py-10 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {statusChip}
            <RuneChip tone="rune" className="capitalize">{formatLabel}</RuneChip>
            <RuneChip tone="neutral">{confirmed.length} / {regs.length} Confirmed</RuneChip>
          </div>
          <h1 className="heading-fantasy text-display-md text-ash-100 capitalize">{tournament.name}</h1>
          {tournament.description && <p className="text-ash-400 text-sm mt-1">{tournament.description}</p>}
          <div className="text-ash-500 text-xs mt-1 font-mono">
            {tournament.startDate} → {tournament.endDate} · Score to {tournament.targetPoints}, win by {tournament.winBy}, best of {tournament.bestOf}
          </div>
        </div>
        <Link href="/tournaments" className="text-spectral-500 hover:text-spectral-400 text-sm">← All Tournaments</Link>
      </div>

      {/* Registration action bar */}
      <Panel variant="base" padding="md">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-ash-300">
            {!user
              ? "Sign in to register for this tournament."
              : myReg
                ? <>You are <span className="font-mono text-ember-400">{myReg.status.toLowerCase()}</span>.</>
                : "You aren't registered yet."}
          </div>
          <div className="flex gap-2">
            {!user ? (
              <Button size="sm" onClick={() => signIn().catch(() => {})}>Sign in with Google</Button>
            ) : !myReg && tournament.status === "REGISTRATION_OPEN" ? (
              <Button size="sm" onClick={onRegister} disabled={busy}>Register</Button>
            ) : myReg && myReg.status !== "WITHDRAWN" && tournament.status !== "COMPLETED" ? (
              <Button variant="outline" size="sm" onClick={onWithdraw} disabled={busy}>Withdraw</Button>
            ) : null}
            {isDirector && tournament.status === "REGISTRATION_OPEN" && (
              <Button size="sm" onClick={onPublishBracket} disabled={busy || confirmed.length < 2}>
                Publish Bracket
              </Button>
            )}
            {isDirector && tournament.status === "SEEDED" && (
              <Button size="sm" onClick={onStart} disabled={busy}>Start Tournament</Button>
            )}
          </div>
        </div>
      </Panel>

      {/* Tabs */}
      <nav className="flex gap-1 border-b border-obsidian-400">
        {(["overview", "entrants", "bracket", "matches"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize border-b-2 transition-colors ${
              tab === t
                ? "border-ember-500 text-ember-400"
                : "border-transparent text-ash-400 hover:text-ash-200"
            }`}
          >
            {t} {t === "entrants" && `(${regs.length})`}
            {t === "matches" && matches.length > 0 && ` (${matches.length})`}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <OverviewTab tournament={tournament} regs={regs} matches={matches} />
      )}
      {tab === "entrants" && (
        <EntrantsTab
          regs={regs}
          isDirector={isDirector}
          disabled={busy}
          onSetStatus={onSetStatus}
          currentUserId={user?.uid}
        />
      )}
      {tab === "bracket" && (
        <Panel variant="base" padding="lg">
          {renderBracket ? (
            <BracketView
              bracket={renderBracket}
              resolveName={(id) => (id ? (nameById[id] ?? "TBD") : "")}
            />
          ) : (
            <p className="text-ash-400 text-sm">
              {isDirector
                ? "No bracket published yet. Confirm entrants, then Publish Bracket."
                : "No bracket has been published yet."}
            </p>
          )}
        </Panel>
      )}
      {tab === "matches" && (
        <MatchesTab
          matches={matches}
          nameById={nameById}
          currentUserId={user?.uid}
          isDirector={isDirector}
        />
      )}
    </main>
  );
}

function OverviewTab({
  tournament, regs, matches,
}: { tournament: TournamentDoc; regs: RegistrationDoc[]; matches: MatchDoc[] }) {
  const stats = {
    registered: regs.length,
    confirmed: regs.filter((r) => r.status === "CONFIRMED").length,
    matches: matches.length,
    done: matches.filter((m) => m.status === "COMPLETED").length,
  };
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Panel variant="raised" padding="md">
        <div className="text-xs uppercase tracking-[0.2em] text-ash-500 mb-2">Field</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Stat label="Registered" value={stats.registered} />
          <Stat label="Confirmed" value={stats.confirmed} />
          <Stat label="Matches" value={stats.matches} />
          <Stat label="Completed" value={stats.done} />
        </div>
      </Panel>
      <Panel variant="raised" padding="md">
        <div className="text-xs uppercase tracking-[0.2em] text-ash-500 mb-2">Details</div>
        <div className="text-sm space-y-1.5">
          <div><span className="text-ash-500">Format:</span> <span className="text-ash-200 capitalize">{tournament.format.replace(/_/g, " ").toLowerCase()}</span></div>
          <div><span className="text-ash-500">Schedule:</span> <span className="font-mono text-ash-200">{tournament.startDate} → {tournament.endDate}</span></div>
          <div><span className="text-ash-500">Scoring:</span> <span className="text-ash-200">To {tournament.targetPoints}, win by {tournament.winBy}, best of {tournament.bestOf}</span></div>
        </div>
      </Panel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.15em] text-ash-500">{label}</div>
      <div className="font-mono text-xl text-ash-100 tabular-nums">{value}</div>
    </div>
  );
}

function EntrantsTab({
  regs, isDirector, disabled, onSetStatus, currentUserId,
}: {
  regs: RegistrationDoc[];
  isDirector: boolean;
  disabled: boolean;
  onSetStatus: (id: string, status: RegistrationDoc["status"]) => void;
  currentUserId?: string;
}) {
  if (regs.length === 0) {
    return <Panel variant="base" padding="lg"><p className="text-ash-400 text-sm">No registrations yet.</p></Panel>;
  }
  const order: RegistrationDoc["status"][] = ["CONFIRMED", "PENDING", "WAITLISTED", "WITHDRAWN", "REJECTED"];
  const sorted = [...regs].sort(
    (a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.displayName.localeCompare(b.displayName),
  );
  return (
    <Panel variant="base" padding="md">
      <ul className="divide-y divide-obsidian-500">
        {sorted.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-2.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-ash-100 text-sm truncate">{r.displayName}</span>
                {r.userId === currentUserId && <RuneChip tone="neutral" className="text-[10px]">you</RuneChip>}
              </div>
              <div className="text-[11px] text-ash-500 font-mono">
                {r.status.toLowerCase()}
                {typeof r.rating === "number" && ` · rating ${r.rating}`}
                {typeof r.seed === "number" && ` · seed ${r.seed}`}
              </div>
            </div>
            {isDirector && (
              <div className="flex gap-1.5 shrink-0">
                {r.status !== "CONFIRMED" && (
                  <Button size="sm" variant="outline" disabled={disabled} onClick={() => onSetStatus(r.id, "CONFIRMED")}>
                    Confirm
                  </Button>
                )}
                {r.status !== "WAITLISTED" && r.status !== "CONFIRMED" && (
                  <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onSetStatus(r.id, "WAITLISTED")}>
                    Waitlist
                  </Button>
                )}
                {r.status !== "REJECTED" && (
                  <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onSetStatus(r.id, "REJECTED")}>
                    Reject
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function MatchesTab({
  matches, nameById, currentUserId, isDirector,
}: {
  matches: MatchDoc[];
  nameById: Record<string, string>;
  currentUserId?: string;
  isDirector: boolean;
}) {
  const [scoring, setScoring] = useState<MatchDoc | null>(null);
  if (matches.length === 0) {
    return <Panel variant="base" padding="lg"><p className="text-ash-400 text-sm">No matches yet. Publish the bracket first.</p></Panel>;
  }
  const order = (m: MatchDoc) => ({
    READY: 0, IN_PROGRESS: 1, SCHEDULED: 2, COMPLETED: 3,
    DISPUTED: 4, FORFEITED: 5, CANCELLED: 6,
  }[m.status] ?? 7);
  const sorted = [...matches].sort((a, b) => order(a) - order(b));
  return (
    <>
      <ul className="space-y-2">
        {sorted.map((m) => {
          const aName = m.participantAId ? (nameById[m.participantAId] ?? "TBD") : "BYE";
          const bName = m.participantBId ? (nameById[m.participantBId] ?? "TBD") : "BYE";
          const canScore =
            m.status !== "COMPLETED" && m.participantAId && m.participantBId &&
            (isDirector /* TODO: also allow participants by userId lookup */);
          return (
            <li key={m.id}>
              <Panel variant={m.status === "COMPLETED" ? "base" : "raised"} padding="md">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <RuneChip tone={m.status === "COMPLETED" ? "neutral" : "ember"} className="text-[10px]">
                        {m.status.toLowerCase()}
                      </RuneChip>
                      {m.scheduledAt && (
                        <span className="text-[11px] font-mono text-ash-500">{m.scheduledAt}</span>
                      )}
                    </div>
                    <div className="text-sm text-ash-100">
                      <span className={m.winnerId === m.participantAId ? "text-ember-400 font-semibold" : ""}>{aName}</span>
                      <span className="text-ash-500 mx-2">vs</span>
                      <span className={m.winnerId === m.participantBId ? "text-ember-400 font-semibold" : ""}>{bName}</span>
                    </div>
                  </div>
                  {canScore && (
                    <Button size="sm" onClick={() => setScoring(m)}>
                      {m.status === "COMPLETED" ? "Edit Score" : "Enter Score"}
                    </Button>
                  )}
                </div>
              </Panel>
            </li>
          );
        })}
      </ul>
      {scoring && currentUserId && (
        <ScoreModal
          match={scoring}
          aName={scoring.participantAId ? (nameById[scoring.participantAId] ?? "A") : "A"}
          bName={scoring.participantBId ? (nameById[scoring.participantBId] ?? "B") : "B"}
          currentUserId={currentUserId}
          onClose={() => setScoring(null)}
        />
      )}
    </>
  );
}

function ScoreModal({
  match, aName, bName, currentUserId, onClose,
}: {
  match: MatchDoc;
  aName: string; bName: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const gamesNeeded = match.bestOf;
  const [games, setGames] = useState<Array<{ a: string; b: string }>>(
    Array.from({ length: gamesNeeded }, () => ({ a: "", b: "" })),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = games
      .map((g) => ({ a: Number(g.a), b: Number(g.b) }))
      .filter((g) => !(isNaN(g.a) || isNaN(g.b)) && (g.a !== 0 || g.b !== 0));
    if (parsed.length === 0) { setError("Enter at least one game score."); return; }
    setSubmitting(true);
    try {
      await recordMatchScore({ matchId: match.id, games: parsed, createdBy: currentUserId });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md">
        <Panel variant="raised" padding="lg">
          <h2 className="heading-fantasy text-lg text-ash-100 mb-1">Enter Score</h2>
          <p className="text-ash-500 text-xs mb-4 font-mono">
            Best of {match.bestOf} · to {match.targetPoints} · win by {match.winBy}
          </p>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
              <div className="text-sm text-ash-300 text-right">{aName}</div>
              <div />
              <div className="text-sm text-ash-300">{bName}</div>
              {games.map((g, i) => (
                <div key={i} className="contents">
                  <input
                    type="number" min={0} inputMode="numeric"
                    className="input text-center font-mono"
                    value={g.a}
                    onChange={(e) => {
                      const next = [...games]; next[i] = { ...next[i]!, a: e.target.value }; setGames(next);
                    }}
                  />
                  <span className="text-ash-500 text-xs font-mono px-1">G{i + 1}</span>
                  <input
                    type="number" min={0} inputMode="numeric"
                    className="input text-center font-mono"
                    value={g.b}
                    onChange={(e) => {
                      const next = [...games]; next[i] = { ...next[i]!, b: e.target.value }; setGames(next);
                    }}
                  />
                </div>
              ))}
            </div>
            {error && (
              <div className="rounded-pixel border border-crimson-500/40 bg-crimson-500/10 px-3 py-2 text-sm text-crimson-400">
                {error}
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" className="text-sm text-ash-400 hover:text-ash-200 px-3 py-1.5" onClick={onClose}>
                Cancel
              </button>
              <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save Score"}</Button>
            </div>
          </form>
        </Panel>
      </div>
    </div>
  );
}

export default function TournamentViewPage() {
  return (
    <ResponsiveShell desktopChromeless>
      <Suspense fallback={<main className="container py-10 text-ash-400">Loading…</main>}>
        <TournamentView />
      </Suspense>
    </ResponsiveShell>
  );
}
