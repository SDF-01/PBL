import Link from "next/link";
import { CrestLogo } from "@/components/brand/CrestLogo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-obsidian-400 bg-obsidian-900/60">
      <div className="container py-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-ember-500">
            <CrestLogo size={24} />
            <span className="heading-display text-[11px] tracking-[0.25em] text-ash-100">
              PICKLEBALL·LEAGUE
            </span>
          </div>
          <p className="mt-3 text-xs text-ash-400 leading-relaxed max-w-sm">
            A competitive pickleball league, tournament, and community platform.
          </p>
        </div>
        <nav className="flex flex-wrap gap-5 text-sm">
          <Link href="/tournaments" className="text-ash-400 hover:text-spectral-500 transition-colors">Tournaments</Link>
          <Link href="/dashboard" className="text-ash-400 hover:text-spectral-500 transition-colors">Dashboard</Link>
        </nav>
      </div>
      <div className="rune-divider" />
      <div className="container py-4 flex items-center justify-between text-xs text-ash-500">
        <span>© {new Date().getFullYear()} Pickleball League</span>
        <span className="font-mono">v0.1.0</span>
      </div>
    </footer>
  );
}
