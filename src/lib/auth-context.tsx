"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./firebase";
import { COLLECTIONS } from "./firestore/collections";

interface AuthCtx {
  user: User | null;
  ready: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  ready: false,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setReady(true);
      return;
    }
    const unsub = onAuthStateChanged(auth(), async (u) => {
      setUser(u);
      setReady(true);
      if (u) {
        // Upsert user profile (fire-and-forget; rules allow self-write).
        try {
          await setDoc(
            doc(db(), COLLECTIONS.users, u.uid),
            {
              email: u.email ?? "",
              displayName: u.displayName ?? u.email ?? "Player",
              photoURL: u.photoURL ?? null,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        } catch {
          // Non-fatal: profile may not be writable yet.
        }
      }
    });
    return () => unsub();
  }, []);

  const value: AuthCtx = {
    user,
    ready,
    signIn: async () => {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth(), provider);
    },
    signOut: async () => {
      await fbSignOut(auth());
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  return useContext(Ctx);
}
