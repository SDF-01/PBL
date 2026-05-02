/**
 * Session generation engine for ladder play
 * Orchestrates court creation, player assignment, and rotation scheduling
 */

import {
  LadderSessionDoc,
  LadderCourtDoc,
  LadderMatchDoc,
  LadderSessionStatus,
  LadderMatchStatus,
  CheckInDoc,
  PlayDateDoc,
  LadderSeasonDoc,
  CourtDistributionPlacement,
} from "@/lib/firestore/types";
import { generate4PlayerRotation, generate5PlayerRotation, RotationMatch } from "./rotations";
import { distributePlayersToCourts } from "./distribution";

export interface SessionGenerationInput {
  playDate: PlayDateDoc;
  season: LadderSeasonDoc;
  checkIns: CheckInDoc[]; // All check-ins for this play date
  sessionKind: "A" | "B"; // Session A or B
  priorSessionCourts?: LadderCourtDoc[]; // Session A courts, if generating Session B
  distribution?: CourtDistributionPlacement;
}

export interface GeneratedSession {
  session: LadderSessionDoc;
  courts: LadderCourtDoc[];
  matches: LadderMatchDoc[];
}

/**
 * Generate a complete ladder session (courts, rosters, rotations)
 *
 * @param input - Generation input including play date, check-ins, and settings
 * @returns Generated session, courts, and matches (not yet persisted)
 */
export function generateLadderSession(input: SessionGenerationInput): GeneratedSession {
  const {
    playDate,
    season,
    checkIns,
    sessionKind,
    distribution = "TOP_HEAVY",
  } = input;

  // Filter confirmed check-ins (include geofence-validated and admin-confirmed)
  const confirmedCheckIns = checkIns.filter(
    (ci) => ci.status === "confirmed" || ci.status === "admin-confirmed"
  );

  const activePlayerIds = confirmedCheckIns.map((ci) => ci.userId);

  if (activePlayerIds.length < 4) {
    throw new Error(
      `Insufficient players for session generation: ${activePlayerIds.length} (minimum 4)`
    );
  }

  // Generate session document
  const now = new Date().toISOString();
  const sessionId = `${playDate.id}_session${sessionKind}`;

  const session: LadderSessionDoc = {
    id: sessionId,
    playDateId: playDate.id,
    seasonId: season.id,
    kind: sessionKind,
    status: "generated" as LadderSessionStatus,
    targetPointsPerGame: season.targetPointsPerGame ?? 11,
    movementPattern: season.movementPattern ?? "ONE_UP_ONE_DOWN",
    distributionPlacement: distribution,
    generatedAt: now,
    startedAt: undefined,
    finalizedAt: undefined,
  };

  // Distribute players to courts
  const courtsPlayerAssignments = distributePlayersToCourts(activePlayerIds, distribution);

  // Create courts and matches
  const courts: LadderCourtDoc[] = [];
  const matches: LadderMatchDoc[] = [];

  let matchIndex = 1;

  courtsPlayerAssignments.forEach((playerIds, courtIndex) => {
    const courtId = `${sessionId}_court${courtIndex + 1}`;

    // Generate rotation for this court
    const rotations: RotationMatch[] =
      playerIds.length === 4
        ? generate4PlayerRotation(playerIds)
        : generate5PlayerRotation(playerIds);

    // Create court document
    const court: LadderCourtDoc = {
      id: courtId,
      sessionId: sessionId,
      courtNumber: courtIndex + 1,
      size: playerIds.length as 4 | 5,
      playerIds: playerIds,
      status: "active",
    };

    courts.push(court);

    // Create match documents from rotation
    rotations.forEach((rotation) => {
      const matchId = `${courtId}_game${rotation.gameNumber}`;

      const match: LadderMatchDoc = {
        id: matchId,
        courtId: courtId,
        gameNumber: matchIndex,
        sequenceInCourt: rotation.gameNumber,
        sideA: rotation.sideA,
        sideB: rotation.sideB,
        sitOutPlayer: rotation.sitOutPlayer,
        status: "scheduled" as LadderMatchStatus,
        scoreA: undefined,
        scoreB: undefined,
        submittedAt: undefined,
        submittedBy: undefined,
        verifiedAt: undefined,
        verifiedBy: undefined,
        adminOverride: undefined,
      };

      matches.push(match);
      matchIndex++;
    });
  });

  return {
    session,
    courts,
    matches,
  };
}

