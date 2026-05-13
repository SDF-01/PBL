"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { useAuth } from "@/lib/auth-context";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user, ready, resendVerificationEmail } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.push("/auth/login");
      return;
    }
    if (user.emailVerified) {
      router.push(`/players/view?uid=${user.uid}`);
    }
  }, [user, ready, router]);

  async function handleResend() {
    setSending(true);
    setError(null);
    try {
      await resendVerificationEmail();
      setSent(true);
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/too-many-requests") {
        setError("Too many requests. Please wait a moment before trying again.");
      } else {
        setError("Failed to send verification email. Please try again.");
      }
    } finally {
      setSending(false);
    }
  }

  if (!ready || !user) return null;

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 max-w-xl space-y-6">
        <div>
          <RuneChip tone="rune" className="mb-3">Verify Email</RuneChip>
          <h1 className="heading-fantasy text-display-md text-ash-100">
            Check your inbox
          </h1>
          <p className="text-ash-400 text-sm mt-1">
            We sent a verification link to{" "}
            <span className="text-ash-200">{user.email}</span>.
            Click the link in that email to verify your account.
          </p>
        </div>

        <Panel variant="quest" padding="lg" className="space-y-4">
          <p className="text-sm text-ash-400">
            Didn&apos;t get it? Check your spam folder, or resend the email below.
          </p>

          {sent && (
            <p className="text-sm text-emerald-400">
              Verification email sent. Check your inbox.
            </p>
          )}

          {error && <p className="text-sm text-crimson-500">{error}</p>}

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleResend}
            disabled={sending || sent}
          >
            {sending ? "Sending…" : sent ? "Email sent" : "Resend verification email"}
          </Button>
        </Panel>

        <p className="text-sm text-ash-400 text-center">
          Already verified?{" "}
          <Link href="/auth/login" className="text-ember-300 hover:text-ember-200">
            Sign in
          </Link>
          {" "}or{" "}
          <Link href={`/players/view?uid=${user.uid}`} className="text-ember-300 hover:text-ember-200">
            Continue to profile
          </Link>
        </p>
      </main>
    </ResponsiveShell>
  );
}
