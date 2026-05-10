"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { subscribeNotifications } from "@/lib/firestore/repo";

export function useUnreadNotifications(): number {
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

  return unread;
}
