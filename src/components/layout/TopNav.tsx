import Link from "next/link";
import { CrestLogo } from "@/components/brand/CrestLogo";
import { Button } from "@/components/ui/Button";
import { SignInButton } from "@/components/ui/SignInButton";
import { ModeToggle } from "@/components/ui/ModeToggle";
import { useAdminMode } from "@/lib/admin-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { ShieldCheck } from "lucide-react";

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
  const { isSiteAdmin, roles, loading: permLoading } = usePermissions();

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
          {/* DEBUG — remove once role issue is resolved */}
          <span className="hidden sm:flex items-center gap-1.5 rounded-pixel border border-obsidian-500 bg-obsidian-900 px-2 py-0.5 font-mono text-[9px]">
            <span className="text-ash-600">roles:</span>
            {permLoading ? (
              <span className="text-ash-600">…</span>
            ) : roles.length === 0 ? (
              <span className="text-crimson-400">none</span>
            ) : (
              roles.map((r) => (
                <span key={r.id} className={r.roleId === "SiteAdmin" ? "text-ember-400" : "text-spectral-400"}>
                  {r.roleId}{r.clubId ? `@${r.clubId.slice(0, 6)}` : ""}
                </span>
              ))
            )}
            <span className="text-ash-700">|</span>
            <span className={isSiteAdmin ? "text-ember-400" : "text-ash-600"}>
              admin:{isSiteAdmin ? "✓" : "✗"}
            </span>
          </span>
          <SignInButton />
        </div>
      </div>
      <div className="ember-divider" />
    </header>
  );
}
