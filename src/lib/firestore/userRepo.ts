"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import type { UserProfile, UserRole } from "@/lib/firestore/types";

export async function getUserRole(uid: string): Promise<UserRole | null> {
  const snap = await getDoc(doc(db(), COLLECTIONS.users, uid));
  if (!snap.exists()) return null;
  return (snap.data() as UserProfile).role ?? null;
}

function timestampMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }
  return 0;
}

export async function listAllUsers(limitCount?: number | null): Promise<UserProfile[]> {
  const constraints: QueryConstraint[] = [];
  if (limitCount != null) constraints.push(limit(limitCount));

  const snap = await getDocs(query(collection(db(), COLLECTIONS.users), ...constraints));
  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() }) as UserProfile)
    .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
}

export async function setUserRole(uid: string, role: UserRole): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.users, uid), {
    role,
    updatedAt: serverTimestamp(),
  });
}
