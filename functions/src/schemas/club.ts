// Parallel copy of src/lib/schemas/club.ts. Kept in sync manually until a
// shared package extracts these schemas. Both copies must remain
// byte-equivalent for client/server validation parity.
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
