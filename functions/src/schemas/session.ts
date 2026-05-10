// Parallel copy of src/lib/schemas/session.ts. Kept in sync manually.
import { z } from "zod";

const NonEmptyId = z.string().trim().min(1).max(128);

const CourtSize = z.union([z.literal(4), z.literal(5)]);

const SessionCourt = z.object({
  id: NonEmptyId,
  courtNumber: z.number().int().min(1).max(99),
  size: CourtSize,
  playerIds: z.array(NonEmptyId).min(1).max(8),
});

const SessionMatch = z.object({
  id: NonEmptyId,
  courtId: NonEmptyId,
  gameNumber: z.number().int().min(1).max(20),
  sequenceInCourt: z.number().int().min(0).max(20).optional(),
  sideA: z.array(NonEmptyId).min(1).max(2),
  sideB: z.array(NonEmptyId).min(1).max(2),
  sitOutPlayer: NonEmptyId.optional(),
});

export const PersistGeneratedSessionInput = z.object({
  sessionDoc: z.record(z.unknown()).and(
    z.object({
      id: NonEmptyId,
      playDateId: NonEmptyId,
      seasonId: NonEmptyId,
      kind: z.enum(["A", "B"]),
    }),
  ),
  courts: z.array(SessionCourt).min(1).max(20),
  matches: z.array(SessionMatch).min(1).max(200),
});

export type PersistGeneratedSessionInput = z.infer<
  typeof PersistGeneratedSessionInput
>;

const PlayerStatsPatch = z.object({
  matches: z.number().int().min(0).optional(),
  wins: z.number().int().min(0).optional(),
  losses: z.number().int().min(0).optional(),
  pointsFor: z.number().int().min(0).optional(),
  pointsAgainst: z.number().int().min(0).optional(),
});

export const FinalizeSessionInput = z.object({
  sessionId: NonEmptyId,
  standingsSnapshot: z.record(z.unknown()).and(
    z.object({
      id: NonEmptyId,
    }),
  ),
  updatedPlayerStats: z.record(PlayerStatsPatch),
});

export type FinalizeSessionInput = z.infer<typeof FinalizeSessionInput>;
