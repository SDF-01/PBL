"use client";

import Link from "next/link";
import { CrestLogo } from "@/components/brand/CrestLogo";
import { Menu, Bell } from "lucide-react";

// Compact top bar for mobile — crest + title + notifications entry point.
// Primary navigation is handled by the bottom tab bar; this bar is just brand
// + system affordances so tap targets stay far from thumb-hit zones at the
// bottom.

export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-40 bg-obsidian-900/90 backdrop-blur-md ember-divider">
      <div className="flex items-center justify-between px-4 h-14">
        <Link href="/" className="flex items-center gap-2">
          <CrestLogo className="w-7 h-7 text-ember-500" />
          <span className="heading-fantasy text-ash-100 text-base tracking-wide">Pickleball League</span>
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Notifications"
            className="w-10 h-10 flex items-center justify-center text-ash-300 hover:text-ember-400 transition-colors"
          >
            <Bell className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Menu"
            className="w-10 h-10 flex items-center justify-center text-ash-300 hover:text-ember-400 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
