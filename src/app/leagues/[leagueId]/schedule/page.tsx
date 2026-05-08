import { Suspense } from "react";
import { ScheduleClient } from "./ScheduleClient";

export function generateStaticParams() {
  return [{ leagueId: "__fallback" }];
}

interface Props {
  params: Promise<{ leagueId: string }>;
}

export default async function LeagueSchedulePage({ params }: Props) {
  const { leagueId } = await params;
  return (
    <Suspense>
      <ScheduleClient leagueId={leagueId} />
    </Suspense>
  );
}
