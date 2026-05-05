"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarDays, Home, ShieldCheck, Swords, Trophy } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { useRoleView } from "@/lib/role-view-context";

const ADMIN_TAB = { href: "/admin",    label: "Admin", icon: ShieldCheck } as const;
const CLUBS_TAB = { href: "/clubs/my", label: "Clubs", icon: Building2  } as const;

export function MobileTabBar() {
  const pathname = usePathname() ?? "/";
  const { user } = useAuth();
  const { isSiteAdmin, clubDirectorFor, coordinatorClubIds, loading } = usePermissions();
  const { isStaffView } = useRoleView();

  const homeHref = user ? `/players/view?uid=${user.uid}` : "/";

  const BASE_TABS = [
    { href: homeHref,             label: "Home",  icon: Home        },
    { href: "/games",             label: "Games", icon: Swords      },
    { href: "/ladder/play-dates", label: "Dates", icon: CalendarDays },
    { href: "/players",           label: "Ranks", icon: Trophy      },
  ] as const;

  const isClubStaff =
    !loading &&
    (clubDirectorFor.length > 0 || coordinatorClubIds.length > 0) &&
    isStaffView;

  // Site admin in staff view → 5-tab bar with Admin
  // Club director / coordinator in staff view → 5-tab bar with Clubs
  // Everyone else → 4-tab base bar
  const tabs =
    isSiteAdmin && isStaffView
      ? [...BASE_TABS, ADMIN_TAB]
      : isClubStaff
        ? [...BASE_TABS, CLUBS_TAB]
        : BASE_TABS;

  const colCount = tabs.length;
  const gridCols = colCount === 5 ? "grid-cols-5" : "grid-cols-4";

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 inset-x-0 z-40 bg-obsidian-900/95 backdrop-blur-md border-t border-obsidian-700"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className={cn("grid", gridCols)}>
        {tabs.map(({ href, label, icon: Icon }) => {
          const hrefPath = href.split("?")[0] ?? href;
          const active =
            label === "Home"
              ? pathname === "/" || pathname.startsWith("/players/view")
              : pathname.startsWith(hrefPath);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium tracking-wide uppercase transition-colors",
                  active ? "text-ember-400" : "text-ash-400 hover:text-ash-200",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    active && "drop-shadow-[0_0_6px_rgba(255,106,31,0.6)]",
                    label === "Admin" && !active && "text-ember-600",
                    label === "Clubs" && !active && "text-ember-600",
                  )}
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