/**
 * Validate generated session before persistence
 */
export function validateGeneratedSession(generated: GeneratedSession): string[] {
  const errors: string[] = [];

  const { session, courts, matches } = generated;

  // Check session status
  if (session.status !== "generated") {
    errors.push("Session status must be 'generated'");
  }

  // Check courts
  if (courts.length === 0) {
    errors.push("No courts generated");
  }

  const allPlayerIds = new Set<string>();
  courts.forEach((court) => {
    if (court.size !== 4 && court.size !== 5) {
      errors.push(`Court ${court.id} has invalid size: ${court.size}`);
    }
    if (court.playerIds.length !== court.size) {
      errors.push(
        `Court ${court.id} player count mismatch: expected ${court.size}, got ${court.playerIds.length}`
      );
    }
    court.playerIds.forEach((id) => allPlayerIds.add(id));
  });

  // Check matches
  const matchesPerCourt: Record<string, number> = {};
  matches.forEach((match) => {
    matchesPerCourt[match.courtId] = (matchesPerCourt[match.courtId] || 0) + 1;

    if (match.sideA.length !== 2 || match.sideB.length !== 2) {
      errors.push(
        `Match ${match.id} has invalid team composition: sideA=${match.sideA.length}, sideB=${match.sideB.length}`
      );
    }

    const courtRef = courts.find((c) => c.id === match.courtId);
    if (!courtRef) {
      errors.push(`Match ${match.id} references non-existent court ${match.courtId}`);
    }
  });

  // Validate matches per court
  courts.forEach((court) => {
    const expectedMatches = court.size === 4 ? 4 : 6;
    const actualMatches = matchesPerCourt[court.id] || 0;
    if (actualMatches !== expectedMatches) {
      errors.push(
        `Court ${court.id} has ${actualMatches} matches, expected ${expectedMatches}`
      );
    }
  });

  return errors;
}

/**
 * Generate Session B from Session A results
 * Only includes players who actually played Session A
 *
 * @param sessionA - Finalized Session A
 * @param courtsA - Session A courts
 * @param matchesA - Session A matches (with scores)
 * @param playDate - Play date reference
 * @param season - Season reference
 * @returns Generated Session B
 */
export function generateSessionBFromSessionA(
  sessionA: LadderSessionDoc,
  courtsA: LadderCourtDoc[],
  matchesA: LadderMatchDoc[],
  playDate: PlayDateDoc,
  season: LadderSeasonDoc
): GeneratedSession {
  // Collect all players who actually played in Session A
  const sessionAParticipants = new Set<string>();

  courtsA.forEach((court) => {
    court.playerIds.forEach((id) => {
      sessionAParticipants.add(id);
    });
  });

  // Create fake check-ins for Session B participants
  const sessionBCheckIns: CheckInDoc[] = Array.from(sessionAParticipants).map((userId) => ({
    id: `${playDate.id}_sessionB_checkin_${userId}`,
    playDateId: playDate.id,
    userId: userId,
    sessionKind: "B",
    checkedInAt: new Date().toISOString(),
    latitude: playDate.venueLatitude,
    longitude: playDate.venueLongitude,
    geofenceResult: "within",
    status: "confirmed" as any,
  }));

  // Generate Session B
  return generateLadderSession({
    playDate,
    season,
    checkIns: sessionBCheckIns,
    sessionKind: "B",
    priorSessionCourts: courtsA,
    distribution: sessionA.distributionPlacement,
  });
}
