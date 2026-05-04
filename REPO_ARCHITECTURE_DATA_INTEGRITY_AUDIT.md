# LeagueForge — Repository Architecture & Data Integrity Audit

**Date:** 2026-05-03  
**Auditor:** Claude Code (automated deep inspection)  
**Scope:** Full codebase — config, lib, app, components, security rules  
**Files inspected:** 45+ source files, 206-line Firestore rules file  

---

## Executive Summary

LeagueForge is a Next.js 15 / Firebase / TypeScript SaaS application for managing pickleball ladder leagues. It is a static-export single-page application backed entirely by Firestore for persistence. There is **no server-side API layer** — all business logic runs client-side and is enforced only by Firestore Security Rules.

The codebase shows strong TypeScript discipline (strict mode, `noUncheckedIndexedAccess`), a clean separation of library concerns, and thoughtful UX patterns. However, the audit uncovered **three blocking production defects** and **nine significant data integrity or security risks**.

### Highest-Risk Findings

| ID | Severity | Summary |
|----|----------|---------|
| DI-01 | **CRITICAL** | `clubs`, `userRoles`, `leagueMemberships`, `roleEvents` collections have **no Firestore rules** — the catch-all blocks all reads and writes. The entire permissions system is dead in production. |
| DI-02 | **CRITICAL** | `isStaff()` and `isAdmin()` in Firestore rules check Firebase Auth **custom claims** — which are **never set** anywhere in the codebase. Every staff/admin guard permanently returns false. |
| DI-03 | **CRITICAL** | Session generation, score submission + ELO, and session finalization are all **non-atomic sequential writes**. A client crash mid-flow leaves permanently corrupt partial state. |
| DI-04 | **HIGH** | ELO calculation runs entirely **client-side**. Any signed-in user can write arbitrary ELO deltas to any player record. Firestore rules permit it via field-only allowlist. |
| DI-05 | **HIGH** | `userRoles` collection has no write protection. A user can grant themselves any role (SiteAdmin, ClubDirector) by writing directly to Firestore. |
| DI-06 | **HIGH** | `ladderSessions`, `ladderCourts`, `ladderMatches` allow `write: if isSignedIn()` — any authenticated user can corrupt any session or match. |
| DI-07 | **MEDIUM** | `finalizeSession()` updates player stats in a sequential loop. Failure on player N leaves players 1..N-1 with updated cumulative stats while N..end remain stale. No rollback. |
| SEC-01 | **HIGH** | `standingsSnapshots` requires `isStaff() || isAdmin()` to write, but since custom claims are never set, **nobody can write standings snapshots in production**. |
| VAL-01 | **MEDIUM** | All validation is client-side only. Firestore rules do not validate score ranges, ELO delta bounds, or player count constraints. |

---

## Architecture Map

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER (Client Only — No Server API)                          │
│                                                                 │
│  Next.js 15 App Router (output: "export" → static HTML)        │
│                                                                 │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │  Auth Layer  │  │  Data Layer     │  │  Permission Layer│  │
│  │              │  │                 │  │                  │  │
│  │ AuthProvider │  │ Firestore SDK   │  │ usePermissions() │  │
│  │ (Context)    │  │ (direct reads   │  │ (client Firestore│  │
│  │              │  │  + writes)      │  │  query)          │  │
│  └──────┬───────┘  └────────┬────────┘  └──────────────────┘  │
│         │                   │                                   │
│  ┌──────▼───────────────────▼──────────────────────────────┐   │
│  │  Business Logic (src/lib/)                              │   │
│  │  ladder/write.ts · players/write.ts · permissions/write │   │
│  │  ELO calculation · Geofence check · Session generation  │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Firestore SDK (client SDK only)
                                ▼
┌───────────────────────────────────────────────────────────────┐
│  FIREBASE SERVICES                                            │
│                                                               │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────┐   │
│  │ Firebase Auth   │  │ Cloud Firestore   │  │ Firebase   │   │
│  │                 │  │                  │  │ Hosting    │   │
│  │ Email/Password  │  │ 30+ collections   │  │            │   │
│  │ Google OAuth    │  │ Security Rules    │  │ CDN served │   │
│  │                 │  │ (client enforced) │  │ static app │   │
│  └─────────────────┘  └──────────────────┘  └────────────┘   │
│                                                               │
│  ❌ No Cloud Functions                                         │
│  ❌ No Firebase Admin SDK in production path                  │
│  ❌ No server-side validation                                  │
└───────────────────────────────────────────────────────────────┘
```

### Key Architectural Characteristics

- **No backend API.** All reads and writes happen directly from the browser via the Firebase client SDK. Firestore Security Rules are the only enforcement layer.
- **Static export.** `next build` with `output: "export"` produces a static HTML/JS bundle deployed to Firebase Hosting. There is no Next.js server runtime, no API routes, no server actions.
- **No Cloud Functions.** The `package.json` includes `firebase-admin` as a dependency, but it is used only in local seed scripts (`scripts/`), not in any production path.
- **Custom claims never set.** The Firestore rules reference `request.auth.token.role` (custom claims) for staff/admin checks, but no code path ever calls `admin.auth().setCustomUserClaims()`.

---

## Data Flow Map

### Sign-Up Flow
```
User fills form (/auth/signup)
  → createUserWithEmailAndPassword()   [Firebase Auth]
  → updateProfile()                    [Firebase Auth — sets displayName]
  → setDoc(users/{uid}, UserProfile)  [Firestore — can fail independently]
  → onAuthStateChanged fires
  → setDoc(users/{uid}, merge: true)  [Firestore — safe merge upsert]
  → redirect to /players/edit
  → upsertPlayerProfile()              [creates players/{uid}]
