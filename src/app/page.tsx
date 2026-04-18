"use client";

import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { useIsMobile } from "@/lib/device";
import { HomeDesktop } from "./HomeDesktop";
import { HomeMobile } from "./HomeMobile";

// Device-aware homepage. Each branch renders its own component tree so we
// can tune layout, information density, and interaction patterns per device
// class — not merely reflow the same DOM.
export default function HomePage() {
  const isMobile = useIsMobile();
  return (
    <ResponsiveShell desktopChromeless>
      {isMobile ? <HomeMobile /> : <HomeDesktop />}
    </ResponsiveShell>
  );
}
