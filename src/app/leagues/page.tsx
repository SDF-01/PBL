import { Suspense } from "react";
import { LeaguesIndexClient } from "./LeaguesIndexClient";

export default function LeaguesIndexPage() {
  return (
    <Suspense>
      <LeaguesIndexClient />
    </Suspense>
  );
}
