# Executive Summary

This repository is a Next.js 15 static-export SaaS application for pickleball clubs, leagues, tournaments, ladder sessions, player profiles, check-ins, scores, roles, and admin operations. The runtime data layer is Firebase client SDK access to Firestore. Firebase Hosting serves the exported `out` directory. No Cloud Functions, API routes, Realtime Database, or Firebase Storage rules were found in the inspected repository.

The highest production risk is architectural: most important writes are performed directly from browser code. Firestore rules provide a useful emergency boundary, but the app still lacks a trusted backend for role assignment, club approval, league creation, ladder generation/finalization, scoring, ELO updates, audit logs, and notification fanout. This creates data integrity, authorization, and recovery risks because clients can fail partway through workflows and because some rules still use `users/{uid}.role` as an authority source.

The second major risk is schema drift. Firestore document shapes live mostly in TypeScript interfaces and scattered write helpers. There is no shared runtime schema layer enforcing required fields, tenant fields, relationship existence, immutable fields, or status transitions. Firestore rules validate some sensitive fields, but many collections are governed by broad `isStaff()` writes and do not validate document structure.

The third major risk is operational integrity. Several flows do multiple dependent writes without a transaction or a single batch, and some best-effort follow-up writes can fail after the user-visible action succeeds. Examples include ladder score submission followed by ELO updates, ladder session generation writing sessions/courts/matches/audits sequentially, and session finalization updating sessions, snapshots, and players sequentially.

# Architecture Map

## Repository Inventory

- App type: static-export Next.js SaaS frontend.
- Framework/language: Next.js 15, React 19, TypeScript, Tailwind CSS.
- Package manager: npm with `package-lock.json`.
- Build/deploy: `next build` with `output: "export"` in `next.config.mjs`; Firebase Hosting deploy via `.github/workflows/deploy.yml`.
- Firebase services detected: Firebase Auth, Firestore, Firebase Hosting, Firebase Analytics.
- Firebase services not found: Cloud Functions, Realtime Database rules, Storage rules, App Check setup.
- Test framework: Vitest; Firebase rules tests configured in `tests/firebase/firestore.rules.test.ts`.

## Firebase and Environment Files

- `firebase.json`: Hosting, Firestore rules/indexes, Firestore emulator.
- `.firebaserc`: Firebase project alias.
- `firestore.rules`: Firestore authorization and partial data validation.
- `firestore.indexes.json`: Composite indexes.
- `.env.example`: public Firebase web config placeholders and service-account seed variable placeholder.
- `.env.local`: present locally, ignored by git; contains public Firebase web config values, redacted in this audit.
- `.github/workflows/deploy.yml`: CI build and Firebase Hosting deployment.
- No `storage.rules`, `database.rules.json`, `functions/`, or `src/app/api/**/route.ts` files were found.

## Frontend Layers

- `src/app`: Next.js routes for public pages, auth, admin, clubs, leagues, ladder, players, games, tournaments, notifications.
- `src/components`: reusable layout, UI, admin, player, club, league, and bracket components.
- `src/domain`: pure bracket and ladder domain engines with unit tests for bracket/ladder logic.
- `src/lib`: Firebase initialization, auth context, Firestore repositories, write helpers, permission helpers, local UI state, and security placeholders.

## Backend/API Layers

There is no application backend in the repository. Backend-required operations are represented by client write helpers and, in one file, the placeholder `trustedBackendRequired()` in `src/lib/security/backendRequired.ts`. The placeholder is not broadly wired into the inspected write helpers.

## Firebase Services

- Firebase Auth is initialized in `src/lib/firebase.ts` and consumed by `src/lib/auth.ts` and `src/lib/auth-context.tsx`.
- Firestore is initialized in `src/lib/firebase.ts`.
- Analytics is lazily initialized in `src/lib/firebase.ts`.
- Hosting rewrites in `firebase.json` support static fallback shells for `/leagues/**`, `/clubs/**`, and `/clubs/manage/**`.

## Authentication Flow

- Email/password signup is implemented in `src/lib/auth-context.tsx` using `createUserWithEmailAndPassword`.
- Google sign-in is implemented in `src/lib/auth.ts` and `src/lib/auth-context.tsx` using `signInWithPopup`.
- On auth state changes, `src/lib/auth-context.tsx` fire-and-forget upserts `users/{uid}` with email/display/photo/update timestamp.
- Email signup creates `users/{uid}` with `role: "PLAYER"`, `accountStatus: "ACTIVE"`, `clubId: null`, and `leagueIds: []`.
- No server-side session guard exists because the app is static-exported.
- The `(authenticated)` layout only renders navigation; it does not enforce authentication.

## Authorization Flow

