"use client";

import Link from "next/link";
import { CrestLogo } from "@/components/brand/CrestLogo";
import { Button } from "@/components/ui/Button";
import { SignInButton } from "@/components/ui/SignInButton";
import { ModeToggle } from "@/components/ui/ModeToggle";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { Building2, ShieldCheck, UserSearch } from "lucide-react";
import { RuneChip } from "@/components/ui/RuneChip";
import { useRoleView } from "@/lib/role-view-context";

const DISCOVERY_NAV = [
  { href: "/clubs",         label: "Clubs" },
  { href: "/courts",        label: "Courts" },
  { href: "/games",         label: "Games" },
  { href: "/players",       label: "Leaderboard" },
  { href: "/tournaments",   label: "Tournaments" },
] as const;

export function TopNav() {
  const { user } = useAuth();
  const { provisionalClubs, clubDirectorFor, coordinatorClubIds, loading } = usePermissions();
  const { isStaffView, isAdminView, activeRole, options } = useRoleView();

  const chipTone = activeRole.id === "SiteAdmin" ? ("ember" as const) : ("rune" as const);
  const roleChip = !loading && user && isStaffView
    ? { label: activeRole.label, tone: chipTone }
    : null;

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
          {user && (
            <>
              <Link
                href="/dashboard"
                className="px-3 py-1.5 text-ash-300 hover:text-ash-100 hover:bg-obsidian-600 rounded-pixel transition-colors"
              >
                Dashboard
              </Link>
              {hasClubAccess && (
                <Link
                  href="/clubs/my"
                  className="px-3 py-1.5 text-ash-300 hover:text-ash-100 hover:bg-obsidian-600 rounded-pixel transition-colors flex items-center gap-1.5"
                >
                  <Building2 className="h-3.5 w-3.5 text-ember-400" />
                  My Clubs
                </Link>
              )}
              <span aria-hidden className="mx-2 h-5 w-px bg-obsidian-500" />
            </>
          )}
          {DISCOVERY_NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="px-3 py-1.5 text-ash-300 hover:text-ash-100 hover:bg-obsidian-600 rounded-pixel transition-colors"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {roleChip && (
            <RuneChip tone={roleChip.tone} className="hidden lg:inline-flex text-[10px]">
              {roleChip.label}
            </RuneChip>
          )}
          <Link
            href="/players/search"
            aria-label="Find a player"
            className="flex items-center justify-center h-8 w-8 rounded-pixel text-ash-400 hover:text-spectral-400 hover:bg-obsidian-600 transition-colors"
          >
            <UserSearch className="h-4 w-4" />
          </Link>
          {options.length > 1 && <ModeToggle />}
          {isAdminView && (
            <Link href="/admin">
              <Button variant="outline" size="sm" className="border-ember-500/50 text-ember-400 hover:bg-ember-500/10 hover:text-ember-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Admin Console</span>
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
