/**
 * Admin mode context
 * Manages admin/player mode toggle and provides admin-specific data
 */

"use client";

import React, { createContext, useContext, useState } from "react";

interface AdminModeContextType {
  isAdminMode: boolean;
  toggleAdminMode: () => void;
  setAdminMode: (mode: boolean) => void;
}

const AdminModeContext = createContext<AdminModeContextType | undefined>(undefined);

export function AdminModeProvider({ children }: { children: React.ReactNode }) {
  const [isAdminMode, setIsAdminMode] = useState(false);

  // Persist to localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem("adminMode");
    if (saved === "true") {
      setIsAdminMode(true);
    }
  }, []);

  const toggleAdminMode = () => {
    setIsAdminMode((prev) => {
      const next = !prev;
      localStorage.setItem("adminMode", next ? "true" : "false");
      return next;
    });
  };

  const setAdminMode = (mode: boolean) => {
    setIsAdminMode(mode);
    localStorage.setItem("adminMode", mode ? "true" : "false");
  };

  return (
    <AdminModeContext.Provider value={{ isAdminMode, toggleAdminMode, setAdminMode }}>
      {children}
    </AdminModeContext.Provider>
  );
}

export function useAdminMode() {
  const context = useContext(AdminModeContext);
  if (!context) {
    throw new Error("useAdminMode must be used within AdminModeProvider");
  }
  return context;
}
