"use client";

import { useState } from "react";
import Link from "next/link";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { useAuth } from "@/lib/auth-context";

const fieldCls =
  "w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100 placeholder:text-ash-600 focus:outline-none focus:border-ember-500";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/user-not-found" || code === "auth/invalid-email") {
        // Don't reveal whether the email exists — always show success
        setSent(true);
      } else if (code === "auth/too-many-requests") {
        setError("Too many requests. Please wait a moment and try again.");
      } else {
        setError("Failed to send reset email. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 max-w-xl space-y-6">
        <div>
          <RuneChip tone="rune" className="mb-3">Password Reset</RuneChip>
          <h1 className="heading-fantasy text-display-md text-ash-100">
            Forgot your password?
          </h1>
          <p className="text-ash-400 text-sm mt-1">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        <Panel variant="quest" padding="lg">
          {sent ? (
            <div className="space-y-4">
              <p className="text-sm text-emerald-400">
                If an account exists for <span className="text-ash-200">{email}</span>,
                a password reset link has been sent. Check your inbox (and spam folder).
              </p>
              <Link href="/auth/login">
                <Button type="button" size="lg" className="w-full">
                  Back to Sign In
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-3">
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

              {error && <p className="text-sm text-crimson-500">{error}</p>}

              <div className="space-y-3 pt-1">
                <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                  {submitting ? "Sending…" : "Send reset link"}
                </Button>
              </div>
            </form>
          )}
        </Panel>

        {!sent && (
          <p className="text-sm text-ash-400 text-center">
            Remember your password?{" "}
            <Link href="/auth/login" className="text-ember-300 hover:text-ember-200">
              Sign in
            </Link>
          </p>
        )}
      </main>
    </ResponsiveShell>
  );
}
