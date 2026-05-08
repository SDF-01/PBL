"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useDevice } from "@/lib/device";
import { useAuth } from "@/lib/auth-context";
import { TopNav } from "@/components/layout/TopNav";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { MobileTopBar } from "@/components/layout/mobile/MobileTopBar";
import { MobileTabBar } from "@/components/layout/mobile/MobileTabBar";
import { BackToHome } from "@/components/layout/BackToHome";
import { PushNotificationBanner } from "@/components/PushNotificationBanner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isMobile, ready: deviceReady } = useDevice();
  const { user, ready: authReady } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (authReady && !user) {
      router.replace(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [authReady, user, router, pathname]);

  // Hold while resolving auth to prevent flash of unauthenticated content.
  if (!authReady || !user) {
    return <div className="min-h-screen bg-obsidian-950" />;
  }

  if (!deviceReady) {
    return <div className="min-h-screen">{children}</div>;
  }

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col">
        <MobileTopBar />
        <div className="pt-14 flex-1 flex flex-col pb-20">
          <BackToHome />
          <main className="flex-1 px-4 py-4">{children}</main>
        </div>
        <MobileTabBar />
      </div>
    );
  }

  return (
    <>
      <TopNav />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <AppSidebar />
        <main className="flex-1 p-6 md:p-8">
          <BackToHome container={false} className="!pt-0" />
          {children}
        </main>
      </div>
      <PushNotificationBanner />
    </>
  );
}
