"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { usePermissions } from "@/lib/permissions/usePermissions";

interface AdminModeContextType {
  isAdminMode: boolean;
  /** True when the signed-in user actually holds a staff role. */
  canAccessAdmin: boolean;
  toggleAdminMode: () => void;
  setAdminMode: (mode: boolean) => void;
}

const AdminModeContext = createContext<AdminModeContextType | undefined>(undefined);

export function AdminModeProvider({ children }: { children: React.ReactNode }) {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const { isSiteAdmin, clubDirectorFor, leagueCoordinatorFor, loading } = usePermissions();

  const canAccessAdmin =
    isSiteAdmin || clubDirectorFor.length > 0 || leagueCoordinatorFor.length > 0;

  useEffect(() => {
    if (loading) return;
    const saved = localStorage.getItem("adminMode");
    if (saved === "true" && canAccessAdmin) {
      setIsAdminMode(true);
    } else if (!canAccessAdmin) {
      // Non-staff: clear any saved admin mode so it can't be exploited
      setIsAdminMode(false);
      localStorage.removeItem("adminMode");
    }
  }, [loading, canAccessAdmin]);

  const toggleAdminMode = () => {
    if (!canAccessAdmin) return;
    setIsAdminMode((prev) => {
      const next = !prev;
      localStorage.setItem("adminMode", next ? "true" : "false");
      return next;
    });
  };

  const setAdminMode = (mode: boolean) => {
    if (mode && !canAccessAdmin) return;
    setIsAdminMode(mode);
    localStorage.setItem("adminMode", mode ? "true" : "false");
  };

  return (
    <AdminModeContext.Provider value={{ isAdminMode, canAccessAdmin, toggleAdminMode, setAdminMode }}>
      {children}
    </AdminModeContext.Provider>
  );
}

export function useAdminMode() {
  const ctx = useContext(AdminModeContext);
  if (!ctx) throw new Error("useAdminMode must be used within AdminModeProvider");
  return ctx;
}
