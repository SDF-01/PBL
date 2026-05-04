"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "./Button";
import { LogOut } from "lucide-react";

interface SignInButtonProps {
  size?: "sm" | "md" | "lg";
  /** When true, only shows "Sign In" without the "Sign Up" button. Use in space-constrained layouts. */
  compact?: boolean;
}

export function SignInButton({ size = "sm", compact = false }: SignInButtonProps) {
  const { user, ready, signOut } = useAuth();
  if (!ready) return null;

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href={`/players/view?uid=${user.uid}`}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          aria-label="My profile"
        >
          {user.photoURL ? (
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
          <span className="hidden sm:inline text-xs text-ash-300 max-w-[8rem] truncate">
            {user.displayName ?? user.email}
          </span>
        </Link>
        <Button variant="ghost" size={size} onClick={() => signOut()}>
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
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
