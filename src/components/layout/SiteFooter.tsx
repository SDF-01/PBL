import Link from "next/link";
import { CrestLogo } from "@/components/brand/CrestLogo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-obsidian-400 bg-obsidian-900/60">
      <div className="container py-10 grid gap-8 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 text-ember-500">
            <CrestLogo size={24} />
            <span className="heading-display text-[11px] tracking-[0.25em] text-ash-100">OBSIDIAN·ARENA</span>
          </div>
          <p className="mt-3 text-xs text-ash-400 leading-relaxed max-w-xs">
            A competitive pickleball league, tournament, and community platform — forged in obsidian.
          </p>
        </div>
        <FooterCol title="Compete" links={[["/leagues","Leagues"],["/tournaments","Tournaments"],["/schedule","Schedule"],["/standings","Standings"]]} />
        <FooterCol title="Community" links={[["/clubs","Clubs"],["/players","Players"],["/teams","Teams"],["/hall-of-fame","Hall of Fame"]]} />
        <FooterCol title="Operate" links={[["/admin","Admin"],["/dashboard/director","Director"],["/dashboard/referee","Referee"],["/about","About"]]} />
      </div>
      <div className="rune-divider" />
      <div className="container py-4 flex items-center justify-between text-xs text-ash-500">
        <span>© {new Date().getFullYear()} Pickleball League</span>
        <span className="font-mono">v0.1.0 · forged</span>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <h4 className="heading-fantasy text-xs text-ash-300 uppercase tracking-widest mb-3">{title}</h4>
      <ul className="space-y-1.5 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-ash-400 hover:text-spectral-500 transition-colors">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
