import * as React from "react";
import { cn } from "@/lib/cn";

/** Pixel-art crest logo. Pure SVG so it scales crisply and tints via currentColor. */
export function CrestLogo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {/* shield backdrop */}
      <path d="M3 2h10v1H3zM2 3h12v6h-1v2h-1v2h-1v1H6v-1H5v-2H4V9H3V3H2z" fill="currentColor" opacity="0.15"/>
      {/* shield border */}
      <path d="M3 2h10v1h1v6h-1v2h-1v2h-1v1h-1v1H6v-1H5v-1H4v-2H3V9H2V3h1V2z" fill="none" stroke="currentColor" strokeWidth="0.5"/>
      {/* pixel runes — "P" and crossed paddles */}
      <rect x="5" y="5" width="1" height="4" fill="currentColor"/>
      <rect x="6" y="5" width="2" height="1" fill="currentColor"/>
      <rect x="7" y="6" width="1" height="2" fill="currentColor"/>
      <rect x="6" y="7" width="2" height="1" fill="currentColor"/>
      <rect x="9" y="5" width="1" height="1" fill="currentColor"/>
      <rect x="10" y="6" width="1" height="1" fill="currentColor"/>
      <rect x="11" y="7" width="1" height="1" fill="currentColor"/>
      <rect x="10" y="8" width="1" height="1" fill="currentColor"/>
      <rect x="9" y="9" width="1" height="1" fill="currentColor"/>
    </svg>
  );
}