- UI authorization comes from `src/lib/permissions/usePermissions.ts`, which reads `userRoles` and `users/{uid}.role`.
- Helper authorization in `src/lib/permissions/helpers.ts` reads `userRoles`.
- Firestore rules use custom claims if present, then fall back to `users/{uid}.role` via `userRole()`.
- Role systems are duplicated:
  - `UserRole`: `SITE_ADMIN`, `CLUB_ADMIN`, `LEAGUE_COORDINATOR`, `PLAYER`.
  - `RoleKey`: `SiteAdmin`, `ClubDirector`, `LeagueCoordinator`, `Player`, `ClubCreatorProvisional`.
- `src/lib/permissions/write.ts` and `src/lib/admin/write.ts` synchronize these systems client-side.

## Data Read/Write Flow

- Pages call repository modules in `src/lib/**/repo.ts` to read Firestore.
- Pages/components call `src/lib/**/write.ts` helpers to write Firestore.
- Most writes use Firebase client SDK directly: `setDoc`, `updateDoc`, `addDoc`, and `writeBatch`.
- Rules decide whether writes are accepted. There is no backend validation layer.

## File Upload/Download Flow

No Firebase Storage SDK usage, upload helpers, or storage rules were found. Club logos are stored as a user-entered `logoUrl` string in `ClubCreateForm`, not uploaded assets.

## Admin/User Flow

- Admin UI is gated client-side by `usePermissions()`.
- Site admins can manage users in `src/app/admin/users/page.tsx`.
- Site admins can approve clubs through `src/lib/permissions/write.ts`.
- Club directors manage clubs in `src/app/clubs/manage/[clubId]/ClubManageClient.tsx`.
- Players edit profiles, check in, and interact with league/player pages through client Firestore calls.

## Error/Logging Flow

- User-visible errors are mostly component-local `try/catch` messages and toast messages.
- Operational logs use `console.warn`/`console.error` in ELO and ladder persistence paths.
- Firestore audit collections exist (`auditLog`, `audits`, `roleEvents`), but many workflows either do not write audit events or can partially fail before/after audit writes.
- No external monitoring or crash reporting was found.

## Deployment Flow

- GitHub Actions runs typecheck, unit tests, static build, and Firebase Hosting deploy.
- CI hardcodes public Firebase web config in `.github/workflows/deploy.yml`.
- Deployment uses `FirebaseExtended/action-hosting-deploy@v0` and `secrets.FIREBASE_SERVICE_ACCOUNT`.
- CI does not deploy Firestore rules or indexes in the shown workflow.

# Data Flow Map

1. Sign-up: user submits auth form in `src/app/auth/signup/page.tsx`; `signUpWithEmail()` creates Firebase Auth user, updates display name, then writes `users/{uid}`.
2. Login: user signs in with email/password or Google; `onAuthStateChanged` updates auth context and attempts a profile upsert.
3. Permissions: components call `usePermissions()`, which reads `userRoles` and `users/{uid}` to derive client UI access.
4. Club creation: `submitClubCreation()` writes `clubs/{id}` and a provisional `userRoles/{id}` in a batch.
5. Club approval: `approveClub()` updates club status, deactivates provisional roles, creates a director role, updates `users/{uid}.role`, writes `roleEvents`, and writes a notification in one batch.
6. League creation: `createLeague()` writes `leagues/{id}` and a creator coordinator `userRoles/{id}` in one batch.
7. League joining: `joinLeague()` writes deterministic `leagueMemberships/{leagueId}__{userId}`.
8. Player profile edit: `upsertPlayerProfile()` reads `players/{uid}` and either creates seeded profile/stats or updates editable fields.
9. Check-in: browser geolocation computes distance in `src/app/ladder/check-in/page.tsx`; `createCheckIn()` writes deterministic `checkIns/{playDateId}__{uid}` with caller-provided status.
10. Ladder generation: `persistGeneratedSession()` writes session, courts, matches, then audit sequentially.
11. Ladder scoring: `submitLadderMatchScore()` validates score, updates match, then best-effort applies ELO deltas.
12. Tournament bracket publication: `publishBracket()` queries prior bracket data, deletes and rewrites bracket/nodes/matches, and updates tournament status in one batch.
13. Tournament scoring: `recordMatchScore()` validates score, writes match/games/node propagation/tournament status in one batch, then best-effort applies ELO deltas.
14. Notifications: staff-created notifications are read by `subscribeNotifications()` scoped by `userId`.

# Entity and Collection Inventory

