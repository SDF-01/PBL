"use client";

import { deleteDoc, deleteField, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import type { ClubFacility } from "@/lib/permissions/types";

export async function updateClubLogo(clubId: string, logoUrl: string | null): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.clubs, clubId), {
    logoUrl: logoUrl ?? null,
    updatedAt: serverTimestamp(),
  });
}

export async function upsertClubFacility(
  clubId: string,
  data: Omit<ClubFacility, "clubId" | "updatedAt" | "updatedBy">,
  updatedBy: string,
): Promise<void> {
  // Firestore rejects undefined values — replace them with deleteField() so
  // clearing an optional field removes it from the document instead of crashing.
  const cleaned = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v === undefined ? deleteField() : v]),
  );

  await setDoc(
    doc(db(), COLLECTIONS.clubFacilities, clubId),
    { ...cleaned, clubId, updatedBy, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function deleteClubFacility(clubId: string): Promise<void> {
  await deleteDoc(doc(db(), COLLECTIONS.clubFacilities, clubId));
}
