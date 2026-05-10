// Creates 20 fake test accounts (Firebase Auth + Firestore) for manual QA.
//
// Run:  npm run seed:test
//
// Idempotent — re-running upserts existing users rather than duplicating them.
// All accounts share the password:  TestPlayer123!
//
// Requires FIREBASE_SERVICE_ACCOUNT_JSON in .env (same credential as seed-firestore.ts).

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export const TEST_PASSWORD = "TestPlayer123!";
export const TEST_EMAIL_DOMAIN = "pbl-test.com";

interface TestPlayer {
  first: string;
  last: string;
  city: string;
  region: string;
  elo: number;
  wins: number;
  losses: number;
  hand: "RIGHT" | "LEFT" | "AMBI";
  paddle: string;
  yearsPlaying: number;
  bio?: string;
}

const TEST_PLAYERS: TestPlayer[] = [
  { first: "Alex",      last: "Johnson",   city: "Austin",       region: "TX", elo: 1750, wins: 42, losses: 18, hand: "RIGHT", paddle: "Selkirk",     yearsPlaying: 4, bio: "Weekend warrior turned competitive grinder." },
  { first: "Sarah",     last: "Mitchell",  city: "Denver",       region: "CO", elo: 1680, wins: 35, losses: 20, hand: "RIGHT", paddle: "Joola",        yearsPlaying: 3 },
  { first: "Marcus",    last: "Rivera",    city: "Phoenix",      region: "AZ", elo: 1620, wins: 28, losses: 22, hand: "RIGHT", paddle: "Paddletek",    yearsPlaying: 2 },
  { first: "Emma",      last: "Chen",      city: "Seattle",      region: "WA", elo: 1590, wins: 24, losses: 20, hand: "LEFT",  paddle: "Engage",       yearsPlaying: 3, bio: "Former tennis player chasing dink perfection." },
  { first: "Tyler",     last: "Brooks",    city: "Nashville",    region: "TN", elo: 1820, wins: 58, losses: 12, hand: "RIGHT", paddle: "Franklin",     yearsPlaying: 6, bio: "Tournament regular. Watch out for my third-shot drop." },
  { first: "Priya",     last: "Patel",     city: "Chicago",      region: "IL", elo: 1480, wins: 15, losses: 18, hand: "RIGHT", paddle: "Onix",         yearsPlaying: 1 },
  { first: "James",     last: "Wilson",    city: "Miami",        region: "FL", elo: 1540, wins: 20, losses: 22, hand: "RIGHT", paddle: "Head",         yearsPlaying: 2 },
  { first: "Sofia",     last: "Garcia",    city: "San Diego",    region: "CA", elo: 1710, wins: 38, losses: 16, hand: "RIGHT", paddle: "Selkirk",      yearsPlaying: 5 },
  { first: "Noah",      last: "Thompson",  city: "Portland",     region: "OR", elo: 1380, wins: 8,  losses: 20, hand: "LEFT",  paddle: "Rally",        yearsPlaying: 1, bio: "Just learning the ropes!" },
  { first: "Olivia",    last: "Martinez",  city: "Houston",      region: "TX", elo: 1440, wins: 12, losses: 18, hand: "RIGHT", paddle: "Gamma",        yearsPlaying: 1 },
  { first: "Liam",      last: "Anderson",  city: "Atlanta",      region: "GA", elo: 1850, wins: 65, losses: 10, hand: "RIGHT", paddle: "Selkirk",      yearsPlaying: 7, bio: "National-level competitor. 5.0 rated." },
  { first: "Ava",       last: "Robinson",  city: "Boston",       region: "MA", elo: 1560, wins: 22, losses: 20, hand: "RIGHT", paddle: "Joola",        yearsPlaying: 2 },
  { first: "Ethan",     last: "Clark",     city: "Las Vegas",    region: "NV", elo: 1290, wins: 5,  losses: 18, hand: "RIGHT", paddle: "Monarch",      yearsPlaying: 1 },
  { first: "Mia",       last: "Lewis",     city: "Minneapolis",  region: "MN", elo: 1650, wins: 32, losses: 18, hand: "LEFT",  paddle: "Paddletek",    yearsPlaying: 4 },
  { first: "Lucas",     last: "Walker",    city: "Charlotte",    region: "NC", elo: 1430, wins: 11, losses: 19, hand: "RIGHT", paddle: "Onix",         yearsPlaying: 1 },
  { first: "Charlotte", last: "Hall",      city: "Scottsdale",   region: "AZ", elo: 1770, wins: 45, losses: 15, hand: "RIGHT", paddle: "Selkirk",      yearsPlaying: 5, bio: "Doubles specialist. Kitchen queen." },
  { first: "Benjamin",  last: "Young",     city: "Dallas",       region: "TX", elo: 1520, wins: 18, losses: 20, hand: "RIGHT", paddle: "Engage",       yearsPlaying: 2 },
  { first: "Amelia",    last: "King",      city: "Tampa",        region: "FL", elo: 1340, wins: 6,  losses: 16, hand: "RIGHT", paddle: "Franklin",     yearsPlaying: 1 },
  { first: "William",   last: "Scott",     city: "San Antonio",  region: "TX", elo: 1680, wins: 36, losses: 18, hand: "RIGHT", paddle: "Joola",        yearsPlaying: 3 },
  { first: "Harper",    last: "Adams",     city: "Columbus",     region: "OH", elo: 1600, wins: 26, losses: 20, hand: "LEFT",  paddle: "Gamma",        yearsPlaying: 2 },
];

