import { collection, getDocs, query, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import type { UserRoleDoc } from "./types";

async function getActiveRoles(userId: string): Promise<UserRoleDoc[]> {
  if (!isFirebaseConfigured()) return [];
  const q = query(
    collection(db(), COLLECTIONS.userRoles),
    where("userId", "==", userId),
    where("active", "==", true),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as UserRoleDoc);
}

export async function isSiteAdmin(userId: string): Promise<boolean> {
  const roles = await getActiveRoles(userId);
  return roles.some((r) => r.roleId === "SiteAdmin" && r.clubId === null);
}

export async function isClubDirector(userId: string, clubId: string): Promise<boolean> {
  if (await isSiteAdmin(userId)) return true;
  const roles = await getActiveRoles(userId);
  return roles.some((r) => r.roleId === "ClubDirector" && r.clubId === clubId);
}

export async function isLeagueCoordinator(
  userId: string,
  leagueId: string,
  clubId?: string,
): Promise<boolean> {
  if (await isSiteAdmin(userId)) return true;
  const roles = await getActiveRoles(userId);
  if (roles.some((r) => r.roleId === "LeagueCoordinator" && r.leagueId === leagueId)) return true;
  if (clubId && roles.some((r) => r.roleId === "ClubDirector" && r.clubId === clubId)) return true;
  return false;
}

export async function canApproveClub(userId: string): Promise<boolean> {
  return isSiteAdmin(userId);
}

export async function canEditPendingClub(userId: string, clubId: string): Promise<boolean> {
  if (await isSiteAdmin(userId)) return true;
  const roles = await getActiveRoles(userId);
  return roles.some((r) => r.roleId === "ClubCreatorProvisional" && r.clubId === clubId);
}

export async function canManageLeagueRoster(
  userId: string,
  leagueId: string,
  clubId?: string,
): Promise<boolean> {
  return isLeagueCoordinator(userId, leagueId, clubId);
}

export async function canValidateStandings(
  userId: string,
  leagueId: string,
  clubId?: string,
): Promise<boolean> {
  return isLeagueCoordinator(userId, leagueId, clubId);
}

export async function canViewPlayerAdvancedStats(
  requestingUserId: string,
  targetUserId: string,
): Promise<boolean> {
  if (requestingUserId === targetUserId) return true;
  return isSiteAdmin(requestingUserId);
}
