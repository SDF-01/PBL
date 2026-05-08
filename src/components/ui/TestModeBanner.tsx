"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

// Key written by TestingClient before switching into a test account.
const TEST_MODE_KEY = "pbl_test_mode";

export function TestModeBanner() {
  const [active, setActive] = useState(false);
  const { user, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setActive(localStorage.getItem(TEST_MODE_KEY) === "1");
  }, [user]);

  if (!active) return null;

  async function handleExit() {
    localStorage.removeItem(TEST_MODE_KEY);
    await signOut();
    router.push("/auth/login");
  }

  return (
    <div className="w-full bg-ember-600 text-obsidian-900 flex items-center justify-between gap-3 px-4 py-2 text-xs font-medium z-50">
      <span className="flex items-center gap-1.5">
        <FlaskConical className="h-3.5 w-3.5 shrink-0" />
        Test Mode · signed in as{" "}
        <span className="font-mono font-bold">{user?.displayName ?? user?.email ?? "test account"}</span>
      </span>
      <button
        onClick={handleExit}
        className="flex items-center gap-1 underline underline-offset-2 hover:no-underline whitespace-nowrap"
      >
        <LogOut className="h-3 w-3" /> Exit Test Mode
      </button>
    </div>
  );
}
