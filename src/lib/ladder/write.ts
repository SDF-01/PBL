// Ladder League write helpers.
//
// Privileged + multi-document writes (score submission, score verification,
// disputes, admin overrides, session generation, finalization) are routed
// through Cloud Functions for atomicity and authoritative audit logging.
// Self-service writes (check-in, season/venue/play-date creation by staff
// at the rule layer) remain client-side.

"use client";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type FieldValue,
} from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../firestore/collections";
import { slugify } from "../firestore/write";
import { listLadderCourts, listLadderMatches } from "./repo";
import {
  callSubmitMatchScore,
  callVerifyMatchScore,
  callDisputeMatch,
  callAdminAssignMatchResult,
  callPersistGeneratedSession,
  callFinalizeSession,
} from "@/lib/functions/callables";
import type {
  LadderSeasonDoc,
  PlayDateDoc,
  LadderSessionDoc,
  MovementPattern,
  CourtDistributionPlacement,
  CheckInStatus,
} from "../firestore/types";

function stripUndefined<T extends Record<string, unknown>>(
  obj: T,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  );
}

// ============================================================
// SEASONS
// ============================================================

export interface NewLadderSeason {
  name: string;
  slug?: string;
  startDate: string;
  endDate: string;
  targetPoints?: number;
  movementPattern?: MovementPattern;
  courtDistributionPlacement?: CourtDistributionPlacement;
  createdBy: string;
}

export async function createLadderSeason(
  input: NewLadderSeason,
): Promise<string> {
  const slug = input.slug?.trim() || slugify(input.name);
  if (!slug) throw new Error("Season slug is required.");
  const payload: Omit<LadderSeasonDoc, "id" | "createdAt"> & {
    createdAt: FieldValue;
  } = {
    name: input.name.trim(),
    slug,
    startDate: input.startDate,
    endDate: input.endDate,
    targetPoints: input.targetPoints ?? 11,
    movementPattern: input.movementPattern ?? "ONE_UP_ONE_DOWN",
    courtDistributionPlacement:
      input.courtDistributionPlacement ?? "MIDDLE",
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(db(), COLLECTIONS.seasons, slug), stripUndefined(payload));
  return slug;
}

export async function copyLadderSeason(
  sourceSeasonId: string,
  newName: string,
  newStartDate: string,
  newEndDate: string,
  createdBy: string,
): Promise<string> {
  const srcSnap = await getDoc(doc(db(), COLLECTIONS.seasons, sourceSeasonId));
  if (!srcSnap.exists()) throw new Error("Source season not found.");
  const src = { id: srcSnap.id, ...srcSnap.data() } as LadderSeasonDoc;
  return createLadderSeason({
    name: newName,
    startDate: newStartDate,
    endDate: newEndDate,
    targetPoints: src.targetPoints,
    movementPattern: src.movementPattern,
    courtDistributionPlacement: src.courtDistributionPlacement,
    createdBy,
  });
}

// ============================================================
// VENUES
// ============================================================

export interface NewVenue {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  createdBy: string;
  clubId?: string;
}

export async function createVenue(input: NewVenue): Promise<string> {
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    throw new Error("Venue lat/lng must be finite numbers.");
  }
  if (!(input.radiusMeters > 0)) {
    throw new Error("Venue geofence radius must be > 0 meters.");
  }
  const ref = await addDoc(
    collection(db(), COLLECTIONS.venues),
    stripUndefined({
      name: input.name.trim(),
      address: input.address?.trim() || undefined,
      lat: input.lat,
      lng: input.lng,
      radiusMeters: input.radiusMeters,
      createdBy: input.createdBy,
      clubId: input.clubId,
      createdAt: serverTimestamp(),
    }),
  );
  return ref.id;
}

// ============================================================
// PLAY DATES
// ============================================================

export interface NewPlayDate {
  seasonId: string;
  venueId: string;
  date: string;
  checkInOpensAt?: string;
  checkInClosesAt?: string;
  createdBy: string;
}

export async function createPlayDate(input: NewPlayDate): Promise<string> {
  const ref = await addDoc(
    collection(db(), COLLECTIONS.playDates),
    stripUndefined({
      seasonId: input.seasonId,
      venueId: input.venueId,
      date: input.date,
      status: "SCHEDULED" as const,
      checkInOpensAt: input.checkInOpensAt,
      checkInClosesAt: input.checkInClosesAt,
      createdBy: input.createdBy,
      createdAt: serverTimestamp(),
    }),
  );
  return ref.id;
}

