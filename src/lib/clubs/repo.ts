import { collection, doc, documentId, getCountFromServer, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import type { ClubDoc, ClubFacility, ClubPost } from "@/lib/permissions/types";
import type { LeagueDoc } from "@/lib/firestore/types";

export async function getClubById(clubId: string): Promise<ClubDoc | null> {
  if (!isFirebaseConfigured()) return null;
  const snap = await getDoc(doc(db(), COLLECTIONS.clubs, clubId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as ClubDoc) : null;
}

export async function getClubBySlug(slug: string): Promise<ClubDoc | null> {
  if (!isFirebaseConfigured()) return null;
  const snap = await getDocs(
    query(collection(db(), COLLECTIONS.clubs), where("slug", "==", slug), limit(1)),
  );
  if (snap.empty) return null;
  const d = snap.docs[0]!;
  return { id: d.id, ...d.data() } as ClubDoc;
}

export async function listClubLeagues(clubId: string): Promise<LeagueDoc[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.leagues),
      where("clubId", "==", clubId),
      orderBy("createdAt", "desc"),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LeagueDoc);
}

export interface CoordinatorEntry {
  userRoleId: string;
  userId: string;
  displayName?: string;
  assignedAt: string;
}

export async function listClubCoordinators(clubId: string): Promise<CoordinatorEntry[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.userRoles),
      where("clubId", "==", clubId),
      where("roleId", "==", "LeagueCoordinator"),
      where("active", "==", true),
    ),
  );
  const entries = snap.docs.map((d) => ({
    userRoleId: d.id,
    userId: d.data().userId as string,
    displayName: undefined as string | undefined,
    assignedAt: d.data().assignedAt as string,
  }));
  await Promise.all(
    entries.map(async (e) => {
      const userSnap = await getDoc(doc(db(), COLLECTIONS.users, e.userId));
      if (userSnap.exists()) {
        e.displayName = (userSnap.data().displayName ?? userSnap.data().email ?? e.userId) as string;
      }
    }),
  );
  return entries;
}

export async function countClubPlayers(leagueIds: string[]): Promise<number> {
  if (!isFirebaseConfigured() || leagueIds.length === 0) return 0;
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.leagueMemberships),
      where("leagueId", "in", leagueIds.slice(0, 30)),
    ),
  );
  const unique = new Set(snap.docs.map((d) => d.data().userId as string));
  return unique.size;
}

/** List all facilities for a club (multi-facility model). */
export async function listClubFacilities(clubId: string): Promise<ClubFacility[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocs(
    query(collection(db(), COLLECTIONS.clubFacilities), where("clubId", "==", clubId)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClubFacility);
}

/** @deprecated Use listClubFacilities. Kept for backward compat with single-facility reads. */
export async function getClubFacility(clubId: string): Promise<ClubFacility | null> {
  if (!isFirebaseConfigured()) return null;
  const facilities = await listClubFacilities(clubId);
  return facilities[0] ?? null;
}

// ── Club posts ─────────────────────────────────────────────────────────────

/** List recent posts for a single club, newest first. */
export async function listClubPosts(clubId: string, limitN = 20): Promise<ClubPost[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.clubPosts),
      where("clubId", "==", clubId),
      orderBy("createdAt", "desc"),
      limit(limitN),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClubPost);
}

/** List recent posts for a set of clubs (player feed). Up to 10 club IDs. */
export async function listFeedPosts(clubIds: string[], limitN = 20): Promise<ClubPost[]> {
  if (!isFirebaseConfigured() || clubIds.length === 0) return [];
  const ids = clubIds.slice(0, 10);
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.clubPosts),
      where("clubId", "in", ids),
      limit(limitN),
    ),
  );
  const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClubPost);
  // Sort newest first client-side (avoids composite index requirement).
  posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return posts;
}

export async function getUserByEmail(
  email: string,
): Promise<{ uid: string; displayName: string; email: string } | null> {
  if (!isFirebaseConfigured()) return null;
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.users),
      where("email", "==", email.toLowerCase().trim()),
      limit(1),
    ),
  );
  if (snap.empty) return null;
  const d = snap.docs[0]!;
  return {
    uid: d.id,
    displayName: (d.data().displayName ?? d.data().email ?? d.id) as string,
    email: d.data().email as string,
  };
}