```
**Risk:** If the Firestore `setDoc` at step 3 fails, the Auth user exists without a profile doc.

### Ladder Session Flow
```
Admin creates season → createLadderSeason()        [seasons/{slug}]
Admin creates venue  → createVenue()               [venues/{id}]
Admin creates play date → createPlayDate()         [playDates/{id}]

Players check in:
  Browser GPS → distanceMeters() → createCheckIn() [checkIns/{playDateId}__{uid}]

Admin generates session:
  Reads confirmed check-ins
  → generateSessionA() (domain logic, client-side)
  → persistGeneratedSession():
      setDoc(ladderSessions/{id})     ← write 1
      for each court: setDoc(...)     ← writes 2..N  (NOT ATOMIC)
      for each match: setDoc(...)     ← writes N+1..M
      addDoc(audits/{id})             ← write M+1

Players submit scores:
  → submitLadderMatchScore():
      getDoc(ladderMatches/{id})
      updateDoc(ladderMatches/{id})   ← score committed
      applyMatchEloByUserIds()        ← ELO applied (best-effort, can fail)

Opponent verifies:
  → verifyLadderMatchScore():
      updateDoc(ladderMatches/{id}, status: VERIFIED)
      [NO AUDIT TRAIL written here]

Admin finalizes:
  → finalizeSession():
      updateDoc(ladderSessions/{id})  ← write 1
      setDoc(standingsSnapshots/{id}) ← write 2  (BLOCKED by rules — isAdmin never true)
      for each player: updateDoc(...)  ← writes 3..N  (NOT ATOMIC)
      addDoc(audits/{id})             ← write N+1
```

### Permission/Role Flow
```
User submits club:
  → submitClubCreation():
      writeBatch:
        set(clubs/{id})           ← BLOCKED — no rule for clubs collection
        set(userRoles/{id})       ← BLOCKED — no rule for userRoles collection

SiteAdmin approves club:
  → approveClub():
      getDocs(userRoles query)    ← BLOCKED — no read rule for userRoles
      writeBatch:
        update(clubs/{id})        ← BLOCKED
        update(userRoles/{id})    ← BLOCKED
        set(userRoles/{id})       ← BLOCKED
        set(roleEvents/{id})      ← BLOCKED
        set(notifications/{id})   ← permitted (notifications has a rule)
