import { collection, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import type { ClubDoc, ClubFacility } from "@/lib/permissions/types";
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

export async function getClubFacility(clubId: string): Promise<ClubFacility | null> {
  if (!isFirebaseConfigured()) return null;
  const snap = await getDoc(doc(db(), COLLECTIONS.clubFacilities, clubId));
  return snap.exists() ? (snap.data() as ClubFacility) : null;
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

export async function listUserClubs(userId: string): Promise<ClubDoc[]> {
  if (!isFirebaseConfigured()) return [];
  const q = query(
    collection(db(), COLLECTIONS.clubs),
    where("createdBy", "==", userId),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
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
  const followSnap = await getDocs(
    query(
      collection(db(), COLLECTIONS.clubFollowers),
      where("userId", "==", userId),
      orderBy("followedAt", "desc"),
    ),
  );
  if (followSnap.empty) return [];
  const clubIds = followSnap.docs.map((d) => d.data().clubId as string);
  const clubs = await Promise.all(clubIds.map((id) => getClubById(id)));
  return clubs.filter((c): c is ClubDoc => c !== null);
}
