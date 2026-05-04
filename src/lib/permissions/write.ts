// TODO: approveClub, rejectClub, assignRole, and deactivateUserRole should
// migrate to Firebase Cloud Functions once one is deployed. For now they run
// client-side, protected by Firestore security rules that require
// users/{uid}.role == "SITE_ADMIN" on the caller — same pattern as admin/write.ts.

import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import type { CreateClubInput, RoleKey } from "./types";

// Maps roleId → the legacy users/{uid}.role string recognised by Firestore rules.
const ROLE_KEY_TO_LEGACY: Partial<Record<RoleKey, string>> = {
  SiteAdmin:          "SITE_ADMIN",
  ClubDirector:       "CLUB_ADMIN",
  LeagueCoordinator:  "LEAGUE_COORDINATOR",
};

export async function submitClubCreation(
  userId: string,
  input: CreateClubInput,
): Promise<string> {
  const database = db();
  const batch = writeBatch(database);

  const clubRef = doc(collection(database, COLLECTIONS.clubs));
  batch.set(clubRef, {
    clubName: input.clubName,
    location: input.location,
    description: input.description,
    logoUrl: input.logoUrl ?? null,
    status: "pending",
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Provisional role lets the submitter edit their pending club while it awaits review.
  const roleRef = doc(collection(database, COLLECTIONS.userRoles));
  batch.set(roleRef, {
    userId,
    roleId: "ClubCreatorProvisional" as RoleKey,
    clubId: clubRef.id,
    leagueId: null,
    assignedAt: serverTimestamp(),
    assignedBy: null,
    active: true,
  });

  await batch.commit();
  return clubRef.id;
}

export async function updateClubSubmission(
  clubId: string,
  data: Partial<CreateClubInput>,
): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.clubs, clubId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function approveClub(
  clubId: string,
  adminUserId: string,
  creatorUserId: string,
): Promise<void> {
  const database = db();

  const provisionalSnap = await getDocs(
    query(
      collection(database, COLLECTIONS.userRoles),
      where("userId", "==", creatorUserId),
      where("roleId", "==", "ClubCreatorProvisional"),
      where("clubId", "==", clubId),
      where("active", "==", true),
    ),
  );

  const batch = writeBatch(database);

  batch.update(doc(database, COLLECTIONS.clubs, clubId), {
    status: "approved",
    updatedAt: serverTimestamp(),
  });

  for (const d of provisionalSnap.docs) {
    batch.update(d.ref, { active: false });
  }

  const directorRef = doc(collection(database, COLLECTIONS.userRoles));
  batch.set(directorRef, {
    userId: creatorUserId,
    roleId: "ClubDirector" as RoleKey,
    clubId,
    leagueId: null,
    assignedAt: serverTimestamp(),
    assignedBy: adminUserId,
    active: true,
  });

  // Elevate primary role so Firestore rules recognise the new privilege level.
  batch.update(doc(database, COLLECTIONS.users, creatorUserId), {
    role: "CLUB_ADMIN",
    updatedAt: serverTimestamp(),
  });

  const eventRef = doc(collection(database, COLLECTIONS.roleEvents));
  batch.set(eventRef, {
    userId: creatorUserId,
    clubId,
    leagueId: null,
    eventType: "ClubApproved",
    oldRoleId: "ClubCreatorProvisional" as RoleKey,
    newRoleId: "ClubDirector" as RoleKey,
    eventTimestamp: serverTimestamp(),
    notes: "Club approval promoted user to ClubDirector.",
  });

  const notifRef = doc(collection(database, COLLECTIONS.notifications));
  batch.set(notifRef, {
    userId: creatorUserId,
    title: "Club Approved",
    body: "Your club has been approved. You are now a Club Director.",
    href: "/clubs/my",
    kind: "GENERAL",
    read: false,
    createdAt: serverTimestamp(),
    createdBy: adminUserId,
  });

  await batch.commit();
}

export async function rejectClub(
  clubId: string,
  adminUserId: string,
  creatorUserId: string,
  notes?: string,
): Promise<void> {
  const database = db();

  const provisionalSnap = await getDocs(
    query(
      collection(database, COLLECTIONS.userRoles),
      where("userId", "==", creatorUserId),
      where("roleId", "==", "ClubCreatorProvisional"),
      where("clubId", "==", clubId),
      where("active", "==", true),
    ),
  );

  const batch = writeBatch(database);

  batch.update(doc(database, COLLECTIONS.clubs, clubId), {
    status: "rejected",
    updatedAt: serverTimestamp(),
  });

  for (const d of provisionalSnap.docs) {
    batch.update(d.ref, { active: false });
  }

  const eventRef = doc(collection(database, COLLECTIONS.roleEvents));
  batch.set(eventRef, {
    userId: creatorUserId,
    clubId,
    leagueId: null,
    eventType: "ClubRejected",
    oldRoleId: "ClubCreatorProvisional" as RoleKey,
    newRoleId: null,
    eventTimestamp: serverTimestamp(),
    notes: notes ?? "Club proposal rejected. User remains Player.",
  });

  const notifRef = doc(collection(database, COLLECTIONS.notifications));
  batch.set(notifRef, {
    userId: creatorUserId,
    title: "Club Not Approved",
    body: "Your club proposal was not approved. You remain a Player.",
    href: "/clubs/my",
    kind: "GENERAL",
    read: false,
    createdAt: serverTimestamp(),
    createdBy: adminUserId,
  });

  await batch.commit();
}

export async function assignRole(
  userId: string,
  roleId: RoleKey,
  clubId: string | null,
  leagueId: string | null,
  assignedBy: string,
): Promise<void> {
  const database = db();
  const batch = writeBatch(database);

  const roleRef = doc(collection(database, COLLECTIONS.userRoles));
  batch.set(roleRef, {
    userId,
    roleId,
    clubId,
    leagueId,
    assignedAt: serverTimestamp(),
    assignedBy,
    active: true,
  });

  // Keep users/{uid}.role in sync so Firestore security rules recognise the
  // new privilege level (rules check userRole() which reads this field).
  const legacyRole = ROLE_KEY_TO_LEGACY[roleId];
  if (legacyRole) {
    batch.update(doc(database, COLLECTIONS.users, userId), {
      role: legacyRole,
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

export async function deactivateUserRole(userRoleId: string): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.userRoles, userRoleId), { active: false });
}
