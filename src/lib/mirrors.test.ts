// Drift guard for hand-maintained client/Cloud-Functions file pairs.
//
// The web app and functions/ are separate TypeScript projects with separate
// package.json files, so they cannot import from each other. Five files are
// therefore duplicated by hand. Every one of them carried a "keep in sync"
// comment and every one of them had already drifted — the functions copy of
// collections.ts was missing entries, and its elo.ts had lost a helper —
// because a comment cannot fail a build. This test can.
//
// Contract: below its leading `//` header, each pair must be byte-identical.
// The header is exempt so each copy can say where it came from.
//
// To change a mirrored file: edit the canonical copy, then re-run the
// mirroring shown in the failure message.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Vitest resolves its root to the directory holding vitest.config.ts, which
// is the repo root — so cwd is a stable base for both mirrored trees.
const REPO_ROOT = process.cwd();

/** Canonical client file → its Cloud Functions mirror. */
const MIRRORS: ReadonlyArray<readonly [string, string]> = [
  ["src/lib/firestore/collections.ts", "functions/src/lib/collections.ts"],
  ["src/lib/players/elo.ts", "functions/src/lib/elo.ts"],
  ["src/lib/schemas/club.ts", "functions/src/schemas/club.ts"],
  ["src/lib/schemas/match.ts", "functions/src/schemas/match.ts"],
  ["src/lib/schemas/role.ts", "functions/src/schemas/role.ts"],
  ["src/lib/schemas/session.ts", "functions/src/schemas/session.ts"],
];

/**
 * Drops the leading `//` comment block (and any blank lines inside it) so the
 * two copies may describe themselves differently. Stops at the first line
 * that is neither a `//` comment nor blank, which is where the real content
 * starts in every mirrored file — including elo.ts, whose body opens with a
 * `/** ... *\/` JSDoc block that is itself part of the compared content.
 */
function stripHeader(source: string): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined) break;
    if (line.startsWith("//") || line.trim() === "") {
      i += 1;
      continue;
    }
    break;
  }
  return lines.slice(i).join("\n").trimEnd();
}

function read(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

describe("client/functions mirrored files", () => {
  it.each(MIRRORS)("%s matches %s", (canonicalPath, mirrorPath) => {
    const canonical = stripHeader(read(canonicalPath));
    const mirror = stripHeader(read(mirrorPath));

    expect(
      mirror,
      `${mirrorPath} has drifted from ${canonicalPath}.\n` +
        `Fix by copying the canonical body over the mirror, keeping the ` +
        `mirror's own header comment intact.`,
    ).toBe(canonical);
  });

  it("compares real content, not two empty strings", () => {
    // Guards the guard: if stripHeader ever ate an entire file, every
    // assertion above would trivially pass.
    for (const [canonicalPath] of MIRRORS) {
      expect(stripHeader(read(canonicalPath)).length).toBeGreaterThan(100);
    }
  });
});
