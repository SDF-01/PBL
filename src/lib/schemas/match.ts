// Canonical Zod schemas for ladder-match command payloads.
// Mirror in functions/src/schemas/match.ts must remain byte-equivalent.
import { z } from "zod";

const NonEmptyId = z.string().trim().min(1).max(128);

const Score = z.number().int().min(0).max(99);

export const SubmitMatchScoreInput = z.object({
  matchId: NonEmptyId,
  scoreA: Score,
  scoreB: Score,
});

export type SubmitMatchScoreInput = z.infer<typeof SubmitMatchScoreInput>;

export const VerifyMatchScoreInput = z.object({
  matchId: NonEmptyId,
});

export type VerifyMatchScoreInput = z.infer<typeof VerifyMatchScoreInput>;

export const DisputeMatchInput = z.object({
  matchId: NonEmptyId,
  reason: z.string().trim().min(5).max(500).optional(),
});

export type DisputeMatchInput = z.infer<typeof DisputeMatchInput>;

export const AdminAssignMatchResultInput = z.object({
  matchId: NonEmptyId,
  scoreA: Score,
  scoreB: Score,
});

export type AdminAssignMatchResultInput = z.infer<
  typeof AdminAssignMatchResultInput
>;
