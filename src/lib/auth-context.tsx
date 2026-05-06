"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  unlink,
  updatePassword,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
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
  linkGoogle: () => Promise<void>;
  unlinkGoogle: () => Promise<void>;
  setOrUpdatePassword: (newPassword: string, currentPassword?: string) => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  ready: false,
  signIn: async () => {},
  signOut: async () => {},
  signUpWithEmail: async () => {},
  signInWithEmail: async () => {},
  linkGoogle: async () => {},
  unlinkGoogle: async () => {},
  setOrUpdatePassword: async () => {},
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
        try {
          const userRef = doc(db(), COLLECTIONS.users, u.uid);
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            // First sign-in (Google or any provider) — write the full initial document.
            const role: UserRole = "PLAYER";
            const accountStatus: AccountStatus = "ACTIVE";
            await setDoc(userRef, {
              uid: u.uid,
              email: u.email ?? "",
              firstName: "",
              lastName: "",
              displayName: u.displayName ?? u.email ?? "Player",
              phoneNumber: null,
              photoURL: u.photoURL ?? null,
              role,
              accountStatus,
              clubId: null,
              leagueIds: [],
              startingSkillRating: null,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            const data = snap.data() as Record<string, unknown>;
            // Always refresh mutable auth fields.
            const patch: Record<string, unknown> = {
              email: u.email ?? "",
              displayName: u.displayName ?? u.email ?? "Player",
              photoURL: u.photoURL ?? null,
              updatedAt: serverTimestamp(),
            };
            // Backfill schema fields that older / Google-auth documents may be missing.
            if (data.uid === undefined) patch.uid = u.uid;
            if (data.accountStatus === undefined) {
              patch.accountStatus = "ACTIVE" as AccountStatus;
            }
            if (data.clubId === undefined) patch.clubId = null;
            if (data.leagueIds === undefined) patch.leagueIds = [];
            if (data.phoneNumber === undefined) patch.phoneNumber = null;
            if (data.startingSkillRating === undefined) patch.startingSkillRating = null;
            if (data.createdAt === undefined) patch.createdAt = serverTimestamp();
            if (data.firstName === undefined || data.lastName === undefined) {
              const parts = (u.displayName ?? "").trim().split(/\s+/);
              if (data.firstName === undefined) patch.firstName = parts[0] ?? "";
              if (data.lastName === undefined) patch.lastName = parts.slice(1).join(" ");
            }
            await setDoc(userRef, patch, { merge: true });
          }
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
      const result = await signInWithPopup(auth(), provider);
      if (result?.user && typeof window !== "undefined") {
        window.location.replace(`/players/view?uid=${result.user.uid}`);
      }
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
    linkGoogle: async () => {
      const current = auth().currentUser;
      if (!current) throw new Error("You must be signed in to link Google.");
      await linkWithPopup(current, new GoogleAuthProvider());
      // Refresh local user reference so UI reflects new providerData.
      setUser(auth().currentUser);
    },
    unlinkGoogle: async () => {
      const current = auth().currentUser;
      if (!current) throw new Error("You must be signed in.");
      const hasPassword = current.providerData.some(
        (p) => p.providerId === "password",
      );
      if (!hasPassword) {
        throw new Error(
          "Set a password before unlinking Google so you can still sign in.",
        );
      }
      await unlink(current, GoogleAuthProvider.PROVIDER_ID);
      setUser(auth().currentUser);
    },
    setOrUpdatePassword: async (newPassword: string, currentPassword?: string) => {
      const current = auth().currentUser;
      if (!current) throw new Error("You must be signed in.");
      const email = current.email;
      const hasPassword = current.providerData.some(
        (p) => p.providerId === "password",
      );

      if (!hasPassword) {
        if (!email) {
          throw new Error(
            "Your account has no email address; cannot add a password sign-in.",
          );
        }
        const credential = EmailAuthProvider.credential(email, newPassword);
        await linkWithCredential(current, credential);
      } else {
        // Reauthenticate before updating password (Firebase requires recent login).
        if (currentPassword && email) {
          const credential = EmailAuthProvider.credential(email, currentPassword);
          await reauthenticateWithCredential(current, credential);
        } else {
          // Fall back to Google reauth if no current password was provided.
          const hasGoogle = current.providerData.some(
            (p) => p.providerId === GoogleAuthProvider.PROVIDER_ID,
          );
          if (!hasGoogle) {
            throw new Error("Current password is required.");
          }
          await reauthenticateWithPopup(current, new GoogleAuthProvider());
        }
        await updatePassword(current, newPassword);
      }
      setUser(auth().currentUser);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  return useContext(Ctx);
}
