"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Plus, ShieldCheck } from "lucide-react";
import { ActiveClubCard } from "@/components/clubs/ActiveClubCard";
import { ClubCreateForm } from "@/components/clubs/ClubCreateForm";
import { PendingClubCard } from "@/components/clubs/PendingClubCard";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { getClubById, listUserClubs } from "@/lib/clubs/repo";
import { updateClubSubmission } from "@/lib/permissions/write";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { isFirebaseConfigured } from "@/lib/firebase";
import type { ClubDoc, CreateClubInput } from "@/lib/permissions/types";

export default function MyClubsPage() {
  const { user } = useAuth();
  const { clubDirectorFor, loading: permLoading } = usePermissions();
  const [clubs, setClubs] = useState<ClubDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingClub, setEditingClub] = useState<ClubDoc | null>(null);

  useEffect(() => {
    if (permLoading) return;
    if (!user || !isFirebaseConfigured()) {
      setLoading(false);
      return;
    }
    // Load clubs the user created plus clubs where they were assigned as director.
    Promise.all([
      listUserClubs(user.uid),
      Promise.all(clubDirectorFor.map((id) => getClubById(id))),
    ])
      .then(([created, directed]) => {
        const seen = new Set<string>();
        const merged: ClubDoc[] = [];
        for (const club of [...created, ...directed.filter((c): c is ClubDoc => c !== null)]) {
          if (!seen.has(club.id)) { seen.add(club.id); merged.push(club); }
        }
        setClubs(merged);
      })
      .finally(() => setLoading(false));
  }, [user, permLoading, clubDirectorFor]);

  async function handleEdit(data: CreateClubInput) {
    if (!editingClub) return;
    await updateClubSubmission(editingClub.id, data);
    setClubs((prev) =>
      prev.map((c) => (c.id === editingClub.id ? { ...c, ...data } : c)),
    );
    setEditingClub(null);
  }

  const activeClubs = clubs.filter((c) => c.status === "approved");
  const submissionClubs = clubs.filter((c) => c.status !== "approved");

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-8 max-w-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <RuneChip tone="rune" className="mb-2">My Clubs</RuneChip>
            <h1 className="heading-fantasy text-display-md text-ash-100">Your Clubs</h1>
            <p className="text-ash-400 text-sm mt-1">
              Track your club submissions and directorships.
            </p>
          </div>
          <Link href="/clubs/create">
            <Button size="sm">
              <Plus className="h-3.5 w-3.5" />
              New Club
            </Button>
          </Link>
        </div>

        {loading && (
          <Panel variant="base" padding="lg" className="text-center text-ash-500 text-sm">
            Loading your clubs…
          </Panel>
        )}

        {!loading && clubs.length === 0 && (
          <Panel variant="quest" padding="lg" className="text-center space-y-3">
            <Building2 className="h-8 w-8 text-ash-600 mx-auto" />
            <p className="text-ash-400 text-sm">You haven&apos;t created any clubs yet.</p>
            <Link href="/clubs/create">
              <Button size="sm">Create Your First Club</Button>
            </Link>
          </Panel>
        )}

        {!loading && activeClubs.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-ember-400" />
              <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest">Active Clubs</h2>
              <RuneChip tone="gold" className="text-[10px]">{activeClubs.length}</RuneChip>
            </div>
            <p className="text-ash-500 text-xs -mt-1">
              You are Club Director for these clubs. Create leagues, schedule play dates, and assign coordinators.
            </p>
            {activeClubs.map((club) => (
              <ActiveClubCard key={club.id} club={club} />
            ))}
          </section>
        )}

        {!loading && submissionClubs.length > 0 && (
          <section className="space-y-3">
            {activeClubs.length > 0 && (
              <h2 className="heading-fantasy text-ash-400 text-sm uppercase tracking-widest">Submissions</h2>
            )}
            {editingClub ? (
              <Panel variant="quest" padding="lg">
                <h2 className="heading-fantasy text-ash-100 text-base mb-4">
                  Edit Club Submission
                </h2>
                <ClubCreateForm
                  initialData={{ ...editingClub, logoUrl: editingClub.logoUrl ?? undefined }}
                  isEditing
                  onSubmit={handleEdit}
                  onCancel={() => setEditingClub(null)}
                />
              </Panel>
            ) : (
              submissionClubs.map((club) => (
                <PendingClubCard
                  key={club.id}
                  club={club}
                  onEdit={club.status === "pending" ? () => setEditingClub(club) : undefined}
                />
              ))
            )}
          </section>
        )}
      </main>
    </ResponsiveShell>
  );
}
