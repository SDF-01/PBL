"use client";

// TODO: These operations should migrate to a Firebase Cloud Function once one
// is deployed. For now they run client-side, protected by Firestore security
// rules that require `users/{uid}.role == "SITE_ADMIN"` on the caller.
// This matches the same pattern used by approveClub() / rejectClub() in
// src/lib/permissions/write.ts.

import {
  collection,
  deleteDoc,
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
import type { UserRole } from "@/lib/firestore/types";
import type { RoleKey } from "@/lib/permissions/types";

// Maps the legacy UserRole enum to the modern RoleKey used in the userRoles collection.
const USER_ROLE_TO_ROLE_KEY: Record<UserRole, RoleKey> = {
  PLAYER:             "Player",
  LEAGUE_COORDINATOR: "LeagueCoordinator",
  CLUB_ADMIN:         "ClubDirector",
  SITE_ADMIN:         "SiteAdmin",
};

/**
 * Promote or demote a user's global role.
 *
 * Atomically:
 *  1. Updates users/{uid}.role (for Firestore rule checks and display)
 *  2. Deactivates all existing global (non-scoped) userRoles entries for the user
 *  3. Creates a new active userRoles entry for the new role
 *  4. Appends a roleEvents entry for the audit trail
 */
export async function setUserRoleWithAudit(
  targetUid: string,
  newRole: UserRole,
  previousRole: UserRole,
  adminUid: string,
): Promise<void> {
  const database = db();

  // Find existing global (clubId === null) active roles for this user.
  const globalRolesSnap = await getDocs(
    query(
      collection(database, COLLECTIONS.userRoles),
      where("userId", "==", targetUid),
      where("active", "==", true),
      where("clubId", "==", null),
    ),
  );

  const batch = writeBatch(database);

  // 1. Update primary role field on the user document.
  batch.update(doc(database, COLLECTIONS.users, targetUid), {
    role: newRole,
    updatedAt: serverTimestamp(),
  });

  // 2. Deactivate all existing global role entries.
  for (const d of globalRolesSnap.docs) {
    batch.update(d.ref, { active: false });
  }

  // 3. Create the new global role entry.
  const newRoleRef = doc(collection(database, COLLECTIONS.userRoles));
  batch.set(newRoleRef, {
    userId: targetUid,
    roleId: USER_ROLE_TO_ROLE_KEY[newRole] satisfies RoleKey,
    clubId: null,
    leagueId: null,
    assignedAt: serverTimestamp(),
    assignedBy: adminUid,
    active: true,
  });

  // 4. Append audit entry to roleEvents (append-only — rules deny update/delete).
  const eventRef = doc(collection(database, COLLECTIONS.roleEvents));
  batch.set(eventRef, {
    userId: targetUid,
    clubId: null,
    leagueId: null,
    eventType: "RoleAssigned",
    oldRoleId: USER_ROLE_TO_ROLE_KEY[previousRole] satisfies RoleKey,
    newRoleId: USER_ROLE_TO_ROLE_KEY[newRole] satisfies RoleKey,
    eventTimestamp: serverTimestamp(),
    notes: `Role changed from ${previousRole} to ${newRole} by admin ${adminUid}.`,
  });

  await batch.commit();
}

/** Soft-delete: mark club as archived and write an audit entry. */
export async function archiveClub(
  clubId: string,
  clubName: string,
  adminUid: string,
): Promise<void> {
  const database = db();
  const batch = writeBatch(database);

  batch.update(doc(database, COLLECTIONS.clubs, clubId), {
    status: "archived",
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(collection(database, COLLECTIONS.auditLog)), {
    actionType: "ClubArchived",
    performedByUserId: adminUid,
    targetType: "club",
    targetId: clubId,
    targetDisplayName: clubName,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Hard-delete: remove the club document, deactivate all associated role
 * assignments, and write an audit entry. Leagues and memberships are left
 * intact for historical reference.
 */
export async function deleteClub(
  clubId: string,
  clubName: string,
  adminUid: string,
): Promise<void> {
  const database = db();

  // Fetch all active userRoles scoped to this club.
  const rolesSnap = await getDocs(
    query(
      collection(database, COLLECTIONS.userRoles),
      where("clubId", "==", clubId),
      where("active", "==", true),
    ),
  );

  const batch = writeBatch(database);

  // Deactivate every club-scoped role.
  for (const d of rolesSnap.docs) {
    batch.update(d.ref, { active: false });
  }

  // Write audit entry before deleting so the record exists.
  batch.set(doc(collection(database, COLLECTIONS.auditLog)), {
    actionType: "ClubDeleted",
    performedByUserId: adminUid,
    targetType: "club",
    targetId: clubId,
    targetDisplayName: clubName,
    createdAt: serverTimestamp(),
  });

  await batch.commit();

  // Delete the club document last (outside the batch to avoid size limits).
  await deleteDoc(doc(database, COLLECTIONS.clubs, clubId));
}

/**
 * Write a generic admin audit log entry to the auditLog collection.
 * Use this for actions that don't fit the roleEvents schema.
 */
export interface AdminAuditEntry {
  actionType: string;
  performedByUserId: string;
  targetType: string;
  targetId: string;
  targetDisplayName?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export async function writeAdminAuditLog(entry: AdminAuditEntry): Promise<void> {
  const ref = doc(collection(db(), COLLECTIONS.auditLog));
  const batch = writeBatch(db());
  batch.set(ref, {
    ...entry,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}
