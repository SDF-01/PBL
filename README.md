# Pickleball League / LeagueForge

Mobile-first pickleball league software for clubs, ladder play, player profiles, tournaments, and admin operations.

The app is a **Next.js static export** (`output: "export"`) served from Firebase Hosting. There is no application server. The browser talks directly to Firebase Auth, Cloud Firestore, and Cloud Storage for reads and self-service writes, and calls **Cloud Functions** for every privileged command.

## Current Status

The privileged-write migration is **done**. Role changes, club approval, ladder score submission/verification/disputes, admin result assignment, session generation, and session finalization all run in Cloud Functions under the Admin SDK. The client cannot write to `ladderSessions`, `ladderCourts`, `ladderMatches`, `standingsSnapshots`, or `eloEvents` at all — Firestore rules deny those paths outright.

Authorization has a single source of truth: the **Firebase Auth custom claim** `request.auth.token.role`. `firestore.rules`, `functions/src/lib/auth.ts`, and `usePermissions()` all read that claim and nothing else. `users/{uid}.role` still exists but is now only a UI cache, mirrored by the role-mutation functions.

Remaining gaps before production are listed under [Production Gate](#production-gate). The significant ones are App Check enforcement (wired but off), public read access on several collections, and `users/{uid}` not being split into public/private halves.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 App Router | `output: "export"` — static HTML/JS, no server runtime. |
| Language | TypeScript strict mode | `noUncheckedIndexedAccess` enabled. |
| Styling | Tailwind CSS + CSS variables | Obsidian/ember/rune visual system. |
| Auth | Firebase Auth | Email/password and Google OAuth; authority via custom claims. |
| Database | Cloud Firestore | Client SDK for reads + self-service writes; privileged writes are Functions-only. |
| Backend | Cloud Functions (gen 2) | 13 callables in `functions/`. Node 20, region `us-central1`. |
| Storage | Firebase Storage | Player photos and club logos; rules enforce role, owner path, size, and content type. |
| Push/PWA | Service workers + FCM | App SW, Messaging SW, client token registration, Admin SDK sender with stale-token cleanup. |
| Hosting | Firebase Hosting | Serves `out/`; rewrites map dynamic routes to `__fallback` pages. |
| Analytics | Firebase Analytics | Lazy client-only initialization. |
| App Check | reCAPTCHA Enterprise | Client wired; server enforcement env-gated (off by default). |
| Tests | Vitest + pytest/Playwright | Domain + rules + mirror guard; persona E2E suite with a local portal. |

## Repository Map

```text
src/
  app/                         Next.js routes and static-export pages
    (authenticated)/dashboard  Authenticated dashboard shell
    admin/                     Admin hub, club approvals, users, audit, testing
    auth/                      Login, signup, verify, forgot-password
    clubs/                     Club creation, owned clubs, club management
    ladder/                    Seasons, play dates, check-in, coordinator, session
    leagues/                   League create/detail/roster/schedule/standings
    players/                   Leaderboard, search, profile edit/view
    tournaments/               Tournament list/create/detail
  components/                  UI, layout, admin, player, bracket components
  domain/
    bracket/                   Pure bracket generation/progression/scoring
    ladder/                    Pure ladder rotations/generation/finalization
  lib/
    firebase.ts                Lazy Firebase client initialization
    auth-context.tsx           Firebase Auth provider
    appcheck.ts                App Check (reCAPTCHA Enterprise) init
    fcm.ts                     FCM token registration and foreground listener
    storage.ts                 Firebase Storage image upload helpers
    mirrors.test.ts            Drift guard for client/functions duplicated files
    firestore/                 Collection names, types, repo/write helpers
    functions/                 Callable client wrappers (typed)
    permissions/               Role types, claim-based usePermissions hook
    ladder/                    Ladder reads, check-in writes, geofence
    players/                   Player profile, ELO, follows, challenges
    schemas/                   Zod payload schemas (canonical; mirrored to functions/)
functions/
  src/commands/                One file per callable — the privileged command layer
  src/lib/                     Caller auth, scope checks, roles, ELO, push, collections
  src/schemas/                 Mirrors of src/lib/schemas
tests/
  firebase/                    Firestore rules tests (emulator)
  e2e/                         pytest + Playwright persona suite and test portal
scripts/                       Seeding, admin bootstrap, migrations
automation/                    TOON implementation handoff specs (gitignored)
```

## Cloud Functions

All callables live in [functions/src/commands/](functions/src/commands/) and are exported from [functions/src/index.ts](functions/src/index.ts). Typed client wrappers are in [src/lib/functions/callables.ts](src/lib/functions/callables.ts).

| Callable | Purpose |
|---|---|
| `approveClub` / `rejectClub` | Club approval workflow with role + audit writes. |
| `notifyAdminsOfClubSubmission` | Fan-out notification on club submission. |
| `assignRole` / `deactivateUserRole` | Scoped role grants; syncs claim + `users.role` mirror. |
| `setUserGlobalRole` | Site-admin global role assignment. |
| `syncMyClaims` | Self-service claim recompute from `userRoles`. |
| `submitMatchScore` | Transactional score + ELO deltas + `eloEvents` + audit + push. |
| `verifyMatchScore` / `disputeMatch` | Participant-driven score state transitions. |
| `adminAssignMatchResult` | Staff override for unresolved matches. |
| `persistGeneratedSession` | Writes engine-generated courts/matches atomically. |
| `finalizeSession` | Movement calculation, standings snapshots, finalization. |

Every callable takes its options from [`SECURE_CALLABLE_OPTIONS`](functions/src/lib/secureCallable.ts) and resolves its caller through [`requireCaller`](functions/src/lib/auth.ts), which is claim-only by design — it must not diverge from what the rules enforce.

## Security Posture

Authority is the `role` custom claim. Provision it with [scripts/grant-site-admin.ts](scripts/grant-site-admin.ts) for the first site admin, then via `assignRole` / `syncMyClaims`. A claim change requires an ID-token refresh (`getIdToken(true)`) before it takes effect in a live session.

**Important:** deploying `firestore.rules` requires at least one user to already hold the `SITE_ADMIN` claim, or admin write paths become unreachable.

Current rules posture:

- Staff checks read `request.auth.token.role` exclusively. Users cannot self-promote — `users/{uid}.role` is not consulted for authorization anywhere.
- `ladderSessions`, `ladderCourts`, `ladderMatches`, `standingsSnapshots` are `write: if false`. Functions-only.
- `eloEvents` is admin-create, never update/delete. ELO mutation happens only inside `submitMatchScore` / `adminAssignMatchResult`.
- `userRoles` is admin-write; scoped assignment authority is enforced in `assignRole`, not in rules.
- Check-ins are self-service create with staff-only update/delete. Participants may submit, verify, or dispute limited ladder match fields via callables.
- `auditLog` and `roleEvents` are append-only and admin-readable.
- A terminal `match /{document=**} { allow read, write: if false; }` denies anything not explicitly matched.
- Storage: player photos are owner-scoped; `/clubs/pending/{uid}/` is uploader-scoped; `/clubs/{clubId}/` requires a `SITE_ADMIN` or `CLUB_ADMIN` claim. Per-club scoping within `CLUB_ADMIN` is still application-level only.

Known open items:

- **Public reads remain** on catalog and operational surfaces, including `users/{uid}`. Splitting public profile from private account data is still pending.
- **App Check is not enforced.** The client mints tokens ([src/lib/appcheck.ts](src/lib/appcheck.ts)) but `enforceAppCheck` defaults to `false`. See below.
- **`fcmTokens` has no rule**, so it falls through to the terminal deny and client token registration cannot write. Push delivery is implemented server-side but has nothing to deliver to until this is resolved.

### Enabling App Check

`enforceAppCheck` is env-gated in [functions/src/lib/secureCallable.ts](functions/src/lib/secureCallable.ts) because enforcing it before the app is registered rejects every callable request. It is a **deploy-time** option, so the variable must be set in whatever environment runs `firebase deploy`.

1. Firebase Console → App Check → Apps → register the web app with reCAPTCHA Enterprise; copy the site key.
2. Set `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` for the web build (see `.env.example` and the deploy workflow).
3. Watch Console → App Check → Metrics until verified requests appear and unverified is ~0.
4. Set `ENFORCE_APP_CHECK=true` and redeploy functions.

## Domain Engines

The pure domain layer is the strongest part of the codebase and is the only code with meaningful unit-test coverage.

### Brackets

`src/domain/bracket/` — single elimination, double elimination, round robin / pool play, seeding and seeded shuffle, match progression and undo, pickleball score validation, standings computation.

### Ladder

`src/domain/ladder/` — 4- and 5-player court rotations, court distribution, session generation, session finalization and movement calculation.

These modules must remain framework-agnostic. Do not import React, Firebase, or UI code into `src/domain`.

## Duplicated Files

The web app and `functions/` are separate TypeScript projects and cannot import from each other, so six files are duplicated by hand:

| Canonical | Mirror |
|---|---|
| `src/lib/firestore/collections.ts` | `functions/src/lib/collections.ts` |
| `src/lib/players/elo.ts` | `functions/src/lib/elo.ts` |
| `src/lib/schemas/{club,match,role,session}.ts` | `functions/src/schemas/{...}.ts` |

Edit the canonical copy, then copy its body over the mirror keeping the mirror's header comment. [src/lib/mirrors.test.ts](src/lib/mirrors.test.ts) fails `npm test` if the two ever diverge.

## Running Locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Required Firebase public web config lives in `.env.local`:

```text
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

Set `NEXT_PUBLIC_FUNCTIONS_EMULATOR=true` to route callables at the local Functions emulator.

The Admin scripts additionally require `FIREBASE_SERVICE_ACCOUNT_JSON`. Never commit that value.

## Verification

```bash
npm test          # domain engines + mirror drift guard
npm run build
npm run typecheck
```

Firestore rules tests:

```bash
npm run test:rules
```

`test:rules` uses the Firebase Emulator Suite and requires Java on PATH. If Java is missing, the emulator exits with `spawn java ENOENT`.

Known detail: `npm run typecheck` may fail on a fresh checkout if `.next/types` has not been generated. Run `npm run build` first, then rerun.

## End-to-End Tests

A pytest + Playwright suite lives in [tests/e2e/](tests/e2e/), organised by persona (player, coordinator, director, admin) plus auth and RBAC suites, with page objects and an HTML report.

```bash
pip install -r tests/e2e/requirements.txt
playwright install chromium
cp tests/e2e/.env.test.example tests/e2e/.env.test   # then fill in real credentials
python tests/e2e/run_e2e.py
```

`tests/e2e/.env.test` holds live account credentials and is gitignored — keep it that way. Run artifacts under `tests/e2e/reports/` (videos, `run_*.json`, screenshots) are generated output and are gitignored too; only `custom_tests.json` is tracked.

See [tests/e2e/README.md](tests/e2e/README.md) for the full runner reference and [tests/e2e/PORTAL_SETUP.md](tests/e2e/PORTAL_SETUP.md) for the local test portal.

## Deployment

```bash
npm run deploy          # hosting only
npm run deploy:all      # everything
npm run rules:deploy    # firestore rules
npm run indexes:deploy  # firestore indexes
npm run functions:deploy
```

CI ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) runs typecheck + tests, builds the static export, then deploys functions, rules, indexes, storage rules, and hosting in that order on every push to `main`.

The Firebase project id is `pickleleauge`. Keep `.firebaserc`, package scripts, and GitHub Actions in sync before deploying.

## Documentation Index

- [REPO_ARCHITECTURE_DATA_INTEGRITY_AUDIT.md](REPO_ARCHITECTURE_DATA_INTEGRITY_AUDIT.md) — architecture and integrity audit. Partly historical; predates the Cloud Functions migration.
- [UX_UI_DESKTOP_MOBILE_PERSONA_AUDIT.md](UX_UI_DESKTOP_MOBILE_PERSONA_AUDIT.md) — UX/UI audit and design fix plan.
- [USE_CASE_TESTING.md](USE_CASE_TESTING.md) — role-based manual QA script and security regression checklist.
- [NEXT_AGENT_TODO.md](NEXT_AGENT_TODO.md) — current open enhancement queue.
- [tests/e2e/README.md](tests/e2e/README.md) — E2E suite reference.
- `automation/*.toon` — phased implementation handoff specs (present locally, gitignored).

## Production Gate

Do not treat this app as production-ready until:

- App Check is enforced (`ENFORCE_APP_CHECK=true`) with reCAPTCHA Enterprise registered
- `fcmTokens` has a Firestore rule so push registration can write
- Storage rules enforce per-club scope for `CLUB_ADMIN`, not just the role
- public/private profile data is split and public reads are narrowed
- Firestore rules tests pass in CI (they are not currently part of the deploy workflow)
- CI has protected production deploy environments

## License

Proprietary.
