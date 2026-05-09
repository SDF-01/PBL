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
import { RuneChip } from "@/components/ui/RuneChip";
import { useRoleView } from "@/lib/role-view-context";

const NAV = [
  { href: "/clubs",         label: "Clubs" },
  { href: "/games",         label: "Games" },
  { href: "/players",       label: "Leaderboard" },
  { href: "/tournaments",   label: "Tournaments" },
  { href: "/dashboard",     label: "Dashboard" },
] as const;

export function TopNav() {
  const { canAccessAdmin } = useAdminMode();
  const { user } = useAuth();
  const { isSiteAdmin, clubDirectorFor, coordinatorClubIds, provisionalClubs, loading } = usePermissions();
  const { isStaffView } = useRoleView();

  const roleChip = !loading && user
    ? isSiteAdmin && isStaffView ? { label: "Site Admin", tone: "ember" as const }
    : clubDirectorFor.length > 0 && isStaffView ? { label: "Club Director", tone: "rune" as const }
    : coordinatorClubIds.length > 0 && isStaffView ? { label: "Coordinator", tone: "rune" as const }
    : null
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
          {roleChip && (
            <RuneChip tone={roleChip.tone} className="hidden lg:inline-flex text-[10px]">
              {roleChip.label}
            </RuneChip>
          )}
          {canAccessAdmin && <ModeToggle />}
          {isSiteAdmin && (
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
