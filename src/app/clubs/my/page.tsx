"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Building2, Layers, MapPin, Plus, ShieldCheck } from "lucide-react";
import { ActiveClubCard } from "@/components/clubs/ActiveClubCard";
import { ClubCreateForm } from "@/components/clubs/ClubCreateForm";
import { PendingClubCard } from "@/components/clubs/PendingClubCard";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { unfollowClub } from "@/lib/clubs/write";
import { updateClubSubmission } from "@/lib/permissions/write";
import { useAuth } from "@/lib/auth-context";
import { listClubsByLeagueMembership, listFollowedClubs, listUserClubs } from "@/lib/clubs/repo";
import { isFirebaseConfigured } from "@/lib/firebase";
import type { ClubDoc, CreateClubInput } from "@/lib/permissions/types";

export default function MyClubsPage() {
  const { user } = useAuth();
  const [clubs, setClubs] = useState<ClubDoc[]>([]);
  const [leagueMemberClubs, setLeagueMemberClubs] = useState<ClubDoc[]>([]);
  const [followedClubs, setFollowedClubs] = useState<ClubDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingClub, setEditingClub] = useState<ClubDoc | null>(null);

  useEffect(() => {
    if (!user || !isFirebaseConfigured()) {
      setLoading(false);
      return;
    }
    Promise.all([
      listUserClubs(user.uid),
      listClubsByLeagueMembership(user.uid),
      listFollowedClubs(user.uid),
    ])
      .then(([member, leagueMember, followed]) => {
        setClubs(member);
        const memberSet = new Set(member.map((c) => c.id));
        const uniqueLeagueMember = leagueMember.filter((c) => !memberSet.has(c.id));
        setLeagueMemberClubs(uniqueLeagueMember);
        const leagueSet = new Set(uniqueLeagueMember.map((c) => c.id));
        setFollowedClubs(
          followed.filter((c) => !memberSet.has(c.id) && !leagueSet.has(c.id)),
        );
      })
      .finally(() => setLoading(false));
  }, [user]);

  async function handleUnfollow(clubId: string) {
    if (!user) return;
    await unfollowClub(user.uid, clubId);
    setFollowedClubs((prev) => prev.filter((c) => c.id !== clubId));
  }

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
              Your clubs, leagues, and directorships.
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

        {!loading && clubs.length === 0 && leagueMemberClubs.length === 0 && (
          <Panel variant="quest" padding="lg" className="text-center space-y-3">
            <Building2 className="h-8 w-8 text-ash-600 mx-auto" />
            <p className="text-ash-400 text-sm">You haven&apos;t joined any clubs yet.</p>
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
        {!loading && leagueMemberClubs.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-ember-400" />
              <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest">Member Clubs</h2>
              <RuneChip tone="gold" className="text-[10px]">{leagueMemberClubs.length}</RuneChip>
            </div>
            <p className="text-ash-500 text-xs -mt-1">
              Clubs where you&apos;re enrolled in a league.
            </p>
            <div className="space-y-2">
              {leagueMemberClubs.map((club) => (
                <Panel key={club.id} variant="inventory" padding="md" className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {club.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={club.logoUrl} alt="" className="h-10 w-10 rounded-pixel object-cover border border-obsidian-400 shrink-0" />
                    ) : (
                      <div className="h-10 w-10 rounded-pixel bg-obsidian-700 border border-obsidian-400 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-ember-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="heading-fantasy text-ash-100 text-sm truncate">{club.clubName}</p>
                      <p className="text-ash-500 text-xs flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />{club.location}
                      </p>
                    </div>
                  </div>
                  <Link href={`/clubs/${club.slug ?? club.id}`}>
                    <Button size="sm" variant="outline">View</Button>
                  </Link>
                </Panel>
              ))}
            </div>
          </section>
        )}

        {!loading && followedClubs.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-spectral-400" />
              <h2 className="heading-fantasy text-ash-100 text-sm uppercase tracking-widest">Following</h2>
              <RuneChip tone="spectral" className="text-[10px]">{followedClubs.length}</RuneChip>
            </div>
            <p className="text-ash-500 text-xs -mt-1">
              Clubs you&apos;re following. You can view their leagues and facilities.
            </p>
            <div className="space-y-2">
              {followedClubs.map((club) => (
                <Panel key={club.id} variant="inventory" padding="md" className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {club.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={club.logoUrl} alt="" className="h-10 w-10 rounded-pixel object-cover border border-obsidian-400 shrink-0" />
                    ) : (
                      <div className="h-10 w-10 rounded-pixel bg-obsidian-700 border border-obsidian-400 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-ember-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="heading-fantasy text-ash-100 text-sm truncate">{club.clubName}</p>
                      <p className="text-ash-500 text-xs flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />{club.location}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link href={`/clubs/${club.slug ?? club.id}`}>
                      <Button size="sm" variant="outline">View</Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-ash-500 hover:text-crimson-400"
                      onClick={() => handleUnfollow(club.id)}
                    >
                      Unfollow
                    </Button>
                  </div>
                </Panel>
              ))}
            </div>
          </section>
        )}
      </main>
    </ResponsiveShell>
  );
}
