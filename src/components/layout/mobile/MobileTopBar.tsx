"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CrestLogo } from "@/components/brand/CrestLogo";
import { SignInButton } from "@/components/ui/SignInButton";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { subscribeNotifications } from "@/lib/firestore/repo";

export function MobileTopBar() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

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
    <header className="sticky top-0 z-40 bg-obsidian-900/90 backdrop-blur-md ember-divider">
      <div className="flex items-center justify-between px-4 h-14">
        <Link href="/" className="flex items-center gap-2">
          <CrestLogo className="w-7 h-7 text-ember-500" />
          <span className="heading-fantasy text-ash-100 text-base tracking-wide">
            Pickleball League
          </span>
        </Link>
        <div className="flex items-center gap-2">
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
          <SignInButton />
        </div>
      </div>
    </header>
  );
}
