import { Suspense } from "react";
import { RosterClient } from "./RosterClient";

export function generateStaticParams() {
  return [{ leagueId: "__fallback" }];
}

interface Props {
  params: Promise<{ leagueId: string }>;
}

export default async function LeagueRosterPage({ params }: Props) {
  const { leagueId } = await params;
  return (
    <Suspense>
      <RosterClient leagueId={leagueId} />
    </Suspense>
  );
}
