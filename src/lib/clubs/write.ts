"use client";

import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import type { ClubFacility } from "@/lib/permissions/types";

export async function upsertClubFacility(
  clubId: string,
  data: Omit<ClubFacility, "clubId" | "updatedAt" | "updatedBy">,
  updatedBy: string,
): Promise<void> {
  await setDoc(
    doc(db(), COLLECTIONS.clubFacilities, clubId),
    {
      ...data,
      clubId,
      updatedBy,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
