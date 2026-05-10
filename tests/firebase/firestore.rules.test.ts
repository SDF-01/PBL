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

  test("users.role alone no longer grants staff power (custom claim required)", async () => {
    // Seed alice as SITE_ADMIN in the legacy mirror only — no custom claim.
    await seed("users/alice", {
      uid: "alice",
      email: "alice@example.test",
      displayName: "Alice",
      role: "SITE_ADMIN",
      accountStatus: "ACTIVE",
      clubId: null,
      leagueIds: [],
    });
    const db = dbFor("alice"); // no token claims

    await assertFails(
      setDoc(doc(db, "announcements/a1"), { title: "x", body: "y" }),
    );
  });

  test("custom claim role: SITE_ADMIN grants staff power on rule-allowed collections", async () => {
    const db = dbFor("admin", { role: "SITE_ADMIN" });

    await assertSucceeds(
      setDoc(doc(db, "announcements/a1"), { title: "ok", body: "ok" }),
    );
  });

  test("ladder operational docs are Cloud-Function-only (even SITE_ADMIN denied direct writes)", async () => {
    const db = dbFor("admin", { role: "SITE_ADMIN" });

    await assertFails(
      setDoc(doc(db, "ladderSessions/s1"), { status: "GENERATED" }),
    );
    await assertFails(
      setDoc(doc(db, "ladderCourts/c1"), { sessionId: "s1" }),
    );
    await assertFails(
      setDoc(doc(db, "ladderMatches/m1"), { sessionId: "s1", scoreA: 11, scoreB: 3 }),
    );
    await assertFails(
      setDoc(doc(db, "standingsSnapshots/snap1"), { sessionId: "s1" }),
    );
  });

  test("match participant can no longer write their own ladderMatch score directly", async () => {
    // Pre-A3 the rules let a participant patch scoreA/scoreB. With submitMatchScore
    // owning that flow, even the player cannot write the doc directly anymore.
    await seed("ladderMatches/m1", {
      sessionId: "s1",
      sideA: ["alice", "bob"],
      sideB: ["carol", "dan"],
      status: "SCHEDULED",
    });
    const db = dbFor("alice");

    await assertFails(
      updateDoc(doc(db, "ladderMatches/m1"), {
        scoreA: 11,
        scoreB: 9,
        submittedBy: "alice",
        status: "SUBMITTED",
      }),
    );
  });

  test("custom claim role: CLUB_ADMIN grants club-director power", async () => {
    const db = dbFor("director", { role: "CLUB_ADMIN" });

    await assertSucceeds(
      setDoc(doc(db, "userRoles/coord-1"), {
        userId: "coord",
        roleId: "LeagueCoordinator",
        clubId: "club-a",
        leagueId: null,
        active: true,
      }),
    );
  });

  test("club director can no longer write users.role from the client", async () => {
    await seed("users/target", {
      uid: "target",
      email: "target@example.test",
      displayName: "T",
      role: "PLAYER",
      accountStatus: "ACTIVE",
      clubId: null,
      leagueIds: [],
    });
    const db = dbFor("director", { role: "CLUB_ADMIN" });

    await assertFails(
      updateDoc(doc(db, "users/target"), { role: "LEAGUE_COORDINATOR" }),
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
