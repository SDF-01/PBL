import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-obsidian-950">
      <div className="text-center space-y-6 max-w-md">
        <div className="heading-display text-[64px] text-ember-500 leading-none select-none">
          404
        </div>
        <div className="space-y-2">
          <h1 className="heading-fantasy text-display-md text-ash-100">Page Not Found</h1>
          <p className="text-ash-400 text-sm leading-relaxed">
            This route doesn&apos;t exist or may have been moved. Check the URL or head back to safety.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-pixel bg-ember-500 text-obsidian-900 text-sm font-heading uppercase tracking-wider hover:bg-ember-400 transition-colors border border-ember-600 shadow-[0_2px_0_0_rgba(0,0,0,0.6)]"
          >
            <Home className="h-4 w-4" /> Home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-pixel bg-obsidian-700 text-ash-100 text-sm font-heading uppercase tracking-wider hover:bg-obsidian-600 transition-colors border border-obsidian-500"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
