// Canonical Zod schemas for club command payloads.
// Canonical copy. A byte-equivalent mirror lives at functions/src/schemas/club.ts;
// src/lib/mirrors.test.ts fails the build if the two drift apart.

import { z } from "zod";

const NonEmptyId = z.string().trim().min(1).max(128);

export const ApproveClubInput = z.object({
  clubId: NonEmptyId,
  creatorUserId: NonEmptyId,
});

export type ApproveClubInput = z.infer<typeof ApproveClubInput>;

export const RejectClubInput = z.object({
  clubId: NonEmptyId,
  creatorUserId: NonEmptyId,
  notes: z.string().trim().min(5).max(500),
});

export type RejectClubInput = z.infer<typeof RejectClubInput>;