| Entity / Collection | Purpose | Key Fields | Owner / Tenant Fields | Read Path | Write Path | Validation / Guard | Known Risks |
|---|---|---|---|---|---|---|---|
| `users` | Auth-level profile and primary role fallback | `uid`, `email`, `displayName`, `role`, `accountStatus`, `clubId`, `leagueIds`, timestamps | `uid`, `clubId`, `leagueIds` | `auth-context`, `userRepo`, `usePermissions`, admin pages | `auth-context`, `admin/write`, `permissions/write`, `userRepo` | Firestore rules restrict self role/status/tenant edits | Public reads expose user profile/email fields; role used as rules authority fallback |
| `userRoles` | Scoped RBAC assignments | `userId`, `roleId`, `clubId`, `leagueId`, `assignedBy`, `active` | `userId`, `clubId`, `leagueId` | `usePermissions`, `permissions/helpers`, `clubs/repo` | `permissions/write`, `admin/write`, `leagues/write` | Rules allow admins and club directors to write | Club directors can write broad role docs without rule-level scope validation |
| `roleEvents` | Role audit trail | `userId`, `eventType`, old/new role, scope, timestamp | `userId`, `clubId`, `leagueId` | `admin/repo` | `permissions/write`, `admin/write` | Append-only in rules for admins | Not all role changes necessarily captured; schema not validated |
| `clubs` | Club submissions and approved clubs | `clubName`, `location`, `description`, `logoUrl`, `status`, `createdBy`, timestamps | `createdBy` | `clubs/repo`, club/admin pages | `permissions/write` | Rules restrict creation to signed-in pending owner and updates to owner-pending/admin | No backend approval workflow; public reads; no runtime schema |
| `clubFacilities` | Facility metadata per club | `clubId`, address/court counts/amenities, `updatedBy` | `clubId`, `updatedBy` | `clubs/repo` | `clubs/write` | Rules allow staff write | Rule does not enforce `clubId == doc id` or director scope |
| `leagues` | Club-owned leagues | `orgId`, `clubId`, `name`, `active`, `createdBy`, timestamps | `clubId`, `orgId`, `createdBy` | `leagues/repo`, `clubs/repo` | `leagues/write` | Rules allow staff write | Staff writes not scope-checked; public reads; fallback query reads all leagues |
| `leagueMemberships` | User membership in leagues | `leagueId`, `userId`, `status`, `joinedAt` | `leagueId`, `userId` | `leagues/repo`, `clubs/repo` | `leagues/write` | Rules allow staff write, self/staff read | `joinLeague()` likely rejected by current rules; membership source not consistently enforced |
| `organizations` | Legacy org catalog | `slug`, `name`, `tagline`, `createdAt` | none explicit | generic Firestore reads | not found | Public read, staff write | Legacy model can drift from clubs |
| `venues` | Play/check-in locations | `name`, address, `lat`, `lng`, `radiusMeters`, `clubId`, `createdBy` | `clubId`, `createdBy` | `ladder/repo`, player edit/check-in | `ladder/write`, club manage page | Client numeric checks only; rules allow staff write | Club manage creates venues with `lat: 0`, `lng: 0`; no rule schema |
| `courts` | Legacy venue courts | `venueId`, `label`, `surface` | `venueId` | not materially used | not found | Public read, staff write | Relationship existence not enforced |
| `seasons` | Tournament/ladder seasons | mixed `SeasonDoc` and `LadderSeasonDoc` shapes | `leagueId` or `createdBy` depending shape | `ladder/repo` | `ladder/write` | Rules allow staff write | Same collection is used for two incompatible shapes |
| `divisions` | Tournament divisions | `seasonId`, skill range, format | `seasonId` | not materially used | not found | Public read, staff write | Relationship existence not enforced |
| `playDates` | Ladder dates | `seasonId`, `venueId`, `status`, check-in window, session ids, `createdBy` | `seasonId`, `venueId`, `createdBy` | `ladder/repo`, check-in page | `ladder/write` | Rules allow staff or creator writes | Non-staff creator can create/update own play dates; status transitions not validated |
| `checkIns` | Player check-ins | `playDateId`, `userId`, `displayName`, `status`, geolocation | `playDateId`, `userId` | `ladder/repo` | `ladder/write` | Rules allow self create; staff update/delete | Client controls geofence status and location data |
| `ladderSessions` | Generated ladder sessions | `playDateId`, `seasonId`, `kind`, `status`, settings, timestamps | `playDateId`, `seasonId` | `ladder/repo` | `ladder/write` | Rules staff write | Sequential generation can partially write |
| `ladderCourts` | Session courts | `sessionId`, `playDateId`, `courtNumber`, `size`, `playerIds` | `sessionId`, `playDateId` | `ladder/repo` | `ladder/write` | Rules staff write | No rule validation of court size/player count |
| `ladderMatches` | Ladder match schedule/results | `sessionId`, `courtId`, `sideA`, `sideB`, scores, status | `sessionId`, `courtId` | `ladder/repo`, player components | `ladder/write` | Rules staff write | Score/ELO writes are not atomic; players cannot submit under current staff-only rule |
| `standingsSnapshots` | Finalized ladder standings | session/play/season ids, results arrays | `sessionId`, `playDateId`, `seasonId` | `ladder/repo` | `ladder/write` | Rules staff write | Sequential finalization can leave status without snapshot/player updates |
| `audits` | Ladder audit trail | `kind`, `actorId`, `targetId`, payload, `createdAt` | `actorId`, `targetId` | admin audit page | `ladder/write` | Rules staff create, admin read | Some ladder writes lack audit; schema not validated |
| `auditLog` | Generic admin audit | action/actor/target metadata | actor/target fields | admin audit page | `admin/write` | Rules admin read/create only | Append not coupled to every admin mutation |
| `players` | Public player profile/stats/ELO | `userId`, display/location/equipment, `elo`, `eloPeak`, `stats`, timestamps | `userId` | `players/repo`, pages | `players/write`, ladder/tournament ELO flows | Rules allow self create/update only safe profile fields; admin full writes | Public reads include discretionary profile; ELO updates blocked from client under current rules |
| `eloEvents` | ELO audit events | `playerId`, delta, before/after, source, context | `playerId` | `players/repo` | `players/write` | Rules deny all writes | Current client ELO writer cannot succeed without backend/admin rule path |
| `tournaments` | Tournament definitions | org/slug/name/status/format/dates/rules | `orgId`, `createdBy` in writes | `firestore/repo`, tournament pages | `firestore/write` | Public read; creator/staff update | Creator authorization is tournament-level only, no tenant guard |
| `registrations` | Entrants | `tournamentId`, `userId`/`teamId`, displayName, seed, status | `tournamentId`, `userId` | `firestore/repo` | `firestore/write` | Self create; self status update or staff/creator update | Self can update `status` to allowed values without transition validation |
| `teams` | Tournament teams | `createdBy`, team fields not fully typed here | `createdBy` | not materially used | not found | Public read; creator/staff update | Shape not defined in `types.ts` beyond rules expectations |
| `brackets` | Persisted bracket engine output | `tournamentId`, format, node ids, rounds | `tournamentId`, `createdBy` | `firestore/repo` | `firestore/write` | Staff or tournament creator write | Delete/rebuild is client-driven; batch limit risk for large tournaments |
| `bracketNodes` | Bracket graph nodes | bracket/tournament ids, round/position, entrants, next links | `bracketId`, `tournamentId` | `firestore/repo` | `firestore/write` | Staff or tournament creator write | Index file references old `round`/`indexInRound` names, not current fields |
| `matches` | Tournament matches | tournament/node ids, participants, scores/status | `tournamentId`, `bracketNodeId` | `firestore/repo` | `firestore/write` | Staff or tournament creator write | Score commit and ELO follow-up not atomic |
| `matchGames` | Per-game scores | `matchId`, game number, scores | `matchId` | `firestore/repo` | `firestore/write` | Staff write only | Tournament creator score path may fail if not staff |
| `standings` | Legacy standings | not fully typed | unknown | public | not found | Public read, staff write | Schema unknown |
| `announcements` | Org announcements | `orgId`, title/body/kind/createdAt | `orgId`, `createdBy` | `firestore/repo` | `firestore/write` | Public read, staff write | No tenant-scope validation for staff writer |
| `notifications` | User inbox | `userId`, title/body/href/kind/read/timestamps | `userId`, `createdBy` | `firestore/repo` | `firestore/write`, admin/permissions write | User can update/delete own notification; staff create | User update not limited to `read` in rules |
| `achievements`, `playerAchievements`, `trophies` | Gamification | typed partially | player/user implied | public | not found | Public read, staff write | Schema and relationships not enforced |