export async function updatePlayDateStatus(
  playDateId: string,
  status: PlayDateDoc["status"],
): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.playDates, playDateId), { status });
}

// ============================================================
// CHECK-INS (still client-side; see DI-009 for future migration)
// ============================================================

export interface NewCheckIn {
  playDateId: string;
  userId: string;
  displayName: string;
  lat?: number;
  lng?: number;
  distanceMeters?: number;
  status: CheckInStatus;
}

export async function createCheckIn(input: NewCheckIn): Promise<string> {
  const id = `${input.playDateId}__${input.userId}`;
  await setDoc(
    doc(db(), COLLECTIONS.checkIns, id),
    stripUndefined({
      playDateId: input.playDateId,
      userId: input.userId,
      displayName: input.displayName,
      status: input.status,
      lat: input.lat,
      lng: input.lng,
      distanceMeters: input.distanceMeters,
      createdAt: serverTimestamp(),
    }),
  );
  return id;
}

export async function adminOverrideCheckIn(
  checkInId: string,
  adminId: string,
): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.checkIns, checkInId), {
    status: "ADMIN_CONFIRMED" as CheckInStatus,
    adminOverrideBy: adminId,
  });
}

// ============================================================
// LADDER MATCHES — score submission + ELO application (atomic via Function)
// ============================================================

export interface SubmitLadderMatchScoreInput {
  matchId: string;
  scoreA: number;
  scoreB: number;
}

export async function submitLadderMatchScore(
  input: SubmitLadderMatchScoreInput,
): Promise<void> {
  if (!Number.isInteger(input.scoreA) || !Number.isInteger(input.scoreB)) {
    throw new Error("Scores must be integers.");
  }
  if (input.scoreA < 0 || input.scoreB < 0) {
    throw new Error("Scores cannot be negative.");
  }
  if (input.scoreA === input.scoreB) {
    throw new Error("Ladder matches cannot end in a tie.");
  }
  await callSubmitMatchScore(input);
}

export async function verifyLadderMatchScore(matchId: string): Promise<void> {
  await callVerifyMatchScore({ matchId });
}

export async function disputeLadderMatch(
  matchId: string,
  reason?: string,
): Promise<void> {
  await callDisputeMatch({ matchId, reason });
}

export async function adminAssignMatchResult(
  matchId: string,
  scoreA: number,
  scoreB: number,
): Promise<void> {
  await callAdminAssignMatchResult({ matchId, scoreA, scoreB });
}

// ============================================================
// SESSION GENERATION & FINALIZATION (atomic via Function)
// ============================================================

export interface GenerateSessionInput {
  sessionDoc: LadderSessionDoc;
  courts: Array<{ id: string; courtNumber: number; size: 4 | 5; playerIds: string[] }>;
  matches: Array<{
    id: string;
    courtId: string;
    gameNumber: number;
    sequenceInCourt?: number;
    sideA: string[];
    sideB: string[];
    sitOutPlayer?: string;
  }>;
  generatedBy: string;
}

export async function persistGeneratedSession(
  input: GenerateSessionInput,
): Promise<void> {
  await callPersistGeneratedSession({
    sessionDoc: input.sessionDoc as unknown as Record<string, unknown> & {
      id: string;
      playDateId: string;
      seasonId: string;
      kind: "A" | "B";
    },
    courts: input.courts,
    matches: input.matches,
  });
}

// ============================================================
// NOTIFICATIONS (general-purpose helper, used by admin tools)
// ============================================================

export async function writeNotification(input: {
  userId: string;
  title: string;
  body: string;
  kind:
    | "SCORE_SUBMITTED"
    | "SCORE_DISPUTED"
    | "LADDER_PROMOTED"
    | "LADDER_DEMOTED"
    | "MATCH_READY"
    | "ANNOUNCEMENT"
    | "GENERAL";
  href?: string;
  createdBy?: string;
}): Promise<void> {
  await addDoc(
    collection(db(), COLLECTIONS.notifications),
    stripUndefined({
      userId: input.userId,
      title: input.title,
      body: input.body,
      kind: input.kind,
      href: input.href ?? null,
      read: false,
      createdBy: input.createdBy ?? null,
      createdAt: serverTimestamp(),
    }),
  );
}

