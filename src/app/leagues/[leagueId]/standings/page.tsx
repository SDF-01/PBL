import { Suspense } from "react";
import { StandingsClient } from "./StandingsClient";

export function generateStaticParams() {
  return [{ leagueId: "__fallback" }];
}

interface Props {
  params: Promise<{ leagueId: string }>;
}

export default async function LeagueStandingsPage({ params }: Props) {
  const { leagueId } = await params;
  return (
    <Suspense>
      <StandingsClient leagueId={leagueId} />
    </Suspense>
  );
}