# Data Integrity Risk Register

| ID | Severity | Area | File path | Problem | Evidence from code | Why it matters | Recommended fix | Suggested test |
|---|---|---|---|---|---|---|---|---|
| DI-001 | Critical | Architecture | `src/lib/**/write.ts`, no `functions/` | Production mutations run from browser clients instead of a trusted backend | Client write helpers call `setDoc`, `updateDoc`, `addDoc`, `writeBatch` across admin, ladder, players, permissions, tournaments | Client-side code cannot enforce invariants, idempotency, rate limits, secret validation, or authoritative audit behavior | Move privileged and multi-document workflows to Firebase Cloud Functions or another trusted API; leave clients as command callers | Integration test each command with unauthorized, cross-tenant, and happy paths |
| DI-002 | Critical | RBAC source of truth | `firestore.rules`, `src/lib/permissions/write.ts`, `src/lib/admin/write.ts` | Rules still authorize staff via mutable Firestore `users/{uid}.role` fallback | `firestore.rules` `userRole()` reads `users/{uid}.role`; role writers update the same field | A database field becomes an authorization source; any rules gap in role writes becomes privilege escalation | Use Auth custom claims as rules authority; make `users.role` display-only; backend owns claim changes | Rules test proving user/doc role cannot grant write access without custom claim |
| DI-003 | High | RBAC scope integrity | `firestore.rules`, `src/lib/permissions/write.ts` | Club directors can create/update/delete `userRoles` without rule-level validation that target role and scope are within their club | Rules: `allow create, update, delete: if isAdmin() || isClubDirector();` | A club director may be able to create broad coordinator/director role documents if their primary role passes `isClubDirector()` | Restrict club director writes to allowed role ids, same club scope, no `SiteAdmin`, no null club/global roles; preferably backend-only | Rules tests for club director cannot assign global, other-club, SiteAdmin, or ClubDirector roles |
| DI-004 | High | Role duplication | `src/lib/firestore/types.ts`, `src/lib/permissions/types.ts` | Two role schemas are synchronized manually | `UserRole` and `RoleKey` differ; mappings exist in `permissions/write.ts` and `admin/write.ts` | Drift can make UI, rules, and data disagree about a user's authority | Collapse to one canonical role model; derive display labels separately | Unit test mapping coverage and migration script validation |
| DI-005 | High | Ladder generation | `src/lib/ladder/write.ts` | Session, court, match, and audit writes are sequential, not a single atomic batch | `persistGeneratedSession()` awaits `setDoc` in loops and writes audit afterward | A network/rules failure can leave session without all courts/matches or without audit | Use `writeBatch` or backend transaction/chunked batches with idempotency key and cleanup/retry semantics | Simulate failure after session write and verify no partial generated state remains |
| DI-006 | High | Ladder finalization | `src/lib/ladder/write.ts` | Finalization updates session, snapshot, player stats, and audit sequentially | `finalizeSession()` calls `updateDoc`, `setDoc`, loops `updateDoc`, then `writeAudit` | Session can be marked `FINALIZED` while snapshot/player stats/audit are incomplete | Move finalization to backend transaction/batch; compute snapshot server-side; write status last | Test forced failure in player update leaves session not finalized |
| DI-007 | High | Score/ELO consistency | `src/lib/ladder/write.ts`, `src/lib/firestore/write.ts`, `src/lib/players/write.ts` | Scores commit before ELO updates, and ELO failures are swallowed | `submitLadderMatchScore()` updates match then catches ELO errors; `recordMatchScore()` commits score then best-effort applies ELO | Leaderboards can diverge from recorded matches with no repair queue | Backend should commit score, ELO deltas, events, and audit together or enqueue a durable job | Test ELO failure creates retry task and score shows pending rating sync |
| DI-008 | High | ELO write path | `firestore.rules`, `src/lib/players/write.ts` | ELO client writer targets collections that current rules deny or restrict | Rules deny all `eloEvents` writes and restrict `players` self updates to safe profile fields | ELO update code may consistently fail outside admin contexts, while UI still accepts score | Move ELO application to backend with Admin SDK; update UI to expose rating-sync status | Rules/integration test score submission produces expected player ELO and event |
| DI-009 | High | Check-in trust | `src/app/ladder/check-in/page.tsx`, `src/lib/ladder/write.ts` | Client controls geofence result and location fields | Browser computes distance and passes `status` to `createCheckIn()` | Users can tamper with request payload to mark themselves confirmed | Backend validates play date window, venue, distance, and writes status; rules only allow request documents or backend writes | Rules test self cannot create `CONFIRMED`; function test validates distance |
| DI-010 | High | Collection schema drift | `src/lib/firestore/types.ts`, `src/lib/ladder/write.ts`, `src/lib/firestore/write.ts`, `firestore.rules` | TypeScript interfaces are not runtime validation; rules validate only selected fields | Zod dependency exists but no runtime schemas were found in app code | Bad or partial docs can be written by staff clients and break readers | Add shared Zod schemas for create/update commands and mirror critical constraints in rules/backend | Schema tests for every command payload |
| DI-011 | High | Seasons collection | `src/lib/firestore/types.ts`, `src/lib/ladder/write.ts` | `seasons` is used for both legacy tournament seasons and ladder seasons with incompatible shapes | `SeasonDoc` requires `leagueId`; `LadderSeasonDoc` uses `createdBy`, `targetPoints`, movement settings | Mixed docs make queries/readers fragile and future migration harder | Split into `ladderSeasons` and `tournamentSeasons`, or add typed discriminator and migration | Test list ladder seasons ignores legacy tournament season docs |
| DI-012 | Medium | Index drift | `firestore.indexes.json`, `src/lib/firestore/types.ts` | Index references old bracket node fields `round` and `indexInRound` | Current `BracketNodeDoc` fields are `roundIndex` and `positionInRound` | Intended ordered queries may fail or use wrong indexes later | Update indexes to current field names or remove unused indexes | Emulator test query with intended order succeeds |
| DI-013 | Medium | Query fallback over-read | `src/lib/leagues/repo.ts` | `listActiveLeagues()` falls back to reading all leagues if no active docs exist | Function queries active leagues, then `getDocs(collection(leagues))` | A missing `active` flag can turn a scoped catalog query into a full collection read | Remove fallback or bound it to intended public catalog criteria | Test inactive/unset leagues do not appear in active list |
| DI-014 | Medium | Notification mutation | `firestore.rules`, `src/lib/firestore/write.ts` | Users can update or delete their notification documents without field-level update restriction | Rules allow `read, update, delete` if `resource.data.userId == request.auth.uid` | User can alter title/body/href/kind, not just read status | Rules should allow only `read` toggle updates and maybe disallow delete or soft-delete only | Rules test user cannot change `href`, `body`, or `userId`; can set `read` |
| DI-015 | Medium | Membership write mismatch | `src/lib/leagues/write.ts`, `firestore.rules` | `joinLeague()` writes league memberships as a normal user, but rules only allow staff create/update/delete | Rules `leagueMemberships` create/update/delete: `isStaff()` | Join UX can appear broken or be worked around unsafely later | Implement backend join command or explicit self-join rules with league status/capacity validation | Rules test self join allowed only for active public league and own uid |
| DI-016 | Medium | Venue coordinates | `src/app/clubs/manage/[clubId]/ClubManageClient.tsx` | Club venue form creates venues with `lat: 0`, `lng: 0` | `handleCreateVenue()` passes `lat: 0, lng: 0` | Geofence check-ins will be invalid and can reject/accept users around the wrong location | Require map/geocoding or manual lat/lng before venue can be active | UI/integration test cannot create active venue without valid coordinates |
| DI-017 | Medium | Tournament bracket batch size | `src/lib/firestore/write.ts` | Bracket publishing deletes prior docs and writes all new docs in one batch | `publishBracket()` batches prior brackets/nodes/matches plus generated nodes/matches | Firestore batches max at 500 writes; large tournaments can fail at publish time | Add size guard, chunking strategy, or backend job; make publish idempotent with versioned bracket ids | Test tournament over threshold returns clear error before writes |
| DI-018 | Medium | Audit gaps | `src/lib/ladder/write.ts`, `src/lib/admin/write.ts`, `src/lib/permissions/write.ts` | Some sensitive operations lack durable audit or write audit after mutation | `verifyLadderMatchScore()` has TODO; ELO failures only console.warn | Operators cannot reconstruct who changed standings/scores/roles under failure | Backend command wrapper writes append-only audit in same transaction/batch | Test every privileged command emits one audit event |
| DI-019 | Medium | Local UI state | `src/lib/admin-context.tsx`, `src/lib/role-view-context.tsx`, `src/lib/selectedLeague.ts` | Admin/role/league UI state is stored in localStorage/sessionStorage | `adminMode`, `roleView`, and selected league id are persisted locally | Safe only if never trusted; future code may mistake UI mode for authority | Document these as display-only and avoid using them in write authorization | Unit test write helpers require auth/permission state, not local role view |
| DI-020 | Low | Timestamp typing | `src/lib/firestore/types.ts`, multiple write helpers | Types claim ISO string timestamps while writes use Firestore `serverTimestamp()` | Comment says timestamps are ISO strings, but writes store Timestamp sentinels | Runtime readers need defensive timestamp parsing; type mismatch hides bugs | Use `Timestamp | string` or converter layer that normalizes on read | Type tests/converter tests for timestamp normalization |

