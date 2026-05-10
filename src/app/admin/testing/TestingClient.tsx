"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FlaskConical, Loader2, LogIn, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { useToast } from "@/lib/toast-context";
import { listTestAccounts } from "@/lib/firestore/userRepo";
import { isFirebaseConfigured } from "@/lib/firebase";
import type { UserProfile } from "@/lib/firestore/types";

const TEST_PASSWORD = "TestPlayer123!";
const TEST_EMAIL_DOMAIN = "pbl-test.com";
export const TEST_MODE_KEY = "pbl_test_mode";

export function TestingClient() {
  const router = useRouter();
  const { user, signInWithEmail, signOut } = useAuth();
  const { isSiteAdmin, loading: permLoading } = usePermissions();
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<UserProfile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    if (permLoading || !isSiteAdmin || !isFirebaseConfigured()) {
      setLoading(false);
      return;
    }
    listTestAccounts()
      .then(setAccounts)
      .catch((e) => toast(e instanceof Error ? e.message : "Failed to load test accounts.", "error"))
      .finally(() => setLoading(false));
  }, [isSiteAdmin, permLoading, toast]);

  async function handleSwitch(account: UserProfile) {
    if (switching) return;
    setSwitching(account.uid);
    try {
      // Persist the admin's provider so the banner can re-auth them on exit.
      const adminProvider =
        user?.providerData.find((p) => p.providerId === "google.com")
          ? "google.com"
          : "password";
      localStorage.setItem(
        TEST_MODE_KEY,
        JSON.stringify({ provider: adminProvider }),
      );
      await signInWithEmail(account.email, TEST_PASSWORD);
      router.push("/dashboard");
    } catch (e) {
      localStorage.removeItem(TEST_MODE_KEY);
      toast(e instanceof Error ? e.message : "Failed to switch account.", "error");
      setSwitching(null);
    }
  }

  async function handleExitTestMode() {
    localStorage.removeItem(TEST_MODE_KEY);
    await signOut();
    router.push("/auth/login");
  }

  if (permLoading || loading) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-3xl">
          <Panel variant="base" padding="lg" className="text-center text-ash-500 text-sm">
            Loading…
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  if (!isSiteAdmin) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-3xl">
          <Panel variant="quest" padding="lg" className="text-center space-y-2">
            <ShieldAlert className="h-8 w-8 text-crimson-500 mx-auto" />
            <h2 className="heading-fantasy text-ash-100 text-base">Access Denied</h2>
            <p className="text-ash-400 text-sm">Site Administrator privileges required.</p>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  const inTestMode = user?.email?.endsWith(`@${TEST_EMAIL_DOMAIN}`) ?? false;

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-3xl">

        {/* Header */}
        <div>
          <Link
            href="/admin"
            className="text-ash-400 hover:text-ash-200 text-sm inline-flex items-center gap-1 mb-3"
          >
            <ArrowLeft className="h-4 w-4" /> Admin
          </Link>
          <RuneChip tone="rune" className="mb-2 inline-flex items-center gap-1">
            <FlaskConical className="h-3 w-3" /> Testing
          </RuneChip>
          <h1 className="heading-fantasy text-display-md text-ash-100">Test Accounts</h1>
          <p className="text-ash-400 text-sm mt-1">
            Switch into a fake player account to test the site from their perspective.
            You will be signed out of admin — click <strong className="text-ash-200">Exit Test Mode</strong> in the banner to return.
          </p>
        </div>

        {/* Credentials card */}
        <Panel variant="base" padding="md" className="space-y-1 text-sm">
          <p className="text-ash-500 text-[10px] uppercase tracking-widest">Shared credentials</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-ash-200">
            <span>email <span className="text-ash-500">→</span> test.firstname.lastname@{TEST_EMAIL_DOMAIN}</span>
            <span>password <span className="text-ash-500">→</span> <span className="text-spectral-300">{TEST_PASSWORD}</span></span>
          </div>
          <p className="text-ash-600 text-[10px] mt-1">
            Run <code className="text-spectral-400">npm run seed:test</code> to create / refresh all accounts.
          </p>
        </Panel>

        {/* Exit test mode (shown when already in a test account) */}
        {inTestMode && (
          <Panel variant="quest" padding="md" className="flex items-center justify-between gap-3 flex-wrap border-ember-500/40">
            <p className="text-ember-300 text-sm">
              Currently signed in as a test account ({user?.displayName}).
            </p>
            <Button size="sm" variant="danger" onClick={handleExitTestMode}>
              <Trash2 className="h-3.5 w-3.5" /> Exit Test Mode
            </Button>
          </Panel>
        )}

        {/* Account list */}
        {accounts.length === 0 ? (
          <Panel variant="quest" padding="lg" className="text-center space-y-3">
            <FlaskConical className="mx-auto h-10 w-10 text-ash-600" />
            <p className="text-ash-400 text-sm">
              No test accounts found. Run <code className="text-spectral-400">npm run seed:test</code> to generate them.
            </p>
          </Panel>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => {
              const isCurrent = user?.uid === a.uid;
              const isLoading = switching === a.uid;

              return (
                <Panel
                  key={a.uid}
                  variant={isCurrent ? "quest" : "inventory"}
                  padding="md"
                  className="flex items-center gap-3 flex-wrap"
                >
                  {/* Avatar letter */}
                  <div className="h-9 w-9 rounded-pixel bg-obsidian-700 border border-obsidian-500 flex items-center justify-center heading-fantasy text-base text-ash-400 shrink-0">
                    {(a.displayName ?? a.email ?? "?").slice(0, 1).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-ash-100 text-sm font-medium truncate">
                      {a.displayName}
                      {isCurrent && (
                        <span className="ml-1.5 text-[10px] text-ember-400">you</span>
                      )}
                    </p>
                    <p className="text-ash-500 text-xs font-mono truncate">{a.email}</p>
                  </div>

                  {/* Link to their profile */}
                  <Link
                    href={`/players/view?uid=${a.uid}`}
                    className="text-ash-500 hover:text-spectral-400 text-xs shrink-0 transition-colors"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Profile ↗
                  </Link>

                  {/* Switch button */}
                  <Button
                    size="sm"
                    variant={isCurrent ? "outline" : "primary"}
                    disabled={!!switching || isCurrent}
                    onClick={() => handleSwitch(a)}
                    className="shrink-0"
                  >
                    {isLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LogIn className="h-3.5 w-3.5" />
                    )}
                    {isCurrent ? "Active" : "Switch"}
                  </Button>
                </Panel>
              );
            })}
          </div>
        )}

        {/* Footer note */}
        {accounts.length > 0 && (
          <p className="text-ash-600 text-xs text-center">
            {accounts.length} test account{accounts.length !== 1 ? "s" : ""} · all marked <code>isTestAccount: true</code> in Firestore
          </p>
        )}
      </main>
    </ResponsiveShell>
  );
}
