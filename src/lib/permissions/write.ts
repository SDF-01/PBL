// TODO: approveClub, rejectClub, assignRole, and deactivateUserRole should
// migrate to Firebase Cloud Functions once one is deployed. For now they run
// client-side, protected by Firestore security rules that require
// users/{uid}.role == "SITE_ADMIN" on the caller — same pattern as admin/write.ts.

import {
  addDoc,
  collection,
  doc,
  getDoc,
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

export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Maps roleId → the legacy users/{uid}.role string recognised by Firestore rules.
const ROLE_KEY_TO_LEGACY: Partial<Record<RoleKey, string>> = {
  SiteAdmin:          "SITE_ADMIN",
  ClubDirector:       "CLUB_ADMIN",
  LeagueCoordinator:  "LEAGUE_COORDINATOR",
};

// Higher number = higher privilege. Used to prevent accidental downgrades.
const LEGACY_ROLE_RANK: Record<string, number> = {
  SITE_ADMIN:         4,
  CLUB_ADMIN:         3,
  LEAGUE_COORDINATOR: 2,
  PLAYER:             1,
};

/** Returns true only if newRole outranks the currentRole (safe to write). */
function outranks(newRole: string, currentRole: string | null | undefined): boolean {
  return (LEGACY_ROLE_RANK[newRole] ?? 0) > (LEGACY_ROLE_RANK[currentRole ?? ""] ?? 0);
}

export async function submitClubCreation(
  userId: string,
  input: CreateClubInput,
): Promise<string> {
  const database = db();
  const batch = writeBatch(database);

  const clubRef = doc(collection(database, COLLECTIONS.clubs));
  batch.set(clubRef, {
    clubName: input.clubName,
    slug: toSlug(input.clubName),
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

  const [provisionalSnap, creatorSnap] = await Promise.all([
    getDocs(
      query(
        collection(database, COLLECTIONS.userRoles),
        where("userId", "==", creatorUserId),
        where("roleId", "==", "ClubCreatorProvisional"),
        where("clubId", "==", clubId),
        where("active", "==", true),
      ),
    ),
    getDoc(doc(database, COLLECTIONS.users, creatorUserId)),
  ]);

  const creatorCurrentRole = creatorSnap.exists()
    ? (creatorSnap.data() as { role?: string }).role
    : null;

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

  // Only elevate the primary role field — never overwrite a higher privilege level.
  if (outranks("CLUB_ADMIN", creatorCurrentRole)) {
    batch.update(doc(database, COLLECTIONS.users, creatorUserId), {
      role: "CLUB_ADMIN",
      updatedAt: serverTimestamp(),
    });
  }

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

  const legacyRole = ROLE_KEY_TO_LEGACY[roleId];
  const currentSnap = legacyRole
    ? await getDoc(doc(database, COLLECTIONS.users, userId))
    : null;
  const currentRole = currentSnap?.exists()
    ? (currentSnap.data() as { role?: string }).role
    : null;

  const batch = writeBatch(database);

  batch.set(doc(collection(database, COLLECTIONS.userRoles)), {
    userId,
    roleId,
    clubId,
    leagueId,
    assignedAt: serverTimestamp(),
    assignedBy,
    active: true,
  });

  // Only update users/{uid}.role if the new role outranks the current one.
  if (legacyRole && outranks(legacyRole, currentRole)) {
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
