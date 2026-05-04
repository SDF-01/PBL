"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./firebase";
import { COLLECTIONS } from "./firestore/collections";
import type { AccountStatus, UserRole } from "./firestore/types";

export interface EmailSignUpParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  startingSkillRating?: number | null;
}

interface AuthCtx {
  user: User | null;
  ready: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  signUpWithEmail: (params: EmailSignUpParams) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  ready: false,
  signIn: async () => {},
  signOut: async () => {},
  signUpWithEmail: async () => {},
  signInWithEmail: async () => {},
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
    signUpWithEmail: async ({
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      startingSkillRating,
    }: EmailSignUpParams) => {
      const credential = await createUserWithEmailAndPassword(auth(), email, password);
      const { user: newUser } = credential;
      const displayName = `${firstName.trim()} ${lastName.trim()}`;

      await updateProfile(newUser, { displayName });

      const role: UserRole = "PLAYER";
      const accountStatus: AccountStatus = "ACTIVE";

      await setDoc(doc(db(), COLLECTIONS.users, newUser.uid), {
        uid: newUser.uid,
        email: email.toLowerCase().trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName,
        phoneNumber: phoneNumber?.trim() || null,
        photoURL: null,
        role,
        accountStatus,
        clubId: null,
        leagueIds: [],
        startingSkillRating: startingSkillRating ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    signInWithEmail: async (email: string, password: string) => {
      await signInWithEmailAndPassword(auth(), email, password);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  return useContext(Ctx);
}
