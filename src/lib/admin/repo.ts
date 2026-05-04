"use client";

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import type { RoleEventDoc } from "@/lib/permissions/types";

export interface AdminStats {
  pendingClubs: number;
  approvedClubs: number;
  rejectedClubs: number;
  totalUsers: number;
  elevatedUsers: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  if (!isFirebaseConfigured()) {
    return { pendingClubs: 0, approvedClubs: 0, rejectedClubs: 0, totalUsers: 0, elevatedUsers: 0 };
  }

  const [pendingSnap, approvedSnap, rejectedSnap, usersSnap, elevatedSnap] =
    await Promise.all([
      getDocs(query(collection(db(), COLLECTIONS.clubs), where("status", "==", "pending"))),
      getDocs(query(collection(db(), COLLECTIONS.clubs), where("status", "==", "approved"))),
      getDocs(query(collection(db(), COLLECTIONS.clubs), where("status", "==", "rejected"))),
      getDocs(collection(db(), COLLECTIONS.users)),
      getDocs(query(collection(db(), COLLECTIONS.users), where("role", "!=", "PLAYER"))),
    ]);

  return {
    pendingClubs: pendingSnap.size,
    approvedClubs: approvedSnap.size,
    rejectedClubs: rejectedSnap.size,
    totalUsers: usersSnap.size,
    elevatedUsers: elevatedSnap.size,
  };
}

export async function listRecentRoleEvents(maxItems = 10): Promise<RoleEventDoc[]> {
  if (!isFirebaseConfigured()) return [];
  const q = query(
    collection(db(), COLLECTIONS.roleEvents),
    orderBy("eventTimestamp", "desc"),
    limit(maxItems),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RoleEventDoc);
}
