"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/cn";
import {
  LayoutDashboard, MapPin, Bell, CalendarDays, Users, Trophy,
  UserCircle2, Swords, Activity, ShieldCheck, Building2, ListChecks, UserCog,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { useRoleView } from "@/lib/role-view-context";

const ITEMS = [
  { href: "/dashboard",         label: "Overview",    icon: LayoutDashboard },
  { href: "/games",             label: "Local Games", icon: Activity },
  { href: "/players",           label: "Leaderboard", icon: Trophy },
  { href: "/courts",            label: "Courts",      icon: MapPin },
  { href: "/ladder/seasons",    label: "Seasons",     icon: CalendarDays },
  { href: "/ladder/play-dates", label: "Play Dates",  icon: Users },
  { href: "/ladder/check-in",   label: "Check-In",    icon: MapPin },
  { href: "/tournaments",       label: "Tournaments", icon: Swords },
  { href: "/notifications",     label: "Notifications", icon: Bell },
];

const SIDEBAR_KEY = "pbl_sidebar_collapsed";

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { isSiteAdmin, clubDirectorFor, loading: permLoading } = usePermissions();
  const { isStaffView, isAdminView } = useRoleView();
  const isStaff = !permLoading && (isSiteAdmin || clubDirectorFor.length > 0) && isStaffView;

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
  }

  function navLink(href: string, label: string, Icon: React.ComponentType<{ className?: string }>) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <li key={href}>
        <Link
          href={href}
          title={collapsed ? label : undefined}
          aria-label={collapsed ? label : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-pixel text-sm transition-colors",
            collapsed ? "justify-center px-2 py-2" : "px-2.5 py-1.5",
            active
              ? "bg-rune-500/15 text-rune-glow border-l-2 border-rune-500 pl-[calc(0.625rem-2px)]"
              : "text-ash-300 hover:text-ash-100 hover:bg-obsidian-600",
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!collapsed && label}
        </Link>
      </li>
    );
  }

  function section(heading: string, headingColor: string, content: React.ReactNode) {
    return (
      <div>
        {!collapsed && (
          <div className={`heading-fantasy text-[10px] uppercase tracking-[0.2em] ${headingColor} px-2 mb-2`}>
            {heading}
          </div>
        )}
        <ul className="space-y-0.5">{content}</ul>
      </div>
    );
  }

  return (
    <aside
      className={cn(
        "hidden md:flex shrink-0 flex-col gap-6 border-r border-obsidian-400 bg-obsidian-800/60 transition-all duration-200",
        collapsed ? "w-14 p-2" : "w-60 p-4",
      )}
    >
      {section("Navigate", "text-ash-500",
        ITEMS.map((item) => navLink(item.href, item.label, item.icon))
      )}

      {user && section("You", "text-ash-500", <>
        {navLink(`/players/view?uid=${user.uid}`, "My Profile", UserCircle2)}
        {navLink("/players/edit", "Edit Profile", Users)}
        {navLink("/clubs/my", "My Clubs", Building2)}
      </>)}

      {isStaff && section("Admin", "text-ember-600", <>
        {navLink("/admin", "Admin Console", ShieldCheck)}
        {navLink("/leagues/create", "New League", ListChecks)}
        {isAdminView && navLink("/admin/clubs", "Club Approvals", Building2)}
        {isAdminView && navLink("/admin/users", "Manage Users", UserCog)}
      </>)}

      <button
        onClick={toggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="mt-auto flex items-center justify-center w-full py-2 text-ash-500 hover:text-ash-300 hover:bg-obsidian-700 rounded-pixel transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        {!collapsed && <span className="text-[10px] ml-1">Collapse</span>}
      </button>
    </aside>
  );
}
