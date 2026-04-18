import Link from "next/link";
import { CrestLogo } from "@/components/brand/CrestLogo";
import { Button } from "@/components/ui/Button";
import { Bell, Search, Swords } from "lucide-react";

const NAV = [
  { href: "/leagues",     label: "Leagues" },
  { href: "/tournaments", label: "Tournaments" },
  { href: "/standings",   label: "Standings" },
  { href: "/rankings",    label: "Rankings" },
  { href: "/players",     label: "Players" },
  { href: "/hall-of-fame",label: "Hall of Fame" },
] as const;

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-obsidian-400 bg-obsidian-800/80 backdrop-blur supports-[backdrop-filter]:bg-obsidian-800/65">
      <div className="container flex h-14 items-center gap-6">
        <Link href="/" className="flex items-center gap-2 text-ember-500 hover:text-ember-400 transition-colors">
          <CrestLogo size={28} />
          <span className="heading-display text-xs text-ash-100 tracking-[0.25em]">
            OBSIDIAN<span className="text-ember-500">·</span>ARENA
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
          <Button variant="ghost" size="icon" aria-label="Search">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>
          <Link href="/dashboard" className="hidden sm:block">
            <Button variant="outline" size="sm">
              <Swords className="h-3.5 w-3.5" /> Enter Arena
            </Button>
          </Link>
        </div>
      </div>
      <div className="ember-divider" />
    </header>
  );
}
