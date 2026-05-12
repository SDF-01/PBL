"use client";

import { useRoleView } from "@/lib/role-view-context";
import { Button } from "./Button";
import { Shield, User } from "lucide-react";

export function ModeToggle() {
  const { isStaffView, togglePlayerMode } = useRoleView();

  return (
    <Button
      onClick={togglePlayerMode}
      variant={isStaffView ? "ghost" : "outline"}
      size="sm"
      className="gap-2"
      aria-label={isStaffView ? "Switch to Player Mode" : "Switch to Staff Mode"}
    >
      {isStaffView ? (
        <>
          <User className="w-4 h-4" />
          <span className="hidden sm:inline">Player Mode</span>
        </>
      ) : (
        <>
          <Shield className="w-4 h-4" />
          <span className="hidden sm:inline">Staff Mode</span>
        </>
      )}
    </Button>
  );
}
