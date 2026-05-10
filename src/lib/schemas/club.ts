// Canonical Zod schemas for club command payloads.
// Mirror in functions/src/schemas/club.ts must remain byte-equivalent.
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
