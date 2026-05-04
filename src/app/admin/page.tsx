"use client";

import Link from "next/link";
import { ShieldCheck, Building2, UserCog, ListChecks, ShieldAlert } from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import { usePermissions } from "@/lib/permissions/usePermissions";

interface AdminCard {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  adminOnly?: boolean;
}

export default function AdminHubPage() {
  const { isSiteAdmin, clubDirectorFor, loading } = usePermissions();
  const isStaff = isSiteAdmin || clubDirectorFor.length > 0;

  if (loading) {
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

  if (!isStaff) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10 max-w-2xl">
          <Panel variant="quest" padding="lg" className="text-center space-y-2">
            <ShieldAlert className="h-8 w-8 text-crimson-500 mx-auto" />
            <h2 className="heading-fantasy text-ash-100 text-base">Access Denied</h2>
            <p className="text-ash-400 text-sm">Staff access required.</p>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  const cards: AdminCard[] = [
    ...(isSiteAdmin
      ? [
          {
            href: "/admin/clubs",
            icon: <Building2 className="h-6 w-6" />,
            title: "Club Approvals",
            description: "Review and approve or reject pending club submissions.",
            adminOnly: true,
          },
          {
            href: "/admin/users",
            icon: <UserCog className="h-6 w-6" />,
            title: "Manage Users",
            description: "Assign and revoke roles for players in the system.",
            adminOnly: true,
          },
        ]
      : []),
    {
      href: "/leagues/create",
      icon: <ListChecks className="h-6 w-6" />,
      title: "Create League",
      description: "Set up a new league under one of your approved clubs.",
    },
    {
      href: "/clubs/my",
      icon: <Building2 className="h-6 w-6" />,
      title: "My Clubs",
      description: "View and manage your club submissions and directorships.",
    },
  ];

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-2xl">
        <div>
          <RuneChip tone="ember" className="mb-2 inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            {isSiteAdmin ? "Site Admin" : "Staff"}
          </RuneChip>
          <h1 className="heading-fantasy text-display-md text-ash-100">Admin Hub</h1>
          <p className="text-ash-400 text-sm mt-1">
            Manage your leagues, clubs, and platform settings.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((card) => (
            <Link key={card.href} href={card.href}>
              <Panel
                variant="quest"
                padding="lg"
                className="h-full flex items-start gap-4 hover:border-ember-500/40 transition-colors cursor-pointer"
              >
                <div className="shrink-0 p-2 rounded-pixel bg-ember-500/15 text-ember-400">
                  {card.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="heading-fantasy text-ash-100 text-base">{card.title}</h2>
                    {card.adminOnly && (
                      <RuneChip tone="ember" className="text-[9px]">Admin</RuneChip>
                    )}
                  </div>
                  <p className="text-ash-400 text-sm leading-relaxed">{card.description}</p>
                </div>
              </Panel>
            </Link>
          ))}
        </div>
      </main>
    </ResponsiveShell>
  );
}