# Cross-Tenant Risk Register

| ID | Severity | Area | File path | Problem | Evidence from code | Why it matters | Recommended fix | Suggested test |
|---|---|---|---|---|---|---|---|---|
| CT-001 | Critical | Tenant authorization | `firestore.rules` | Staff writes are mostly global, not scoped to assigned club/league | Catalog and ladder collections use `allow write: if isStaff()` | Any staff role can potentially mutate other clubs/leagues if role fallback grants staff | Add membership/scope checks per collection and move high-risk writes backend-side | Club director for club A cannot write club B league/venue/playDate |
| CT-002 | High | Club manage URL access | `src/app/clubs/manage/[clubId]/ClubManageClient.tsx`, `firestore.rules` | UI checks `clubDirectorFor.includes(clubId)`, but write helpers do not include server-verified scope checks | Page derives `canManage`; helpers write by doc id or payload clubId | A malicious client can bypass UI and call Firestore writes directly; rules must own scope | Enforce doc/payload `clubId` in rules or backend commands | Direct Firestore write by club A director to club B facility/venue denied |
| CT-003 | High | User lookup by email | `src/lib/clubs/repo.ts`, `firestore.rules` | Club coordinators can search `users` by email because `users` reads are public | `getUserByEmail()` queries `users` where email equals input; rules allow `users` read if true | Public email enumeration and cross-tenant user discovery | Split public profiles from private auth profiles; restrict email lookup to backend invitation command | Unauthenticated and non-staff cannot query users by email |
| CT-004 | High | Public users collection | `firestore.rules` | All `users/{uid}` documents are publicly readable | `match /users/{userId} { allow read: if true; ... }` | Emails, phone numbers, role/status, club/league ids can leak across tenants | Restrict private user docs; expose only sanitized `publicProfiles` | Rules test unauth cannot read email/phone fields |
| CT-005 | High | Public operational collections | `firestore.rules` | Many operational collections allow public read | Leagues, seasons, playDates, sessions, matches, checkIns, standings snapshots read `if true` | Check-ins, sessions, and match schedules can expose attendance and tenant operations | Separate public catalog data from private operational data; scope operational reads | Unauth user cannot list check-ins or operational sessions |
| CT-006 | High | Club director role assignment | `src/app/clubs/manage/[clubId]/ClubManageClient.tsx`, `src/lib/permissions/write.ts` | Coordinator assignment takes email and writes role for chosen `clubId` client-side | `assignRole(found.uid, "LeagueCoordinator", clubId, null, userId)` | Without rule/backend scope validation, role docs can target arbitrary users/scopes | Backend invite/assign command verifies caller manages club and target constraints | Club director cannot assign coordinator outside their club |
| CT-007 | Medium | League creation club selection | `src/app/leagues/create/page.tsx`, `src/lib/leagues/write.ts` | UI lists allowed clubs, but `createLeague()` trusts passed `clubId` | `createLeague(createdBy, input)` writes `clubId: input.clubId` | Caller can forge another club id if rules allow staff globally | Rules/backend must verify caller has director/coordinator role for `clubId` | Direct forged `clubId` create denied |
| CT-008 | Medium | Tournament creator boundary | `firestore.rules`, `src/lib/firestore/write.ts` | Tournament creator can update bracket/matches for tournament they created, independent of org/club membership | `isTournamentCreator()` checks only `createdBy` on tournament | A user can create tournament under arbitrary `orgId` and gain control over associated tournament data | Validate `orgId`/club membership at creation and updates | User cannot create tournament for org/club they do not manage |
| CT-009 | Medium | Admin stats | `src/lib/admin/repo.ts` | Admin stats read whole users/clubs collections client-side | `getAdminStats()` loads all users and role-filtered users | If UI gate or rules are wrong, cross-tenant data volume leaks; also scales poorly | Backend aggregate counters or admin-only secured aggregate docs | Non-admin cannot read admin stats inputs; admin dashboard reads aggregate only |
| CT-010 | Medium | Check-in visibility | `src/lib/ladder/repo.ts`, `firestore.rules` | `subscribeCheckIns(playDateId)` exposes attendance data; rules allow public read | Query is scoped by playDateId, but rules are public | Anyone who knows a play date can list attendees | Require participant/staff access for checkIns | Unauth and unrelated user cannot list check-ins |

