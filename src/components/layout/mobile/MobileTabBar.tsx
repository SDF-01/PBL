"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Swords, Trophy, CalendarDays, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { useRoleView } from "@/lib/role-view-context";

const ADMIN_TAB = { href: "/admin", label: "Admin", icon: ShieldCheck } as const;

export function MobileTabBar() {
  const pathname = usePathname() ?? "/";
  const { user } = useAuth();
  const { isSiteAdmin, clubDirectorFor, loading } = usePermissions();
  const { isStaffView } = useRoleView();
  const isStaff = !loading && (isSiteAdmin || clubDirectorFor.length > 0) && isStaffView;

  const homeHref = user ? `/players/view?uid=${user.uid}` : "/";

  const BASE_TABS = [
    { href: homeHref,              label: "Home",  icon: Home },
    { href: "/games",              label: "Games", icon: Swords },
    { href: "/ladder/play-dates",  label: "Dates", icon: CalendarDays },
    { href: "/players",            label: "Ranks", icon: Trophy },
  ] as const;

  const tabs = isStaff ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 inset-x-0 z-40 bg-obsidian-900/95 backdrop-blur-md border-t border-obsidian-700"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className={cn("grid", isStaff ? "grid-cols-5" : "grid-cols-4")}>
        {tabs.map(({ href, label, icon: Icon }) => {
          const hrefPath = href.split("?")[0] ?? href;
          const active = label === "Home"
            ? pathname === "/" || pathname.startsWith("/players/view")
            : pathname.startsWith(hrefPath);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium tracking-wide uppercase transition-colors",
                  active
                    ? href === "/admin"
                      ? "text-ember-400"
                      : "text-ember-400"
                    : "text-ash-400 hover:text-ash-200",
                )}
              >
                <Icon className={cn(
                  "h-5 w-5",
                  active && "drop-shadow-[0_0_6px_rgba(255,106,31,0.6)]",
                  href === "/admin" && !active && "text-ember-600",
                )} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
