import { Suspense } from "react";
import { ChallengeDetailClient } from "./ChallengeDetailClient";

export function generateStaticParams() {
  return [{ id: "__fallback" }];
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ChallengePage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense>
      <ChallengeDetailClient challengeId={id} />
    </Suspense>
  );
}
