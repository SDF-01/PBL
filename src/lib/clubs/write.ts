"use client";

import { deleteField, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import type { ClubFacility } from "@/lib/permissions/types";

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
