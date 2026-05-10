"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2, LogOut } from "lucide-react";
import { GoogleAuthProvider, signInWithPopup, signOut as fbSignOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

const TEST_MODE_KEY = "pbl_test_mode";

interface TestModeState {
  provider: "google.com" | "password";
}

function readTestMode(): TestModeState | null {
  try {
    const raw = localStorage.getItem(TEST_MODE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TestModeState;
  } catch {
    return null;
  }
}

export function TestModeBanner() {
  const [state, setState] = useState<TestModeState | null>(null);
  const [exiting, setExiting] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setState(readTestMode());
  }, [user]);

  if (!state) return null;

  async function handleExit() {
    setExiting(true);
    localStorage.removeItem(TEST_MODE_KEY);
    try {
      await fbSignOut(auth());
      if (state?.provider === "google.com") {
        // Re-auth silently — browser is still logged into Google so this
        // usually resolves without any visible popup.
        await signInWithPopup(auth(), new GoogleAuthProvider());
        router.push("/admin/testing");
      } else {
        router.push("/auth/login");
      }
    } catch {
      // If the re-auth popup is dismissed or fails, send to login.
      router.push("/auth/login");
    }
  }

  return (
    <div className="w-full bg-ember-600 text-obsidian-900 flex items-center justify-between gap-3 px-4 py-2 text-xs font-medium z-50">
      <span className="flex items-center gap-1.5">
        <FlaskConical className="h-3.5 w-3.5 shrink-0" />
        Test Mode · signed in as{" "}
        <span className="font-mono font-bold">
          {user?.displayName ?? user?.email ?? "test account"}
        </span>
      </span>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="flex items-center gap-1 underline underline-offset-2 hover:no-underline whitespace-nowrap disabled:opacity-60"
      >
        {exiting ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <LogOut className="h-3 w-3" />
        )}
        {exiting ? "Returning…" : "Exit Test Mode"}
      </button>
    </div>
  );
}
