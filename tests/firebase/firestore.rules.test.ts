import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, test } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
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

// ─────────────────────────────────────────────────────────────
// players/{uid} — ELO / stats write lock
// ─────────────────────────────────────────────────────────────

describe("players/{uid} — ELO lock", () => {
  beforeAll(async () => {
    await seed("users/alice", { role: "PLAYER" });
    await seed("users/admin", { role: "SITE_ADMIN" });
    await seed("players/bob", {
      userId: "bob",
      displayName: "Bob",
      elo: 1500,
      eloPeak: 1500,
      stats: { matches: 0, wins: 0, losses: 0 },
    });
  });

  test("unauthenticated user cannot read player profile", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "players/bob")));
  });

  test("authenticated player can read another player profile", async () => {
    await assertSucceeds(getDoc(doc(dbFor("alice"), "players/bob")));
  });

  test("player cannot update own ELO directly", async () => {
    await seed("players/alice", {
      userId: "alice",
      displayName: "Alice",
      elo: 1500,
      eloPeak: 1500,
      stats: { matches: 0, wins: 0, losses: 0 },
    });
    await assertFails(updateDoc(doc(dbFor("alice"), "players/alice"), { elo: 2000 }));
  });

  test("player cannot update own stats directly", async () => {
    await seed("players/alice", {
      userId: "alice",
      displayName: "Alice",
      elo: 1500,
      stats: { matches: 0, wins: 0, losses: 0 },
    });
    await assertFails(
      updateDoc(doc(dbFor("alice"), "players/alice"), {
        stats: { matches: 50, wins: 40, losses: 10 },
      }),
    );
  });

  test("player can update safe profile fields (displayName)", async () => {
    await seed("players/alice", {
      userId: "alice",
      displayName: "Alice",
      elo: 1500,
      stats: { matches: 0, wins: 0, losses: 0 },
    });
    await assertSucceeds(
      updateDoc(doc(dbFor("alice"), "players/alice"), {
        displayName: "Alice A.",
        updatedAt: new Date().toISOString(),
      }),
    );
  });

  test("admin can update ELO", async () => {
    await assertSucceeds(
      updateDoc(doc(dbFor("admin", { role: "SITE_ADMIN" }), "players/bob"), {
        elo: 1600,
        updatedAt: new Date().toISOString(),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────
// eloEvents — immutable, admin-only create
// ─────────────────────────────────────────────────────────────

describe("eloEvents", () => {
  beforeAll(async () => {
    await seed("users/admin", { role: "SITE_ADMIN" });
  });

  test("signed-in player cannot create an eloEvent", async () => {
    await assertFails(
      addDoc(collection(dbFor("alice"), "eloEvents"), {
        userId: "alice",
        delta: 25,
        before: 1500,
        after: 1525,
      }),
    );
  });

  test("anonymous cannot create an eloEvent", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      addDoc(collection(db, "eloEvents"), { userId: "alice", delta: 25 }),
    );
  });

  test("admin can create an eloEvent", async () => {
    await assertSucceeds(
      addDoc(collection(dbFor("admin", { role: "SITE_ADMIN" }), "eloEvents"), {
        userId: "bob",
        delta: 25,
        before: 1500,
        after: 1525,
        createdAt: new Date().toISOString(),
      }),
    );
  });

  test("eloEvent cannot be updated even by admin", async () => {
    await seed("eloEvents/evt1", { userId: "bob", delta: 25 });
    await assertFails(
      updateDoc(
        doc(dbFor("admin", { role: "SITE_ADMIN" }), "eloEvents/evt1"),
        { delta: 999 },
      ),
    );
  });
});

// ─────────────────────────────────────────────────────────────
// checkIns — player creates own, staff overrides
// ─────────────────────────────────────────────────────────────

describe("checkIns", () => {
  beforeAll(async () => {
    await seed("users/coord", { role: "LEAGUE_COORDINATOR" });
    await seed("checkIns/ci1", {
      playDateId: "pd1",
      userId: "alice",
      status: "GEO_REJECTED",
      displayName: "Alice",
    });
  });

  test("player can create own check-in", async () => {
    await assertSucceeds(
      addDoc(collection(dbFor("alice"), "checkIns"), {
        playDateId: "pd1",
        userId: "alice",
        displayName: "Alice",
        status: "CONFIRMED",
      }),
    );
  });

  test("player cannot create check-in for another user", async () => {
    await assertFails(
      addDoc(collection(dbFor("alice"), "checkIns"), {
        playDateId: "pd1",
        userId: "bob",
        displayName: "Bob",
        status: "CONFIRMED",
      }),
    );
  });

  test("player cannot override a check-in", async () => {
    await assertFails(
      updateDoc(doc(dbFor("alice"), "checkIns/ci1"), {
        status: "ADMIN_CONFIRMED",
      }),
    );
  });

  test("league coordinator can override a check-in", async () => {
    await assertSucceeds(
      updateDoc(doc(dbFor("coord", { role: "LEAGUE_COORDINATOR" }), "checkIns/ci1"), {
        status: "ADMIN_CONFIRMED",
        overriddenBy: "coord",
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────
// audits — admin-only, immutable
// ─────────────────────────────────────────────────────────────

describe("audits", () => {
  beforeAll(async () => {
    await seed("users/admin", { role: "SITE_ADMIN" });
    await seed("audits/audit1", { action: "ORIGINAL", actorId: "admin" });
  });

  test("player cannot read audit records", async () => {
    await assertFails(getDoc(doc(dbFor("alice"), "audits/audit1")));
  });

  test("player cannot create audit records", async () => {
    await assertFails(
      addDoc(collection(dbFor("alice"), "audits"), { action: "FAKE" }),
    );
  });

  test("admin can read and create audit records", async () => {
    const adminDb = dbFor("admin", { role: "SITE_ADMIN" });
    await assertSucceeds(getDoc(doc(adminDb, "audits/audit1")));
    await assertSucceeds(
      addDoc(collection(adminDb, "audits"), {
        action: "TEST",
        actorId: "admin",
        timestamp: new Date().toISOString(),
      }),
    );
  });

  test("audit records cannot be updated even by admin", async () => {
    await assertFails(
      updateDoc(doc(dbFor("admin", { role: "SITE_ADMIN" }), "audits/audit1"), {
        action: "TAMPERED",
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────
// playerChallenges — participant-only visibility
// ─────────────────────────────────────────────────────────────

describe("playerChallenges", () => {
  beforeAll(async () => {
    await seed("playerChallenges/ch1", {
      challengerId: "alice",
      challengeeId: "bob",
      status: "PENDING",
    });
  });

  test("challenger can read own challenge", async () => {
    await assertSucceeds(getDoc(doc(dbFor("alice"), "playerChallenges/ch1")));
  });

  test("challengee can read the challenge", async () => {
    await assertSucceeds(getDoc(doc(dbFor("bob"), "playerChallenges/ch1")));
  });

  test("third party cannot read the challenge", async () => {
    await assertFails(getDoc(doc(dbFor("carol"), "playerChallenges/ch1")));
  });

  test("player can create a challenge as challenger", async () => {
    await assertSucceeds(
      addDoc(collection(dbFor("alice"), "playerChallenges"), {
        challengerId: "alice",
        challengeeId: "carol",
        status: "PENDING",
      }),
    );
  });

  test("player cannot impersonate another challenger", async () => {
    await assertFails(
      addDoc(collection(dbFor("carol"), "playerChallenges"), {
        challengerId: "alice",
        challengeeId: "bob",
        status: "PENDING",
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────
// leagues — public read, staff write
// ─────────────────────────────────────────────────────────────

describe("leagues", () => {
  beforeAll(async () => {
    await seed("leagues/league1", { name: "Test League", active: true });
    await seed("users/coord", { role: "LEAGUE_COORDINATOR" });
  });

  test("anonymous can read a league", async () => {
    await assertSucceeds(
      getDoc(doc(testEnv.unauthenticatedContext().firestore(), "leagues/league1")),
    );
  });

  test("player cannot create a league", async () => {
    await assertFails(
      setDoc(doc(dbFor("alice"), "leagues/newLeague"), { name: "My League" }),
    );
  });

  test("league coordinator can create a league", async () => {
    await assertSucceeds(
      setDoc(
        doc(dbFor("coord", { role: "LEAGUE_COORDINATOR" }), "leagues/newLeague"),
        { name: "New League" },
      ),
    );
  });
});
