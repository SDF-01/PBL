"use client";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { useEffect, useState } from "react";
import { auth, isFirebaseConfigured } from "./firebase";

export function useAuthUser(): { user: User | null; ready: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setReady(true);
      return;
    }
    const unsub = onAuthStateChanged(auth(), (u) => {
      setUser(u);
      setReady(true);
    });
    return () => unsub();
  }, []);

  return { user, ready };
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth(), new GoogleAuthProvider());
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth());
}
