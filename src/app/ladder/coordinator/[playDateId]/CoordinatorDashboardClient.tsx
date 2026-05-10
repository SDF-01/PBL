"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Hourglass,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserMinus,
  UserPlus2,
  Users,
} from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import {
  getPlayDate,
  subscribeCheckIns,
  subscribeLadderSessions,
  subscribeLadderMatches,
  subscribeLadderCourts,
} from "@/lib/ladder/repo";
import {
  adminOverrideCheckIn,
  markLateArrival,
  markNoShow,
  setPlayDateCheckInCode,
  updatePlayDateStatus,
} from "@/lib/ladder/write";
import { listLeagueMembers, type LeagueMemberEntry } from "@/lib/leagues/repo";
import { LiveCourts } from "@/components/player/LiveCourts";
import type {
  CheckInDoc,
  LadderCourtDoc,
  LadderMatchDoc,
  LadderSessionDoc,
  PlayDateDoc,
} from "@/lib/firestore/types";

interface Props {
  playDateId: string;
}

function generateCode(): string {
  // 6-char alphanumeric, no ambiguous characters.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function CoordinatorDashboardClient({ playDateId: propId }: Props) {
  const pathname = usePathname();
  const pathnameSegment = pathname.split("/")[3];
  const playDateId =
    pathnameSegment && pathnameSegment !== "__fallback"
      ? pathnameSegment
      : propId;

  const { user } = useAuth();
  const {
    isSiteAdmin,
    leagueCoordinatorFor,
    coordinatorClubIds,
    loading: permLoading,
  } = usePermissions();

  const [playDate, setPlayDate] = useState<PlayDateDoc | null>(null);
  const [loadingPd, setLoadingPd] = useState(true);
  const [checkIns, setCheckIns] = useState<CheckInDoc[]>([]);
  const [sessions, setSessions] = useState<LadderSessionDoc[]>([]);
  const [courts, setCourts] = useState<LadderCourtDoc[]>([]);
  const [matches, setMatches] = useState<LadderMatchDoc[]>([]);
  const [members, setMembers] = useState<LeagueMemberEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [savingCode, setSavingCode] = useState(false);
  const [pdStatusBusy, setPdStatusBusy] = useState(false);

  // Permission: site admin, league coordinator for this league, or club coordinator
  const isAuthorized = useMemo(() => {
    if (permLoading) return false;
    if (isSiteAdmin) return true;
    if (playDate?.leagueId && leagueCoordinatorFor.includes(playDate.leagueId)) return true;
    // Best-effort: a club coordinator can manage any play date in that club.
    // We don't have the play-date's club id directly, but any club coordinator
    // is allowed to use the dashboard. Strict checks happen at write time.
    if (coordinatorClubIds.length > 0) return true;
    return false;
  }, [permLoading, isSiteAdmin, leagueCoordinatorFor, coordinatorClubIds, playDate?.leagueId]);

  // Load play date
  useEffect(() => {
    if (!playDateId || playDateId === "__fallback") {
      setLoadingPd(false);
      return;
    }
    setLoadingPd(true);
    getPlayDate(playDateId)
      .then((pd) => setPlayDate(pd))
      .finally(() => setLoadingPd(false));
  }, [playDateId]);

  // Subscribe to live check-ins
  useEffect(() => {
    if (!playDateId) return;
    return subscribeCheckIns(playDateId, setCheckIns);
  }, [playDateId]);

  // Subscribe to sessions, then to their courts + matches
  useEffect(() => {
    if (!playDateId) return;
    return subscribeLadderSessions(playDateId, setSessions);
  }, [playDateId]);

  const activeSession = useMemo(
    () =>
      sessions.find((s) => s.status === "LIVE" || s.status === "GENERATED") ??
      sessions[0],
    [sessions],
  );

  useEffect(() => {
    if (!activeSession) {
      setCourts([]);
      setMatches([]);
      return;
    }
    const u1 = subscribeLadderCourts(activeSession.id, setCourts);
    const u2 = subscribeLadderMatches(activeSession.id, setMatches);
    return () => {
      u1();
      u2();
    };
  }, [activeSession]);

  // Roster — for no-show detection
  useEffect(() => {
    if (!playDate?.leagueId) {
      setMembers([]);
      return;
    }
    listLeagueMembers(playDate.leagueId)
      .then((rows) => setMembers(rows.filter((m) => m.status === "active")))
      .catch(() => setMembers([]));
  }, [playDate?.leagueId]);

  // Partition rosters for the no-show panel: members without any CONFIRMED-ish check-in.
  const checkInByUserId = useMemo(() => {
    const map = new Map<string, CheckInDoc>();
    for (const ci of checkIns) map.set(ci.userId, ci);
    return map;
  }, [checkIns]);

  const missingMembers = useMemo(() => {
    return members.filter((m) => !checkInByUserId.has(m.userId));
  }, [members, checkInByUserId]);

  const scoreSummary = useMemo(() => {
    const verified = matches.filter((m) => m.status === "VERIFIED" || m.status === "ADMIN_ASSIGNED");
    const awaiting = matches.filter((m) => m.status === "SUBMITTED" || m.status === "AWAITING_VERIFICATION");
    const disputed = matches.filter((m) => m.status === "DISPUTED");
    return { verified, awaiting, disputed, total: matches.length };
  }, [matches]);

  async function handleOverride(ci: CheckInDoc) {
    if (!user) return;
    setBusy(ci.id);
    try {
      await adminOverrideCheckIn(ci.id, user.uid);
    } finally {
      setBusy(null);
    }
  }

  async function handleMarkLate(ci: CheckInDoc) {
    if (!user) return;
    setBusy(ci.id);
    try {
      await markLateArrival(ci.id, user.uid);
    } finally {
      setBusy(null);
    }
  }

  async function handleMarkNoShow(member: LeagueMemberEntry) {
    if (!user || !playDate) return;
    setBusy(member.userId);
    try {
      await markNoShow({
        playDateId: playDate.id,
        userId: member.userId,
        displayName: member.displayName ?? member.userId.slice(0, 8),
        adminId: user.uid,
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleRotateCode() {
    if (!playDate) return;
    setSavingCode(true);
    try {
      const next = generateCode();
      await setPlayDateCheckInCode(playDate.id, next);
      setPlayDate({ ...playDate, checkInCode: next });
    } finally {
      setSavingCode(false);
    }
  }

  async function handleClearCode() {
    if (!playDate) return;
    setSavingCode(true);
    try {
      await setPlayDateCheckInCode(playDate.id, null);
      setPlayDate({ ...playDate, checkInCode: "" });
    } finally {
      setSavingCode(false);
    }
  }

  async function handleSetStatus(status: PlayDateDoc["status"]) {
    if (!playDate) return;
    setPdStatusBusy(true);
    try {
      await updatePlayDateStatus(playDate.id, status);
      setPlayDate({ ...playDate, status });
    } finally {
      setPdStatusBusy(false);
    }
  }

  // Build the QR/deep-link URL clients can scan to land on the check-in page
  // with the code pre-filled. Uses the public api.qrserver.com renderer so we
  // don't need to add a runtime dep just for one screen.
  const checkInUrl = useMemo(() => {
    if (typeof window === "undefined" || !playDate) return null;
    const code = playDate.checkInCode?.trim();
    if (!code) return null;
    const url = new URL(`${window.location.origin}/ladder/check-in`);
    url.searchParams.set("playDate", playDate.id);
    url.searchParams.set("code", code);
    return url.toString();
  }, [playDate]);

  if (loadingPd || permLoading) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 flex items-center gap-2 text-ash-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard…
        </main>
      </ResponsiveShell>
    );
  }

  if (!playDate) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10">
          <Panel variant="base" padding="lg">
            <p className="text-crimson-400">Play date not found.</p>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  if (!isAuthorized) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10">
          <Panel variant="base" padding="lg">
            <p className="text-crimson-400">
              You don&apos;t have permission to manage this play date.
            </p>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            {playDate.leagueId && (
              <Link
                href={`/leagues/${playDate.leagueId}`}
                className="text-ash-400 text-sm hover:text-ash-200 inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-4 w-4" /> League
              </Link>
            )}
            <h1 className="heading-fantasy text-display-md text-ash-100 mt-1">
              Coordinator Dashboard
            </h1>
            <p className="text-ash-500 text-xs mt-1 font-mono">
              Play date {playDate.date} · status {playDate.status}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={playDate.status === "CHECK_IN_OPEN" ? "primary" : "outline"}
              onClick={() => handleSetStatus("CHECK_IN_OPEN")}
              disabled={pdStatusBusy || playDate.status === "CHECK_IN_OPEN"}
            >
              Open check-in
            </Button>
            <Button
              size="sm"
              variant={playDate.status === "IN_PROGRESS" ? "primary" : "outline"}
              onClick={() => handleSetStatus("IN_PROGRESS")}
              disabled={pdStatusBusy || playDate.status === "IN_PROGRESS"}
            >
              Start play
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSetStatus("CLOSED")}
              disabled={pdStatusBusy || playDate.status === "CLOSED"}
            >
              Close
            </Button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* ─────────── Check-ins ─────────── */}
          <Panel variant="hud" padding="lg" className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-ember-400" />
              <h2 className="heading-fantasy text-ash-100">Check-ins</h2>
              <RuneChip tone="neutral" className="text-[9px]">{checkIns.length}</RuneChip>
            </div>
            {checkIns.length === 0 ? (
              <p className="text-ash-500 text-sm">No check-ins yet.</p>
            ) : (
              <ul className="divide-y divide-obsidian-600">
                {checkIns.map((ci) => (
                  <CheckInRow
                    key={ci.id}
                    ci={ci}
                    busy={busy === ci.id}
                    onOverride={() => handleOverride(ci)}
                    onMarkLate={() => handleMarkLate(ci)}
                  />
                ))}
              </ul>
            )}
          </Panel>

          {/* ─────────── No-shows ─────────── */}
          <Panel variant="quest" padding="lg" className="space-y-3">
            <div className="flex items-center gap-2">
              <UserMinus className="h-4 w-4 text-crimson-400" />
              <h2 className="heading-fantasy text-ash-100">Roster status</h2>
              <RuneChip tone="neutral" className="text-[9px]">
                {missingMembers.length} pending
              </RuneChip>
            </div>
            {members.length === 0 ? (
              <p className="text-ash-500 text-sm">
                {playDate.leagueId
                  ? "Roster loading…"
                  : "This play date isn't linked to a league, so we can't compute no-shows."}
              </p>
            ) : missingMembers.length === 0 ? (
              <p className="text-ash-500 text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-ember-400" />
                Everyone&apos;s accounted for.
              </p>
            ) : (
              <ul className="divide-y divide-obsidian-600 max-h-72 overflow-y-auto">
                {missingMembers.map((m) => (
                  <li key={m.userId} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                    <span className="flex-1 truncate text-ash-200 text-sm">
                      {m.displayName ?? m.userId.slice(0, 8)}
                    </span>
                    <button
                      onClick={() => handleMarkNoShow(m)}
                      disabled={busy === m.userId}
                      className="text-[11px] px-2 py-1 rounded bg-obsidian-700 border border-ash-700 text-ash-400 hover:text-crimson-400 transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      <UserMinus className="h-3 w-3" />
                      No-show
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* ─────────── Code / QR fallback ─────────── */}
          <Panel variant="inventory" padding="lg" className="space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-spectral-400" />
              <h2 className="heading-fantasy text-ash-100">Check-in code</h2>
            </div>
            <p className="text-ash-500 text-xs">
              Share this when GPS check-in fails. Anyone with the code can
              check in on this play date.
            </p>
            <div className="flex items-center gap-3">
              <div className="font-mono text-2xl tracking-[0.3em] text-ember-300 bg-obsidian-900 border border-obsidian-400 rounded-pixel px-4 py-3 flex-1 text-center">
                {playDate.checkInCode?.trim() || "— — — — — —"}
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRotateCode}
                  disabled={savingCode}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Rotate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleClearCode}
                  disabled={savingCode || !playDate.checkInCode}
                >
                  Clear
                </Button>
              </div>
            </div>
            {checkInUrl && (
              <div className="flex flex-col items-center gap-2 pt-3 border-t border-obsidian-600">
                <p className="text-[10px] uppercase tracking-[0.15em] text-ash-500">
                  Scan to check in
                </p>
                {/* QR rendered by api.qrserver.com — no auth, no client dep. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={`QR code for ${checkInUrl}`}
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkInUrl)}`}
                  width={200}
                  height={200}
                  className="rounded-pixel bg-ash-100 p-2"
                />
                <p className="text-[11px] text-ash-500 break-all font-mono text-center">
                  {checkInUrl}
                </p>
              </div>
            )}
          </Panel>

          {/* ─────────── Score status ─────────── */}
          <Panel variant="base" padding="lg" className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-gold-400" />
              <h2 className="heading-fantasy text-ash-100">Score status</h2>
            </div>
            {!activeSession ? (
              <p className="text-ash-500 text-sm">No session generated yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 text-center">
                <StatusTile
                  label="Verified"
                  value={scoreSummary.verified.length}
                  total={scoreSummary.total}
                  tone="success"
                />
                <StatusTile
                  label="Awaiting"
                  value={scoreSummary.awaiting.length}
                  total={scoreSummary.total}
                  tone="warning"
                />
                <StatusTile
                  label="Disputed"
                  value={scoreSummary.disputed.length}
                  total={scoreSummary.total}
                  tone="crimson"
                />
              </div>
            )}
            {scoreSummary.disputed.length > 0 && (
              <div className="pt-3 border-t border-obsidian-600 space-y-2">
                <p className="text-[10px] uppercase tracking-[0.15em] text-ash-500">
                  Disputes
                </p>
                {scoreSummary.disputed.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 text-xs font-mono"
                  >
                    <span className="text-crimson-300 truncate">Game #{m.gameNumber}</span>
                    <Link
                      href={`/ladder/session?playDate=${playDateId}`}
                      className="text-spectral-300 hover:underline shrink-0"
                    >
                      Review →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* ─────────── Court board ─────────── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Hourglass className="h-4 w-4 text-rune-glow" />
            <h2 className="heading-fantasy text-ash-100 text-xl">Courts</h2>
            {activeSession && (
              <RuneChip tone="rune" className="text-[9px]">
                Session {activeSession.kind} · {activeSession.status}
              </RuneChip>
            )}
          </div>
          {!activeSession ? (
            <Panel variant="base" padding="lg" className="text-ash-500 text-sm text-center">
              No session generated yet. Once you start play, courts will appear here.
            </Panel>
          ) : (
            <LiveCourts courts={courts} matches={matches} />
          )}
        </section>
      </main>
    </ResponsiveShell>
  );
}

function CheckInRow({
  ci,
  busy,
  onOverride,
  onMarkLate,
}: {
  ci: CheckInDoc;
  busy: boolean;
  onOverride: () => void;
  onMarkLate: () => void;
}) {
  const tone =
    ci.status === "CONFIRMED" || ci.status === "ADMIN_CONFIRMED"
      ? "success"
      : ci.status === "PENDING" || ci.status === "LATE"
      ? "warning"
      : ci.status === "NO_SHOW"
      ? "neutral"
      : "crimson";

  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="flex-1 min-w-0">
        <p className="text-ash-200 text-sm truncate">{ci.displayName}</p>
        <p className="text-ash-500 text-[11px] font-mono">
          {ci.distanceMeters != null ? `${Math.round(ci.distanceMeters)}m` : "No GPS"}
          {ci.method ? ` · ${ci.method}` : ""}
        </p>
      </div>
      <RuneChip tone={tone} className="text-[9px] shrink-0">
        {ci.status}
      </RuneChip>
      {(ci.status === "GEO_REJECTED" || ci.status === "PENDING") && (
        <ActionPill busy={busy} onClick={onOverride} tone="ember">
          Override
        </ActionPill>
      )}
      {ci.status === "NO_SHOW" && (
        <ActionPill busy={busy} onClick={onMarkLate} tone="spectral">
          <UserPlus2 className="h-3 w-3" /> Late
        </ActionPill>
      )}
    </li>
  );
}

function ActionPill({
  busy,
  onClick,
  tone,
  children,
}: {
  busy: boolean;
  onClick: () => void;
  tone: "ember" | "spectral";
  children: React.ReactNode;
}) {
  const cls =
    tone === "ember"
      ? "bg-ember-500/20 border-ember-500/40 text-ember-400 hover:bg-ember-500/30"
      : "bg-spectral-500/20 border-spectral-500/40 text-spectral-300 hover:bg-spectral-500/30";
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`shrink-0 text-[11px] px-2 py-1 rounded border transition-colors disabled:opacity-50 inline-flex items-center gap-1 ${cls}`}
    >
      {busy ? "…" : children}
    </button>
  );
}

function StatusTile({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "success" | "warning" | "crimson";
}) {
  const toneCls =
    tone === "success"
      ? "text-ember-400"
      : tone === "warning"
      ? "text-gold-400"
      : "text-crimson-400";
  return (
    <div className="rounded-pixel bg-obsidian-900 border border-obsidian-400 px-3 py-2">
      <p className={`heading-fantasy text-2xl ${toneCls}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-[0.15em] text-ash-500 mt-1">
        {label}
      </p>
      {total > 0 && (
        <p className="text-[10px] text-ash-600 font-mono">/ {total}</p>
      )}
    </div>
  );
}

