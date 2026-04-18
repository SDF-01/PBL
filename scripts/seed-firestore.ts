// Seeds Firestore with a realistic Pickleball League tournament.
// Uses the Admin SDK — requires FIREBASE_SERVICE_ACCOUNT_JSON env var (the
// full JSON body from Firebase Console → Service Accounts → Generate Key).
//
// Run: `npm run seed`
//
// Idempotent: uses deterministic document ids so re-running overwrites.

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { generateSingleElim, type Entrant } from "../src/domain/bracket";

function loadCredentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is required. Paste the service account JSON into .env.",
    );
  }
  return JSON.parse(raw);
}

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(loadCredentials()) });
  }
  const db = getFirestore();

  const now = Timestamp.now().toDate().toISOString();

  // --- Organization / Venue / Courts ---
  const orgId = "pickleball-league";
  await db.doc(`organizations/${orgId}`).set({
    slug: orgId,
    name: "Pickleball League",
    tagline: "Forged in ember. Ranked in rune.",
    createdAt: now,
  });

  const venueId = "ember-hall";
  await db.doc(`venues/${venueId}`).set({
    orgId,
    name: "Ember Hall",
    city: "Obsidian Heights",
    region: "Northern Marches",
  });

  for (let i = 1; i <= 4; i++) {
    await db.doc(`courts/${venueId}-c${i}`).set({
      venueId,
      label: `Court ${i}`,
      surface: "ACRYLIC",
    });
  }

  // --- League + Season + Divisions ---
  const leagueId = "pbl-league";
  await db.doc(`leagues/${leagueId}`).set({
    orgId,
    slug: leagueId,
    name: "Pickleball League",
    description: "The flagship league.",
  });

  const seasonId = "season-iv-spring-2026";
  await db.doc(`seasons/${seasonId}`).set({
    leagueId,
    slug: seasonId,
    name: "Season IV — Spring 2026",
    startDate: "2026-03-01",
    endDate: "2026-06-30",
    isCurrent: true,
  });

  const divisions = [
    { id: "div-mens-open",      name: "Men's Open",       format: "SINGLES",        skillMin: 4.5, skillMax: 7.0 },
    { id: "div-womens-open",    name: "Women's Open",     format: "SINGLES",        skillMin: 4.5, skillMax: 7.0 },
    { id: "div-mixed-open",     name: "Mixed Open",       format: "MIXED_DOUBLES",  skillMin: 4.5, skillMax: 7.0 },
    { id: "div-mens-doubles",   name: "Men's Doubles",    format: "DOUBLES",        skillMin: 4.0, skillMax: 7.0 },
    { id: "div-masters",        name: "Masters 50+",      format: "DOUBLES",        skillMin: 3.5, skillMax: 7.0 },
  ];
  for (const d of divisions) {
    await db.doc(`divisions/${d.id}`).set({ seasonId, ...d });
  }

  // --- Players ---
  const players = [
    { id: "p-vex",   displayName: "Vex · Solen",     tier: "DIAMOND",  rating: 2100 },
    { id: "p-nyx",   displayName: "Nyx · Kael",      tier: "DIAMOND",  rating: 2080 },
    { id: "p-mira",  displayName: "Mira · Jor",      tier: "PLATINUM", rating: 2050 },
    { id: "p-velo",  displayName: "Velo · Brand",    tier: "PLATINUM", rating: 2020 },
    { id: "p-rune",  displayName: "Rune · Ash",      tier: "GOLD",     rating: 1990 },
    { id: "p-ira",   displayName: "Ira · Ost",       tier: "GOLD",     rating: 1970 },
    { id: "p-sylva", displayName: "Sylva · Thorne",  tier: "SILVER",   rating: 1940 },
    { id: "p-fen",   displayName: "Fen · Orin",      tier: "SILVER",   rating: 1900 },
  ];
  for (const p of players) {
    await db.doc(`users/${p.id}`).set({
      email: `${p.id}@example.pickleballleague.app`,
      displayName: p.displayName,
      tier: p.tier,
      rating: p.rating,
      createdAt: now,
    });
  }

  // --- Achievements ---
  const achievements = [
    { id: "ach-first-blood",  code: "FIRST_BLOOD",  name: "First Blood",   description: "Win your first tournament match.", tier: "BRONZE" },
    { id: "ach-iron-wall",    code: "IRON_WALL",    name: "Iron Wall",     description: "Win a match 11-0.",                tier: "SILVER" },
    { id: "ach-kingslayer",   code: "KINGSLAYER",   name: "Kingslayer",    description: "Defeat a top-4 seed.",              tier: "GOLD" },
    { id: "ach-mythic-run",   code: "MYTHIC_RUN",   name: "Mythic Run",    description: "Win 10 matches consecutively.",     tier: "MYTHIC" },
  ];
  for (const a of achievements) {
    await db.doc(`achievements/${a.id}`).set(a);
  }

  // --- Tournament ---
  const tournamentId = "ember-open";
  await db.doc(`tournaments/${tournamentId}`).set({
    orgId,
    slug: tournamentId,
    name: "The Ember Open",
    status: "IN_PROGRESS",
    format: "SINGLE_ELIM",
    startDate: "2026-04-18",
    endDate: "2026-04-19",
    venueId,
    description: "Flagship mixed doubles open. Scored to 11, win by 2, best of 3.",
    targetPoints: 11,
    winBy: 2,
    bestOf: 3,
  });

  // --- Registrations (one per player, all CONFIRMED) ---
  const registrationIds: string[] = [];
  for (const p of players) {
    const regId = `reg-${tournamentId}-${p.id}`;
    registrationIds.push(regId);
    await db.doc(`registrations/${regId}`).set({
      tournamentId,
      userId: p.id,
      displayName: p.displayName,
      rating: p.rating,
      status: "CONFIRMED",
      createdAt: now,
    });
  }

  // --- Bracket (generated by engine, projected to Firestore) ---
  const entrants: Entrant[] = players.map((p, i) => ({
    id: registrationIds[i]!,
    name: p.displayName,
    rating: p.rating,
  }));
  const bracket = generateSingleElim({
    entrants,
    seeding: { method: "RANK_BASED" },
  });

  const bracketId = `bracket-${tournamentId}`;
  const allNodes = Object.values(bracket.nodes);
  await db.doc(`brackets/${bracketId}`).set({
    tournamentId,
    format: "SINGLE_ELIM",
    seedingMethod: "RANK_BASED",
    nodeIds: allNodes.map((n) => n.id),
    rounds: bracket.rounds.map((r) => ({ label: r.label, nodeIds: r.nodeIds })),
    generatedAt: now,
  });

  // Two-pass write so winnerNext/loserNext ids are valid references.
  for (const n of allNodes) {
    await db.doc(`bracketNodes/${bracketId}-${n.id}`).set({
      bracketId,
      tournamentId,
      roundIndex: n.roundIndex,
      positionInRound: n.positionInRound,
      a: n.a ?? null,
      b: n.b ?? null,
      isByeA: n.isByeA,
      isByeB: n.isByeB,
      seedA: n.seedA ?? null,
      seedB: n.seedB ?? null,
      winnerNext: n.winnerNext ?? null,
      loserNext: n.loserNext ?? null,
    });
  }

  // --- Announcement ---
  await db.doc(`announcements/ann-ember-open-published`).set({
    orgId,
    title: "Ember Open bracket published",
    body: "The bracket for the Ember Open has been forged. Check-in opens 1h before your first match.",
    kind: "BRACKET_PUBLISHED",
    createdAt: now,
  });

  console.log("✔ Seed complete.");
  console.log(`  org:         ${orgId}`);
  console.log(`  tournament:  ${tournamentId}`);
  console.log(`  entrants:    ${entrants.length}`);
  console.log(`  nodes:       ${allNodes.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
