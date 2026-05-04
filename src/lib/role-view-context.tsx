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
  isAdminView: boolean;
  isStaffView: boolean;
}

const DEFAULT: RoleViewOption = { id: "Player", label: "Player", tone: "neutral" };

const Ctx = createContext<RoleViewCtx>({
  options: [DEFAULT],
  activeRole: DEFAULT,
  setActiveRole: () => {},
  isAdminView: false,
  isStaffView: false,
});

export function RoleViewProvider({ children }: { children: ReactNode }) {
  const { isSiteAdmin, clubDirectorFor, leagueCoordinatorFor, loading } = usePermissions();
  const [activeId, setActiveId] = useState<RoleViewId>("Player");

  const options: RoleViewOption[] = [
    ...(isSiteAdmin
      ? [{ id: "SiteAdmin" as RoleViewId, label: "Site Admin", tone: "ember" as const }]
      : []),
    ...(clubDirectorFor.length > 0
      ? [{ id: "ClubAdmin" as RoleViewId, label: "Club Director", tone: "gold" as const }]
      : []),
    ...(leagueCoordinatorFor.length > 0
      ? [{ id: "LeagueCoordinator" as RoleViewId, label: "Coordinator", tone: "spectral" as const }]
      : []),
    { id: "Player", label: "Player", tone: "neutral" },
  ];

  // Once permissions resolve, restore saved role or auto-select the highest privilege.
  // Never restore "Player" if the user now has elevated roles — that would hide
  // the Admin section for users who previously visited without a role assigned.
  useEffect(() => {
    if (loading) return;
    const stored =
      typeof window !== "undefined"
        ? (localStorage.getItem("roleView") as RoleViewId | null)
        : null;
    const restorable = stored && stored !== "Player" && options.some((o) => o.id === stored);
    const highestRole = options.find((o) => o.id !== "Player") ?? options[0];
    setActiveId(restorable ? (stored as RoleViewId) : (highestRole?.id ?? "Player"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isSiteAdmin, clubDirectorFor.length, leagueCoordinatorFor.length]);

  function setActiveRole(id: RoleViewId) {
    setActiveId(id);
    if (typeof window !== "undefined") localStorage.setItem("roleView", id);
  }

  const activeRole = options.find((o) => o.id === activeId) ?? options[0] ?? DEFAULT;

  return (
    <Ctx.Provider
      value={{
        options,
        activeRole,
        setActiveRole,
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