// ============================================================
// SESSION B GENERATION (orchestrator: domain code + persist callable + notify)
// ============================================================

export async function generateSessionB(
  sessionAId: string,
  generatedBy: string,
): Promise<string> {
  const sessionASnap = await getDoc(
    doc(db(), COLLECTIONS.ladderSessions, sessionAId),
  );
  if (!sessionASnap.exists()) throw new Error("Session A not found");

  const sessionA = sessionASnap.data() as LadderSessionDoc;
  if (sessionA.status !== "FINALIZED") {
    throw new Error("Session A must be finalized before generating Session B");
  }

  const playDateSnap = await getDoc(
    doc(db(), COLLECTIONS.playDates, sessionA.playDateId),
  );
  if (!playDateSnap.exists()) throw new Error("Play date not found");

  const seasonSnap = await getDoc(
    doc(db(), COLLECTIONS.seasons, sessionA.seasonId),
  );
  if (!seasonSnap.exists()) throw new Error("Season not found");

  const playDate = { id: playDateSnap.id, ...playDateSnap.data() } as PlayDateDoc;
  const season = { id: seasonSnap.id, ...seasonSnap.data() } as LadderSeasonDoc;

  const courtsA = await listLadderCourts(sessionAId);
  const matchesA = await listLadderMatches(sessionAId);

  const { generateSessionBFromSessionA } = await import(
    "../../domain/ladder/generation"
  );
  const sessionBData = generateSessionBFromSessionA(
    sessionA,
    courtsA,
    matchesA,
    playDate,
    season,
  );

  const mappedMatches = sessionBData.matches.map((match) => ({
    id: match.id,
    courtId: match.courtId,
    gameNumber: match.gameNumber,
    sequenceInCourt: match.sequenceInCourt ?? 0,
    sideA: match.sideA,
    sideB: match.sideB,
    sitOutPlayer: match.sittingOut ?? undefined,
  }));

  await persistGeneratedSession({
    sessionDoc: sessionBData.session,
    courts: sessionBData.courts,
    matches: mappedMatches,
    generatedBy,
  });

  // Update play date with Session B id (small client-side write).
  await updateDoc(doc(db(), COLLECTIONS.playDates, playDate.id), {
    sessionBId: sessionBData.session.id,
  });

  // Movement notifications (best-effort; not in the persist transaction
  // since the affected user set is derived after the session is committed).
  const courtAMap = new Map<string, number>();
  for (const court of courtsA) {
    for (const pid of court.playerIds) courtAMap.set(pid, court.courtNumber);
  }
  const courtBMap = new Map<string, number>();
  for (const court of sessionBData.courts) {
    for (const pid of court.playerIds) courtBMap.set(pid, court.courtNumber);
  }
  const notifyPromises: Promise<void>[] = [];
  for (const [playerId, courtA] of courtAMap.entries()) {
    const courtB = courtBMap.get(playerId);
    if (courtB === undefined) continue;
    if (courtB < courtA) {
      notifyPromises.push(
        writeNotification({
          userId: playerId,
          title: "Court Promotion!",
          body: `You moved up from court ${courtA} to court ${courtB} for Session B.`,
          kind: "LADDER_PROMOTED",
          href: "/ladder/session",
        }),
      );
    } else if (courtB > courtA) {
      notifyPromises.push(
        writeNotification({
          userId: playerId,
          title: "Court Change",
          body: `You moved down from court ${courtA} to court ${courtB} for Session B.`,
          kind: "LADDER_DEMOTED",
          href: "/ladder/session",
        }),
      );
    }
  }
  await Promise.allSettled(notifyPromises);

  return sessionBData.session.id;
}

// ============================================================
// SESSION FINALIZATION (atomic via Function)
// ============================================================

export async function finalizeSession(
  sessionId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  standingsSnapshot: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updatedPlayerStats: Record<string, any>,
): Promise<void> {
  await callFinalizeSession({
    sessionId,
    standingsSnapshot: standingsSnapshot as { id: string } & Record<
      string,
      unknown
    >,
    updatedPlayerStats: updatedPlayerStats as Record<
      string,
      Record<string, number | undefined>
    >,
  });
}
