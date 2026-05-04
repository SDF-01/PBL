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

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`text-xs text-ash-400 space-y-1 block ${className ?? ""}`}>
      <span>
        {label}
        {required && <span className="text-crimson-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const { user, ready, signIn, signUpWithEmail } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [skillRating, setSkillRating] = useState<number | "">("");
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

  function validate(): string | null {
    if (!firstName.trim()) return "First name is required.";
    if (!lastName.trim()) return "Last name is required.";
    if (!email.trim()) return "Email is required.";
    if (!password) return "Password is required.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return null;
  }

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signUpWithEmail({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phone.trim() || undefined,
        startingSkillRating: typeof skillRating === "number" ? skillRating : null,
      });
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignup() {
    setSubmitting(true);
    setError(null);
    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) return null;

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 max-w-xl space-y-6">
        <div>
          <RuneChip tone="rune" className="mb-3">Create Account</RuneChip>
          <h1 className="heading-fantasy text-display-md text-ash-100">
            Join LeagueForge
          </h1>
          <p className="text-ash-400 text-sm mt-1">
            Create your account to join a league, set up your player profile, and start competing.
          </p>
        </div>

        <Panel variant="quest" padding="lg">
          <form onSubmit={handleEmailSignup} noValidate className="grid gap-3 md:grid-cols-2">
            <Field label="First name" required>
              <input
                type="text"
                className={fieldCls}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                maxLength={40}
                autoComplete="given-name"
                required
              />
            </Field>

            <Field label="Last name" required>
              <input
                type="text"
                className={fieldCls}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
                maxLength={40}
                autoComplete="family-name"
                required
              />
            </Field>

            <Field label="Email" required className="md:col-span-2">
              <input
                type="email"
                className={fieldCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </Field>

            <Field label="Phone number">
              <input
                type="tel"
                className={fieldCls}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="optional"
                autoComplete="tel"
                maxLength={20}
              />
            </Field>

            <Field label="Starting skill rating">
              <input
                type="number"
                step="0.25"
                min={1}
                max={8}
                className={fieldCls}
                value={skillRating}
                onChange={(e) =>
                  setSkillRating(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="e.g. 3.5"
              />
            </Field>

            <Field label="Password" required className="md:col-span-2">
              <input
                type="password"
                className={fieldCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                required
              />
            </Field>

            <Field label="Confirm password" required className="md:col-span-2">
              <input
                type="password"
                className={fieldCls}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                autoComplete="new-password"
                required
              />
            </Field>

            {error && (
              <p className="md:col-span-2 text-sm text-crimson-500">{error}</p>
            )}

            <div className="md:col-span-2 space-y-3 pt-1">
              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting ? "Creating account…" : "Create Account"}
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
                onClick={handleGoogleSignup}
                disabled={submitting}
              >
                Continue with Google
              </Button>
            </div>
          </form>
        </Panel>

        <p className="text-sm text-ash-400 text-center">
          Already have an account?{" "}
          <Link
            href={`/auth/login${selectedLeagueId ? `?leagueId=${selectedLeagueId}` : ""}`}
            className="text-ember-300 hover:text-ember-200"
          >
            Sign in
          </Link>
        </p>
      </main>
    </ResponsiveShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupPageContent />
    </Suspense>
  );
}

function friendlyAuthError(err: unknown): string {
  if (!(err instanceof Error)) return "Registration failed. Please try again.";
  const code = (err as { code?: string }).code ?? "";
  if (code === "auth/email-already-in-use")
    return "An account with this email already exists. Try signing in instead.";
  if (code === "auth/invalid-email") return "That email address is not valid.";
  if (code === "auth/weak-password") return "Password must be at least 6 characters.";
  if (code === "auth/network-request-failed")
    return "Network error. Check your connection and try again.";
  return err.message || "Registration failed. Please try again.";
}
