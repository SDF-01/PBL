"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home } from "lucide-react";

/**
 * Tiny utility shown on every non-home screen so users always have an
 * obvious "return to home" affordance, independent of the top nav
 * (which collapses on mobile and can scroll out of reach on long pages).
 *
 * Rendered by layout shells; pages don't need to add it manually.
 * The `container` prop controls whether a centered container is added
 * (needed for chromeless / mobile branches) or not (authenticated
 * layout's <main> already provides padding).
 */
export function BackToHome({
  container = true,
  className = "",
}: {
  container?: boolean;
  className?: string;
}) {
  const pathname = usePathname() ?? "/";
  if (pathname === "/" || pathname === "") return null;
  const link = (
    <Link
      href="/"
      className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-ash-500 hover:text-ember-400 transition-colors"
    >
      <Home className="h-3.5 w-3.5" />
      Home
    </Link>
  );
  if (!container) {
    return <div className={`pt-3 pb-1 ${className}`}>{link}</div>;
  }
  return <div className={`container pt-3 pb-1 ${className}`}>{link}</div>;
}
