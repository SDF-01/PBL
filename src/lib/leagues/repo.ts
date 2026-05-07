"use client";

import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
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

export async function listLeaguesByClub(clubId: string): Promise<LeagueDoc[]> {
  const snap = await getDocs(
    query(collection(db(), COLLECTIONS.leagues), where("clubId", "==", clubId)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LeagueDoc);
}

export interface LeagueMemberEntry {
  id: string;
  leagueId: string;
  userId: string;
  status: string;
  role?: string;
  joinedAt?: string;
  displayName?: string;
}

export async function listLeagueMembers(leagueId: string): Promise<LeagueMemberEntry[]> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.leagueMemberships),
      where("leagueId", "==", leagueId),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LeagueMemberEntry);
}

export async function getUserLeagueMembership(
  leagueId: string,
  userId: string,
): Promise<{ id: string; status: string } | null> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.leagueMemberships),
      where("leagueId", "==", leagueId),
      where("userId", "==", userId),
      limit(1),
    ),
  );
  if (snap.empty) return null;
  const d = snap.docs[0]!;
  return { id: d.id, status: d.data().status as string };
}
