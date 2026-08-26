"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import { useAuth } from "@/lib/auth-context";
import type { RoleKey, UserRoleDoc } from "./types";

export interface PermissionState {
  roles: UserRoleDoc[];
  /**
   * The `role` custom claim on the caller's ID token — the same value
   * firestore.rules and the Cloud Functions authorize against. Exposed for
   * debugging; prefer the derived booleans below.
   */
  claimRole: string | null;
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
  const [claimRole, setClaimRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!user || !isFirebaseConfigured()) {
      setRoles([]);
      setClaimRole(null);
      setLoading(false);
      return;
    }

    // Guards against a stale response from a previous user landing in state
    // after a fast sign-out/sign-in swap (the admin test-account switcher
    // does exactly that).
    let cancelled = false;

    // Two parallel reads: scoped role documents, and the ID token whose
    // `role` claim is the authoritative site-admin signal.
    Promise.all([
      getDocs(
        query(
          collection(db(), COLLECTIONS.userRoles),
          where("userId", "==", user.uid),
          where("active", "==", true),
        ),
      ),
      user.getIdTokenResult(),
    ])
      .then(([rolesSnap, token]) => {
        if (cancelled) return;
        setRoles(rolesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as UserRoleDoc));
        const claim = token.claims.role;
        setClaimRole(typeof claim === "string" ? claim : null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, ready]);

  // Site admin comes from the custom claim, matching firestore.rules and
  // functions/src/lib/auth.ts. It deliberately does NOT fall back to
  // users/{uid}.role: that field is a UI cache the rules stopped trusting,
  // and reading it here would show admin surfaces to a user whose every
  // privileged write the backend then rejects.
  //
  // A SiteAdmin userRoles document is still honoured, because assignRole
  // writes that document and the claim in the same batch — but the claim
  // needs an ID-token refresh to appear, so the document covers the window
  // between "role granted" and "token refreshed".
  const isSiteAdminUser =
    claimRole === "SITE_ADMIN" ||
    roles.some((r) => r.roleId === "SiteAdmin" && r.clubId === null);

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
    claimRole,
    loading,
    isSiteAdmin: isSiteAdminUser,
    clubDirectorFor,
    leagueCoordinatorFor,
    coordinatorClubIds,
    provisionalClubs,
    hasRole,
  };
}
