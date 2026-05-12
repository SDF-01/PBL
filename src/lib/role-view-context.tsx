"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePermissions } from "./permissions/usePermissions";

export type RoleViewId = "SiteAdmin" | "ClubAdmin" | "LeagueCoordinator" | "Player";

export interface RoleViewOption {
  id: RoleViewId;
  label: string;
  tone: "ember" | "gold" | "spectral" | "neutral";
}

interface RoleViewCtx {
  options: RoleViewOption[];
  activeRole: RoleViewOption;
  setActiveRole: (id: RoleViewId) => void;
  togglePlayerMode: () => void;
  isAdminView: boolean;
  isStaffView: boolean;
}

const DEFAULT: RoleViewOption = { id: "Player", label: "Player", tone: "neutral" };

const Ctx = createContext<RoleViewCtx>({
  options: [DEFAULT],
  activeRole: DEFAULT,
  setActiveRole: () => {},
  togglePlayerMode: () => {},
  isAdminView: false,
  isStaffView: false,
});

export function RoleViewProvider({ children }: { children: ReactNode }) {
  const { isSiteAdmin, clubDirectorFor, leagueCoordinatorFor, coordinatorClubIds, loading } = usePermissions();
  const [activeId, setActiveId] = useState<RoleViewId>("Player");

  const options: RoleViewOption[] = [
    ...(isSiteAdmin
      ? [{ id: "SiteAdmin" as RoleViewId, label: "Site Admin", tone: "ember" as const }]
      : []),
    ...(clubDirectorFor.length > 0
      ? [{ id: "ClubAdmin" as RoleViewId, label: "Club Director", tone: "gold" as const }]
      : []),
    ...(leagueCoordinatorFor.length > 0 || coordinatorClubIds.length > 0
      ? [{ id: "LeagueCoordinator" as RoleViewId, label: "Coordinator", tone: "spectral" as const }]
      : []),
    { id: "Player", label: "Player", tone: "neutral" },
  ];

  // Once permissions resolve, restore the saved role from localStorage.
  // If no saved role exists, auto-select the highest privilege so new staff
  // accounts don't land in player view unexpectedly. An explicit "Player"
  // selection is always respected — the user consciously chose that view.
  useEffect(() => {
    if (loading) return;
    const stored =
      typeof window !== "undefined"
        ? (localStorage.getItem("roleView") as RoleViewId | null)
        : null;
    const restorable = stored && options.some((o) => o.id === stored);
    const highestRole = options.find((o) => o.id !== "Player") ?? options[0];
    setActiveId(restorable ? (stored as RoleViewId) : (highestRole?.id ?? "Player"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isSiteAdmin, clubDirectorFor.length, leagueCoordinatorFor.length, coordinatorClubIds.length]);

  function setActiveRole(id: RoleViewId) {
    setActiveId(id);
    if (typeof window !== "undefined") localStorage.setItem("roleView", id);
  }

  function togglePlayerMode() {
    if (activeId === "Player") {
      const highest = options.find((o) => o.id !== "Player");
      if (highest) setActiveRole(highest.id);
    } else {
      setActiveRole("Player");
    }
  }

  const activeRole = options.find((o) => o.id === activeId) ?? options[0] ?? DEFAULT;

  return (
    <Ctx.Provider
      value={{
        options,
        activeRole,
        setActiveRole,
        togglePlayerMode,
        isAdminView: activeId === "SiteAdmin",
        isStaffView: activeId !== "Player",
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useRoleView(): RoleViewCtx {
  return useContext(Ctx);
}
