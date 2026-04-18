"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  LayoutDashboard, Swords, CalendarDays, Trophy, Users, Scroll,
  ShieldCheck, Gavel, BarChart3, Bell, Settings,
} from "lucide-react";

const SECTIONS: Array<{
  title: string;
  items: Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string }> }>;
}> = [
  {
    title: "Player",
    items: [
      { href: "/dashboard",           label: "Overview",        icon: LayoutDashboard },
      { href: "/my-matches",          label: "My Matches",      icon: Swords },
      { href: "/my-stats",            label: "My Stats",        icon: BarChart3 },
      { href: "/my-achievements",     label: "Achievements",    icon: Trophy },
      { href: "/schedule",            label: "Schedule",        icon: CalendarDays },
      { href: "/notifications",       label: "Notifications",   icon: Bell },
    ],
  },
  {
    title: "Operate",
    items: [
      { href: "/dashboard/admin",     label: "Admin",           icon: ShieldCheck },
      { href: "/dashboard/director",  label: "Director",        icon: Gavel },
      { href: "/dashboard/referee",   label: "Referee",         icon: Scroll },
      { href: "/admin/leagues",       label: "Leagues",         icon: Users },
      { href: "/settings",            label: "Settings",        icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col gap-6 border-r border-obsidian-400 bg-obsidian-800/60 p-4">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <div className="heading-fantasy text-[10px] uppercase tracking-[0.2em] text-ash-500 px-2 mb-2">
            {section.title}
          </div>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
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
      ))}
    </aside>
  );
}
