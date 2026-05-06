"use client";

import { useMemo, useState } from "react";
import { GoogleAuthProvider } from "firebase/auth";
import { Check, KeyRound, Link2, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { useAuth } from "@/lib/auth-context";

const fieldCls =
  "w-full bg-obsidian-900 border border-obsidian-400 rounded-pixel px-3 py-2 text-sm text-ash-100 placeholder:text-ash-600 focus:outline-none focus:border-ember-500";

export function AccountSecurityPanel() {
  const { user, linkGoogle, unlinkGoogle, setOrUpdatePassword } = useAuth();

  const providers = useMemo(
    () => new Set(user?.providerData.map((p) => p.providerId) ?? []),
    [user],
  );
  const hasGoogle = providers.has(GoogleAuthProvider.PROVIDER_ID);
  const hasPassword = providers.has("password");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState<string | null>(null);

  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkOk, setLinkOk] = useState<string | null>(null);

  if (!user) return null;

  async function handleLinkGoogle() {
    setLinkBusy(true);
    setLinkError(null);
    setLinkOk(null);
    try {
      await linkGoogle();
      setLinkOk("Google account connected.");
    } catch (err) {
      setLinkError(friendlyAuthError(err));
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleUnlinkGoogle() {
    setLinkBusy(true);
    setLinkError(null);
    setLinkOk(null);
    try {
      await unlinkGoogle();
      setLinkOk("Google account disconnected.");
    } catch (err) {
      setLinkError(friendlyAuthError(err));
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwOk(null);
    if (newPassword.length < 6) {
      setPwError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match.");
      return;
    }
    if (hasPassword && !currentPassword && !hasGoogle) {
      setPwError("Enter your current password.");
      return;
    }
    setPwBusy(true);
    try {
      await setOrUpdatePassword(newPassword, currentPassword || undefined);
      setPwOk(hasPassword ? "Password updated." : "Password set.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwError(friendlyAuthError(err));
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <Panel variant="quest" padding="lg">
      <div className="flex items-center gap-2 mb-3">
        <KeyRound className="h-4 w-4 text-spectral-400" />
        <h2 className="heading-fantasy text-lg text-ash-100">
          Sign-in & Security
        </h2>
      </div>
      <p className="text-ash-400 text-xs mb-4">
        Connect Google to your profile or set a password so you can sign in
        either way.
      </p>

      <div className="space-y-4">
        <div className="rounded-pixel border border-obsidian-400 bg-obsidian-900/40 p-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-ash-300" />
              <div>
                <div className="text-sm text-ash-100">Google sign-in</div>
                <div className="text-xs text-ash-500 font-mono">
                  {hasGoogle
                    ? user.email ?? "Connected"
                    : "Not connected"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasGoogle ? (
                <>
                  <RuneChip tone="spectral">
                    <Check className="h-3 w-3" /> Linked
                  </RuneChip>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleUnlinkGoogle}
                    disabled={linkBusy || !hasPassword}
                    title={
                      hasPassword
                        ? undefined
                        : "Set a password before disconnecting Google."
                    }
                  >
                    <Link2Off className="h-3.5 w-3.5" />
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleLinkGoogle}
                  disabled={linkBusy}
                >
                  {linkBusy ? "Connecting…" : "Connect Google"}
                </Button>
              )}
            </div>
          </div>
          {linkError && (
            <p className="text-xs text-crimson-500 mt-2">{linkError}</p>
          )}
          {linkOk && (
            <p className="text-xs text-spectral-400 mt-2">{linkOk}</p>
          )}
        </div>

        <form
          onSubmit={handleSavePassword}
          className="rounded-pixel border border-obsidian-400 bg-obsidian-900/40 p-3 space-y-3"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <div className="text-sm text-ash-100">
                {hasPassword ? "Change password" : "Set a password"}
              </div>
              <div className="text-xs text-ash-500">
                {hasPassword
                  ? "Update the password used for email sign-in."
                  : "Add an email + password sign-in to this account."}
              </div>
            </div>
            {hasPassword && (
              <RuneChip tone="spectral">
                <Check className="h-3 w-3" /> Password set
              </RuneChip>
            )}
          </div>

          {hasPassword && (
            <label className="text-xs text-ash-400 space-y-1 block">
              <span>Current password</span>
              <input
                type="password"
                className={fieldCls}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                placeholder={
                  hasGoogle
                    ? "Optional if signed in with Google"
                    : "Required"
                }
              />
            </label>
          )}

          <label className="text-xs text-ash-400 space-y-1 block">
            <span>New password</span>
            <input
              type="password"
              className={fieldCls}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 6 characters"
              required
              minLength={6}
            />
          </label>

          <label className="text-xs text-ash-400 space-y-1 block">
            <span>Confirm new password</span>
            <input
              type="password"
              className={fieldCls}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
            />
          </label>

          {pwError && <p className="text-xs text-crimson-500">{pwError}</p>}
          {pwOk && <p className="text-xs text-spectral-400">{pwOk}</p>}

          <div>
            <Button type="submit" size="sm" disabled={pwBusy}>
              {pwBusy
                ? "Saving…"
                : hasPassword
                  ? "Update Password"
                  : "Set Password"}
            </Button>
          </div>
        </form>
      </div>
    </Panel>
  );
}

function friendlyAuthError(err: unknown): string {
  if (!(err instanceof Error)) return "Something went wrong. Please try again.";
  const code = (err as { code?: string }).code ?? "";
  if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use")
    return "That Google account is already linked to another profile.";
  if (code === "auth/provider-already-linked")
    return "That provider is already connected.";
  if (code === "auth/requires-recent-login")
    return "For security, sign out and sign back in, then try again.";
  if (code === "auth/wrong-password" || code === "auth/invalid-credential")
    return "Current password is incorrect.";
  if (code === "auth/weak-password")
    return "Password must be at least 6 characters.";
  if (code === "auth/popup-closed-by-user")
    return "Google sign-in was cancelled.";
  if (code === "auth/no-such-provider")
    return "No Google sign-in is connected to this account.";
  return err.message || "Something went wrong. Please try again.";
}
