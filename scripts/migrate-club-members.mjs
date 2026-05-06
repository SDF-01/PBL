import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function migrate() {
  console.log("Starting migration...");

  const clubsSnap = await db.collection("clubs").get();
  console.log(`Found ${clubsSnap.docs.length} clubs`);

  for (const clubDoc of clubsSnap.docs) {
    const club = clubDoc.data();
    const clubId = clubDoc.id;

    if (club.memberIds !== undefined) {
      console.log(`Skipping ${club.clubName} — already has memberIds`);
      continue;
    }

    const rolesSnap = await db.collection("userRoles")
      .where("clubId", "==", clubId)
      .where("active", "==", true)
      .get();

    const memberSet = new Set();
    if (club.createdBy) memberSet.add(club.createdBy);
    for (const roleDoc of rolesSnap.docs) {
      memberSet.add(roleDoc.data().userId);
    }

    const followersSnap = await db.collection("clubFollowers")
      .where("clubId", "==", clubId)
      .get();

    const followerIds = followersSnap.docs
      .map((d) => d.data().userId)
      .filter((id) => !memberSet.has(id));

    const memberIds = [...memberSet];

    console.log(`${club.clubName}: ${memberIds.length} members, ${followerIds.length} followers`);

    await db.collection("clubs").doc(clubId).update({ memberIds, followerIds });
    console.log(`  ✓ Updated`);
  }

  console.log("Migration complete!");
}

migrate().catch(console.error);