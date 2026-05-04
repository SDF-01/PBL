import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, test } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const PROJECT_ID = "demo-pbl-rules";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

async function seed(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

function dbFor(uid: string, token: Record<string, unknown> = {}) {
  return testEnv.authenticatedContext(uid, token).firestore();
}

describe("critical Firestore security rules", () => {
  test("unauthenticated users cannot write database documents", async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertFails(
      setDoc(doc(db, "announcements/a1"), {
        title: "Nope",
        body: "Nope",
      }),
    );
  });

  test("players can create their own safe user profile", async () => {
    const db = dbFor("alice");

    await assertSucceeds(
      setDoc(doc(db, "users/alice"), {
        uid: "alice",
        email: "alice@example.test",
        displayName: "Alice",
        role: "PLAYER",
        accountStatus: "ACTIVE",
        clubId: null,
        leagueIds: [],
      }),
    );
  });

  test("players cannot self-promote through users/{uid}.role", async () => {
    await seed("users/alice", {
      uid: "alice",
      email: "alice@example.test",
      displayName: "Alice",
      role: "PLAYER",
      accountStatus: "ACTIVE",
      clubId: null,
      leagueIds: [],
    });
    const db = dbFor("alice");

    await assertFails(updateDoc(doc(db, "users/alice"), { role: "SITE_ADMIN" }));
  });

  test("players cannot update account status or tenant fields", async () => {
    await seed("users/alice", {
      uid: "alice",
      email: "alice@example.test",
      displayName: "Alice",
      role: "PLAYER",
      accountStatus: "ACTIVE",
      clubId: null,
      leagueIds: [],
    });
    const db = dbFor("alice");

    await assertFails(updateDoc(doc(db, "users/alice"), { accountStatus: "SUSPENDED" }));
    await assertFails(updateDoc(doc(db, "users/alice"), { clubId: "club-a" }));
    await assertFails(updateDoc(doc(db, "users/alice"), { leagueIds: ["league-a"] }));
  });

  test("players can update safe own user profile fields", async () => {
    await seed("users/alice", {
      uid: "alice",
      email: "alice@example.test",
      displayName: "Alice",
      role: "PLAYER",
      accountStatus: "ACTIVE",
      clubId: null,
      leagueIds: [],
    });
    const db = dbFor("alice");

    await assertSucceeds(updateDoc(doc(db, "users/alice"), { displayName: "Alice A." }));
  });

  test("players cannot create or activate privileged userRoles", async () => {
    const db = dbFor("alice");

    await assertFails(
      setDoc(doc(db, "userRoles/alice-site-admin"), {
        userId: "alice",
        roleId: "SiteAdmin",
        clubId: null,
        leagueId: null,
        active: true,
      }),
    );

    await seed("userRoles/alice-provisional", {
      userId: "alice",
      roleId: "ClubCreatorProvisional",
      clubId: "club-a",
      leagueId: null,
      active: false,
    });

    await assertFails(updateDoc(doc(db, "userRoles/alice-provisional"), { active: true }));
  });

  test("normal players cannot write ladder operational documents", async () => {
    const db = dbFor("alice");

    await assertFails(setDoc(doc(db, "ladderSessions/session-a"), { status: "GENERATED" }));
    await assertFails(setDoc(doc(db, "ladderCourts/court-a"), { sessionId: "session-a" }));
    await assertFails(setDoc(doc(db, "ladderMatches/match-a"), { sessionId: "session-a" }));
  });

  test("normal players cannot tamper with ELO or ELO events", async () => {
    await seed("players/bob", {
      userId: "bob",
      displayName: "Bob",
      elo: 1500,
      eloPeak: 1500,
      stats: { matches: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 },
    });
    const db = dbFor("alice");

    await assertFails(updateDoc(doc(db, "players/bob"), { elo: 9999 }));
    await assertFails(
      setDoc(doc(db, "eloEvents/fake-event"), {
        playerId: "alice",
        delta: 999,
      }),
    );
  });

  test("normal players cannot tamper with matches, match games, announcements, or audit logs", async () => {
    await seed("matches/match-a", {
      tournamentId: "tournament-a",
      status: "SCHEDULED",
      participantAId: "reg-a",
      participantBId: "reg-b",
    });
    const db = dbFor("alice");

    await assertFails(updateDoc(doc(db, "matches/match-a"), { status: "COMPLETED" }));
    await assertFails(deleteDoc(doc(db, "matches/match-a")));
    await assertFails(setDoc(doc(db, "matchGames/game-a"), { matchId: "match-a", scoreA: 11, scoreB: 0 }));
    await assertFails(setDoc(doc(db, "announcements/a1"), { title: "Fake", body: "Fake" }));
    await assertFails(setDoc(doc(db, "audits/a1"), { actorId: "alice", kind: "FAKE" }));
    await assertFails(setDoc(doc(db, "roleEvents/e1"), { actorId: "alice", targetUserId: "bob" }));
  });
});
