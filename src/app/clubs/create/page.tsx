"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { ClubCreateForm } from "@/components/clubs/ClubCreateForm";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { submitClubCreation } from "@/lib/permissions/write";
import { useAuth } from "@/lib/auth-context";
import type { CreateClubInput } from "@/lib/permissions/types";

export default function ClubCreatePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [success, setSuccess] = useState(false);

  async function handleSubmit(data: CreateClubInput) {
    if (!user) throw new Error("You must be signed in to create a club.");
    await submitClubCreation(user.uid, data);
    setSuccess(true);
    setTimeout(() => router.push("/clubs/my"), 2000);
  }

  if (success) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-xl">
          <Panel variant="quest" padding="lg" className="text-center space-y-3">
            <Building2 className="h-10 w-10 text-ember-400 mx-auto" />
            <h2 className="heading-fantasy text-display-sm text-ash-100">Club Submitted!</h2>
            <p className="text-ash-400 text-sm">
              Your club has been submitted for review. Redirecting…
            </p>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-xl">
        <div>
          <RuneChip tone="rune" className="mb-2">New Club</RuneChip>
          <h1 className="heading-fantasy text-display-md text-ash-100">Create a Club</h1>
          <p className="text-ash-400 text-sm mt-1">
            Submit your club for approval. Once approved, you&apos;ll become a Club Director
            and can create leagues.
          </p>
        </div>
        <Panel variant="quest" padding="lg">
          <ClubCreateForm onSubmit={handleSubmit} onCancel={() => router.back()} />
        </Panel>
      </main>
    </ResponsiveShell>
  );
}
