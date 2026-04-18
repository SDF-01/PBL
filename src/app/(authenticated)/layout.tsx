"use client";

import { useDevice } from "@/lib/device";
import { TopNav } from "@/components/layout/TopNav";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { MobileTopBar } from "@/components/layout/mobile/MobileTopBar";
import { MobileTabBar } from "@/components/layout/mobile/MobileTabBar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isMobile, ready } = useDevice();

  if (!ready) {
    return <div className="min-h-screen">{children}</div>;
  }

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col">
        <MobileTopBar />
        <main className="flex-1 px-4 py-4 pb-20">{children}</main>
        <MobileTabBar />
      </div>
    );
  }

  return (
    <>
      <TopNav />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <AppSidebar />
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </>
  );
}
