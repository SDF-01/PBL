"use client";

import Link from "next/link";
import { CrestLogo } from "@/components/brand/CrestLogo";
import { SignInButton } from "@/components/ui/SignInButton";
import { ModeToggle } from "@/components/ui/ModeToggle";
import { Bell, UserSearch } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useAdminMode } from "@/lib/admin-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { useRoleView } from "@/lib/role-view-context";
import { RuneChip } from "@/components/ui/RuneChip";
import { subscribeNotifications } from "@/lib/firestore/repo";

export function MobileTopBar() {
  const { canAccessAdmin } = useAdminMode();
  const { isSiteAdmin, clubDirectorFor, coordinatorClubIds, loading } = usePermissions();
  const { isStaffView } = useRoleView();
  const [unread, setUnread] = useState(0);

  const roleChip = !loading && user
    ? isSiteAdmin && isStaffView ? { label: "Admin", tone: "ember" as const }
    : clubDirectorFor.length > 0 && isStaffView ? { label: "Director", tone: "rune" as const }
    : coordinatorClubIds.length > 0 && isStaffView ? { label: "Coord", tone: "rune" as const }
    : null
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
          {canAccessAdmin && <ModeToggle />}
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