/**
 * Clubs where the user has an active league membership (joined via joinLeague).
 * These are distinct from role-based memberIds — a regular player who joins a league
 * lands here but not in listUserClubs.
 */
export async function listClubsByLeagueMembership(userId: string): Promise<ClubDoc[]> {
  if (!isFirebaseConfigured()) return [];

  // Step 1: all memberships for this user (filter active/waitlisted client-side)
  const memberSnap = await getDocs(
    query(collection(db(), COLLECTIONS.leagueMemberships), where("userId", "==", userId)),
  );
  const activeLeagueIds = [
    ...new Set(
      memberSnap.docs
        .filter((d) => {
          const s = d.data().status as string;
          return s === "active" || s === "waitlisted";
        })
        .map((d) => d.data().leagueId as string),
    ),
  ];
  if (activeLeagueIds.length === 0) return [];

  // Step 2: fetch leagues in chunks of 10 to collect clubIds
  const clubIds = new Set<string>();
  for (let i = 0; i < activeLeagueIds.length; i += 10) {
    const batch = activeLeagueIds.slice(i, i + 10);
    const leagueSnap = await getDocs(
      query(collection(db(), COLLECTIONS.leagues), where(documentId(), "in", batch)),
    );
    leagueSnap.docs.forEach((d) => {
      const cId = d.data().clubId as string | undefined;
      if (cId) clubIds.add(cId);
    });
  }
  if (clubIds.size === 0) return [];

  // Step 3: fetch clubs in chunks of 10
  const clubs: ClubDoc[] = [];
  const clubIdArr = [...clubIds];
  for (let i = 0; i < clubIdArr.length; i += 10) {
    const batch = clubIdArr.slice(i, i + 10);
    const clubSnap = await getDocs(
      query(collection(db(), COLLECTIONS.clubs), where(documentId(), "in", batch)),
    );
    clubSnap.docs.forEach((d) => clubs.push({ id: d.id, ...d.data() } as ClubDoc));
  }
  return clubs;
}

export async function listUserClubs(userId: string): Promise<ClubDoc[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.clubs),
      where("memberIds", "array-contains", userId),
      orderBy("createdAt", "desc"),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClubDoc);
}

export async function listPendingClubs(): Promise<ClubDoc[]> {
  if (!isFirebaseConfigured()) return [];
  const q = query(
    collection(db(), COLLECTIONS.clubs),
    where("status", "==", "pending"),
    orderBy("createdAt", "asc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClubDoc);
}

export async function listApprovedClubs(): Promise<ClubDoc[]> {
  if (!isFirebaseConfigured()) return [];
  const q = query(
    collection(db(), COLLECTIONS.clubs),
    where("status", "==", "approved"),
    orderBy("clubName", "asc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClubDoc);
}

export async function listArchivedClubs(): Promise<ClubDoc[]> {
  if (!isFirebaseConfigured()) return [];
  const q = query(
    collection(db(), COLLECTIONS.clubs),
    where("status", "==", "archived"),
    orderBy("clubName", "asc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClubDoc);
}

/** Returns true if the given user is following the club. O(1) doc read. */
export async function isFollowingClub(userId: string, clubId: string): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  const snap = await getDoc(doc(db(), COLLECTIONS.clubFollowers, `${userId}_${clubId}`));
  return snap.exists();
}

/** Total follower count for a club. */
export async function getClubFollowerCount(clubId: string): Promise<number> {
  if (!isFirebaseConfigured()) return 0;
  const snap = await getCountFromServer(
    query(collection(db(), COLLECTIONS.clubFollowers), where("clubId", "==", clubId)),
  );
  return snap.data().count;
}

/** All clubs a user is following, ordered by follow date descending. */
export async function listFollowedClubs(userId: string): Promise<ClubDoc[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.clubs),
      where("followerIds", "array-contains", userId),
      orderBy("createdAt", "desc"),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClubDoc);
}
