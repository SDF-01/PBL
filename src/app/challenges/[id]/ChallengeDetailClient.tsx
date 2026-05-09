"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Hourglass,
  MapPin,
  Swords,
  Trophy,
  X,
} from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { useAuth } from "@/lib/auth-context";
import {
  subscribeChallenge,
  proposeConditions,
  acceptConditions,
  submitChallengeScore,
  verifyChallengeScore,
  respondToChallenge,
  formatLabel,
} from "@/lib/players/challenges";
import type { PlayerChallengeDoc, ChallengeConditions } from "@/lib/firestore/types";
import { formatDistanceToNow } from "date-fns";

interface Props {
  challengeId: string;
}

export function ChallengeDetailClient({ challengeId: fallbackId }: Props) {
  const routeParams = useParams<{ id: string }>();
  const pathname = usePathname();
  const { user } = useAuth();

  const segment = pathname.split("/")[2];
  const challengeId =
    segment && segment !== "__fallback"
      ? segment
      : routeParams?.id && routeParams.id !== "__fallback"
      ? routeParams.id
      : fallbackId;

  const [challenge, setChallenge] = useState<PlayerChallengeDoc | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── conditions form state ────────────────────────────────────────────────
  const [format, setFormat] = useState<ChallengeConditions["format"]>("game-11");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [location, setLocation] = useState("");
  const [showConditionsForm, setShowConditionsForm] = useState(false);

  // ── score form state ─────────────────────────────────────────────────────
  const [myScore, setMyScore] = useState("");
  const [opponentScore, setOpponentScore] = useState("");
  const [showScoreForm, setShowScoreForm] = useState(false);

  useEffect(() => {
    if (!challengeId || challengeId === "__fallback") { setLoadingChallenge(false); return; }
    const unsub = subscribeChallenge(challengeId, (c) => {
      setChallenge(c);
      setLoadingChallenge(false);
    });
    return () => unsub();
  }, [challengeId]);

  if (loadingChallenge) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 text-ash-400 text-sm">Loading…</main>
      </ResponsiveShell>
    );
  }

  if (!challenge) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-xl">
          <Panel variant="base" padding="md">
            <p className="text-crimson-400 text-sm">Challenge not found.</p>
            <Link href="/(authenticated)/dashboard" className="text-ash-500 hover:text-ash-300 text-sm mt-2 inline-block">
              ← Dashboard
            </Link>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  if (!user) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-xl">
          <Panel variant="base" padding="md">
            <p className="text-ash-400 text-sm">Please sign in to view this challenge.</p>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  const myRole: "challenger" | "challengee" | "observer" =
    user.uid === challenge.challengerId
      ? "challenger"
      : user.uid === challenge.challengeeId
      ? "challengee"
      : "observer";

  const opponentName =
    myRole === "challenger" ? challenge.challengeeName : challenge.challengerName;
  const opponentId =
    myRole === "challenger" ? challenge.challengeeId : challenge.challengerId;

  const iConditionsProposer = challenge.conditionsProposedBy === user.uid;
  const conditionsPending = !!challenge.conditions && !iConditionsProposer;

  // ── handlers ────────────────────────────────────────────────────────────

  async function handleRespondPending(accept: boolean) {
    if (!user || myRole !== "challengee" || busy) return;
    setBusy(true);
    setError(null);
    try {
      await respondToChallenge(challengeId, accept, user.uid, user.displayName ?? "Player", challenge!.challengerId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleProposeConditions() {
    if (!user || myRole === "observer" || busy) return;
    setBusy(true);
    setError(null);
    try {
      const cond: ChallengeConditions = {
        format,
        scheduledDate: scheduledDate || undefined,
        scheduledTime: scheduledTime || undefined,
        location: location.trim() || undefined,
      };
      await proposeConditions(challengeId, cond, user.uid, opponentId, user.displayName ?? "Player");
      setShowConditionsForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptConditions() {
    if (!user || myRole === "observer" || busy) return;
    setBusy(true);
    setError(null);
    try {
      await acceptConditions(challengeId, user.uid, challenge!.conditionsProposedBy!, user.displayName ?? "Player");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitScore() {
    if (!user || myRole === "observer" || busy) return;
    const a = parseInt(myScore, 10);
    const b = parseInt(opponentScore, 10);
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) { setError("Enter valid scores."); return; }
    if (a === b) { setError("Scores cannot be tied."); return; }
    setBusy(true);
    setError(null);
    try {
      await submitChallengeScore(challengeId, a, b, user.uid, myRole, opponentId, user.displayName ?? "Player");
      setShowScoreForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyScore() {
    if (!user || myRole === "observer" || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyChallengeScore(challengeId, user.uid);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  // ── derived display values ───────────────────────────────────────────────

  const steps: { label: string; done: boolean; active: boolean }[] = [
    { label: "Challenged", done: true, active: challenge.status === "PENDING" },
    {
      label: "Accepted",
      done: !["PENDING", "DECLINED"].includes(challenge.status),
      active: challenge.status === "ACCEPTED",
    },
    {
      label: "Scheduled",
      done: ["SCHEDULED", "SCORE_SUBMITTED", "COMPLETED"].includes(challenge.status),
      active: challenge.status === "SCHEDULED",
    },
    {
      label: "Score Submitted",
      done: ["SCORE_SUBMITTED", "COMPLETED"].includes(challenge.status),
      active: challenge.status === "SCORE_SUBMITTED",
    },
    { label: "Complete", done: challenge.status === "COMPLETED", active: challenge.status === "COMPLETED" },
  ];

  const createdAgo = (() => {
    const ca = challenge.createdAt as unknown;
    if (ca && typeof ca === "object" && "toDate" in ca) {
      return formatDistanceToNow((ca as { toDate(): Date }).toDate(), { addSuffix: true });
    }
    if (typeof ca === "string") return formatDistanceToNow(new Date(ca), { addSuffix: true });
    return "";
  })();

  const inputCls =
    "w-full rounded-pixel bg-obsidian-700 border border-ash-700 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500";

  // ── score display (challenger perspective) ───────────────────────────────
  const challengerScore = challenge.scoreA ?? null;
  const challengeeScore = challenge.scoreB ?? null;
  const winnerName =
    challenge.winnerSide === "challenger"
      ? challenge.challengerName
      : challenge.winnerSide === "challengee"
      ? challenge.challengeeName
      : null;

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 max-w-xl space-y-5">

        {/* Back nav */}
        <Link
          href="/(authenticated)/dashboard"
          className="text-ash-400 hover:text-ash-200 text-sm inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>

        {/* Header */}
        <Panel variant="quest" padding="lg" glow="rune">
          <div className="flex items-center gap-3 mb-3">
            <Swords className="h-5 w-5 text-ember-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/players/view?uid=${challenge.challengerId}`} className="text-ash-100 font-medium hover:text-ember-300 transition-colors text-sm">
                  {challenge.challengerName}
                </Link>
                <span className="text-ash-600 text-xs">vs</span>
                <Link href={`/players/view?uid=${challenge.challengeeId}`} className="text-ash-100 font-medium hover:text-ember-300 transition-colors text-sm">
                  {challenge.challengeeName}
                </Link>
              </div>
              <p className="text-ash-500 text-[10px] mt-0.5">{createdAgo}</p>
            </div>
            <StatusChip status={challenge.status} />
          </div>

          {challenge.message && (
            <p className="text-ash-400 text-xs italic border-l border-obsidian-500 pl-2">
              "{challenge.message}"
            </p>
          )}
        </Panel>

        {/* Progress steps */}
        {challenge.status !== "DECLINED" && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {steps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-1 shrink-0">
                <div className={`flex items-center gap-1 px-2 py-1 rounded-pixel text-[10px] border transition-colors ${
                  step.done
                    ? "bg-spectral-900/40 border-spectral-600 text-spectral-300"
                    : step.active
                    ? "bg-ember-900/40 border-ember-500 text-ember-300"
                    : "border-obsidian-600 text-ash-600"
                }`}>
                  {step.done && <CheckCircle2 className="h-2.5 w-2.5" />}
                  {step.label}
                </div>
                {i < steps.length - 1 && <div className="w-3 h-px bg-obsidian-600 shrink-0" />}
              </div>
            ))}
          </div>
        )}

        {/* ── State: DECLINED ─────────────────────────────────────────────── */}
        {challenge.status === "DECLINED" && (
          <Panel variant="base" padding="md">
            <div className="flex items-center gap-2 text-crimson-400">
              <X className="h-4 w-4" />
              <p className="text-sm">{challenge.challengeeName} declined this challenge.</p>
            </div>
          </Panel>
        )}

        {/* ── State: PENDING (challengee view) ─────────────────────────────── */}
        {challenge.status === "PENDING" && myRole === "challengee" && (
          <Panel variant="base" padding="md" className="space-y-3">
            <p className="text-ash-300 text-sm">
              <span className="text-ash-100 font-medium">{challenge.challengerName}</span> challenged you to a match. Accept to begin negotiating conditions.
            </p>
            {error && <p className="text-crimson-400 text-xs">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" variant="primary" disabled={busy} onClick={() => handleRespondPending(true)}>
                <Check className="h-3.5 w-3.5" /> Accept
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleRespondPending(false)} className="text-crimson-400">
                <X className="h-3.5 w-3.5" /> Decline
              </Button>
            </div>
          </Panel>
        )}

        {challenge.status === "PENDING" && myRole === "challenger" && (
          <Panel variant="base" padding="md">
            <div className="flex items-center gap-2 text-ash-400">
              <Hourglass className="h-4 w-4" />
              <p className="text-sm">Waiting for {challenge.challengeeName} to respond…</p>
            </div>
          </Panel>
        )}

        {/* ── State: ACCEPTED ───────────────────────────────────────────────── */}
        {challenge.status === "ACCEPTED" && (
          <Panel variant="base" padding="md" className="space-y-4">
            <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-ember-400" /> Match Conditions
            </h2>

            {/* No conditions proposed yet */}
            {!challenge.conditions && !showConditionsForm && myRole !== "observer" && (
              <div className="space-y-2">
                <p className="text-ash-400 text-sm">Propose conditions for your match so both players can agree on format, date, and location.</p>
                <Button size="sm" variant="primary" onClick={() => setShowConditionsForm(true)}>
                  Propose Conditions
                </Button>
              </div>
            )}

            {/* Conditions proposed by me — waiting */}
            {challenge.conditions && iConditionsProposer && !showConditionsForm && (
              <div className="space-y-3">
                <ConditionsDisplay conditions={challenge.conditions} />
                <div className="flex items-center gap-2 text-ash-500 text-xs">
                  <Hourglass className="h-3.5 w-3.5" />
                  Waiting for {opponentName} to accept…
                </div>
                <Button size="sm" variant="ghost" onClick={() => setShowConditionsForm(true)} className="text-ash-400">
                  Update Conditions
                </Button>
              </div>
            )}

            {/* Conditions proposed by opponent */}
            {challenge.conditions && conditionsPending && !showConditionsForm && (
              <div className="space-y-3">
                <p className="text-ash-400 text-xs">{opponentName} proposed:</p>
                <ConditionsDisplay conditions={challenge.conditions} />
                {error && <p className="text-crimson-400 text-xs">{error}</p>}
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" disabled={busy} onClick={handleAcceptConditions}>
                    <Check className="h-3.5 w-3.5" /> Accept Conditions
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowConditionsForm(true)} className="text-ash-400">
                    Counter-propose
                  </Button>
                </div>
              </div>
            )}

            {/* Conditions form */}
            {(showConditionsForm || (!challenge.conditions && myRole !== "observer")) && (
              <div className="space-y-3">
                {showConditionsForm && challenge.conditions && (
                  <p className="text-ash-500 text-xs">Updating proposed conditions</p>
                )}
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-ash-500 block mb-1">Format</label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as ChallengeConditions["format"])}
                    className={inputCls}
                  >
                    <option value="game-11">Game to 11</option>
                    <option value="game-15">Game to 15</option>
                    <option value="game-21">Game to 21</option>
                    <option value="best-of-3">Best of 3 (to 11)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-ash-500 block mb-1">Date</label>
                    <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-ash-500 block mb-1">Time</label>
                    <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-ash-500 block mb-1">Location</label>
                  <input
                    type="text"
                    placeholder="Court, facility name, or address"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className={inputCls}
                  />
                </div>
                {error && <p className="text-crimson-400 text-xs">{error}</p>}
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" disabled={busy} onClick={handleProposeConditions}>
                    {iConditionsProposer ? "Update Proposal" : "Propose Conditions"}
                  </Button>
                  {showConditionsForm && (
                    <Button size="sm" variant="ghost" onClick={() => setShowConditionsForm(false)}>Cancel</Button>
                  )}
                </div>
              </div>
            )}

            {myRole === "observer" && !challenge.conditions && (
              <p className="text-ash-500 text-sm">Waiting for players to agree on conditions.</p>
            )}
          </Panel>
        )}

        {/* ── State: SCHEDULED ─────────────────────────────────────────────── */}
        {challenge.status === "SCHEDULED" && (
          <Panel variant="base" padding="md" className="space-y-4">
            <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gold-400" /> Match Ready
            </h2>

            {challenge.conditions && <ConditionsDisplay conditions={challenge.conditions} />}

            {!showScoreForm && myRole !== "observer" && (
              <div className="space-y-2">
                <p className="text-ash-400 text-sm">After you play, log the score below. Either player can submit.</p>
                <Button size="sm" variant="primary" onClick={() => setShowScoreForm(true)}>
                  Log Score
                </Button>
              </div>
            )}

            {showScoreForm && (
              <div className="space-y-3 pt-1 border-t border-obsidian-600">
                <p className="text-ash-400 text-xs">Enter scores from your perspective</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-ash-500 block mb-1">My Score</label>
                    <input
                      type="number"
                      min={0}
                      value={myScore}
                      onChange={(e) => setMyScore(e.target.value)}
                      placeholder="0"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-ash-500 block mb-1">{opponentName}&apos;s Score</label>
                    <input
                      type="number"
                      min={0}
                      value={opponentScore}
                      onChange={(e) => setOpponentScore(e.target.value)}
                      placeholder="0"
                      className={inputCls}
                    />
                  </div>
                </div>
                {error && <p className="text-crimson-400 text-xs">{error}</p>}
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" disabled={busy} onClick={handleSubmitScore}>
                    Submit Score
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowScoreForm(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {myRole === "observer" && (
              <p className="text-ash-500 text-sm">Waiting for players to log their score.</p>
            )}
          </Panel>
        )}

        {/* ── State: SCORE_SUBMITTED ───────────────────────────────────────── */}
        {challenge.status === "SCORE_SUBMITTED" && (
          <Panel variant="base" padding="md" className="space-y-4">
            <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest flex items-center gap-2">
              <Clock className="h-4 w-4 text-ember-400" /> Score Submitted
            </h2>

            {challenge.conditions && <ConditionsDisplay conditions={challenge.conditions} />}

            {/* Score display */}
            <div className="flex items-center justify-center gap-6 py-3">
              <div className="text-center">
                <p className="text-ash-500 text-[10px] mb-1">{challenge.challengerName}</p>
                <p className="heading-fantasy text-3xl text-ash-100">{challengerScore ?? "—"}</p>
              </div>
              <div className="text-ash-600 text-lg">–</div>
              <div className="text-center">
                <p className="text-ash-500 text-[10px] mb-1">{challenge.challengeeName}</p>
                <p className="heading-fantasy text-3xl text-ash-100">{challengeeScore ?? "—"}</p>
              </div>
            </div>

            {myRole !== "observer" && challenge.submittedBy === user?.uid && (
              <div className="flex items-center gap-2 text-ash-500 text-sm">
                <Hourglass className="h-4 w-4" />
                Waiting for {opponentName} to verify this score…
              </div>
            )}

            {myRole !== "observer" && challenge.submittedBy !== user?.uid && (
              <div className="space-y-2">
                <p className="text-ash-400 text-sm">
                  {opponentName} submitted this score. Does it look correct?
                </p>
                {error && <p className="text-crimson-400 text-xs">{error}</p>}
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" disabled={busy} onClick={handleVerifyScore}>
                    <Check className="h-3.5 w-3.5" /> Confirm Score
                  </Button>
                </div>
                <p className="text-ash-600 text-[10px]">
                  If the score is wrong, contact {opponentName} to re-submit.
                </p>
              </div>
            )}

            {myRole === "observer" && (
              <p className="text-ash-500 text-sm">Waiting for both players to confirm the score.</p>
            )}
          </Panel>
        )}

        {/* ── State: COMPLETED ─────────────────────────────────────────────── */}
        {challenge.status === "COMPLETED" && (
          <Panel variant="base" padding="md" className="space-y-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-gold-400" />
              <h2 className="heading-fantasy text-ash-100 text-base">Match Complete</h2>
            </div>

            {challenge.conditions && <ConditionsDisplay conditions={challenge.conditions} />}

            <div className="flex items-center justify-center gap-6 py-4">
              <div className="text-center">
                <p className="text-ash-500 text-[10px] mb-1">{challenge.challengerName}</p>
                <p className={`heading-fantasy text-4xl ${challenge.winnerSide === "challenger" ? "text-spectral-400" : "text-crimson-500"}`}>
                  {challengerScore ?? "—"}
                </p>
                {challenge.winnerSide === "challenger" && (
                  <RuneChip tone="spectral" className="mt-1 text-[9px]">Winner</RuneChip>
                )}
              </div>
              <div className="text-ash-600 text-xl">–</div>
              <div className="text-center">
                <p className="text-ash-500 text-[10px] mb-1">{challenge.challengeeName}</p>
                <p className={`heading-fantasy text-4xl ${challenge.winnerSide === "challengee" ? "text-spectral-400" : "text-crimson-500"}`}>
                  {challengeeScore ?? "—"}
                </p>
                {challenge.winnerSide === "challengee" && (
                  <RuneChip tone="spectral" className="mt-1 text-[9px]">Winner</RuneChip>
                )}
              </div>
            </div>

            {winnerName && (
              <p className="text-center text-ash-300 text-sm">
                <span className="text-spectral-400 font-medium">{winnerName}</span> wins · ELO updated
              </p>
            )}
          </Panel>
        )}

      </main>
    </ResponsiveShell>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConditionsDisplay({ conditions }: { conditions: ChallengeConditions }) {
  return (
    <div className="flex flex-wrap gap-2">
      <RuneChip tone="ember">{formatLabel(conditions.format)}</RuneChip>
      {conditions.scheduledDate && (
        <RuneChip tone="neutral">
          <CalendarDays className="h-2.5 w-2.5" />
          {conditions.scheduledDate}
          {conditions.scheduledTime ? ` at ${conditions.scheduledTime}` : ""}
        </RuneChip>
      )}
      {conditions.location && (
        <RuneChip tone="neutral">
          <MapPin className="h-2.5 w-2.5" />
          {conditions.location}
        </RuneChip>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: PlayerChallengeDoc["status"] }) {
  const map: Record<PlayerChallengeDoc["status"], { label: string; tone: "ember" | "spectral" | "gold" | "crimson" | "neutral" }> = {
    PENDING:         { label: "Pending",         tone: "neutral" },
    ACCEPTED:        { label: "Accepted",         tone: "ember" },
    SCHEDULED:       { label: "Scheduled",        tone: "gold" },
    SCORE_SUBMITTED: { label: "Score Submitted",  tone: "ember" },
    COMPLETED:       { label: "Completed",        tone: "spectral" },
    DECLINED:        { label: "Declined",         tone: "crimson" },
    EXPIRED:         { label: "Expired",          tone: "neutral" },
  };
  const { label, tone } = map[status] ?? { label: status, tone: "neutral" };
  return <RuneChip tone={tone} className="text-[9px] shrink-0">{label}</RuneChip>;
}
