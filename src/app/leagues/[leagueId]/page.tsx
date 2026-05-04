// Server Component — owns generateStaticParams (cannot coexist with "use client").
// Awaits params and passes leagueId down to the client component as a plain string.
import { Suspense } from "react";
import { LeagueDetailsClient } from "./LeagueDetailsClient";

// Required by Next.js static export for dynamic routes.
// A single shell is pre-generated; Firebase Hosting rewrites /leagues/**
// to this shell, and the client-side router reads the real leagueId from the URL.
export function generateStaticParams() {
  return [{ leagueId: "__fallback" }];
}

interface LeagueDetailsPageProps {
  params: Promise<{ leagueId: string }>;
}

export default async function LeagueDetailsPage({ params }: LeagueDetailsPageProps) {
  const { leagueId } = await params;
  return (
    <Suspense>
      <LeagueDetailsClient leagueId={leagueId} />
    </Suspense>
  );
}