# Validation Gaps

- Runtime validation is mostly absent. The repo has `zod` installed, but no inspected application code uses Zod schemas for Firestore command validation.
- Firestore rules validate only selected sensitive fields on `users` and `players`; most staff-writable collections have no field/type validation.
- Client forms validate required fields in components such as `ClubCreateForm`, auth pages, player edit, and club manage forms, but client validation is bypassable.
- Role docs do not have rules enforcing allowed `roleId`, `clubId`, `leagueId`, `assignedBy`, or immutable scope semantics.
- Club facility writes do not enforce non-negative court counts or `clubId == doc id` in rules.
- Venue writes validate finite coordinates in client helper, but club manage currently passes `0,0`; no backend/rules validation prevents bad geofence data.
- Check-in writes trust client-provided geofence status, display name, coordinates, and distance.
- League, club, tournament, registration, match, bracket, ladder session, ladder court, standings snapshot, audit, and notification schemas are not fully validated at runtime or in rules.
- Status transitions are not centrally validated. Examples: tournament status, play date status, registration status, ladder session status, ladder match status.
- Relationship existence is not enforced for references such as `clubId`, `leagueId`, `seasonId`, `venueId`, `playDateId`, `sessionId`, `courtId`, `tournamentId`, and `userId`.
- Timestamp types are inconsistent between TypeScript interfaces and Firestore server timestamps.
- Local/session storage values are used for UI mode and selected league only; this is acceptable only if they remain display/navigation hints and never become authorization input.

