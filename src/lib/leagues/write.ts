// TODO: createLeague should migrate to a Firebase Cloud Function once one is deployed.

"use client";

import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import type { RoleKey } from "@/lib/permissions/types";

export interface CreateLeagueInput {
  name: string;
  description?: string;
  clubId: string;
  city?: string;
  state?: string;
  leagueFormat?: string;
}

export async function createLeague(
  createdBy: string,
  input: CreateLeagueInput,
): Promise<string> {

  const database = db();
  const batch = writeBatch(database);

  const leagueRef = doc(collection(database, COLLECTIONS.leagues));

  batch.set(leagueRef, {
    orgId: input.clubId,
    clubId: input.clubId,
    name: input.name,
    description: input.description ?? "",
    city: input.city ?? "",
    state: input.state ?? "",
    league_format: input.leagueFormat ?? "Doubles Ladder",
    active: true,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Assign creator as LeagueCoordinator scoped to this league + club
  const roleRef = doc(collection(database, COLLECTIONS.userRoles));
  batch.set(roleRef, {
    userId: createdBy,
    roleId: "LeagueCoordinator" as RoleKey,
    clubId: input.clubId,
    leagueId: leagueRef.id,
    assignedAt: serverTimestamp(),
    assignedBy: createdBy,
    active: true,
  });

  await batch.commit();
  return leagueRef.id;
}
