// Player profile Firestore read helpers.

"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as qLimit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../firestore/collections";
import type { PlayerProfileDoc, EloEventDoc } from "../firestore/types";

export async function getPlayerProfile(
  userId: string,
): Promise<PlayerProfileDoc | null> {
  const snap = await getDoc(doc(db(), COLLECTIONS.players, userId));
  return snap.exists()
    ? ({ id: snap.id, ...snap.data() } as PlayerProfileDoc)
    : null;
}

export async function listLeaderboard(
  limit = 100,
): Promise<PlayerProfileDoc[]> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.players),
      orderBy("elo", "desc"),
      qLimit(limit),
    ),
  );
  return snap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as PlayerProfileDoc,
  );
}

export function subscribeLeaderboard(
  onChange: (rows: PlayerProfileDoc[]) => void,
  limit = 100,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db(), COLLECTIONS.players),
      orderBy("elo", "desc"),
      qLimit(limit),
    ),
    (snap) =>
      onChange(
        snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as PlayerProfileDoc,
        ),
      ),
  );
}

export async function listRecentEloEvents(
  playerId: string,
  limit = 20,
): Promise<EloEventDoc[]> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.eloEvents),
      where("playerId", "==", playerId),
      orderBy("createdAt", "desc"),
      qLimit(limit),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EloEventDoc);
}
