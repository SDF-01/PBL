import { ScheduleClient } from "./ScheduleClient";

export function generateStaticParams() {
  return [{ leagueId: "__fallback" }];
}

export default function LeagueSchedulePage({
  params,
}: {
  params: { leagueId: string };
}) {
  return <ScheduleClient leagueId={params.leagueId} />;
}
