"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  LayoutDashboard, MapPin, Bell, CalendarDays, Users, Trophy,
  UserCircle2, Swords, Activity, ShieldCheck, Building2, ListChecks, UserCog,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { useRoleView } from "@/lib/role-view-context";

const ITEMS = [
  { href: "/dashboard",         label: "Overview",    icon: LayoutDashboard },
  { href: "/games",             label: "Local Games", icon: Activity },
  { href: "/players",           label: "Leaderboard", icon: Trophy },
  { href: "/ladder/seasons",    label: "Seasons",     icon: CalendarDays },
  { href: "/ladder/play-dates", label: "Play Dates",  icon: Users },
  { href: "/ladder/check-in",   label: "Check-In",    icon: MapPin },
  { href: "/tournaments",       label: "Tournaments", icon: Swords },
  { href: "/notifications",     label: "Notifications", icon: Bell },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { isSiteAdmin, clubDirectorFor, loading: permLoading } = usePermissions();
  const { isStaffView, isAdminView } = useRoleView();
  const isStaff = !permLoading && (isSiteAdmin || clubDirectorFor.length > 0) && isStaffView;

  function navLink(href: string, label: string, Icon: React.ComponentType<{ className?: string }>) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <li key={href}>
        <Link
          href={href}
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-1.5 rounded-pixel text-sm transition-colors",
            active
              ? "bg-rune-500/15 text-rune-glow border-l-2 border-rune-500 pl-[calc(0.625rem-2px)]"
              : "text-ash-300 hover:text-ash-100 hover:bg-obsidian-600",
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      </li>
    );
  }

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col gap-6 border-r border-obsidian-400 bg-obsidian-800/60 p-4">
      <div>
        <div className="heading-fantasy text-[10px] uppercase tracking-[0.2em] text-ash-500 px-2 mb-2">
          Navigate
        </div>
        <ul className="space-y-0.5">
          {ITEMS.map((item) => navLink(item.href, item.label, item.icon))}
        </ul>
      </div>

      {user && (
        <div>
          <div className="heading-fantasy text-[10px] uppercase tracking-[0.2em] text-ash-500 px-2 mb-2">
            You
          </div>
          <ul className="space-y-0.5">
            {navLink(`/players/view?uid=${user.uid}`, "My Profile", UserCircle2)}
            {navLink("/players/edit", "Edit Profile", Users)}
            {navLink("/clubs/my", "My Clubs", Building2)}
          </ul>
        </div>
      )}

      {isStaff && (
        <div>
          <div className="heading-fantasy text-[10px] uppercase tracking-[0.2em] text-ember-600 px-2 mb-2">
            Admin
          </div>
          <ul className="space-y-0.5">
            {navLink("/admin", "Admin Hub", ShieldCheck)}
            {navLink("/leagues/create", "New League", ListChecks)}
            {isAdminView && navLink("/admin/clubs", "Club Approvals", Building2)}
            {isAdminView && navLink("/admin/users", "Manage Users", UserCog)}
          </ul>
        </div>
      )}
    </aside>
  );
}
