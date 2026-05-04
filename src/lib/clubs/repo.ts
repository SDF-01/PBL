import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import type { ClubDoc } from "@/lib/permissions/types";

export async function listUserClubs(userId: string): Promise<ClubDoc[]> {
  if (!isFirebaseConfigured()) return [];
  const q = query(
    collection(db(), COLLECTIONS.clubs),
    where("creatorUserId", "==", userId),
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
