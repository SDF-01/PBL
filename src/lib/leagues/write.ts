// TODO: createLeague should migrate to a Firebase Cloud Function once one is deployed.

"use client";

import { collection, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import { followClub } from "@/lib/clubs/write";
import type { RoleKey } from "@/lib/permissions/types";

export interface NewFacilityInput {
  facilityName?: string;
  address?: string;
  pickleballCourts?: number;
  tennisConversionCourts?: number;
  hasParking?: boolean;
  hasLights?: boolean;
  isIndoor?: boolean;
  surfaceType?: "hard" | "clay" | "turf" | "indoor";
  amenities?: string[];
  notes?: string;
}

export interface CreateLeagueInput {
  name: string;
  description?: string;
  clubId: string;
  city?: string;
  state?: string;
  leagueFormat?: string;
  /** Link to an existing clubFacilities document. */
  facilityId?: string;
  /** Inline facility to create atomically with the league. */
  newFacility?: NewFacilityInput;
  venueId?: string;
  venueName?: string;
  venueAddress?: string;
  registrationOpenDate?: string;
  registrationCloseDate?: string;
  firstSessionDate?: string;
  lastSessionDate?: string;
  sessionDayOfWeek?: string;
  sessionCount?: number;
  directorId?: string;
  directorName?: string;
  coordinatorId?: string;
  coordinatorName?: string;
  /** Stripe Payment Link URL for registration fee collection. */
  stripePaymentLink?: string;
  /** Registration fee in USD cents (display only). */
  registrationFee?: number;
}

export async function createLeague(
  createdBy: string,
  input: CreateLeagueInput,
): Promise<string> {

  const database = db();
  const batch = writeBatch(database);

  const leagueRef = doc(collection(database, COLLECTIONS.leagues));

  const leagueData: Record<string, unknown> = {
    orgId: input.clubId,
    clubId: input.clubId,
    name: input.name,
    description: input.description ?? "",
    city: input.city ?? "",
    state: input.state ?? "",
    league_format: input.leagueFormat ?? "Doubles Ladder",
    active: true,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Facility — create new inline or link existing, atomically with the league.
  if (input.newFacility) {
    const facilityRef = doc(collection(database, COLLECTIONS.clubFacilities));
    const { facilityName, address, pickleballCourts, tennisConversionCourts,
            hasParking, hasLights, isIndoor, surfaceType, amenities, notes } = input.newFacility;
    const facilityData: Record<string, unknown> = {
      clubId: input.clubId,
      updatedBy: createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (facilityName) facilityData.facilityName = facilityName;
    if (address) facilityData.address = address;
    if (pickleballCourts !== undefined) facilityData.pickleballCourts = pickleballCourts;
    if (tennisConversionCourts !== undefined) facilityData.tennisConversionCourts = tennisConversionCourts;
    if (hasParking !== undefined) facilityData.hasParking = hasParking;
    if (hasLights !== undefined) facilityData.hasLights = hasLights;
    if (isIndoor !== undefined) facilityData.isIndoor = isIndoor;
    if (surfaceType) facilityData.surfaceType = surfaceType;
    if (amenities?.length) facilityData.amenities = amenities;
    if (notes) facilityData.notes = notes;
    batch.set(facilityRef, facilityData);
    leagueData.facilityId = facilityRef.id;
  } else if (input.facilityId) {
    leagueData.facilityId = input.facilityId;
  }

  if (input.venueId) leagueData.venueId = input.venueId;
  if (input.venueName) leagueData.venueName = input.venueName;
  if (input.venueAddress) leagueData.venueAddress = input.venueAddress;
  if (input.registrationOpenDate) leagueData.registrationOpenDate = input.registrationOpenDate;
  if (input.registrationCloseDate) leagueData.registrationCloseDate = input.registrationCloseDate;
  if (input.firstSessionDate) leagueData.firstSessionDate = input.firstSessionDate;
  if (input.lastSessionDate) leagueData.lastSessionDate = input.lastSessionDate;
  if (input.sessionDayOfWeek) leagueData.sessionDayOfWeek = input.sessionDayOfWeek;
  if (input.sessionCount !== undefined) leagueData.sessionCount = input.sessionCount;
  if (input.directorId) { leagueData.directorId = input.directorId; leagueData.directorName = input.directorName ?? ""; }
  if (input.coordinatorId) { leagueData.coordinatorId = input.coordinatorId; leagueData.coordinatorName = input.coordinatorName ?? ""; }
  if (input.stripePaymentLink) leagueData.stripePaymentLink = input.stripePaymentLink;
  if (input.registrationFee !== undefined) leagueData.registrationFee = input.registrationFee;

  batch.set(leagueRef, leagueData);

  // Assign coordinator role — use explicitly assigned coordinator if provided, otherwise default to creator
  const coordinatorUserId = input.coordinatorId ?? createdBy;
  const coordinatorRoleRef = doc(collection(database, COLLECTIONS.userRoles));
  batch.set(coordinatorRoleRef, {
    userId: coordinatorUserId,
    roleId: "LeagueCoordinator" as RoleKey,
    clubId: input.clubId,
    leagueId: leagueRef.id,
    assignedAt: serverTimestamp(),
    assignedBy: createdBy,
    active: true,
  });

  // If creator is not the coordinator, also give creator a coordinator role so they retain access
  if (input.coordinatorId && input.coordinatorId !== createdBy) {
    const creatorRoleRef = doc(collection(database, COLLECTIONS.userRoles));
    batch.set(creatorRoleRef, {
      userId: createdBy,
      roleId: "LeagueCoordinator" as RoleKey,
      clubId: input.clubId,
      leagueId: leagueRef.id,
      assignedAt: serverTimestamp(),
      assignedBy: createdBy,
      active: true,
    });
  }

  await batch.commit();
  return leagueRef.id;
}

export async function joinLeague(userId: string, leagueId: string, clubId?: string): Promise<void> {
  const database = db();
  const docRef = doc(database, COLLECTIONS.leagueMemberships, `${leagueId}__${userId}`);
  const existing = await getDoc(docRef);
  if (existing.exists()) {
    // Re-join after leaving: update status and reset joinedAt. Preserve existing role.
    const existingRole = existing.data().role as string | undefined;
    await updateDoc(docRef, {
      status: "active",
      joinedAt: serverTimestamp(),
      ...(existingRole ? {} : { role: "player" }),
    });
  } else {
    await setDoc(docRef, { leagueId, userId, status: "active", joinedAt: serverTimestamp(), role: "player" });
  }

  // Auto-follow the club so the player gets posts and updates in their feed.
  if (clubId) {
    const followerRef = doc(database, COLLECTIONS.clubFollowers, `${userId}_${clubId}`);
    const followerSnap = await getDoc(followerRef);
    if (!followerSnap.exists()) {
      await followClub(userId, clubId).catch(() => {}); // non-fatal
    }
  }
}

export async function leaveLeague(userId: string, leagueId: string): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.leagueMemberships, `${leagueId}__${userId}`), {
    status: "inactive",
  });
}