function toEmail(first: string, last: string): string {
  return `test.${first.toLowerCase()}.${last.toLowerCase()}@${TEST_EMAIL_DOMAIN}`;
}

function loadCredentials() {
  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ??
    process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      "Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_JSON in your environment.",
    );
  }
  return JSON.parse(raw);
}

async function upsertAuthUser(p: TestPlayer): Promise<string> {
  const email = toEmail(p.first, p.last);
  const displayName = `${p.first} ${p.last}`;
  try {
    const existing = await getAuth().getUserByEmail(email);
    return existing.uid;
  } catch (err: unknown) {
    if ((err as { code?: string })?.code !== "auth/user-not-found") throw err;
    const created = await getAuth().createUser({
      email,
      password: TEST_PASSWORD,
      displayName,
      emailVerified: true,
    });
    return created.uid;
  }
}

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(loadCredentials()) });
  }
  const db = getFirestore();
  const now = new Date().toISOString();

  console.log(`Seeding ${TEST_PLAYERS.length} test accounts…\n`);

  for (const p of TEST_PLAYERS) {
    const email = toEmail(p.first, p.last);
    const displayName = `${p.first} ${p.last}`;

    const uid = await upsertAuthUser(p);

    // users/{uid}
    await db.doc(`users/${uid}`).set(
      {
        uid,
        email,
        firstName: p.first,
        lastName: p.last,
        displayName,
        phoneNumber: null,
        photoURL: null,
        role: "PLAYER",
        accountStatus: "ACTIVE",
        clubId: null,
        leagueIds: [],
        startingSkillRating: null,
        isTestAccount: true,
        createdAt: now,
        updatedAt: now,
      },
      { merge: false },
    );

    // players/{uid}
    const matches = p.wins + p.losses;
    await db.doc(`players/${uid}`).set(
      {
        userId: uid,
        displayName,
        photoURL: null,
        city: p.city,
        region: p.region,
        country: "US",
        dominantHand: p.hand,
        paddleBrand: p.paddle,
        yearsPlaying: p.yearsPlaying,
        bio: p.bio ?? null,
        elo: p.elo,
        eloPeak: p.elo,
        duprRating: null,
        duprId: null,
        stats: {
          matches,
          wins: p.wins,
          losses: p.losses,
          pointsFor: p.wins * 11 + p.losses * 7,
          pointsAgainst: p.wins * 7 + p.losses * 11,
          sessionsPlayed: Math.ceil(matches / 3),
          updatedAt: now,
        },
        createdAt: now,
        updatedAt: now,
      },
      { merge: false },
    );

    console.log(`  ✔  ${displayName.padEnd(20)} ELO ${p.elo}  ${email}`);
  }

  console.log(`\nDone. Password for all test accounts: ${TEST_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
