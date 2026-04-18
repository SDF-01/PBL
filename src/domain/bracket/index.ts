/**
 * Public API for the bracket engine.
 */
export * from "./types";
export { generateSingleElim, nextPowerOfTwo } from "./singleElim";
export { generateDoubleElim } from "./doubleElim";
export { circleRoundRobin, generatePoolPlay } from "./roundRobin";
export { advanceMatch, undoAdvancement } from "./progression";
export { computeStandings } from "./standings";
export { validateMatchScore, validateGame, resolveRules } from "./scoring";
export { assignSeeds, standardSeedOrder, snakePools, mulberry32, shuffle } from "./seeding";
