import { Suspense } from "react";
import { ClubPublicClient } from "./ClubPublicClient";

export function generateStaticParams() {
  return [{ clubId: "__fallback" }];
}

interface Props {
  params: Promise<{ clubId: string }>;
}

export default async function ClubPublicPage({ params }: Props) {
  const { clubId } = await params;
  return (
    <Suspense>
      <ClubPublicClient clubId={clubId} />
    </Suspense>
  );
}
