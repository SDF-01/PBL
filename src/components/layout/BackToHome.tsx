"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";

/**
 * Breadcrumb row shown on every non-home screen. Provides two always-
 * visible affordances:
 *   • Back   — pops browser history (falls back to Home if no history)
 *   • Home   — hard link to '/'
 *
 * Rendered by layout shells; individual pages don't add it manually.
 * The `container` prop controls whether a centered container wraps the
 * row (needed for chromeless / mobile branches) — authenticated dashboard
 * main already has padding so it passes container={false}.
 */
export function BackToHome({
  container = true,
  className = "",
}: {
  container?: boolean;
  className?: string;
}) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  if (pathname === "/" || pathname === "") return null;

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  const row = (
    <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.15em]">
      <button
        type="button"
        onClick={goBack}
        className="inline-flex items-center gap-1.5 text-ash-500 hover:text-ember-400 transition-colors cursor-pointer"
        aria-label="Go back"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>
      <span className="text-obsidian-400" aria-hidden="true">·</span>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-ash-500 hover:text-ember-400 transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
        Home
      </Link>
    </div>
  );

  if (!container) {
    return <div className={`pt-3 pb-1 ${className}`}>{row}</div>;
  }
  return <div className={`container pt-3 pb-1 ${className}`}>{row}</div>;
}
