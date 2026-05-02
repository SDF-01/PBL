import { describe, it, expect } from "vitest";
import {
  generate4PlayerRotation,
  generate5PlayerRotation,
  computeRotationStats,
} from "./rotations";

describe("Rotation Generation", () => {
  it("should generate 4-game rotation for 4-player court", () => {
    const players = ["p1", "p2", "p3", "p4"];
    const rotation = generate4PlayerRotation(players);

    expect(rotation).toHaveLength(4);
    expect(rotation[0].gameNumber).toBe(1);
    expect(rotation[3].gameNumber).toBe(4);

    // Each player should be in 3 games (sitting out 1 game)
    const gameCounts: Record<string, number> = {};
    players.forEach((p) => (gameCounts[p] = 0));

    rotation.forEach((game) => {
      game.sideA.forEach((p) => gameCounts[p]++);
      game.sideB.forEach((p) => gameCounts[p]++);
    });

    players.forEach((p) => {
      expect(gameCounts[p]).toBe(3);
    });
  });

  it("should generate 6-game rotation for 5-player court", () => {
    const players = ["p1", "p2", "p3", "p4", "p5"];
    const rotation = generate5PlayerRotation(players);

    expect(rotation).toHaveLength(6);

    // Each player should have exactly 1 sit-out
    const sitOuts: Record<string, number> = {};
    players.forEach((p) => (sitOuts[p] = 0));

    rotation.forEach((game) => {
      if (game.sitOutPlayer) {
        sitOuts[game.sitOutPlayer]++;
      }
    });

    players.forEach((p) => {
      expect(sitOuts[p]).toBe(1);
    });
  });

  it("should compute partnership statistics correctly", () => {
    const players = ["p1", "p2", "p3", "p4"];
    const rotation = generate4PlayerRotation(players);
    const stats = computeRotationStats(players, rotation);

    // Each player should partner with 3 others (once each)
    players.forEach((p) => {
      expect(stats.partnershipsPerPlayer[p].size).toBe(3);
    });

    // Each player should oppose all others
    players.forEach((p) => {
      expect(stats.opponentsPerPlayer[p].size).toBe(3);
    });
  });

  it("should throw on invalid player count", () => {
    expect(() => generate4PlayerRotation(["p1", "p2", "p3"])).toThrow();
    expect(() => generate5PlayerRotation(["p1", "p2"])).toThrow();
  });
});
