// Privileged role writes (approveClub, rejectClub, assignRole,
// deactivateUserRole) are routed through Cloud Functions for transactional
// safety, server-side validation, custom-claim provisioning, and
// authoritative audit writes. Self-service writes (submitClubCreation,
// updateClubSubmission) remain client-side because Firestore rules already
// gate them on the caller's uid.

import {
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import {
  callApproveClub,
  callRejectClub,
  callAssignRole,
  callDeactivateUserRole,
  callNotifyAdminsOfClubSubmission,
} from "@/lib/functions/callables";
import type { CreateClubInput, RoleKey } from "./types";

export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
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
    memberIds: [userId],
    followerIds: [],
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

  // Fire-and-forget — notification failure must not break the submission.
  callNotifyAdminsOfClubSubmission({ clubId: clubRef.id, clubName: input.clubName }).catch(
    () => {},
  );

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
  creatorUserId: string,
): Promise<void> {
  await callApproveClub({ clubId, creatorUserId });
}

export async function rejectClub(
  clubId: string,
  creatorUserId: string,
  notes: string,
): Promise<void> {
  await callRejectClub({ clubId, creatorUserId, notes });
}

export async function assignRole(
  userId: string,
  roleId: RoleKey,
  clubId: string | null,
  leagueId: string | null,
): Promise<void> {
  await callAssignRole({ userId, roleId, clubId, leagueId });
}

export async function deactivateUserRole(userRoleId: string): Promise<void> {
  await callDeactivateUserRole({ userRoleId });
}
