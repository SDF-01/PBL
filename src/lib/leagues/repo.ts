"use client";

import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import type { LeagueDoc } from "@/lib/firestore/types";

export async function listActiveLeagues(): Promise<LeagueDoc[]> {
  const activeQuery = query(
    collection(db(), COLLECTIONS.leagues),
    where("active", "==", true),
  );
  const activeSnap = await getDocs(activeQuery);
  if (!activeSnap.empty) {
    return activeSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as LeagueDoc);
  }

  const fallbackSnap = await getDocs(collection(db(), COLLECTIONS.leagues));
  return fallbackSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as LeagueDoc);
}

export async function getLeague(id: string): Promise<LeagueDoc | null> {
  const snap = await getDoc(doc(db(), COLLECTIONS.leagues, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as LeagueDoc) : null;
}
