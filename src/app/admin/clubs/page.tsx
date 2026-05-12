"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { getDoc, doc } from "firebase/firestore";
import { ClubApprovalQueue } from "@/components/admin/ClubApprovalQueue";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { listPendingClubs } from "@/lib/clubs/repo";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import type { ClubDoc } from "@/lib/permissions/types";
import type { UserProfile } from "@/lib/firestore/types";

export default function AdminClubsPage() {
  const { isSiteAdmin, loading: permLoading } = usePermissions();
  const [pendingClubs, setPendingClubs] = useState<ClubDoc[]>([]);
  const [submitterNames, setSubmitterNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (permLoading || !isSiteAdmin || !isFirebaseConfigured()) {
      setLoading(false);
      return;
    }
    listPendingClubs()
      .then(async (clubs) => {
        setPendingClubs(clubs);
        const uids = [...new Set(clubs.map((c) => c.createdBy))];
        const snaps = await Promise.all(
          uids.map((uid) => getDoc(doc(db(), COLLECTIONS.users, uid))),
        );
        const names: Record<string, string> = {};
        snaps.forEach((snap, i) => {
          const data = snap.exists() ? (snap.data() as UserProfile) : null;
          names[uids[i]!] = data?.displayName ?? data?.email ?? uids[i]!;
        });
        setSubmitterNames(names);
      })
      .finally(() => setLoading(false));
  }, [isSiteAdmin, permLoading]);

  if (permLoading || loading) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-2xl">
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
        <main className="container py-10 max-w-2xl">
          <Panel variant="quest" padding="lg" className="text-center space-y-2">
            <ShieldAlert className="h-8 w-8 text-crimson-500 mx-auto" />
            <h2 className="heading-fantasy text-ash-100 text-base">Access Denied</h2>
            <p className="text-ash-400 text-sm">
              This page requires Site Administrator privileges.
            </p>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-2xl">
        <div>
          <RuneChip tone="ember" className="mb-2 inline-flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" />
            Admin
          </RuneChip>
          <h1 className="heading-fantasy text-display-md text-ash-100">
            Club Approval Queue
          </h1>
          <p className="text-ash-400 text-sm mt-1">
            Review and approve or reject pending club submissions.
          </p>
        </div>

        <Panel variant="base" padding="sm" className="flex items-center gap-3">
          <span className="text-ash-500 text-sm">Pending submissions:</span>
          <span className="heading-fantasy text-ember-300 text-lg">{pendingClubs.length}</span>
        </Panel>

        <ClubApprovalQueue
          clubs={pendingClubs}
          submitterNames={submitterNames}
          onApproved={(id) => setPendingClubs((prev) => prev.filter((c) => c.id !== id))}
          onRejected={(id) => setPendingClubs((prev) => prev.filter((c) => c.id !== id))}
        />
      </main>
    </ResponsiveShell>
  );
}
