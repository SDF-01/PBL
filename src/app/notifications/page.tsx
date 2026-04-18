"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { subscribeNotifications } from "@/lib/firestore/repo";
import { markNotificationRead } from "@/lib/firestore/write";
import type { NotificationDoc } from "@/lib/firestore/types";
import { Bell, Check } from "lucide-react";

export default function NotificationsPage() {
  const { user, ready, signIn } = useAuth();
  const [items, setItems] = useState<NotificationDoc[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeNotifications(user.uid, setItems);
    return () => unsub();
  }, [user]);

  if (ready && !user) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-2xl">
          <Panel variant="quest" padding="lg">
            <RuneChip tone="rune" className="mb-3">Sign-in required</RuneChip>
            <h1 className="heading-fantasy text-2xl text-ash-100 mb-2">Notifications</h1>
            <p className="text-ash-400 text-sm mb-5">
              Sign in to see tournament announcements and personal alerts.
            </p>
            <Button onClick={() => signIn().catch(() => {})}>Sign in with Google</Button>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-10 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="heading-fantasy text-display-md text-ash-100">Notifications</h1>
            <p className="text-ash-400 text-sm mt-1">
              {items.length === 0 ? "All caught up." : `${items.length} recent`}
            </p>
          </div>
          <Bell className="h-6 w-6 text-ash-500" />
        </div>

        {items.length === 0 ? (
          <Panel variant="base" padding="lg">
            <p className="text-ash-400 text-sm">No notifications yet.</p>
          </Panel>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => (
              <NotificationRow key={n.id} n={n} />
            ))}
          </ul>
        )}
      </main>
    </ResponsiveShell>
  );
}

function NotificationRow({ n }: { n: NotificationDoc }) {
  const ts = formatTimestamp(n.createdAt);
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    n.href ? (
      <Link
        href={n.href}
        onClick={() => !n.read && markNotificationRead(n.id).catch(() => {})}
        className="block"
      >
        {children}
      </Link>
    ) : (
      <div>{children}</div>
    );

  return (
    <li>
      <Wrapper>
        <Panel
          variant={n.read ? "base" : "raised"}
          padding="md"
          className={n.read ? "opacity-70" : ""}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {!n.read && (
                  <span className="inline-block h-2 w-2 rounded-full bg-ember-500" />
                )}
                <span className="heading-fantasy text-ash-100 text-sm truncate">
                  {n.title}
                </span>
              </div>
              <p className="text-sm text-ash-300">{n.body}</p>
              <div className="text-[11px] text-ash-500 mt-1.5 font-mono">{ts}</div>
            </div>
            {!n.read && (
              <button
                type="button"
                aria-label="Mark as read"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  markNotificationRead(n.id).catch(() => {});
                }}
                className="text-ash-500 hover:text-ember-400 p-1"
              >
                <Check className="h-4 w-4" />
              </button>
            )}
          </div>
        </Panel>
      </Wrapper>
    </li>
  );
}

function formatTimestamp(ts: NotificationDoc["createdAt"]): string {
  if (!ts) return "";
  // Firestore Timestamp comes through as { seconds, nanoseconds } in real-time
  // listeners before serialization; handle both shapes defensively.
  const obj = ts as unknown as { seconds?: number; toDate?: () => Date };
  const date =
    typeof obj.toDate === "function"
      ? obj.toDate()
      : typeof obj.seconds === "number"
        ? new Date(obj.seconds * 1000)
        : typeof ts === "string"
          ? new Date(ts)
          : null;
  if (!date) return "";
  return date.toLocaleString();
}
