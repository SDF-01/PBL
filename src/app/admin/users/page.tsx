"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, UserCog } from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { listAllUsers, setUserRole } from "@/lib/firestore/userRepo";
import { isFirebaseConfigured } from "@/lib/firebase";
import type { UserProfile, UserRole } from "@/lib/firestore/types";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "PLAYER",             label: "Player" },
  { value: "LEAGUE_COORDINATOR", label: "League Coordinator" },
  { value: "CLUB_ADMIN",         label: "Club Director" },
  { value: "SITE_ADMIN",         label: "Site Admin" },
];

const ROLE_TONE: Record<UserRole, string> = {
  SITE_ADMIN:         "text-ember-400 bg-ember-500/15",
  CLUB_ADMIN:         "text-gold-400 bg-gold-500/15",
  LEAGUE_COORDINATOR: "text-spectral-400 bg-spectral-500/15",
  PLAYER:             "text-ash-400 bg-obsidian-600",
};

export default function AdminUsersPage() {
  const { isSiteAdmin, loading: permLoading } = usePermissions();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (permLoading || !isSiteAdmin || !isFirebaseConfigured()) {
      setLoading(false);
      return;
    }
    listAllUsers()
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load users."))
      .finally(() => setLoading(false));
  }, [isSiteAdmin, permLoading]);

  async function handleRoleChange(uid: string, role: UserRole) {
    setSaving(uid);
    try {
      await setUserRole(uid, role);
      setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, role } : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update role.");
    } finally {
      setSaving(null);
    }
  }

  if (permLoading || loading) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-3xl">
          <Panel variant="base" padding="lg" className="text-center text-ash-500 text-sm">Loading…</Panel>
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

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-3xl">
        <div>
          <RuneChip tone="ember" className="mb-2 inline-flex items-center gap-1">
            <UserCog className="h-3 w-3" /> Admin
          </RuneChip>
          <h1 className="heading-fantasy text-display-md text-ash-100">Manage Users</h1>
          <p className="text-ash-400 text-sm mt-1">
            Assign roles to players. Changes take effect immediately.
          </p>
        </div>

        {error && (
          <Panel variant="base" padding="md">
            <p className="text-crimson-400 text-sm">{error}</p>
          </Panel>
        )}

        <Panel variant="base" padding="sm" className="flex items-center gap-3">
          <span className="text-ash-500 text-sm">Total users:</span>
          <span className="heading-fantasy text-ember-300 text-lg">{users.length}</span>
        </Panel>

        <div className="space-y-2">
          {users.map((u) => {
            const roleColor = ROLE_TONE[u.role ?? "PLAYER"] ?? ROLE_TONE.PLAYER;
            const isSavingThis = saving === u.uid;
            return (
              <Panel key={u.uid} variant="inventory" padding="md">
                <div className="flex items-center gap-3 flex-wrap">
                  {u.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.photoURL}
                      alt=""
                      className="h-9 w-9 rounded-full border border-obsidian-400 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full border border-obsidian-400 bg-obsidian-700 flex items-center justify-center text-sm text-ash-400 shrink-0">
                      {(u.displayName ?? u.email ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="text-ash-100 text-sm font-medium truncate">
                      {u.displayName || "—"}
                    </div>
                    <div className="text-ash-500 text-xs truncate">{u.email}</div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-pixel font-mono ${roleColor}`}>
                      {u.role ?? "PLAYER"}
                    </span>
                    <select
                      value={u.role ?? "PLAYER"}
                      disabled={isSavingThis}
                      onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                      className="bg-obsidian-800 border border-obsidian-400 rounded-pixel text-ash-200 text-xs px-2 py-1 focus:outline-none focus:border-ember-500 disabled:opacity-50"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    {isSavingThis && (
                      <span className="text-ash-500 text-xs">Saving…</span>
                    )}
                  </div>
                </div>
              </Panel>
            );
          })}

          {users.length === 0 && (
            <Panel variant="base" padding="lg" className="text-center text-ash-500 text-sm">
              No users found.
            </Panel>
          )}
        </div>
      </main>
    </ResponsiveShell>
  );
}
