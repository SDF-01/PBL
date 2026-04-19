// Ladder League Firestore read helpers.

"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../firestore/collections";
import type {
  LadderSeasonDoc,
  VenueDoc,
  PlayDateDoc,
  CheckInDoc,
} from "../firestore/types";

export async function listLadderSeasons(): Promise<LadderSeasonDoc[]> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.seasons),
      orderBy("startDate", "desc"),
      limit(50),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LadderSeasonDoc);
}

export async function getLadderSeason(
  id: string,
): Promise<LadderSeasonDoc | null> {
  const snap = await getDoc(doc(db(), COLLECTIONS.seasons, id));
  return snap.exists()
    ? ({ id: snap.id, ...snap.data() } as LadderSeasonDoc)
    : null;
}

export async function listVenues(): Promise<VenueDoc[]> {
  const snap = await getDocs(
    query(collection(db(), COLLECTIONS.venues), limit(100)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VenueDoc);
}

export async function getVenue(id: string): Promise<VenueDoc | null> {
  const snap = await getDoc(doc(db(), COLLECTIONS.venues, id));
  return snap.exists()
    ? ({ id: snap.id, ...snap.data() } as VenueDoc)
    : null;
}

export async function listPlayDates(): Promise<PlayDateDoc[]> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.playDates),
      orderBy("date", "desc"),
      limit(50),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlayDateDoc);
}

export async function getPlayDate(id: string): Promise<PlayDateDoc | null> {
  const snap = await getDoc(doc(db(), COLLECTIONS.playDates, id));
  return snap.exists()
    ? ({ id: snap.id, ...snap.data() } as PlayDateDoc)
    : null;
}

export function subscribeCheckIns(
  playDateId: string,
  onChange: (rows: CheckInDoc[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db(), COLLECTIONS.checkIns),
      where("playDateId", "==", playDateId),
    ),
    (snap) =>
      onChange(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CheckInDoc),
      ),
  );
}
