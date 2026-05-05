"use client";

import Link from "next/link";
import { CrestLogo } from "@/components/brand/CrestLogo";
import { Button } from "@/components/ui/Button";
import { SignInButton } from "@/components/ui/SignInButton";
import { ModeToggle } from "@/components/ui/ModeToggle";
import { useAdminMode } from "@/lib/admin-context";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { Building2, ShieldCheck } from "lucide-react";

const NAV = [
  { href: "/games",             label: "Games" },
  { href: "/ladder/check-in",   label: "Check-In" },
  { href: "/ladder/play-dates", label: "Play Dates" },
  { href: "/players",           label: "Leaderboard" },
  { href: "/tournaments",       label: "Tournaments" },
  { href: "/dashboard",         label: "Dashboard" },
] as const;

export function TopNav() {
  const { isAdminMode } = useAdminMode();
  const { user } = useAuth();
  const { isSiteAdmin, clubDirectorFor, coordinatorClubIds, provisionalClubs, loading } = usePermissions();

  const hasClubAccess =
    !loading &&
    (clubDirectorFor.length > 0 ||
      coordinatorClubIds.length > 0 ||
      provisionalClubs.length > 0);

  return (
    <header className="sticky top-0 z-40 border-b border-obsidian-400 bg-obsidian-800/80 backdrop-blur supports-[backdrop-filter]:bg-obsidian-800/65">
      <div className="container flex h-14 items-center gap-6">
        <Link href="/" className="flex items-center gap-2 text-ember-500 hover:text-ember-400 transition-colors">
          <CrestLogo size={28} />
          <span className="heading-display text-xs text-ash-100 tracking-[0.25em]">
            LADDER<span className="text-ember-500">·</span>LEAGUE
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="px-3 py-1.5 text-ash-300 hover:text-ash-100 hover:bg-obsidian-600 rounded-pixel transition-colors"
            >
              {n.label}
            </Link>
          ))}
          {user && hasClubAccess && (
            <Link
              href="/clubs/my"
              className="px-3 py-1.5 text-ash-300 hover:text-ash-100 hover:bg-obsidian-600 rounded-pixel transition-colors flex items-center gap-1.5"
            >
              <Building2 className="h-3.5 w-3.5 text-ember-400" />
              My Clubs
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {isAdminMode && <ModeToggle />}
          {isSiteAdmin && (
            <Link href="/admin" className="hidden sm:block">
              <Button variant="outline" size="sm" className="border-ember-500/50 text-ember-400 hover:bg-ember-500/10 hover:text-ember-300">
                <ShieldCheck className="h-3.5 w-3.5" /> Admin Console
              </Button>
            </Link>
          )}
          <SignInButton />
        </div>
      </div>
      <div className="ember-divider" />
    </header>
  );
}
