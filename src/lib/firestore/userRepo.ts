"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import type { UserProfile, UserRole } from "@/lib/firestore/types";

export async function getUserRole(uid: string): Promise<UserRole | null> {
  const snap = await getDoc(doc(db(), COLLECTIONS.users, uid));
  if (!snap.exists()) return null;
  return (snap.data() as UserProfile).role ?? null;
}

export async function listAllUsers(limitCount = 100): Promise<UserProfile[]> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.users),
      orderBy("createdAt", "desc"),
      limit(limitCount),
    ),
  );
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as UserProfile);
}

export async function setUserRole(uid: string, role: UserRole): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.users, uid), {
    role,
    updatedAt: serverTimestamp(),
  });
}
