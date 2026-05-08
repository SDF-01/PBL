"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { registerPushToken } from "@/lib/fcm";
import { useAuth } from "@/lib/auth-context";

type BannerState = "idle" | "asking" | "granted" | "denied" | "dismissed";

/**
 * Shows a one-time banner asking the user to enable push notifications.
 * Persists dismissal in localStorage so it only appears once per browser.
 */
export function PushNotificationBanner() {
  const { user } = useAuth();
  const [state, setState] = useState<BannerState>("idle");

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") { setState("granted"); return; }
    if (Notification.permission === "denied") { setState("denied"); return; }
    if (localStorage.getItem("pbl-push-dismissed") === "1") { setState("dismissed"); return; }
    // Ask after a short delay so it doesn't fire on every page load instantly.
    const t = setTimeout(() => setState("asking"), 3000);
    return () => clearTimeout(t);
  }, [user]);

  if (state !== "asking") return null;

  async function handleEnable() {
    if (!user) return;
    setState("idle"); // hide banner while asking
    const token = await registerPushToken(user.uid);
    setState(token ? "granted" : "denied");
    if (!token) localStorage.setItem("pbl-push-dismissed", "1");
  }

  function handleDismiss() {
    localStorage.setItem("pbl-push-dismissed", "1");
    setState("dismissed");
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 left-0 right-0 flex justify-center px-4 z-50 pointer-events-none">
      <Panel
        variant="raised"
        padding="md"
        glow="ember"
        className="max-w-sm w-full flex items-start gap-3 pointer-events-auto shadow-glow-ember"
      >
        <div className="p-2 rounded bg-ember-900/40 shrink-0">
          <Bell className="h-4 w-4 text-ember-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-ash-100 text-sm font-medium">Enable push notifications</p>
          <p className="text-ash-400 text-xs mt-0.5">
            Get notified when someone follows you, challenges you, or your match results are posted.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleEnable}>
              <Bell className="h-3.5 w-3.5" /> Enable
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Not now
            </Button>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-ash-600 hover:text-ash-400 shrink-0 mt-0.5">
          <X className="h-4 w-4" />
        </button>
      </Panel>
    </div>
  );
}
