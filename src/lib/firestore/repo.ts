// Typed Firestore read helpers. All client-side — safe for static export.
// Keep the query surface small; specific pages call these from `"use client"`
// components and render.

"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type QueryConstraint,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "./collections";
import type {
  AnnouncementDoc,
  BracketDoc,
  BracketNodeDoc,
  MatchDoc,
  MatchGameDoc,
  NotificationDoc,
  RegistrationDoc,
  TournamentDoc,
} from "./types";

async function getAll<T>(name: string, ...constraints: QueryConstraint[]): Promise<T[]> {
  const snap = await getDocs(query(collection(db(), name), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

export async function listTournaments(): Promise<TournamentDoc[]> {
  return getAll<TournamentDoc>(COLLECTIONS.tournaments, orderBy("startDate", "desc"), limit(50));
}

export async function getTournamentBySlug(slug: string): Promise<TournamentDoc | null> {
  const results = await getAll<TournamentDoc>(
    COLLECTIONS.tournaments,
    where("slug", "==", slug),
    limit(1),
  );
  return results[0] ?? null;
}

export async function getBracketForTournament(tournamentId: string): Promise<BracketDoc | null> {
  const results = await getAll<BracketDoc>(
    COLLECTIONS.brackets,
    where("tournamentId", "==", tournamentId),
    limit(1),
  );
  return results[0] ?? null;
}

export async function listBracketNodes(bracketId: string): Promise<BracketNodeDoc[]> {
  return getAll<BracketNodeDoc>(
    COLLECTIONS.bracketNodes,
    where("bracketId", "==", bracketId),
  );
}

export async function listRegistrations(tournamentId: string): Promise<RegistrationDoc[]> {
  return getAll<RegistrationDoc>(
    COLLECTIONS.registrations,
    where("tournamentId", "==", tournamentId),
  );
}

export async function listAnnouncements(orgId?: string): Promise<AnnouncementDoc[]> {
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc"), limit(10)];
  if (orgId) constraints.unshift(where("orgId", "==", orgId));
  return getAll<AnnouncementDoc>(COLLECTIONS.announcements, ...constraints);
}

export async function getDocById<T>(name: string, id: string): Promise<T | null> {
  const snap = await getDoc(doc(db(), name, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as T;
}

/**
 * Subscribe to a user's notifications inbox in real time.
 * Returns the Firestore unsubscribe function.
 */
export function subscribeNotifications(
  userId: string,
  callback: (notifications: NotificationDoc[]) => void,
): Unsubscribe {
  const q = query(
    collection(db(), COLLECTIONS.notifications),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(50),
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NotificationDoc);
    callback(items);
  });
}

export async function listUserIds(max = 500): Promise<string[]> {
  const snap = await getDocs(query(collection(db(), COLLECTIONS.users), limit(max)));
  return snap.docs.map((d) => d.id);
}

/**
 * Realtime subscription to all registrations for a tournament.
 */
export function subscribeRegistrations(
  tournamentId: string,
  callback: (regs: RegistrationDoc[]) => void,
): Unsubscribe {
  const q = query(
    collection(db(), COLLECTIONS.registrations),
    where("tournamentId", "==", tournamentId),
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RegistrationDoc);
    callback(items);
  });
}

/**
 * Realtime subscription to all matches in a tournament.
 */
export function subscribeMatches(
  tournamentId: string,
  callback: (matches: MatchDoc[]) => void,
): Unsubscribe {
  const q = query(
    collection(db(), COLLECTIONS.matches),
    where("tournamentId", "==", tournamentId),
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MatchDoc);
    callback(items);
  });
}

/**
 * Realtime subscription to all bracket nodes in a tournament.
 */
export function subscribeBracketNodes(
  tournamentId: string,
  callback: (nodes: BracketNodeDoc[]) => void,
): Unsubscribe {
  const q = query(
    collection(db(), COLLECTIONS.bracketNodes),
    where("tournamentId", "==", tournamentId),
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BracketNodeDoc);
    callback(items);
  });
}

/**
 * Realtime subscription to the persisted bracket doc for a tournament.
 * Returns null until published.
 */
export function subscribeBracket(
  tournamentId: string,
  callback: (bracket: BracketDoc | null) => void,
): Unsubscribe {
  const q = query(
    collection(db(), COLLECTIONS.brackets),
    where("tournamentId", "==", tournamentId),
    limit(1),
  );
  return onSnapshot(q, (snap) => {
    if (snap.empty) { callback(null); return; }
    const d = snap.docs[0]!;
    callback({ id: d.id, ...d.data() } as BracketDoc);
  });
}

export async function listMatchGames(matchId: string): Promise<MatchGameDoc[]> {
  return getAll<MatchGameDoc>(
    COLLECTIONS.matchGames,
    where("matchId", "==", matchId),
  );
}