# Required Fixes Before Production

## Must Fix

- Implement trusted backend commands for role assignment, club approval/rejection, league creation, venue/play-date management, ladder generation/finalization, score verification, ELO updates, audit logging, and notification fanout.
- Remove Firestore `users/{uid}.role` as an authorization source in rules; use custom claims or backend-owned role checks.
- Scope all staff writes by club/league/tenant membership, not only by broad staff role.
- Split private `users` from public player/profile data; stop public reads of emails, phone numbers, roles, account status, and tenant fields.
- Lock down public reads of operational collections such as `checkIns`, ladder sessions/courts/matches, standings snapshots, and audit-like data.
- Add runtime schemas for every backend command and mirror critical invariants in Firestore rules.
- Make ladder generation/finalization and score/ELO flows atomic or durably retryable.
- Add App Check enforcement and rate limiting for high-cost or abuse-prone commands.
- Deploy Firestore rules and indexes through CI, not only hosting.

## Should Fix Before Beta

- Resolve the duplicate role model (`UserRole` vs `RoleKey`).
- Split or discriminate incompatible `seasons` document shapes.
- Fix `firestore.indexes.json` bracket node field drift.
- Replace public all-collection reads and admin whole-collection counts with scoped queries or aggregate documents.
- Add tests for cross-club, cross-league, role escalation, notification field tamper, check-in tamper, and private profile access.
- Add explicit idempotency keys for publish/generate/finalize/score commands.
- Add data repair scripts for partial ladder sessions, orphaned role docs, orphaned league memberships, and missing player profiles.

