"use client";

import {
  addDoc,
  arrayUnion,
  arrayRemove,
  collection,
  deleteDoc,
  deleteField,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import type { ClubFacility } from "@/lib/permissions/types";

// ── Club followers ─────────────────────────────────────────────────────────

/** Follow a club. Doc ID is deterministic so re-following is idempotent. */
export async function followClub(userId: string, clubId: string): Promise<void> {
  await Promise.all([
    setDoc(doc(db(), COLLECTIONS.clubFollowers, `${userId}_${clubId}`), {
      userId, clubId, followedAt: serverTimestamp(),
    }),
    updateDoc(doc(db(), COLLECTIONS.clubs, clubId), {
      followerIds: arrayUnion(userId),
    }),
  ]);
}

export async function unfollowClub(userId: string, clubId: string): Promise<void> {
  await Promise.all([
    deleteDoc(doc(db(), COLLECTIONS.clubFollowers, `${userId}_${clubId}`)),
    updateDoc(doc(db(), COLLECTIONS.clubs, clubId), {
      followerIds: arrayRemove(userId),
    }),
  ]);
}

// ── Club logo ──────────────────────────────────────────────────────────────

export async function updateClubLogo(clubId: string, logoUrl: string | null): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.clubs, clubId), {
    logoUrl: logoUrl ?? null,
    updatedAt: serverTimestamp(),
  });
}

// ── Club facilities (multi-facility) ──────────────────────────────────────

type FacilityInput = Omit<ClubFacility, "id" | "clubId" | "createdAt" | "updatedAt" | "updatedBy">;

// For updates: undefined → deleteField() to clear existing values
function cleanFacilityForUpdate(data: FacilityInput) {
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v === undefined ? deleteField() : v]),
  );
}

// For creates: undefined fields are simply omitted (addDoc rejects deleteField sentinels)
function cleanFacilityForCreate(data: FacilityInput) {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  );
}

/** Add a new facility for a club — returns the new document ID. */
export async function addClubFacility(
  clubId: string,
  data: FacilityInput,
  updatedBy: string,
): Promise<string> {
  const ref = await addDoc(collection(db(), COLLECTIONS.clubFacilities), {
    ...cleanFacilityForCreate(data),
    clubId,
    updatedBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Update an existing facility document. */
export async function updateClubFacility(
  facilityId: string,
  data: FacilityInput,
  updatedBy: string,
): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.clubFacilities, facilityId), {
    ...cleanFacilityForUpdate(data),
    updatedBy,
    updatedAt: serverTimestamp(),
  });
}

/** Delete a facility document. */
export async function removeClubFacility(facilityId: string): Promise<void> {
  await deleteDoc(doc(db(), COLLECTIONS.clubFacilities, facilityId));
}

// ── Club posts ─────────────────────────────────────────────────────────────

export interface CreatePostInput {
  clubId: string;
  clubName: string;
  authorId: string;
  authorName: string;
  content: string;
  imageUrl?: string;
}

/** Create a club post — returns the new document ID. */
export async function createClubPost(input: CreatePostInput): Promise<string> {
  const ref = await addDoc(collection(db(), COLLECTIONS.clubPosts), {
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteClubPost(postId: string): Promise<void> {
  await deleteDoc(doc(db(), COLLECTIONS.clubPosts, postId));
}

