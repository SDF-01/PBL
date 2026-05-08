"use client";

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";

export interface PlatformAnalytics {
  totalMatches: number;
  activePlayers30d: number;
  matchesLast30d: number;
  matchesByDay: { label: string; count: number }[];
  openChallenges: number;
  totalFollows: number;
  upcomingRsvps: number;
  activeLeagues: number;
}

function thirtyDaysAgo(): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return Timestamp.fromDate(d);
}

function sevenDaysAgo(): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return Timestamp.fromDate(d);
}

export async function getPlatformAnalytics(): Promise<PlatformAnalytics> {
  if (!isFirebaseConfigured()) {
    return {
      totalMatches: 0,
      activePlayers30d: 0,
      matchesLast30d: 0,
      matchesByDay: [],
      openChallenges: 0,
      totalFollows: 0,
      upcomingRsvps: 0,
      activeLeagues: 0,
    };
  }

  const cutoff30 = thirtyDaysAgo();
  const cutoff7 = sevenDaysAgo();

  const [
    totalMatchesSnap,
    recentEventsSnap,
    challengesSnap,
    followsSnap,
    rsvpSnap,
    leaguesSnap,
  ] = await Promise.all([
    getDocs(query(collection(db(), COLLECTIONS.eloEvents), limit(1000))),
    getDocs(
      query(
        collection(db(), COLLECTIONS.eloEvents),
        where("createdAt", ">=", cutoff30),
        orderBy("createdAt", "desc"),
        limit(500),
      ),
    ),
    getDocs(
      query(
        collection(db(), COLLECTIONS.playerChallenges),
        where("status", "==", "PENDING"),
      ),
    ),
    getDocs(query(collection(db(), COLLECTIONS.playerFollows), limit(1000))),
    getDocs(
      query(
        collection(db(), COLLECTIONS.playDateRsvps),
        where("attending", "==", true),
      ),
    ),
    getDocs(
      query(
        collection(db(), COLLECTIONS.leagues),
        where("status", "==", "active"),
      ),
    ),
  ]);

  // Active players = distinct playerIds in last 30 days
  const activePlayerIds = new Set<string>();
  const dayCounts = new Map<string, number>();

  for (const doc of recentEventsSnap.docs) {
    const data = doc.data();
    if (data.playerId) activePlayerIds.add(data.playerId as string);

    // Bucket by day label (last 7 days)
    const ts: Timestamp | undefined = data.createdAt as Timestamp | undefined;
    if (ts) {
      const date = ts.toDate();
      const sevenAgo = sevenDaysAgo().toDate();
      if (date >= sevenAgo) {
        const label = date.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
        dayCounts.set(label, (dayCounts.get(label) ?? 0) + 1);
      }
    }
  }

  // Build 7-day array sorted chronologically
  const matchesByDay = buildLastNDays(7).map((label) => ({
    label,
    count: dayCounts.get(label) ?? 0,
  }));

  return {
    totalMatches: totalMatchesSnap.size,
    activePlayers30d: activePlayerIds.size,
    matchesLast30d: recentEventsSnap.size,
    matchesByDay,
    openChallenges: challengesSnap.size,
    totalFollows: followsSnap.size,
    upcomingRsvps: rsvpSnap.size,
    activeLeagues: leaguesSnap.size,
  };
}

function buildLastNDays(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(
      d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" }),
    );
  }
  return days;
}
