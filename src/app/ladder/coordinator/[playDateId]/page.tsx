import { Suspense } from "react";
import { CoordinatorDashboardClient } from "./CoordinatorDashboardClient";

export function generateStaticParams() {
  return [{ playDateId: "__fallback" }];
}

interface Props {
  params: Promise<{ playDateId: string }>;
}

export default async function CoordinatorDashboardPage({ params }: Props) {
  const { playDateId } = await params;
  return (
    <Suspense>
      <CoordinatorDashboardClient playDateId={playDateId} />
    </Suspense>
  );
}
