"use client";

import type { ReactNode } from "react";
import { useDevice } from "@/lib/device";
import { TopNav } from "./TopNav";
import { SiteFooter } from "./SiteFooter";
import { MobileTopBar } from "./mobile/MobileTopBar";
import { MobileTabBar } from "./mobile/MobileTabBar";

// ResponsiveShell swaps the entire chrome based on device class. This is
// distinct from Tailwind media queries: each branch renders its own
// component tree, so we avoid loading heavy desktop-only layout pieces on
// mobile (and vice-versa) and each surface can be tuned independently.

interface Props {
  children: ReactNode;
  /**
   * When true, the desktop branch renders only `children` (no chrome). Useful
   * for routes that already render their own TopNav/SiteFooter, like the
   * homepage and tournaments list.
   */
  desktopChromeless?: boolean;
  /**
   * When true, the mobile branch adds extra bottom padding to account for the
   * fixed MobileTabBar. Default true.
   */
  mobilePadForTabBar?: boolean;
}

export function ResponsiveShell({
  children,
  desktopChromeless = false,
  mobilePadForTabBar = true,
}: Props) {
  const { isMobile, ready } = useDevice();

  // Before detection completes we render a neutral shell so there's no layout
  // thrash. This renders once on the client; static export produces a skeleton
  // that hydrates into the correct branch on mount.
  if (!ready) {
    return <div className="min-h-screen">{children}</div>;
  }

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col">
        <MobileTopBar />
        <div className={mobilePadForTabBar ? "pb-20 flex-1" : "flex-1"}>{children}</div>
        <MobileTabBar />
      </div>
    );
  }

  if (desktopChromeless) {
    return <>{children}</>;
  }

  return (
    <>
      <TopNav />
      {children}
      <SiteFooter />
    </>
  );
}
