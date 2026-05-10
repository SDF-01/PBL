"use client";

// archiveClub, deleteClub, and writeAdminAuditLog are still client-side and
// gated by Firestore rules requiring SITE_ADMIN. They should migrate to
// Cloud Functions in a follow-up pass.
//
// setUserRoleWithAudit is routed through the setUserGlobalRole callable so
// that the user's custom claim is updated in lockstep with the userRoles /
// users.role writes.

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import { callSetUserGlobalRole } from "@/lib/functions/callables";
import type { UserRole } from "@/lib/firestore/types";

/**
 * Promote or demote a user's global role. Routes through the
 * setUserGlobalRole Cloud Function which updates the custom claim,
 * mirrors users/{uid}.role, swaps the active global userRoles entry,
 * and writes the roleEvents audit row in one transaction.
 */
export async function setUserRoleWithAudit(
  targetUid: string,
  newRole: UserRole,
): Promise<void> {
  await callSetUserGlobalRole({ userId: targetUid, newRole });
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
