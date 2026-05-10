"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, UserCog, Search, X, AlertTriangle } from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { Button } from "@/components/ui/Button";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { listAllUsers } from "@/lib/firestore/userRepo";
import { setUserRoleWithAudit } from "@/lib/admin/write";
import { isFirebaseConfigured } from "@/lib/firebase";
import type { UserProfile, UserRole } from "@/lib/firestore/types";

const ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: "PLAYER",             label: "Player",             description: "Standard member — no elevated access." },
  { value: "LEAGUE_COORDINATOR", label: "League Coordinator", description: "Can manage leagues they are assigned to." },
  { value: "CLUB_ADMIN",         label: "Club Director",      description: "Manages club operations and members." },
  { value: "SITE_ADMIN",         label: "Site Admin",         description: "Full platform access. Assign with caution." },
];

const ROLE_CHIP_TONE: Record<UserRole, "ember" | "gold" | "spectral" | "neutral"> = {
  SITE_ADMIN:         "ember",
  CLUB_ADMIN:         "gold",
  LEAGUE_COORDINATOR: "spectral",
  PLAYER:             "neutral",
};

interface PendingChange {
  user: UserProfile;
  newRole: UserRole;
}

export default function AdminUsersPage() {
  const { isSiteAdmin, loading: permLoading } = usePermissions();
  const { user: adminUser } = useAuth();
  const { toast } = useToast();

  const [users, setUsers]           = useState<UserProfile[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [filterRole, setFilterRole] = useState<UserRole | "ALL">("ALL");
  const [pending, setPending]       = useState<PendingChange | null>(null);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    if (permLoading || !isSiteAdmin || !isFirebaseConfigured()) {
      setLoading(false);
      return;
    }
    listAllUsers()
      .then(setUsers)
      .catch((e) => toast(e instanceof Error ? e.message : "Failed to load users.", "error"))
      .finally(() => setLoading(false));
  }, [isSiteAdmin, permLoading, toast]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter((u) => {
      const matchesSearch =
        !q ||
        u.displayName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q);
      const matchesRole = filterRole === "ALL" || u.role === filterRole;
      return matchesSearch && matchesRole;
    });
  }, [users, search, filterRole]);

  async function confirmRoleChange() {
    if (!pending || !adminUser) return;
    setSaving(true);
    try {
      await setUserRoleWithAudit(pending.user.uid, pending.newRole);
      setUsers((prev) =>
        prev.map((u) => (u.uid === pending.user.uid ? { ...u, role: pending.newRole } : u)),
      );
      toast(
        `${pending.user.displayName || pending.user.email} promoted to ${pending.newRole}.`,
        "success",
      );
      setPending(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update role.", "error");
    } finally {
      setSaving(false);
    }
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

  const roleNew = ROLES.find((r) => r.value === pending?.newRole);
  const rolePrev = ROLES.find((r) => r.value === (pending?.user.role ?? "PLAYER"));

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-3xl">

        {/* Header */}
        <div>
          <RuneChip tone="ember" className="mb-2 inline-flex items-center gap-1">
            <UserCog className="h-3 w-3" /> Admin
          </RuneChip>
          <h1 className="heading-fantasy text-display-md text-ash-100">Manage Users</h1>
          <p className="text-ash-400 text-sm mt-1">
            Assign and manage platform roles. All changes are logged.
          </p>
        </div>

        {/* Stats bar */}
        <Panel variant="base" padding="sm" className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-ash-500 text-sm">Total:</span>
            <span className="heading-fantasy text-ember-300 text-lg">{users.length}</span>
          </div>
          <div className="h-4 w-px bg-obsidian-500" />
          <div className="flex items-center gap-2">
            <span className="text-ash-500 text-sm">Showing:</span>
            <span className="heading-fantasy text-ash-200 text-lg">{filtered.length}</span>
          </div>
          {filterRole !== "ALL" && (
            <>
              <div className="h-4 w-px bg-obsidian-500" />
              <RuneChip tone={ROLE_CHIP_TONE[filterRole]} className="text-[9px]">
                {filterRole}
              </RuneChip>
            </>
          )}
        </Panel>

        {/* Search + filter */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ash-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="w-full pl-8 pr-8 py-1.5 rounded-pixel border border-obsidian-400 bg-obsidian-800 text-ash-200 text-sm focus:outline-none focus:border-ember-500 placeholder:text-ash-600"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ash-500 hover:text-ash-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as UserRole | "ALL")}
            className="bg-obsidian-800 border border-obsidian-400 rounded-pixel text-ash-200 text-sm px-2 py-1.5 focus:outline-none focus:border-ember-500"
          >
            <option value="ALL">All roles</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* User list */}
        <div className="space-y-2">
          {filtered.map((u) => {
            const currentRole = u.role ?? "PLAYER";
            return (
              <Panel key={u.uid} variant="inventory" padding="md">
                <div className="flex items-center gap-3 flex-wrap">
                  {u.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.photoURL}
                      alt=""
                      className="h-9 w-9 rounded-full border border-obsidian-400 shrink-0 object-cover"
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
                    <RuneChip tone={ROLE_CHIP_TONE[currentRole]} className="text-[9px]">
                      {currentRole}
                    </RuneChip>
                    <select
                      value={currentRole}
                      disabled={saving && pending?.user.uid === u.uid}
                      onChange={(e) => {
                        const newRole = e.target.value as UserRole;
                        if (newRole !== currentRole) {
                          setPending({ user: u, newRole });
                        }
                      }}
                      className="bg-obsidian-800 border border-obsidian-400 rounded-pixel text-ash-200 text-xs px-2 py-1 focus:outline-none focus:border-ember-500 disabled:opacity-50"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </Panel>
            );
          })}

          {filtered.length === 0 && (
            <Panel variant="base" padding="lg" className="text-center text-ash-500 text-sm">
              {search || filterRole !== "ALL" ? "No users match the current filter." : "No users found."}
            </Panel>
          )}
        </div>
      </main>

      {/* Confirmation dialog */}
      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian-950/80 backdrop-blur-sm"
          onClick={() => !saving && setPending(null)}
        >
          <Panel
            variant="quest"
            padding="lg"
            className="w-full max-w-sm space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-pixel bg-ember-500/15 shrink-0">
                <AlertTriangle className="h-5 w-5 text-ember-400" />
              </div>
              <div>
                <h2 className="heading-fantasy text-ash-100 text-base">Confirm Role Change</h2>
                <p className="text-ash-400 text-xs mt-1">
                  This action will be logged in the audit trail.
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-ash-400">
                <span>User</span>
                <span className="text-ash-100 font-medium truncate ml-4 max-w-[200px]">
                  {pending.user.displayName || pending.user.email || pending.user.uid}
                </span>
              </div>
              <div className="flex justify-between text-ash-400">
                <span>Current role</span>
                <RuneChip tone={ROLE_CHIP_TONE[pending.user.role ?? "PLAYER"]} className="text-[9px]">
                  {rolePrev?.label ?? pending.user.role}
                </RuneChip>
              </div>
              <div className="flex justify-between text-ash-400">
                <span>New role</span>
                <RuneChip tone={ROLE_CHIP_TONE[pending.newRole]} className="text-[9px]">
                  {roleNew?.label ?? pending.newRole}
                </RuneChip>
              </div>
            </div>

            {pending.newRole === "SITE_ADMIN" && (
              <Panel variant="base" padding="sm" className="border-ember-500/40">
                <p className="text-ember-300 text-xs">
                  <strong>Warning:</strong> Site Admin grants full platform access including the ability to
                  approve clubs and change any user's role. Only assign to trusted operators.
                </p>
              </Panel>
            )}

            {roleNew?.description && (
              <p className="text-ash-500 text-xs">{roleNew.description}</p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={confirmRoleChange}
                disabled={saving}
                className="flex-1"
                variant={pending.newRole === "SITE_ADMIN" ? "danger" : "primary"}
              >
                {saving ? "Saving…" : "Confirm"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPending(null)}
                disabled={saving}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </ResponsiveShell>
  );
}
