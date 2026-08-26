// Mirror of src/lib/schemas/club.ts. Do NOT edit directly — edit the client copy,
// then re-run `npm test`, which fails on drift (src/lib/mirrors.test.ts).

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
