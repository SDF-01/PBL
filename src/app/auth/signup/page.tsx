"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { useAuth } from "@/lib/auth-context";
import { resolveSelectedLeagueId } from "@/lib/selectedLeague";

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const { user, ready, signIn } = useAuth();
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

  async function handleSignup() {
    setSubmitting(true);
    setError(null);
    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-10 max-w-xl">
        <div className="space-y-4">
          <RuneChip tone="rune" className="mb-3">Create Account</RuneChip>
          <h1 className="heading-fantasy text-display-md text-ash-100">
            Create your Ladder League account
          </h1>
          <p className="text-ash-400 text-sm">
            Sign up to join a league, set up your player profile, and start checking in.
          </p>
        </div>

        <Panel variant="quest" padding="lg" className="mt-6">
          <div className="space-y-4">
            <Button size="lg" className="w-full" onClick={handleSignup} disabled={submitting}>
              {submitting ? "Creating account…" : "Continue with Google"}
            </Button>
            {error ? <p className="text-rose-400 text-sm">{error}</p> : null}
            <div className="text-sm text-ash-400">
              Already have an account?{' '}
              <Link href={`/auth/login${selectedLeagueId ? `?leagueId=${selectedLeagueId}` : ""}`} className="text-ember-300 hover:text-ember-200">
                Login
              </Link>
            </div>
          </div>
        </Panel>
      </main>
    </ResponsiveShell>
  );
}
