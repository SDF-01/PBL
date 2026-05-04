"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRoleView, type RoleViewId } from "@/lib/role-view-context";
import { Button } from "./Button";
import { LogOut, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";

const TONE: Record<string, string> = {
  ember:    "bg-ember-500/20 text-ember-400 ring-ember-500/40",
  gold:     "bg-gold-500/20 text-gold-400 ring-gold-500/40",
  spectral: "bg-spectral-500/20 text-spectral-400 ring-spectral-500/40",
  neutral:  "bg-obsidian-600 text-ash-400 ring-obsidian-400",
};

interface SignInButtonProps {
  size?: "sm" | "md" | "lg";
  compact?: boolean;
}

export function SignInButton({ size = "sm", compact = false }: SignInButtonProps) {
  const { user, ready, signOut } = useAuth();
  const { options, activeRole, setActiveRole } = useRoleView();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!ready) return null;

  if (user) {
    const hasMultipleRoles = options.length > 1;
    const badgeTone = TONE[activeRole.tone] ?? TONE.neutral;
    const showBadge = activeRole.id !== "Player";

    return (
      <div ref={ref} className="relative">
        {/* Avatar trigger */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          aria-label="Profile menu"
        >
          <div className="relative shrink-0">
            {user.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.photoURL}
                alt=""
                className="h-7 w-7 rounded-full border border-obsidian-400"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="h-7 w-7 rounded-full border border-obsidian-400 bg-obsidian-700 flex items-center justify-center text-[11px] text-ash-300">
                {(user.displayName ?? user.email ?? "?").slice(0, 1).toUpperCase()}
              </span>
            )}
            {showBadge && (
              <span
                className={cn(
                  "absolute -bottom-1 -right-1 text-[8px] px-1 leading-[14px] rounded font-mono font-bold",
                  badgeTone,
                )}
              >
                {activeRole.id === "SiteAdmin" ? "Admin" : activeRole.id === "ClubAdmin" ? "Dir" : "Co"}
              </span>
            )}
          </div>
          <span className="hidden sm:inline text-xs text-ash-300 max-w-[8rem] truncate">
            {user.displayName ?? user.email}
          </span>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 mt-2 w-56 z-50 rounded-pixel border border-obsidian-400 bg-obsidian-800 shadow-xl">
            {/* User info */}
            <div className="px-3 py-2.5 border-b border-obsidian-600">
              <div className="text-xs font-medium text-ash-100 truncate">
                {user.displayName ?? "Player"}
              </div>
              <div className="text-[10px] text-ash-500 truncate">{user.email}</div>
            </div>

            {/* Role switcher */}
            {hasMultipleRoles && (
              <div className="px-3 py-2 border-b border-obsidian-600">
                <div className="text-[9px] uppercase tracking-[0.15em] text-ash-500 mb-1.5">
                  View as
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {options.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => { setActiveRole(role.id as RoleViewId); setOpen(false); }}
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded font-mono transition-all ring-1",
                        TONE[role.tone],
                        activeRole.id === role.id
                          ? "ring-1 opacity-100"
                          : "opacity-50 hover:opacity-80",
                      )}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="py-1">
              <Link
                href={`/players/view?uid=${user.uid}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-ash-300 hover:text-ash-100 hover:bg-obsidian-700 transition-colors"
              >
                <UserCircle2 className="h-3.5 w-3.5" />
                My Profile
              </Link>
              <button
                type="button"
                onClick={() => { signOut(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-ash-300 hover:text-crimson-400 hover:bg-obsidian-700 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <Link href="/auth/login">
        <Button size={size}>Sign In</Button>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/auth/login">
        <Button variant="outline" size={size}>Sign In</Button>
      </Link>
      <Link href="/auth/signup">
        <Button size={size}>Sign Up</Button>
      </Link>
    </div>
  );
}
