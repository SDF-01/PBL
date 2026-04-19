"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { LayoutDashboard, MapPin, Bell, CalendarDays, Users, Trophy, UserCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const ITEMS: Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { href: "/dashboard",        label: "Overview",      icon: LayoutDashboard },
  { href: "/players",          label: "Leaderboard",   icon: Trophy },
  { href: "/ladder/seasons",   label: "Seasons",       icon: CalendarDays },
  { href: "/ladder/play-dates",label: "Play Dates",    icon: Users },
  { href: "/ladder/check-in",  label: "Check-In",      icon: MapPin },
  { href: "/notifications",    label: "Notifications", icon: Bell },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col gap-6 border-r border-obsidian-400 bg-obsidian-800/60 p-4">
      <div>
        <div className="heading-fantasy text-[10px] uppercase tracking-[0.2em] text-ash-500 px-2 mb-2">
          Navigate
        </div>
        <ul className="space-y-0.5">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-1.5 rounded-pixel text-sm transition-colors",
                    active
                      ? "bg-rune-500/15 text-rune-glow border-l-2 border-rune-500 pl-[calc(0.625rem-2px)]"
                      : "text-ash-300 hover:text-ash-100 hover:bg-obsidian-600",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      {user && (
        <div>
          <div className="heading-fantasy text-[10px] uppercase tracking-[0.2em] text-ash-500 px-2 mb-2">
            You
          </div>
          <ul className="space-y-0.5">
            <li>
              <Link
                href={`/players/view?uid=${user.uid}`}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-pixel text-sm text-ash-300 hover:text-ash-100 hover:bg-obsidian-600 transition-colors"
              >
                <UserCircle2 className="h-4 w-4" />
                My Profile
              </Link>
            </li>
            <li>
              <Link
                href="/players/edit"
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-1.5 rounded-pixel text-sm transition-colors",
                  pathname === "/players/edit"
                    ? "bg-rune-500/15 text-rune-glow border-l-2 border-rune-500 pl-[calc(0.625rem-2px)]"
                    : "text-ash-300 hover:text-ash-100 hover:bg-obsidian-600",
                )}
              >
                <Users className="h-4 w-4" />
                Edit Profile
              </Link>
            </li>
          </ul>
        </div>
      )}
    </aside>
  );
}