## Monitor After Launch

- Failed Firestore writes by command and route.
- ELO sync failures and rating/event mismatches.
- Partial generated sessions without all courts/matches.
- Finalized sessions missing snapshots or audit records.
- Role changes and club approval events.
- Query/index errors in production logs.
- Abuse patterns on signup, club creation, check-in, score submission, and notifications.

# Suggested Refactor Plan

## Phase 1: Critical Safety Fixes

1. Add backend command layer using Firebase Cloud Functions or another trusted API.
2. Move role/admin/club approval/league creation/ladder/scoring/ELO workflows behind backend commands.
3. Update Firestore rules so clients can only read/write low-risk self-service documents.
4. Replace `users.role` rule fallback with custom claims or backend-only role derivation.
5. Add rules tests for every critical deny case: unauthenticated, cross-user, cross-club, cross-league, role escalation, operational public read, and private user profile read.

## Phase 2: Schema and Validation Cleanup

1. Create shared Zod schemas for command inputs and Firestore document outputs.
2. Add converter/repository layer that normalizes Firestore timestamps.
3. Merge or map role types through a single canonical model.
4. Split mixed collections such as `seasons`, or add a required discriminator with migration.
5. Add relationship validation in backend commands for all foreign keys.

## Phase 3: Observability and Audit Logs

1. Add a durable audit wrapper for every privileged backend command.
2. Add structured error logging and alerting for failed commands.
3. Add retry queues or repair jobs for ELO sync and notification fanout.
4. Add admin data integrity dashboards for partial sessions, orphaned docs, and stale roles.

## Phase 4: Scaling and Maintainability

1. Replace client whole-collection admin stats with aggregate documents.
2. Add pagination/cursors to large lists.
3. Add batch chunking or background jobs for large bracket publishing and ladder generation.
4. Add App Check, per-user/IP rate limits, and abuse quotas for public and authenticated command surfaces.
5. Document collection ownership, indexes, invariants, and command contracts as part of the development guide.

# Agent Notes

- Inspected repository files with `rg --files`, Firebase config, Firestore rules/indexes, package scripts, CI workflow, auth/permission modules, Firestore repository/write modules, ladder/player/club/admin/tournament flows, tests, and environment examples.
- No live Firebase services were queried. No production-destructive commands were run.
- `.env.local` exists locally and is ignored by git. Its values were not printed; only variable names were inspected in redacted form.
- `.github/workflows/deploy.yml` contains public Firebase web config. Those values are not secret, but CI should still avoid unnecessary logging of app ids/config values.
- No `storage.rules`, `database.rules.json`, Cloud Functions directory, API route files, Storage SDK usage, or App Check setup were found.
- Firestore rules tests exist but this audit did not rerun them. Previous local context indicated rules tests require Java for the Firebase emulator.
- `src/app/clubs/manage/[clubId]/ClubManageClient.tsx` had existing uncommitted changes before this audit; it was inspected but not modified.
