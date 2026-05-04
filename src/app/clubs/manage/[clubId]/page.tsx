import { Suspense } from "react";
import { ClubManageClient } from "./ClubManageClient";

export function generateStaticParams() {
  return [{ clubId: "__fallback" }];
}

interface Props {
  params: Promise<{ clubId: string }>;
}

export default async function ClubManagePage({ params }: Props) {
  const { clubId } = await params;
  return (
    <Suspense>
      <ClubManageClient clubId={clubId} />
    </Suspense>
  );
}
