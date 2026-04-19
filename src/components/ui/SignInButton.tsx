"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "./Button";
import { LogIn, LogOut } from "lucide-react";

export function SignInButton({ size = "sm" }: { size?: "sm" | "md" | "lg" }) {
  const { user, ready, signIn, signOut } = useAuth();
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

  return (
    <Button size={size} onClick={() => signIn().catch(() => {})}>
      <LogIn className="h-3.5 w-3.5" /> Sign in
    </Button>
  );
}
