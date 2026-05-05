import { describe, it, expect } from "vitest";
import { distributePlayersToCourts } from "./distribution";

function players(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `p${i + 1}`);
}

describe("distributePlayersToCourts", () => {
  it("throws for fewer than 4 players", () => {
    expect(() => distributePlayersToCourts(players(3), "MIDDLE")).toThrow();
  });

  it("4 players → 1 court of 4", () => {
    const courts = distributePlayersToCourts(players(4), "MIDDLE");
    expect(courts).toHaveLength(1);
    expect(courts[0]).toHaveLength(4);
  });

  it("8 players → 2 courts of 4", () => {
    const courts = distributePlayersToCourts(players(8), "MIDDLE");
    expect(courts).toHaveLength(2);
    courts.forEach((c) => expect(c).toHaveLength(4));
  });

  it("12 players → 3 courts of 4", () => {
    const courts = distributePlayersToCourts(players(12), "MIDDLE");
    expect(courts).toHaveLength(3);
    courts.forEach((c) => expect(c).toHaveLength(4));
  });

  it("13 players → 1 court of 5 + 2 courts of 4", () => {
    const courts = distributePlayersToCourts(players(13), "MIDDLE");
    expect(courts).toHaveLength(3);
    const sizes = courts.map((c) => c.length).sort((a, b) => b - a);
    expect(sizes[0]).toBe(5);
    expect(sizes[1]).toBe(4);
    expect(sizes[2]).toBe(4);
  });

  it("14 players → 2 courts of 5 + 1 court of 4", () => {
    const courts = distributePlayersToCourts(players(14), "MIDDLE");
    const sizes = courts.map((c) => c.length).sort((a, b) => b - a);
    expect(sizes.filter((s) => s === 5)).toHaveLength(2);
    expect(sizes.filter((s) => s === 4)).toHaveLength(1);
  });

  it("15 players → 3 courts of 5", () => {
    const courts = distributePlayersToCourts(players(15), "MIDDLE");
    expect(courts).toHaveLength(3);
    courts.forEach((c) => expect(c).toHaveLength(5));
  });

  it("16 players → 4 courts of 4", () => {
    const courts = distributePlayersToCourts(players(16), "MIDDLE");
    expect(courts).toHaveLength(4);
    courts.forEach((c) => expect(c).toHaveLength(4));
  });

  it("all players are assigned exactly once", () => {
    for (const n of [4, 5, 8, 9, 10, 12, 13, 14, 15, 16, 20]) {
      const ps = players(n);
      const courts = distributePlayersToCourts(ps, "MIDDLE");
      const assigned = courts.flat();
      expect(new Set(assigned).size).toBe(n);
      expect(assigned).toHaveLength(n);
    }
  });

  it("TOP_HEAVY places larger courts first (lower index)", () => {
    const courts = distributePlayersToCourts(players(13), "TOP_HEAVY");
    expect(courts[0]).toHaveLength(5);
  });

  it("BOTTOM_HEAVY places larger courts last (higher index)", () => {
    const courts = distributePlayersToCourts(players(13), "BOTTOM_HEAVY");
    expect(courts[courts.length - 1]).toHaveLength(5);
  });

  it("MIDDLE places larger courts near center", () => {
    const courts = distributePlayersToCourts(players(13), "MIDDLE");
    const midIndex = Math.floor(courts.length / 2);
    expect(courts[midIndex]).toHaveLength(5);
  });

  it("throws for player counts that cannot be distributed (6, 7, 11)", () => {
    expect(() => distributePlayersToCourts(players(6), "MIDDLE")).toThrow();
    expect(() => distributePlayersToCourts(players(7), "MIDDLE")).toThrow();
    expect(() => distributePlayersToCourts(players(11), "MIDDLE")).toThrow();
  });

  it("no court is smaller than 4 or larger than 5", () => {
    for (const n of [4, 5, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
      const courts = distributePlayersToCourts(players(n), "MIDDLE");
      courts.forEach((c) => {
        expect(c.length).toBeGreaterThanOrEqual(4);
        expect(c.length).toBeLessThanOrEqual(5);
      });
    }
  });
});
