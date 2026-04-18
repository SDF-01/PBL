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
  orderBy,
  query,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "./collections";
import type {
  AnnouncementDoc,
  BracketDoc,
  BracketNodeDoc,
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
