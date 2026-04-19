import { describe, it, expect } from "vitest";
import {
  computeEloDeltas,
  expectedScore,
  STARTING_ELO,
  skillBand,
} from "./elo";

describe("ELO", () => {
  it("expectedScore is 0.5 for equal ratings", () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 5);
  });

  it("favorite has expected score > underdog", () => {
    expect(expectedScore(1800, 1500)).toBeGreaterThan(0.5);
    expect(expectedScore(1500, 1800)).toBeLessThan(0.5);
  });

  it("equal players doubles match: winner gains, loser loses equal magnitude", () => {
    const deltas = computeEloDeltas({
      sideA: [
        { userId: "a1", elo: 1500, matches: 50 },
        { userId: "a2", elo: 1500, matches: 50 },
      ],
      sideB: [
        { userId: "b1", elo: 1500, matches: 50 },
        { userId: "b2", elo: 1500, matches: 50 },
      ],
      scoreA: 11,
      scoreB: 7,
      targetPoints: 11,
    });
    const winners = deltas.filter((d) => d.userId.startsWith("a"));
    const losers = deltas.filter((d) => d.userId.startsWith("b"));
    expect(winners[0]!.delta).toBeGreaterThan(0);
    expect(losers[0]!.delta).toBeLessThan(0);
    expect(winners[0]!.delta).toBe(-losers[0]!.delta);
  });

  it("upset (underdog beats favorite) awards larger delta than expected win", () => {
    const upset = computeEloDeltas({
      sideA: [{ userId: "a", elo: 1400, matches: 50 }],
      sideB: [{ userId: "b", elo: 1800, matches: 50 }],
      scoreA: 11,
      scoreB: 9,
      targetPoints: 11,
    });
    const favored = computeEloDeltas({
      sideA: [{ userId: "a", elo: 1800, matches: 50 }],
      sideB: [{ userId: "b", elo: 1400, matches: 50 }],
      scoreA: 11,
      scoreB: 9,
      targetPoints: 11,
    });
    const upsetWinDelta = upset.find((d) => d.userId === "a")!.delta;
    const favoredWinDelta = favored.find((d) => d.userId === "a")!.delta;
    expect(upsetWinDelta).toBeGreaterThan(favoredWinDelta);
  });

  it("provisional players (few matches) swing more than seasoned", () => {
    const rookie = computeEloDeltas({
      sideA: [{ userId: "a", elo: 1500, matches: 0 }],
      sideB: [{ userId: "b", elo: 1500, matches: 100 }],
      scoreA: 11,
      scoreB: 5,
      targetPoints: 11,
    });
    const seasoned = computeEloDeltas({
      sideA: [{ userId: "a", elo: 1500, matches: 100 }],
      sideB: [{ userId: "b", elo: 1500, matches: 100 }],
      scoreA: 11,
      scoreB: 5,
      targetPoints: 11,
    });
    expect(rookie[0]!.delta).toBeGreaterThan(seasoned[0]!.delta);
  });

  it("rejects ties", () => {
    expect(() =>
      computeEloDeltas({
        sideA: [{ userId: "a", elo: 1500, matches: 10 }],
        sideB: [{ userId: "b", elo: 1500, matches: 10 }],
        scoreA: 11,
        scoreB: 11,
        targetPoints: 11,
      }),
    ).toThrow();
  });

  it("skillBand thresholds", () => {
    expect(skillBand(STARTING_ELO)).toBe("INTERMEDIATE");
    expect(skillBand(1100)).toBe("NOVICE");
    expect(skillBand(2100)).toBe("ELITE");
  });
});
