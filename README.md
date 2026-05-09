# Pickleball League / LeagueForge

Mobile-first pickleball league software for clubs, ladder play, player profiles, tournaments, and admin operations.

This repository is currently a **Next.js static export backed by Firebase Auth, Cloud Firestore, Firebase Storage, and Firebase Cloud Messaging client SDKs**. It is not a Prisma/Postgres application and it does not currently run a production server API. The app is deployed as static HTML/JS to Firebase Hosting, and client code talks directly to Firebase services.

## Current Status

The application has working UI, pure domain engines, Firebase-backed reads/writes, Storage uploads, PWA scaffolding, and FCM token registration. It is still in a security transition because the production architecture remains a static client talking directly to Firebase.

Several privileged workflows are still browser-driven and protected only by Firestore/Storage rules. Some helper paths are documented as backend-required, and the shared guard throws:

```ts
trustedBackendRequired("action name")
```

That guard is intentional where it is used, but it is not yet wired into every high-risk write helper. Treat role changes, club approval, league administration, ladder generation/finalization, score/ELO mutation, audit logging, notifications, and tournament operations as workflows that need Cloud Functions or another trusted Admin SDK backend before production.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 App Router | Built with `output: "export"` for static hosting. |
| Language | TypeScript strict mode | `noUncheckedIndexedAccess` enabled. |
| Styling | Tailwind CSS + CSS variables | Obsidian/ember/rune visual system. |
| Auth | Firebase Auth | Email/password and Google OAuth. |
| Database | Cloud Firestore | Client SDK reads/writes; rules enforce the current boundary; privileged writes need backend. |
| Storage | Firebase Storage | Player photos and club logos; rules restrict file type/size but club-logo authorization still needs backend/scope hardening. |
| Push/PWA | Web service workers + FCM | Static app SW and Firebase Messaging SW exist; token registration is client-side; server send trigger is not implemented. |
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
    fcm.ts                     FCM token registration and foreground listener
    storage.ts                 Firebase Storage image upload helpers
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
- Firebase Storage
- Firebase Analytics
- Firebase Cloud Messaging client SDK
- Firebase Admin SDK in `scripts/seed-firestore.ts` only

Partially scaffolded:

- PWA service worker in `public/sw.js`.
- Firebase Messaging service worker in `public/firebase-messaging-sw.js`.
- FCM token writes to `fcmTokens`; no Cloud Function or Admin SDK sender exists yet.

Not present:

- Cloud Functions
- Realtime Database
- App Check initialization

## Security Posture

Read these before implementing privileged features:

- [Development Summaries/FIREBASE_DATABASE_SECURITY_AUDIT.md](Development%20Summaries/FIREBASE_DATABASE_SECURITY_AUDIT.md)
- [automation/firebase_database_security_remediation_handoff.toon](automation/firebase_database_security_remediation_handoff.toon)
- [automation/facility_venue_geocheckin_consolidation_handoff.toon](automation/facility_venue_geocheckin_consolidation_handoff.toon)

Current rules posture:

- Staff checks prefer Firebase Auth custom claims, but still fall back to `users/{uid}.role`.
- Users cannot self-promote by editing `users/{uid}.role`.
- `userRoles` are client-writable by site admins and club directors; scope validation still needs backend/rules hardening.
- Ladder sessions/courts are staff-only from rules; participants can submit, verify, or dispute limited ladder match fields.
- ELO/stat mutations and `eloEvents` are not client-writable.
- Audit collections are append-only or admin-readable depending on collection, but audit creation is not yet centralized around trusted commands.
- Public reads still exist for several catalog and operational surfaces; privacy hardening remains a future phase.
- Player profile reads require authentication, but `users/{uid}` remains publicly readable and should be split from private account data.
- Storage club-logo writes are allowed for any authenticated user under `/clubs/**`; director/tenant scope is currently enforced only by application UI and needs rules/backend enforcement.
- FCM token registration can store device tokens, but actual push delivery requires a trusted server trigger.

Important: custom claims are not set by this repository yet. Firestore rules still fall back to `users/{uid}.role` for staff checks, so role authority must be moved to custom claims or backend-owned role state before production.

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
- push notification fanout
- Storage authorization for club-owned assets

The client helper [src/lib/security/backendRequired.ts](src/lib/security/backendRequired.ts) marks backend-required paths, but current write helpers also contain TODO comments where migration is still pending.

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
- `automation/facility_venue_geocheckin_consolidation_handoff.toon` - Facility/Venue merge, geocoding, open-play, and GPS-assisted check-in handoff.
- `USE_CASE_TESTING.md` - role-based manual QA script and security regression checklist.
- `ENHANCEMENTS.md` - reviewed feature backlog and recommended improvements.

## Production Gate

Do not treat this app as production-ready until:

- trusted backend functions replace blocked privileged client writes
- custom claims or backend-only role docs are implemented
- Firestore rules tests pass in CI
- App Check is configured and enforced
- Storage rules enforce owner/director scope, not just authentication and image constraints
- FCM has a backend sender, token cleanup, and notification preferences
- public/private profile data is split
- CI has protected production deploy environments

## License

Proprietary.
