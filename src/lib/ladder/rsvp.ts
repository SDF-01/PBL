"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../firestore/collections";
import type { PlayDateRsvpDoc } from "../firestore/types";

/** Returns true if the user has RSVPed attending for this play date. */
export async function getRsvpStatus(
  playDateId: string,
  userId: string,
): Promise<boolean | null> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.playDateRsvps),
      where("playDateId", "==", playDateId),
      where("userId", "==", userId),
    ),
  );
  if (snap.empty) return null;
  return (snap.docs[0]!.data() as PlayDateRsvpDoc).attending;
}

/** Returns all RSVPs for a play date (for directors to see headcount). */
export async function listPlayDateRsvps(playDateId: string): Promise<PlayDateRsvpDoc[]> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.playDateRsvps),
      where("playDateId", "==", playDateId),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlayDateRsvpDoc);
}

/** RSVP or update RSVP. Deterministic ID → idempotent. */
export async function setRsvp(
  playDateId: string,
  userId: string,
  displayName: string,
  attending: boolean,
): Promise<void> {
  const id = `${playDateId}_${userId}`;
  await setDoc(
    doc(db(), COLLECTIONS.playDateRsvps, id),
    { id, playDateId, userId, displayName, attending, createdAt: serverTimestamp() },
    { merge: true },
  );
}

/** Remove RSVP entirely. */
export async function removeRsvp(playDateId: string, userId: string): Promise<void> {
  await deleteDoc(doc(db(), COLLECTIONS.playDateRsvps, `${playDateId}_${userId}`));
}
