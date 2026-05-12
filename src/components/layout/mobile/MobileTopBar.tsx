"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CrestLogo } from "@/components/brand/CrestLogo";
import { SignInButton } from "@/components/ui/SignInButton";
import { ModeToggle } from "@/components/ui/ModeToggle";
import { Bell, UserSearch } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { useRoleView } from "@/lib/role-view-context";
import { RuneChip } from "@/components/ui/RuneChip";
import { subscribeNotifications } from "@/lib/firestore/repo";

export function MobileTopBar() {
  const { user } = useAuth();
  const { loading } = usePermissions();
  const { isStaffView, activeRole, options } = useRoleView();
  const [unread, setUnread] = useState(0);

  const chipTone = activeRole.id === "SiteAdmin" ? ("ember" as const) : ("rune" as const);
  const roleChip = !loading && user && isStaffView
    ? { label: activeRole.label, tone: chipTone }
    : null;

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    const unsub = subscribeNotifications(user.uid, (items) => {
      setUnread(items.filter((n) => !n.read).length);
    });
    return () => unsub();
  }, [user]);

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-obsidian-900/90 backdrop-blur-md ember-divider">
      <div className="flex items-center justify-between px-4 h-14">
        <Link href="/" className="flex items-center gap-2">
          <CrestLogo className="w-7 h-7 text-ember-500" />
          <span className="heading-fantasy text-ash-100 text-base tracking-wide">
            Ladder League
          </span>
          {roleChip && (
            <RuneChip tone={roleChip.tone} className="text-[9px]">
              {roleChip.label}
            </RuneChip>
          )}
        </Link>
        <div className="flex items-center gap-2">
          {options.length > 1 && <ModeToggle />}
          <Link
            href="/players/search"
            aria-label="Find a player"
            className="w-10 h-10 flex items-center justify-center text-ash-300 hover:text-spectral-400 transition-colors"
          >
            <UserSearch className="h-5 w-5" />
          </Link>
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="relative w-10 h-10 flex items-center justify-center text-ash-300 hover:text-ember-400 transition-colors"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center text-[10px] font-mono rounded-full bg-ember-500 text-obsidian-900">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <SignInButton compact />
        </div>
      </div>
    </header>
  );
}
