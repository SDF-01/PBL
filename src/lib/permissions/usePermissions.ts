"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import { useAuth } from "@/lib/auth-context";
import type { UserProfile } from "@/lib/firestore/types";
import type { RoleKey, UserRoleDoc } from "./types";

export interface PermissionState {
  roles: UserRoleDoc[];
  /** Raw role field from users/{uid} — exposed for debugging only. */
  primaryRole: string | null;
  loading: boolean;
  isSiteAdmin: boolean;
  clubDirectorFor: string[];
  /** League IDs where this user has a league-scoped LeagueCoordinator role. */
  leagueCoordinatorFor: string[];
  /** Club IDs where this user has a club-level LeagueCoordinator role (leagueId=null). */
  coordinatorClubIds: string[];
  provisionalClubs: string[];
  hasRole: (roleId: RoleKey, scopeId?: string) => boolean;
}

export function usePermissions(): PermissionState {
  const { user, ready } = useAuth();
  const [roles, setRoles] = useState<UserRoleDoc[]>([]);
  const [primaryRole, setPrimaryRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!user || !isFirebaseConfigured()) {
      setRoles([]);
      setPrimaryRole(null);
      setLoading(false);
      return;
    }

    // Run both reads in parallel: userRoles collection + users/{uid}.role fallback.
    Promise.all([
      getDocs(
        query(
          collection(db(), COLLECTIONS.userRoles),
          where("userId", "==", user.uid),
          where("active", "==", true),
        ),
      ),
      getDoc(doc(db(), COLLECTIONS.users, user.uid)),
    ])
      .then(([rolesSnap, userSnap]) => {
        setRoles(rolesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as UserRoleDoc));
        if (userSnap.exists()) {
          setPrimaryRole((userSnap.data() as UserProfile).role ?? null);
        }
      })
      .finally(() => setLoading(false));
  }, [user, ready]);

  // isSiteAdmin: either a SiteAdmin userRoles doc exists OR the primary role
  // field on the user document is SITE_ADMIN (fallback until userRoles doc is added).
  const isSiteAdminUser =
    roles.some((r) => r.roleId === "SiteAdmin" && r.clubId === null) ||
    primaryRole === "SITE_ADMIN";

  const clubDirectorFor = roles
    .filter((r) => r.roleId === "ClubDirector" && r.clubId)
    .map((r) => r.clubId as string);

  const leagueCoordinatorFor = roles
    .filter((r) => r.roleId === "LeagueCoordinator" && r.leagueId)
    .map((r) => r.leagueId as string);

  // Club-level coordinators: assigned with leagueId=null (club-wide scope).
  const coordinatorClubIds = roles
    .filter((r) => r.roleId === "LeagueCoordinator" && r.clubId && !r.leagueId)
    .map((r) => r.clubId as string);

  const provisionalClubs = roles
    .filter((r) => r.roleId === "ClubCreatorProvisional" && r.clubId)
    .map((r) => r.clubId as string);

  function hasRole(roleId: RoleKey, scopeId?: string): boolean {
    if (isSiteAdminUser) return true;
    return roles.some((r) => {
      if (r.roleId !== roleId) return false;
      if (!scopeId) return true;
      return r.clubId === scopeId || r.leagueId === scopeId;
    });
  }

  return {
    roles,
    primaryRole,
    loading,
    isSiteAdmin: isSiteAdminUser,
    clubDirectorFor,
    leagueCoordinatorFor,
    coordinatorClubIds,
    provisionalClubs,
    hasRole,
  };
}
