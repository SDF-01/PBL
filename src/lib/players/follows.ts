"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as qLimit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../firestore/collections";
import type { EloEventDoc } from "../firestore/types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PlayerFollowDoc {
  followerId: string;
  followedId: string;
  followerName?: string | null;
  createdAt: string;
}

/** One item in the activity feed: a match result from a followed player. */
export interface PlayerActivityItem {
  eloEventId: string;
  playerId: string;
  playerName: string;
  playerPhotoURL?: string;
  delta: number;
  eloBefore: number;
  eloAfter: number;
  won: boolean;
  source: string;
  pointsFor?: number;
  pointsAgainst?: number;
  createdAt: unknown; // Firestore Timestamp or ISO string
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function isFollowingPlayer(
  followerId: string,
  followedId: string,
): Promise<boolean> {
  const snap = await getDoc(
    doc(db(), COLLECTIONS.playerFollows, `${followerId}_${followedId}`),
  );
  return snap.exists();
}

export async function listFollowedPlayerIds(userId: string): Promise<string[]> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.playerFollows),
      where("followerId", "==", userId),
    ),
  );
  return snap.docs.map((d) => d.data().followedId as string);
}

export async function getPlayerFollowerIds(playerId: string): Promise<string[]> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.playerFollows),
      where("followedId", "==", playerId),
    ),
  );
  return snap.docs.map((d) => d.data().followerId as string);
}

export async function getPlayerFollowerCount(playerId: string): Promise<number> {
  const ids = await getPlayerFollowerIds(playerId);
  return ids.length;
}

/**
 * Fetch recent ELO events for a set of followed player IDs,
 * merge them, and sort chronologically descending.
 * Caps at 10 followed players and 20 total items to limit reads.
 */
export async function listFollowedActivity(
  followedIds: string[],
  maxPerPlayer = 5,
  maxTotal = 20,
): Promise<(EloEventDoc & { followedId: string })[]> {
  if (followedIds.length === 0) return [];

  const perPlayer = await Promise.all(
    followedIds.slice(0, 10).map(async (playerId) => {
      try {
        const snap = await getDocs(
          query(
            collection(db(), COLLECTIONS.eloEvents),
            where("playerId", "==", playerId),
            orderBy("createdAt", "desc"),
            qLimit(maxPerPlayer),
          ),
        );
        return snap.docs.map(
          (d) =>
            ({ id: d.id, ...d.data(), followedId: playerId }) as EloEventDoc & {
              followedId: string;
            },
        );
      } catch {
        return [];
      }
    }),
  );

  const all = perPlayer.flat();
  all.sort((a, b) => {
    const ms = (v: unknown): number => {
      if (v && typeof v === "object" && "toDate" in v)
        return (v as { toDate(): Date }).toDate().getTime();
      if (typeof v === "string") return new Date(v).getTime();
      return 0;
    };
    return ms(b.createdAt) - ms(a.createdAt);
  });
  return all.slice(0, maxTotal);
}

// ── Write ────────────────────────────────────────────────────────────────────

/**
 * Follow a player. Deterministic doc ID → idempotent re-follows.
 * Sends a PLAYER_FOLLOWED notification to the followed player.
 */
export async function followPlayer(
  followerId: string,
  followedId: string,
  followerName?: string,
  followedName?: string,
): Promise<void> {
  await setDoc(
    doc(db(), COLLECTIONS.playerFollows, `${followerId}_${followedId}`),
    {
      followerId,
      followedId,
      followerName: followerName ?? null,
      createdAt: serverTimestamp(),
    },
  );

  // Notify the followed player — best effort.
  try {
    const { notifyUser } = await import("../firestore/write");
    await notifyUser({
      userId: followedId,
      title: `${followerName ?? "Someone"} is now following you`,
      body: `${followerName ?? "A player"} started following your activity on the platform.`,
      href: `/players/view?uid=${followerId}`,
      kind: "PLAYER_FOLLOWED",
      createdBy: followerId,
    });
  } catch {
    // ignore — the follow relationship is already written
  }
}

export async function unfollowPlayer(
  followerId: string,
  followedId: string,
): Promise<void> {
  await deleteDoc(
    doc(db(), COLLECTIONS.playerFollows, `${followerId}_${followedId}`),
  );
}

// ── Fan-out notifications ─────────────────────────────────────────────────────

/**
 * For each player in a completed match, look up their followers and send
 * a PLAYER_MATCH_RESULT notification. Called best-effort from
 * applyMatchEloDeltas after the batch commits.
 */
export async function notifyFollowersOfMatch(
  players: Array<{
    userId: string;
    displayName: string;
    won: boolean;
    delta: number;
    eloAfter: number;
    pointsFor: number;
    pointsAgainst: number;
    source: string;
    sourceId: string;
  }>,
): Promise<void> {
  const { notifyMany } = await import("../firestore/write");

  await Promise.allSettled(
    players.map(async (p) => {
      const followerIds = await getPlayerFollowerIds(p.userId);
      if (followerIds.length === 0) return;

      const verb = p.won ? "won" : "lost";
      const scoreStr = `${p.pointsFor}–${p.pointsAgainst}`;
      const deltaStr = p.delta >= 0 ? `+${p.delta}` : String(p.delta);
      const sourceLabel =
        p.source === "ladderMatch" ? "ladder" : "tournament";

      await notifyMany(followerIds, {
        title: `${p.displayName} ${verb} a ${sourceLabel} match`,
        body: `${p.displayName} ${verb} ${scoreStr} · ELO ${deltaStr} → ${p.eloAfter}`,
        href: `/players/view?uid=${p.userId}`,
        kind: "PLAYER_MATCH_RESULT",
        createdBy: p.userId,
      });
    }),
  );
}
