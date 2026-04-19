// Ladder League write helpers — client-side Firestore writes for the
// doubles-ladder MVP (spec v4). Pure write layer, no rendering.

"use client";

import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type FieldValue,
} from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../firestore/collections";
import { slugify } from "../firestore/write";
import type {
  LadderSeasonDoc,
  VenueDoc,
  PlayDateDoc,
  CheckInDoc,
  MovementPattern,
  CourtDistributionPlacement,
  CheckInStatus,
  AuditDoc,
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
// CHECK-INS
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

/**
 * Deterministic check-in id so a player cannot check in twice to the same
 * play date. Callers compute geofence validation first and pass the status.
 */
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
// AUDIT LOG (append-only, per spec directive 04)
// ============================================================

export async function writeAudit(
  entry: Omit<AuditDoc, "id" | "createdAt">,
): Promise<void> {
  await addDoc(
    collection(db(), COLLECTIONS.audits),
    stripUndefined({ ...entry, createdAt: serverTimestamp() }),
  );
}
