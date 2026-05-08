"use client";

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../firestore/collections";
import type { EloEventDoc } from "../firestore/types";

export interface PartnerStat {
  partnerId: string;
  partnerName?: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
}

/**
 * Aggregate recent ELO events to find a player's top doubles partners.
 * Groups by partner user ID, summing wins/losses per pairing.
 */
export async function getTopPartners(
  userId: string,
  maxEvents = 100,
): Promise<PartnerStat[]> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.eloEvents),
      where("playerId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(maxEvents),
    ),
  );

  const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EloEventDoc);
  const map = new Map<string, { wins: number; losses: number }>();

  for (const e of events) {
    const partners: string[] = (e.partnerIds as string[] | undefined) ?? [];
    const won = e.won ?? false;
    for (const pid of partners) {
      if (!pid || pid === userId) continue;
      const cur = map.get(pid) ?? { wins: 0, losses: 0 };
      if (won) cur.wins++;
      else cur.losses++;
      map.set(pid, cur);
    }
  }

  const stats: PartnerStat[] = Array.from(map.entries()).map(([pid, s]) => ({
    partnerId: pid,
    gamesPlayed: s.wins + s.losses,
    wins: s.wins,
    losses: s.losses,
    winRate: s.wins + s.losses > 0 ? s.wins / (s.wins + s.losses) : 0,
  }));

  // Sort by games played desc, then win rate desc
  stats.sort((a, b) =>
    b.gamesPlayed !== a.gamesPlayed
      ? b.gamesPlayed - a.gamesPlayed
      : b.winRate - a.winRate,
  );
  return stats.slice(0, 5);
}
