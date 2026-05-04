# Pickleball League / LeagueForge

Mobile-first pickleball league software for clubs, ladder play, player profiles, tournaments, and admin operations.

This repository is currently a **Next.js static export backed by Firebase Auth and Cloud Firestore**. It is not a Prisma/Postgres application and it does not currently run a production server API. The app is deployed as static HTML/JS to Firebase Hosting, and client code talks directly to Firebase services.

## Current Status

The application has working UI and pure domain engines, but privileged operational writes are in a security transition.

The Firestore rules were recently moved to an emergency lockdown posture after a Firebase security audit. Several admin workflows now intentionally require a trusted backend function before they can run safely. Helpers that would previously perform unsafe browser-side privileged writes now throw:

```ts
trustedBackendRequired("action name")
```

That is intentional. It prevents role escalation, ELO tampering, forged audit entries, and broad match/session mutation until Cloud Functions or another trusted Admin SDK backend is implemented.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 App Router | Built with `output: "export"` for static hosting. |
| Language | TypeScript strict mode | `noUncheckedIndexedAccess` enabled. |
| Styling | Tailwind CSS + CSS variables | Obsidian/ember/rune visual system. |
| Auth | Firebase Auth | Email/password and Google OAuth. |
| Database | Cloud Firestore | Client SDK reads; locked-down rules; privileged writes need backend. |
| Hosting | Firebase Hosting | Serves `out/`; rewrites for static dynamic-route fallbacks. |
| Analytics | Firebase Analytics | Lazy client-only initialization. |
| Tests | Vitest | Domain tests plus Firebase rules test harness. |
| Backend | Not yet implemented | Required for secure admin/RBAC/score/ELO workflows. |

## Repository Map

```text
src/
  app/                         Next.js routes and static-export pages
    (authenticated)/dashboard  Authenticated dashboard shell
    admin/                     Admin hub, club approvals, users, audit views
    auth/                      Login and signup
    clubs/                     Club creation, owned clubs, club management
    ladder/                    Seasons, play dates, check-in, session surfaces
    leagues/                   League create/detail views
    players/                   Leaderboard, profile edit/view
    tournaments/               Tournament list/create/detail
  components/                  UI, layout, admin, player, bracket components
  domain/
    bracket/                   Pure bracket generation/progression/scoring
    ladder/                    Pure ladder rotations/generation/finalization
  lib/
    firebase.ts                Lazy Firebase client initialization
    auth-context.tsx           Firebase Auth provider
    firestore/                 Collection names, types, general repo/write helpers
    permissions/               Client-side role display helpers and pending club writes
    ladder/                    Ladder reads plus backend-required write stubs
    players/                   Player profile and ELO domain adapters
    security/                  Backend-required guard
tests/
  firebase/                    Firestore rules tests
automation/                    TOON implementation handoff specs
Development Summaries/         Historical and current project summaries/audits
```

## Firebase Services

Detected and used:

- Firebase Hosting
- Firebase Auth
- Cloud Firestore
- Firebase Analytics
- Firebase Admin SDK in `scripts/seed-firestore.ts` only

Configured but not actively used in app code:

- Firebase Storage bucket appears in env config, but there is no `storage.rules` and no upload/download code.

Not present:

- Cloud Functions
- Realtime Database
- App Check initialization

## Security Posture

Read these before implementing privileged features:

- [Development Summaries/FIREBASE_DATABASE_SECURITY_AUDIT.md](Development%20Summaries/FIREBASE_DATABASE_SECURITY_AUDIT.md)
- [automation/firebase_database_security_remediation_handoff.toon](automation/firebase_database_security_remediation_handoff.toon)

Current rules posture:

- Staff checks use Firebase Auth custom claims, not user-writable Firestore profile fields.
- Users cannot self-promote by editing `users/{uid}.role`.
- `userRoles` are not client-writable.
- Ladder sessions/courts/matches are staff-only from rules.
- ELO/stat mutations and `eloEvents` are not client-writable.
- Audit collections are backend-only from client rules.
- Public reads still exist for several catalog/player surfaces; privacy hardening remains a future phase.

Important: custom claims are not set by this repository yet. Until a trusted backend exists, many staff/admin write paths will be unavailable by design.

## Backend-Required Workflows

The following flows must be moved to Cloud Functions or another trusted Admin SDK backend before production use:

- user role assignment and revocation
- club approval and rejection
- league creation under a club
- ladder season/venue/play-date administrative creation
- ladder session generation and finalization
- ladder score verification and admin result assignment
- tournament bracket publishing
- tournament match score recording
- ELO/stat mutation
- audit and role event creation
- bulk notifications and announcements
- achievement/trophy awards

The client helper [src/lib/security/backendRequired.ts](src/lib/security/backendRequired.ts) marks these blocked paths.

## Domain Engines

The pure domain layer is the strongest part of the codebase.

### Brackets

`src/domain/bracket/` contains deterministic logic for:

- single elimination
- double elimination
- round robin / pool play helpers
- seeding and seeded shuffle
- match progression and undo
- pickleball score validation
- standings computation

### Ladder

`src/domain/ladder/` contains pure logic for:

- 4-player and 5-player court rotations
- court distribution
- session generation
- session finalization and movement calculation

These modules should remain framework-agnostic. Do not import React, Firebase, or UI code into `src/domain`.

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

The Admin seed script additionally requires `FIREBASE_SERVICE_ACCOUNT_JSON`. Never commit that value.

## Verification

```bash
npm test
npm run build
npm run typecheck
```

Firestore rules tests:

```bash
npm run test:rules
```

`test:rules` uses the Firebase Emulator Suite and requires Java on PATH. If Java is missing, the emulator exits with `spawn java ENOENT`.

Known verification detail: `npm run typecheck` may fail on a fresh checkout if `.next/types` has not been generated yet. Run `npm run build` first, then rerun `npm run typecheck`.

## Deployment

Firebase Hosting deploy:

```bash
npm run deploy
```

Rules-only deploy:

```bash
npm run rules:deploy
```

Indexes-only deploy:

```bash
npm run indexes:deploy
```

The current Firebase project id used by scripts is `pickleleauge`. Keep `.firebaserc`, package scripts, and GitHub Actions in sync before deploying.

## Documentation Index

- `Development Summaries/FIREBASE_DATABASE_SECURITY_AUDIT.md` - Firebase/database security audit.
- `Development Summaries/REPO_ARCHITECTURE_DATA_INTEGRITY_AUDIT.md` - architecture and integrity audit, partly historical.
- `Development Summaries/IMPLEMENTATION_GUIDE.md` - current implementation guide and secure-backend TODOs.
- `Development Summaries/DEPLOYMENT_SUMMARY.md` - deployment and verification notes.
- `automation/firebase_database_security_remediation_handoff.toon` - phased security remediation handoff.

## Production Gate

Do not treat this app as production-ready until:

- trusted backend functions replace blocked privileged client writes
- custom claims or backend-only role docs are implemented
- Firestore rules tests pass in CI
- App Check is configured and enforced
- Storage is either disabled or protected by `storage.rules`
- public/private profile data is split
- CI has protected production deploy environments

## License

Proprietary.
