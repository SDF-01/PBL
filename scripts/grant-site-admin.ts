// One-shot bootstrap: promote a user to SITE_ADMIN.
//
// Sets the Firebase Auth custom claim { role: "SITE_ADMIN" } on a target
// user, mirrors the value into users/{uid}.role, and writes a roleEvents
// audit row. Use this when:
//   - bootstrapping the very first site admin on a fresh project
//   - recovering after a corrupted custom claim
//   - the trusted backend assignRole callable is unavailable
//
// Requires FIREBASE_SERVICE_ACCOUNT_JSON in the environment.
//
// Run: npx tsx scripts/grant-site-admin.ts <email-or-uid>
//
// The script accepts either an email or a uid. After it succeeds, ask the
// target user to sign out and back in (or call getIdToken(true)) to pick
// up the new claim.

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function loadCredentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is required. Paste the service account JSON into .env.",
    );
  }
  return JSON.parse(raw);
}

async function resolveUid(input: string): Promise<string> {
  if (input.includes("@")) {
    const user = await getAuth().getUserByEmail(input);
    return user.uid;
  }
  return input;
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: npx tsx scripts/grant-site-admin.ts <email-or-uid>");
    process.exit(1);
  }

  if (!getApps().length) {
    initializeApp({ credential: cert(loadCredentials()) });
  }

  const uid = await resolveUid(target);
  const db = getFirestore();

  await getAuth().setCustomUserClaims(uid, { role: "SITE_ADMIN" });

  await db.doc(`users/${uid}`).set(
    {
      role: "SITE_ADMIN",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await db.collection("userRoles").add({
    userId: uid,
    roleId: "SiteAdmin",
    clubId: null,
    leagueId: null,
    assignedAt: FieldValue.serverTimestamp(),
    assignedBy: "bootstrap-script",
    active: true,
  });

  await db.collection("roleEvents").add({
    userId: uid,
    clubId: null,
    leagueId: null,
    eventType: "RoleAssigned",
    oldRoleId: null,
    newRoleId: "SiteAdmin",
    eventTimestamp: FieldValue.serverTimestamp(),
    notes: "Bootstrap: SITE_ADMIN granted via grant-site-admin.ts",
    actorId: "bootstrap-script",
  });

  console.log(`✓ ${uid} is now SITE_ADMIN.`);
  console.log(
    "  Ask the user to sign out and back in (or call getIdToken(true)) to pick up the new claim.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