```

---

## Entity and Collection Inventory

### Core Collections

| Collection | Purpose | Owner Field | Timestamps | Public Read | Write Guard |
|---|---|---|---|---|---|
| `users/{uid}` | Auth profile + UserProfile | uid (doc ID) | createdAt, updatedAt | ✅ Yes | Self or Admin |
| `players/{uid}` | Gameplay profile + ELO | userId | createdAt, updatedAt | ✅ Yes | Self + field allowlist |
| `eloEvents/{id}` | Immutable ELO audit | playerId | createdAt | ✅ Yes | Create-only |
| `notifications/{id}` | Per-user alerts | userId | createdAt | ❌ Self only | Any signed-in |
| `auditLog/{id}` | Legacy audit log | — | — | ❌ Admin only | Any signed-in |
| `audits/{id}` | Ladder audit log | actorId | createdAt | ❌ Admin only | Any signed-in |

### Tournament Collections

| Collection | Purpose | Parent Ref | Public Read | Write Guard |
|---|---|---|---|---|
| `organizations/{id}` | Org/club (legacy) | — | ✅ | Any signed-in |
| `tournaments/{id}` | Tournament | orgId | ✅ | Creator or Staff |
| `brackets/{id}` | Bracket structure | tournamentId | ✅ | Creator or Staff |
| `bracketNodes/{id}` | Bracket tree nodes | tournamentId | ✅ | Creator or Staff |
| `matches/{id}` | Tournament matches | tournamentId | ✅ | Permissive (see DI-06) |
| `matchGames/{id}` | Individual games | matchId | ✅ | Any signed-in |
| `registrations/{id}` | Tournament entries | tournamentId, userId | ✅ | Self-register |
| `standings/{doc}` | Tournament standings | — | ✅ | Staff only |
| `announcements/{id}` | Org announcements | orgId | ✅ | Any signed-in |

### Ladder League Collections

| Collection | Purpose | Parent Ref | Public Read | Write Guard |
|---|---|---|---|---|
| `seasons/{slug}` | Ladder season config | — | ✅ | Any signed-in |
| `venues/{id}` | Physical venue + geofence | — | ✅ | Any signed-in |
| `playDates/{id}` | Scheduled play event | seasonId, venueId | ✅ | Creator or Staff |
| `ladderSessions/{id}` | Generated session A/B | playDateId, seasonId | ✅ | **Any signed-in** |
| `ladderCourts/{id}` | Court assignment | sessionId | ✅ | **Any signed-in** |
| `ladderMatches/{id}` | Individual match | sessionId, courtId | ✅ | **Any signed-in** |
| `checkIns/{playDateId}___{uid}` | Player check-in | playDateId, userId | ✅ | Self or Staff |
| `standingsSnapshots/{id}` | Final standings | sessionId | ✅ | **Staff/Admin only — broken** |

### Permission Collections (ALL BLOCKED IN PRODUCTION)

| Collection | Purpose | Status |
|---|---|---|
| `clubs/{id}` | Club records + approval status | ❌ No Firestore rule — all ops blocked |
| `userRoles/{id}` | Scoped role grants | ❌ No Firestore rule — all ops blocked |
| `leagueMemberships/{id}` | League roster entries | ❌ No Firestore rule — all ops blocked |
| `roleEvents/{id}` | Role change audit trail | ❌ No Firestore rule — all ops blocked |

---

## Data Integrity Risk Register

### DI-01 — CRITICAL: New permission collections blocked by Firestore catch-all

- **ID:** DI-01
- **Severity:** CRITICAL
- **Area:** Firestore Security Rules / Permissions System
- **File:** `firestore.rules` (line 204), `src/lib/firestore/collections.ts` (lines 36–41)
- **Problem:** Four new Firestore collections (`clubs`, `userRoles`, `leagueMemberships`, `roleEvents`) were added to the application code but have no matching rules in `firestore.rules`. The file ends with a catch-all `match /{document=**} { allow read, write: if false; }` which blocks all operations on uncovered collections.
- **Evidence:** `grep "clubs\|userRoles\|leagueMemberships\|roleEvents" firestore.rules` returns zero results. The catch-all is at line 204.
- **Why it matters:** Every feature depending on these collections silently fails at runtime: club creation, role assignment, club approval, the `/clubs/create` page, `/clubs/my` page, `/admin/clubs` page, and the `usePermissions()` hook all return empty or throw errors. The user sees no feedback.
- **Recommended fix:** Add rules for all four collections before deploying. Minimum:
  ```
  match /clubs/{id} {
    allow read: if true;
    allow create: if isSignedIn() && request.resource.data.creatorUserId == request.auth.uid;
    allow update: if isSignedIn() && (resource.data.creatorUserId == request.auth.uid || isAdmin());
    allow delete: if isAdmin();
  }
  match /userRoles/{id} {
    allow read: if isSignedIn() && (resource.data.userId == request.auth.uid || isAdmin());
    allow create, update, delete: if isAdmin();
  }
  match /leagueMemberships/{id} { allow read, write: if isSignedIn(); }
  match /roleEvents/{id} { allow read: if isAdmin(); allow create: if isSignedIn(); allow update, delete: if false; }
  ```
- **Suggested test:** After adding rules, call `submitClubCreation()` from a signed-in user and verify the document appears in Firestore console.

---

### DI-02 — CRITICAL: Custom claims never set; isStaff/isAdmin permanently false

- **ID:** DI-02
- **Severity:** CRITICAL
- **Area:** Firestore Security Rules / Authentication
- **File:** `firestore.rules` (lines 13–22), `src/lib/auth-context.tsx`
- **Problem:** `isStaff()` and `isAdmin()` check `request.auth.token.role` (Firebase Auth custom claims). Custom claims are set via the Firebase Admin SDK (`admin.auth().setCustomUserClaims()`). No code in this repository ever calls this — `firebase-admin` is a dev dependency used only in local seed scripts. Therefore every rule that uses `isStaff()` or `isAdmin()` silently evaluates to false for all users in production.
- **Evidence:** `grep -rn "setCustomUserClaims\|custom.*claim\|admin.auth" src/` → zero results.
- **Why it matters:** 
  - `standingsSnapshots` writes require `isStaff() || isAdmin()` → **nobody can write standings snapshots**
  - `auditLog` and `audits` reads require `isAdmin()` → **nobody can read audit logs**
  - `standings` writes require `isStaff() || isAdmin()` → **nobody can write standings**
  - Tournament delete, registration moderation, and other staff functions are all permanently locked.
- **Recommended fix (Option A — Quick):** Replace custom claim checks with Firestore document lookups for the admin role:
  ```
  function isAdmin() {
    return isSignedIn() && exists(/databases/$(database)/documents/userRoles/$(request.auth.uid + "_SiteAdmin"));
  }
  ```
  Or use the existing `userRoles` collection once DI-01 is fixed.
- **Recommended fix (Option B — Correct):** Implement a Cloud Function that sets custom claims when a `userRoles` document is created/updated. Use `onDocumentWritten("userRoles/{id}", ...)` trigger.
- **Suggested test:** Sign in as a user, attempt to write to `standingsSnapshots`, observe the permission denied error vs. expected behavior.

---

### DI-03 — CRITICAL: Session generation, finalization, and ELO application are non-atomic

- **ID:** DI-03
- **Severity:** CRITICAL
- **Area:** Data Integrity / Write Atomicity
- **File:** `src/lib/ladder/write.ts` — `persistGeneratedSession()` (line 306), `finalizeSession()` (line 460), `submitLadderMatchScore()` (line 362)
- **Problem:** Three critical multi-document write operations use sequential `setDoc`/`updateDoc` calls instead of a `writeBatch`. A network failure, tab close, or Firestore quota error mid-sequence leaves permanently inconsistent state.
- **Evidence:**
  ```ts
  // persistGeneratedSession — sequential, NOT batched
  await setDoc(doc(db(), COLLECTIONS.ladderSessions, sessionDoc.id), ...);
  for (const court of courts) {
    await setDoc(doc(db(), COLLECTIONS.ladderCourts, court.id), ...); // can fail here
  }
  for (const match of matches) {
    await setDoc(doc(db(), COLLECTIONS.ladderMatches, match.id), ...); // or here
  }

  // finalizeSession — sequential loop
  for (const [playerId, stats] of Object.entries(updatedPlayerStats)) {
    await updateDoc(doc(db(), COLLECTIONS.players, playerId), ...); // fails at player N
  }

  // submitLadderMatchScore — score committed before ELO
  await updateDoc(mRef, { scoreA, scoreB, submittedBy, submittedAt });
  try {
    await applyMatchEloByUserIds(...); // fire-and-forget — can fail silently
  } catch (err) {
    console.warn("[elo] ladder ELO apply failed", err); // score already written
  }
  ```
- **Why it matters:** 
  - A session can exist with 3 of 5 courts written — players assigned to missing courts see no matches.
  - A finalization that fails on player 4 of 10 leaves 4 players with updated cumulative season stats and 6 without. The standings snapshot doesn't reflect reality.
  - A match score can be committed without the corresponding ELO delta — `player.stats.matches` diverges from actual verified match count.
- **Recommended fix:** 
  - `persistGeneratedSession`: Consolidate into a single `writeBatch`. Firestore batches support 500 operations — a typical 5-court session generates ~30 writes.
  - `finalizeSession`: Use `writeBatch` for all player stat updates + standings snapshot.
  - `submitLadderMatchScore`: Move ELO application to a Cloud Function triggered on match status change, making it server-side and guaranteed.
- **Suggested test:** Simulate a network failure mid-`persistGeneratedSession` by disconnecting from Firebase mid-write. Verify session documents are either fully present or fully absent.

---

### DI-04 — HIGH: ELO calculation is client-side and unvalidated

- **ID:** DI-04
- **Severity:** HIGH
- **Area:** Data Integrity / Trust Boundary
- **File:** `src/lib/players/elo.ts`, `src/lib/players/write.ts`, `firestore.rules` (players update rule)
- **Problem:** The ELO algorithm runs in the browser. `computeEloDeltas()` computes rating changes, then `applyMatchEloDeltas()` writes them to Firestore via a batch. Firestore rules permit any signed-in user to update the `elo`, `eloPeak`, and `stats.*` fields of any player document.
- **Evidence:**
  ```
  // firestore.rules — players update rule
  allow update: if isSignedIn() && (
    request.auth.uid == uid || isStaff() ||
    request.resource.data.keys().hasOnly([
      "elo", "eloPeak", "stats", "stats.matches", "stats.wins", ...
    ])
  );
  ```
  The third branch allows ANY signed-in user to write ELO fields. There is no server-side validation of the delta magnitude or whether the source match was actually verified.
- **Why it matters:** A malicious user can write arbitrary ELO values to any player's document without playing a match.
- **Recommended fix:** Remove the open ELO update permission from Firestore rules. Move ELO application to a Cloud Function that triggers on `ladderMatches/{id}` status changing to `VERIFIED` or `ADMIN_ASSIGNED`. The Cloud Function reads the match, computes deltas server-side, and applies them atomically.
- **Suggested test:** While signed in as User A, attempt to directly write `{ elo: 9999 }` to `players/{userB_uid}`. With current rules this succeeds; after the fix it should be denied.

---

### DI-05 — HIGH: userRoles collection has no write protection

- **ID:** DI-05
- **Severity:** HIGH
- **Area:** Security / Role Escalation
- **File:** `src/lib/permissions/write.ts`, `firestore.rules` (missing rule for userRoles)
- **Problem:** Once DI-01 is fixed and the `userRoles` collection becomes accessible, there is no rule preventing a user from writing a `userRoles` document that grants themselves `SiteAdmin`. The `assignRole()` function calls `addDoc(collection(db(), COLLECTIONS.userRoles), { userId, roleId: "SiteAdmin", ... })` from the client. Any user who knows the Firestore schema can replicate this call.
- **Evidence:** `src/lib/permissions/helpers.ts:getActiveRoles()` queries `userRoles` where `userId == userId AND active == true` — it trusts whatever is in the collection.
- **Why it matters:** Full privilege escalation. Any authenticated user becomes a SiteAdmin.
- **Recommended fix:** The `userRoles` write rule must verify the requesting user is already a SiteAdmin:
  ```
  match /userRoles/{id} {
    allow read: if isSignedIn() && resource.data.userId == request.auth.uid;
    allow create, update, delete: if /* requester is SiteAdmin via custom claim or Cloud Function */ false;
  }
  ```
  Role grants must be issued via a Cloud Function that validates the actor's permission server-side.
- **Suggested test:** While signed in as a regular player, attempt to write a `userRoles` document with `roleId: "SiteAdmin"` and `userId` set to your own UID. After fix, this must return permission denied.

---

### DI-06 — HIGH: Ladder operational collections allow write by any signed-in user

- **ID:** DI-06
- **Severity:** HIGH
- **Area:** Security / Data Integrity
- **File:** `firestore.rules` (lines 156–165)
- **Problem:** `ladderSessions`, `ladderCourts`, and `ladderMatches` all allow `write: if isSignedIn()`. Any authenticated user can create, overwrite, or delete any session, court assignment, or match record.
- **Evidence:**
  ```
  match /ladderSessions/{id} { allow read: if true; allow write: if isSignedIn(); }
  match /ladderCourts/{id}   { allow read: if true; allow write: if isSignedIn(); }
  match /ladderMatches/{id}  { allow read: if true; allow write: if isSignedIn(); }
  ```
- **Why it matters:** A malicious player could delete their court, rewrite match results, or corrupt the session entirely. The comment in the rules file acknowledges this is intentional for the MVP but flags it for tightening.
- **Recommended fix:** 
  - `ladderSessions`: Require the writer's UID matches `createdBy` or is the play date creator.
  - `ladderMatches`: Allow score submission only by players in `sideA` or `sideB`; require status transition to be valid (SCHEDULED → SUBMITTED, not VERIFIED → SCHEDULED).
  - `ladderCourts`: Admin-write only after session generation lock.
- **Suggested test:** While signed in as a player, attempt to delete another player's match document. After fix, this must fail.

---

### DI-07 — MEDIUM: finalizeSession player stat loop is non-idempotent and non-atomic

- **ID:** DI-07
- **Severity:** MEDIUM
- **Area:** Data Integrity / Finalization
- **File:** `src/lib/ladder/write.ts:finalizeSession()` (line 460–490)
- **Problem:** Player stats are updated in a `for...of` loop with sequential `updateDoc` calls. If the function throws mid-loop, some players have their cumulative season stats updated while others do not. Re-running finalization would double-count stats for already-updated players.
- **Evidence:**
  ```ts
  for (const [playerId, stats] of Object.entries(updatedPlayerStats)) {
    await updateDoc(doc(db(), COLLECTIONS.players, playerId), {
      stats: stripUndefined(stats),  // FULL OVERWRITE of stats object
      updatedAt: serverTimestamp(),
    });
  }
  ```
  Note: `stats: stats` is a full overwrite of the stats sub-object, not a field-level increment. This means if a player had stats from a prior session, this overwrites them entirely with session-only stats.
- **Why it matters:** Players 1–N get updated stats; players N+1–end remain at pre-session values. The standings snapshot doesn't match player records.
- **Recommended fix:** Use `writeBatch` for all player updates. Add a `finalizedSessions` array to each player doc and check it before applying — if the sessionId is already in the list, skip to achieve idempotency.
- **Suggested test:** Trigger finalization, cut the network on write 3 of 5, attempt to re-run finalization, verify no stats are double-counted.

---

### DI-08 — MEDIUM: User profile creation can fail silently after Auth account creation

- **ID:** DI-08
- **Severity:** MEDIUM
- **Area:** Data Integrity / Account Creation
- **File:** `src/lib/auth-context.tsx:signUpWithEmail()` (line 63–90)
- **Problem:** `createUserWithEmailAndPassword()` creates the Firebase Auth user, then `setDoc()` writes the Firestore user profile. If the Firestore write fails (network error, rules denial, quota), the Auth user exists with no profile document. The user is now in a broken state — they can sign in but have no profile.
- **Evidence:**
  ```ts
  const credential = await createUserWithEmailAndPassword(auth(), email, password);
  await updateProfile(newUser, { displayName });
  await setDoc(doc(db(), COLLECTIONS.users, newUser.uid), { ... }); // can fail
  // If this throws, Auth user exists but Firestore profile does not
  ```
- **Why it matters:** Broken accounts that can authenticate but trigger null-reference errors throughout the app.
- **Recommended fix:** 
  1. Wrap the entire signup in a try/catch that calls `newUser.delete()` on Firestore write failure to keep Auth and Firestore in sync.
  2. Or: implement a defensive `onAuthStateChanged` profile repair that re-creates the profile doc if missing.
- **Suggested test:** During signup, block the Firestore write via a temporary rules deny, verify the Auth user is cleaned up.

---

### DI-09 — MEDIUM: Schema drift between old Role type and new UserRole/UserProfile types

- **ID:** DI-09
- **Severity:** MEDIUM
- **Area:** Schema Consistency
- **File:** `src/lib/firestore/types.ts` (lines 7 and 34), `src/lib/auth-context.tsx` (line 80)
- **Problem:** Two parallel role type systems exist in the codebase simultaneously:
  - **Old system:** `type Role = "PLAYER" | "TEAM_CAPTAIN" | "REFEREE" | "DIRECTOR" | "ADMIN" | "OWNER"` — used in Firestore rules custom claims check.
  - **New system:** `type UserRole = "SITE_ADMIN" | "CLUB_ADMIN" | "LEAGUE_COORDINATOR" | "PLAYER"` — written to `users/{uid}.role` on signup.
  - **Permissions system:** `type RoleKey = "SiteAdmin" | "ClubDirector" | "LeagueCoordinator" | "Player" | "ClubCreatorProvisional"` — stored in `userRoles` collection.
  
  Three different role vocabularies. None of them are read by `firestore.rules` which only checks custom claims.
- **Additionally:** `CheckInDoc` has both `lat/lng` (current) and `latitude/longitude` (legacy) fields. `PlayerStats` has both `stats.matches/wins/losses` and `stats.totalWins/totalLosses/sessionsPlayed`.
- **Why it matters:** Different parts of the code read different fields for the same concept. Future developers will be confused about which system is authoritative.
- **Recommended fix:** Pick one role vocabulary. Deprecate the old `Role` type. Write a one-time migration script to backfill `userRoles` collection from `users/{uid}.role`. Document schema versions in a `SCHEMA.md` file.
- **Suggested test:** Search for all reads of `user.role`, `userRole`, and `roleId` — verify they all reference the same collection/field.

---

### DI-10 — LOW: Geofence validation is client-reported and unverifiable

- **ID:** DI-10
- **Severity:** LOW
- **Area:** Data Integrity / Check-In
- **File:** `src/app/ladder/check-in/page.tsx`, `src/lib/ladder/geofence.ts`, `src/lib/ladder/write.ts:createCheckIn()`
- **Problem:** The geofence check (`distanceMeters()`, `withinGeofence()`) runs entirely in the browser. The GPS coordinates are browser-reported. The `status` field written to Firestore is computed client-side. A determined user can manipulate `navigator.geolocation` results to report any coordinates.
- **Evidence:** `createCheckIn()` accepts a pre-computed `status: CheckInStatus` from the caller — Firestore rules don't validate that `distanceMeters` is within the venue radius.
- **Why it matters:** Players can check in from home. For a competitive ladder, location integrity matters.
- **Recommended fix:** Move geofence validation to a Cloud Function. The client reports raw GPS; the server validates distance and sets the status. Client-reported GPS is stored but not trusted for status determination.
- **Suggested test:** Mock `navigator.geolocation` to return coordinates 10 miles from the venue, attempt check-in, verify `status: CONFIRMED` is still accepted by current rules.

---

## Cross-Tenant Risk Register

### CT-01 — HIGH: No tenant isolation on ladder operational data

- **ID:** CT-01
- **Severity:** HIGH
- **Area:** Multi-tenancy / Data Isolation
- **File:** `firestore.rules` (ladderSessions, ladderMatches, ladderCourts)
- **Problem:** The ladder collections (`ladderSessions`, `ladderCourts`, `ladderMatches`) have no organization/club/league scope in their Firestore rules. Any signed-in user from any organization can read all sessions and write to any match from any other club's league.
- **Evidence:** `allow write: if isSignedIn()` — no check against the session's owning organization.
- **Why it matters:** If multiple clubs use the platform, Club A players can corrupt Club B sessions.
- **Recommended fix:** Add `orgId` or `leagueId` to session documents and validate that the writing user has a role in the same org/league.

---

### CT-02 — MEDIUM: Tournament data has no org-level isolation

- **ID:** CT-02
- **Severity:** MEDIUM
- **Area:** Multi-tenancy / Data Isolation
- **File:** `firestore.rules` (tournaments, brackets, matches)
- **Problem:** `organizations`, `tournaments`, `leagues`, `seasons` are all publicly readable with no tenant filter. Any user can read any org's tournament brackets, registrations, and standings.
- **Evidence:** `match /organizations/{doc=**} { allow read: if true; }` — global read, no org scoping.
- **Why it matters:** For a competitive SaaS with multiple organizations, this exposes all org data to all users.
- **Recommended fix:** Restrict reads to members of the organization, or accept public reads as a design decision (public leaderboards) and document it explicitly.

---

### CT-03 — MEDIUM: URL parameters can access any league's data

- **ID:** CT-03
- **Severity:** MEDIUM
- **Area:** Multi-tenancy / IDOR
- **File:** `src/app/leagues/[leagueId]/LeagueDetailsClient.tsx`, `src/app/players/view/page.tsx`
- **Problem:** Pages that accept `leagueId` or `uid` as URL parameters read the corresponding Firestore document without checking if the requesting user has access to that league or player profile.
- **Evidence:** `src/app/leagues/[leagueId]/LeagueDetailsClient.tsx` reads `getLeague(leagueId)` where `leagueId` comes directly from the URL. There is no membership check.
- **Why it matters:** A user can substitute any `leagueId` in the URL to read data from leagues they are not members of. (Currently mitigated by the fact that all league data is publicly readable, but this becomes a higher risk if read permissions are tightened.)
- **Recommended fix:** When read permissions are tightened, add membership validation before rendering league-specific data.

---

### CT-04 — LOW: Admin mode stored in localStorage without server validation

- **ID:** CT-04
- **Severity:** LOW
- **Area:** Client Trust / Admin
- **File:** `src/lib/admin-context.tsx`
- **Problem:** `localStorage.setItem("adminMode", "true")` persists UI state across sessions. A user who opens DevTools can set this to enable admin UI elements. However, all actual admin write operations check Firestore roles on execution.
- **Evidence:**
  ```ts
  const saved = localStorage.getItem("adminMode");
  if (saved === "true") setIsAdminMode(true);
  ```
- **Why it matters:** Admin UI is shown to non-admins, but actual writes will fail at the Firestore layer. UX confusion risk rather than security risk. However, it reduces the "defense in depth" of the UI layer.
- **Recommended fix:** Derive `isAdminMode` from `usePermissions().isSiteAdmin` or the user's role doc. Remove the localStorage persistence.

---

## Validation Gaps

| ID | Location | Gap | Risk |
|----|----------|-----|------|
| VAL-01 | `firestore.rules` | No score range validation on `ladderMatches` writes (negative scores accepted) | Medium |
| VAL-02 | `firestore.rules` | No validation that `submittedBy` in match doc matches `request.auth.uid` | High |
| VAL-03 | `firestore.rules` | No validation that match status transitions are legal (e.g., VERIFIED → SCHEDULED) | High |
| VAL-04 | `firestore.rules` | `matchGames` — no validation on scoreA/scoreB ranges | Low |
| VAL-05 | `firestore.rules` | `announcements` — any signed-in user can create announcements for any org | Medium |
| VAL-06 | `firestore.rules` | `seasons` — any signed-in user can create or overwrite any season | Medium |
| VAL-07 | `firestore.rules` | `venues` — any signed-in user can create venues with any lat/lng/radius | Medium |
| VAL-08 | `src/lib/ladder/write.ts:finalizeSession()` | `updatedPlayerStats` parameter typed as `any` — no TypeScript enforcement | Medium |
| VAL-09 | `src/lib/ladder/write.ts:finalizeSession()` | `standingsSnapshot` parameter typed as `any` | Medium |
| VAL-10 | `src/app/auth/signup/page.tsx` | Password minimum (6 chars) enforced client-side only — Firestore Auth enforces separately | Low |
| VAL-11 | `src/lib/permissions/write.ts` | No validation that `assignedBy` user actually has permission to assign the requested role | Critical |
| VAL-12 | All Firestore writes | No Zod/Valibot runtime schema validation — TypeScript types are compile-time only | Medium |
| VAL-13 | `src/lib/ladder/write.ts:submitLadderMatchScore()` | No validation that `submittedBy` is in `sideA` or `sideB` of the match | High |
| VAL-14 | `src/lib/ladder/write.ts:verifyLadderMatchScore()` | No validation that `verifiedBy` is the opposing player, not the submitter | High |

---

## Required Fixes Before Production

### Blocking (ship nothing until fixed)

- [ ] **[DI-01]** Add Firestore rules for `clubs`, `userRoles`, `leagueMemberships`, `roleEvents` collections
- [ ] **[DI-02]** Replace custom claims checks (`isStaff`, `isAdmin`) with Firestore document lookups, or implement a Cloud Function to set custom claims when SiteAdmin role is granted
- [ ] **[DI-03a]** Convert `persistGeneratedSession()` to a single `writeBatch` call
- [ ] **[DI-03b]** Convert `finalizeSession()` player stat loop to a single `writeBatch`
- [ ] **[SEC-01]** Fix `standingsSnapshots` write rule — currently nobody can write them (isAdmin always false)

### High Priority (fix before first real users)

- [ ] **[DI-03c]** Make ELO application atomic with score submission — use batch or move to Cloud Function
- [ ] **[DI-04]** Move ELO calculation server-side (Cloud Function on match verification)
- [ ] **[DI-05]** Restrict `userRoles` write to server-side only (Cloud Function)
- [ ] **[DI-06]** Tighten `ladderSessions`, `ladderCourts`, `ladderMatches` write rules to require role or creator check
- [ ] **[VAL-13]** Validate that score submitter is a participant in the match
- [ ] **[VAL-14]** Validate that score verifier is not the original submitter

### Medium Priority (fix within first sprint)

- [ ] **[DI-07]** Make `finalizeSession` idempotent — check if session already finalized before applying stats
- [ ] **[DI-08]** Roll back Auth user creation if Firestore profile write fails
- [ ] **[DI-09]** Consolidate the three role type systems into one
- [ ] **[VAL-08/09]** Replace `any` types in `finalizeSession()` with proper TypeScript interfaces
- [ ] **[CT-01]** Add org/league scoping to ladder collection write rules
- [ ] **[VAL-11]** Validate role assigner has permission server-side

### Low Priority (tech debt)

- [ ] **[DI-10]** Move geofence validation server-side
- [ ] **[CT-04]** Remove `localStorage` admin mode; derive from role query
- [ ] **[VAL-01]** Add score range validation (0–25) in Firestore rules
- [ ] **[DI-09]** Migrate legacy `latitude/longitude` fields to `lat/lng` in CheckIn documents
- [ ] **[DI-09]** Migrate legacy `stats.totalWins/totalLosses` to canonical `stats.wins/losses`

---

## Suggested Refactor Plan

### Phase 1: Critical Safety Fixes (Week 1)

**Goal:** Make the app safe to deploy with real users.

1. Add missing Firestore rules for all 4 permission collections (2 hours)
2. Replace `isStaff()`/`isAdmin()` custom claim checks with Firestore document lookups using a helper function that reads from `userRoles` (4 hours)
3. Convert `persistGeneratedSession()` to `writeBatch` (2 hours)
4. Convert `finalizeSession()` to `writeBatch` (3 hours)
5. Make score submission + ELO application atomic in `submitLadderMatchScore()` (3 hours)
6. Add Firestore rule: `submittedBy == request.auth.uid` on `ladderMatches` score update (1 hour)
7. Add Firestore rule: `verifiedBy != resource.data.submittedBy` on match verification (1 hour)

**Deliverable:** Deploy to staging, run manual end-to-end test of full session flow.

### Phase 2: Schema and Validation Cleanup (Week 2)

**Goal:** Eliminate schema drift and add server-side validation.

1. Consolidate role types — pick `RoleKey` as the single vocabulary, deprecate `Role` and `UserRole`
2. Write migration script: read `users/{uid}.role`, map to `userRoles` collection entry
3. Migrate `CheckInDoc.latitude/longitude` → `lat/lng` (add both to writes, read either, then remove old)
4. Migrate `PlayerStats.totalWins/totalLosses` → `stats.wins/losses`
5. Add Zod schemas for `LadderMatchDoc`, `UserProfile`, `ClubDoc` — validate on write in write helpers
6. Replace `any` types in `finalizeSession()` with typed interfaces
7. Add score range validation (0–25) and no-tie validation to Firestore rules for `ladderMatches`

**Deliverable:** TypeScript `--noEmit` passes with zero `any` violations. Schema migration runs cleanly on test data.

### Phase 3: Observability and Audit Logs (Week 3)

**Goal:** Know when things go wrong and be able to recover.

1. Add audit trail to `verifyLadderMatchScore()` (currently missing)
2. Add audit trail to player profile edits
3. Add audit trail to check-in status changes
4. Implement ELO repair script: detect `player.stats.matches` != `count(eloEvents where playerId == uid)`, flag for admin review
5. Implement finalization integrity check: detect sessions where `status == FINALIZED` but player stats don't match standings snapshot
6. Add Firebase Analytics events for critical flows (signup, check-in, score submission, finalization)
7. Configure Firebase Alerting on high error rates

**Deliverable:** Admin can audit any player's ELO history. Integrity check script runs nightly and posts to admin notification.

### Phase 4: Scaling and Server-Side Enforcement (Month 2)

**Goal:** Enforce business logic server-side; prepare for multi-club scale.

1. **Cloud Function: ELO Application**
   - Trigger: `onDocumentUpdated("ladderMatches/{id}")` when status changes to `VERIFIED` or `ADMIN_ASSIGNED`
   - Compute ELO deltas server-side, write atomically in a Firestore transaction
   - Remove ELO field write permission from Firestore rules (tighten to owner-only)

2. **Cloud Function: Role Grant**
   - HTTP callable function: `grantRole(targetUserId, roleId, scopeId)`
   - Validates requestor is SiteAdmin via custom claim
   - Atomically writes `userRoles` doc + `roleEvents` doc + notification
   - Tighten `userRoles` Firestore rule to `allow write: if false` (Cloud Function only via Admin SDK)

3. **Cloud Function: Club Approval**
   - HTTP callable: `approveClub(clubId)` / `rejectClub(clubId, notes)`
   - Validates requestor is SiteAdmin, updates club + userRoles atomically via Admin SDK batch
   - Sends notification

4. **Cloud Function: Session Generation**
   - HTTP callable: `generateSession(playDateId, options)`
   - Performs full generation + persistence in a server-side batch (no 500-op limit with Admin SDK)
   - Returns session ID on success; rolls back completely on failure

5. **Multi-tenant isolation:** Add `orgId` to all ladder collections; update Firestore rules to scope reads and writes by org membership

**Deliverable:** All privileged operations are server-enforced. Client-side code can be read by any user without security risk. Firestore rules become simpler (most sensitive collections: write: if false).

---

## Agent Notes

The following files were not directly read (content inferred from imports and grep results):

- `src/app/(authenticated)/dashboard/page.tsx` — inferred from `AdminDashboard` component imports
- `src/app/ladder/check-in/page.tsx` — referenced but not read in full
- `firestore.indexes.json` — not inspected; composite index requirements for compound queries (userId + active, status + createdAt) may not be defined, causing slow or failing queries in production
- `src/domain/ladder/generation.ts` — the session generation domain logic was not read; round-robin algorithm correctness is unaudited
- `scripts/seed-firestore.ts` — seed script not audited
- Any `.env` or `.env.local` files — confirmed absent from repository (correctly gitignored); no secrets were exposed

**Uncertain assumptions:**

1. It is assumed there are no Cloud Functions deployed to the Firebase project that compensate for the missing server-side logic. If Cloud Functions exist outside this repository, several DI findings may be partially mitigated.
2. The `firestore.indexes.json` file was not read. Compound queries in `usePermissions()` (`userId + active`), `listPendingClubs()` (`status + createdAt`), and `listUserClubs()` (`creatorUserId + createdAt`) all require composite indexes. If these indexes are missing, queries will fail or return incomplete results in production.
3. The `src/domain/` directory was referenced in imports but not fully explored. Additional business logic may exist there.
