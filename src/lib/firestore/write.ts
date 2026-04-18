// Firestore write helpers. All client-side; safe for static export.

"use client";

import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type FieldValue,
} from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "./collections";
import type {
  TournamentDoc,
  AnnouncementDoc,
  NotificationDoc,
} from "./types";

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Firestore rejects `undefined` field values — strip them before writes.
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

type NewTournament = Omit<TournamentDoc, "id"> & { createdBy: string };

export async function createTournament(input: NewTournament): Promise<string> {
  // Use slug as document id when provided so the URL is stable.
  const id = input.slug || slugify(input.name);
  await setDoc(doc(db(), COLLECTIONS.tournaments, id), stripUndefined({
    ...input,
    slug: id,
    createdAt: serverTimestamp(),
  }));
  return id;
}

export async function updateTournamentStatus(
  id: string,
  status: TournamentDoc["status"],
): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.tournaments, id), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function createAnnouncement(input: {
  orgId: string;
  title: string;
  body: string;
  kind?: AnnouncementDoc["kind"];
  createdBy: string;
}): Promise<string> {
  const ref = await addDoc(collection(db(), COLLECTIONS.announcements), {
    orgId: input.orgId,
    title: input.title,
    body: input.body,
    kind: input.kind ?? "GENERAL",
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

interface NewNotification {
  userId: string;
  title: string;
  body: string;
  href?: string;
  kind?: NotificationDoc["kind"];
  createdBy: string;
}

export async function notifyUser(input: NewNotification): Promise<string> {
  const ref = await addDoc(collection(db(), COLLECTIONS.notifications), {
    userId: input.userId,
    title: input.title,
    body: input.body,
    href: input.href ?? null,
    kind: input.kind ?? "GENERAL",
    read: false,
    createdBy: input.createdBy,
    createdAt: serverTimestamp() as FieldValue,
  });
  return ref.id;
}

/**
 * Send a notification to many users at once. Best-effort — failures for any
 * single recipient do not abort the rest.
 */
export async function notifyMany(
  userIds: string[],
  payload: Omit<NewNotification, "userId">,
): Promise<{ sent: number; failed: number }> {
  const results = await Promise.allSettled(
    userIds.map((userId) => notifyUser({ ...payload, userId })),
  );
  return {
    sent: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db(), COLLECTIONS.notifications, id), { read: true });
}