export interface UpdateLeagueInput {
  name?: string;
  description?: string;
  city?: string;
  state?: string;
  leagueFormat?: string;
  active?: boolean;
  facilityId?: string | null;
  movementRules?: string;
  courtCount?: number;
  targetPoints?: number;
  seasonStartDate?: string;
  seasonEndDate?: string;
  registrationOpenDate?: string;
  registrationCloseDate?: string;
  firstSessionDate?: string;
  lastSessionDate?: string;
  sessionDayOfWeek?: string;
  sessionCount?: number;
}

export async function updateLeagueSettings(
  leagueId: string,
  input: UpdateLeagueInput,
): Promise<void> {
  const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.city !== undefined) updates.city = input.city;
  if (input.state !== undefined) updates.state = input.state;
  if (input.leagueFormat !== undefined) updates.league_format = input.leagueFormat;
  if (input.active !== undefined) updates.active = input.active;
  if (input.facilityId !== undefined) updates.facilityId = input.facilityId ?? null;
  if (input.movementRules !== undefined) updates.movementRules = input.movementRules;
  if (input.courtCount !== undefined) updates.courtCount = input.courtCount;
  if (input.targetPoints !== undefined) updates.targetPoints = input.targetPoints;
  if (input.seasonStartDate !== undefined) updates.seasonStartDate = input.seasonStartDate;
  if (input.seasonEndDate !== undefined) updates.seasonEndDate = input.seasonEndDate;
  if (input.registrationOpenDate !== undefined) updates.registrationOpenDate = input.registrationOpenDate;
  if (input.registrationCloseDate !== undefined) updates.registrationCloseDate = input.registrationCloseDate;
  if (input.firstSessionDate !== undefined) updates.firstSessionDate = input.firstSessionDate;
  if (input.lastSessionDate !== undefined) updates.lastSessionDate = input.lastSessionDate;
  if (input.sessionDayOfWeek !== undefined) updates.sessionDayOfWeek = input.sessionDayOfWeek;
  if (input.sessionCount !== undefined) updates.sessionCount = input.sessionCount;
  await updateDoc(doc(db(), COLLECTIONS.leagues, leagueId), updates);
}
