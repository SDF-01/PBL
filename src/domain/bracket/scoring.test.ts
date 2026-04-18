import { describe, it, expect } from "vitest";
import { resolveRules, validateMatchScore } from "./scoring";

describe("validateMatchScore — BEST_OF_3_TO_11_WIN_BY_2", () => {
  const rules = resolveRules("BEST_OF_3_TO_11_WIN_BY_2");

  it("accepts a straight-games win", () => {
    const r = validateMatchScore([{ a: 11, b: 5 }, { a: 11, b: 7 }], rules);
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.winner).toBe("A");
  });

  it("accepts a 3-game split", () => {
    const r = validateMatchScore(
      [{ a: 11, b: 9 }, { a: 8, b: 11 }, { a: 13, b: 11 }],
      rules,
    );
    expect(r.valid).toBe(true);
  });

  it("rejects under-target game", () => {
    const r = validateMatchScore([{ a: 10, b: 8 }], rules);
    expect(r.valid).toBe(false);
  });

  it("rejects win-by-1 game", () => {
    const r = validateMatchScore([{ a: 11, b: 10 }, { a: 11, b: 5 }], rules);
    expect(r.valid).toBe(false);
  });

  it("rejects extra games after match is decided", () => {
    const r = validateMatchScore(
      [{ a: 11, b: 3 }, { a: 11, b: 4 }, { a: 11, b: 5 }],
      rules,
    );
    expect(r.valid).toBe(false);
  });
});
