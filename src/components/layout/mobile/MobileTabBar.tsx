"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MapPin, Trophy, CalendarDays } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/",                  label: "Home",     icon: Home },
  { href: "/ladder/check-in",   label: "Check In", icon: MapPin },
  { href: "/ladder/play-dates", label: "Dates",    icon: CalendarDays },
  { href: "/players",           label: "Ranks",    icon: Trophy },
] as const;

export function MobileTabBar() {
  const pathname = usePathname() ?? "/";
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 inset-x-0 z-40 bg-obsidian-900/95 backdrop-blur-md border-t border-obsidian-700"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium tracking-wide uppercase transition-colors",
                  active ? "text-ember-400" : "text-ash-400 hover:text-ash-200",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_6px_rgba(255,106,31,0.6)]")} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
