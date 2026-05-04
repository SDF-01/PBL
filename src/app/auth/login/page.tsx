"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { useAuth } from "@/lib/auth-context";
import { resolveSelectedLeagueId } from "@/lib/selectedLeague";

const fieldCls =
  "w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100 placeholder:text-ash-600 focus:outline-none focus:border-ember-500";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const { user, ready, signIn, signInWithEmail } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedLeagueId(resolveSelectedLeagueId(searchParams));
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      router.push(
        selectedLeagueId ? `/players/edit?leagueId=${selectedLeagueId}` : "/players/edit",
      );
    }
  }, [user, router, selectedLeagueId]);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setSubmitting(true);
    setError(null);
    try {
      await signIn();
      // signInWithRedirect navigates away; execution won't reach here on success.
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    }
  }

  if (!ready) return null;

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 max-w-xl space-y-6">
        <div>
          <RuneChip tone="rune" className="mb-3">Sign In</RuneChip>
          <h1 className="heading-fantasy text-display-md text-ash-100">
            Welcome back
          </h1>
          <p className="text-ash-400 text-sm mt-1">
            Access your player profile, manage your league, and check in for upcoming sessions.
          </p>
        </div>

        <Panel variant="quest" padding="lg">
          <form onSubmit={handleEmailLogin} noValidate className="space-y-3">
            <label className="text-xs text-ash-400 space-y-1 block">
              <span>Email</span>
              <input
                type="email"
                className={fieldCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="text-xs text-ash-400 space-y-1 block">
              <span>Password</span>
              <input
                type="password"
                className={fieldCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
                required
              />
            </label>

            {error && <p className="text-sm text-crimson-500">{error}</p>}

            <div className="space-y-3 pt-1">
              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting ? "Signing in…" : "Sign In"}
              </Button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-ash-700" />
                <span className="text-xs text-ash-500">or</span>
                <div className="flex-1 h-px bg-ash-700" />
              </div>

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                onClick={handleGoogleLogin}
                disabled={submitting}
              >
                Continue with Google
              </Button>
            </div>
          </form>
        </Panel>

        <p className="text-sm text-ash-400 text-center">
          Don&apos;t have an account?{" "}
          <Link
            href={`/auth/signup${selectedLeagueId ? `?leagueId=${selectedLeagueId}` : ""}`}
            className="text-ember-300 hover:text-ember-200"
          >
            Create Account
          </Link>
        </p>
      </main>
    </ResponsiveShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}

function friendlyAuthError(err: unknown): string {
  if (!(err instanceof Error)) return "Sign-in failed. Please try again.";
  const code = (err as { code?: string }).code ?? "";
  if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential")
    return "Incorrect email or password.";
  if (code === "auth/invalid-email") return "That email address is not valid.";
  if (code === "auth/user-disabled") return "This account has been disabled.";
  if (code === "auth/too-many-requests")
    return "Too many failed attempts. Please wait a moment and try again.";
  if (code === "auth/network-request-failed")
    return "Network error. Check your connection and try again.";
  return err.message || "Sign-in failed. Please try again.";
}
