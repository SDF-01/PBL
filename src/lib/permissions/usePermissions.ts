"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import { useAuth } from "@/lib/auth-context";
import type { RoleKey, UserRoleDoc } from "./types";

export interface PermissionState {
  roles: UserRoleDoc[];
  loading: boolean;
  isSiteAdmin: boolean;
  clubDirectorFor: string[];
  leagueCoordinatorFor: string[];
  provisionalClubs: string[];
  hasRole: (roleId: RoleKey, scopeId?: string) => boolean;
}

export function usePermissions(): PermissionState {
  const { user, ready } = useAuth();
  const [roles, setRoles] = useState<UserRoleDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!user || !isFirebaseConfigured()) {
      setRoles([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db(), COLLECTIONS.userRoles),
      where("userId", "==", user.uid),
      where("active", "==", true),
    );
    getDocs(q)
      .then((snap) => setRoles(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as UserRoleDoc)))
      .finally(() => setLoading(false));
  }, [user, ready]);

  const isSiteAdminUser = roles.some((r) => r.roleId === "SiteAdmin" && r.clubId === null);

  const clubDirectorFor = roles
    .filter((r) => r.roleId === "ClubDirector" && r.clubId)
    .map((r) => r.clubId as string);

  const leagueCoordinatorFor = roles
    .filter((r) => r.roleId === "LeagueCoordinator" && r.leagueId)
    .map((r) => r.leagueId as string);

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
    loading,
    isSiteAdmin: isSiteAdminUser,
    clubDirectorFor,
    leagueCoordinatorFor,
    provisionalClubs,
    hasRole,
  };
}
