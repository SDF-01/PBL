/**
 * Admin/Player mode toggle component
 * Allows users with dual roles to switch modes quickly
 */

"use client";

import { useAdminMode } from "@/lib/admin-context";
import { Button } from "./Button";
import { Shield, User } from "lucide-react";

export function ModeToggle() {
  const { isAdminMode, toggleAdminMode } = useAdminMode();

  return (
    <Button
      onClick={toggleAdminMode}
      variant={isAdminMode ? "ghost" : "outline"}
      size="sm"
      className="gap-2"
      title={isAdminMode ? "Switch to Player Mode" : "Switch to Admin Mode"}
    >
      {isAdminMode ? (
        <>
          <Shield className="w-4 h-4" />
          <span className="hidden sm:inline">Admin Mode</span>
        </>
      ) : (
        <>
          <User className="w-4 h-4" />
          <span className="hidden sm:inline">Player Mode</span>
        </>
      )}
    </Button>
  );
}
