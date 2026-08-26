# Next Agent TODO

## Context

Next.js 15 + React 19 static export on Firebase, with a Cloud Functions command layer for every privileged write. See [README.md](README.md) for the architecture, the claim-based authorization model, and the mirrored-file rule.

The previous contents of this file — gating check-in behind league match-day selection, plus a five-item "next enhancement bundle" — are **all shipped**. Verified present:

- `listPlayDatesByLeague` in [src/lib/ladder/repo.ts](src/lib/ladder/repo.ts), consumed by the league detail page and club management.
- Match-day selector with a `CHECK_IN_OPEN`-gated CTA in [LeagueDetailsClient.tsx](src/app/leagues/[leagueId]/LeagueDetailsClient.tsx) (`PlayDateCheckInCta`), deep-linking to `/ladder/check-in?playDate=`.
- Composite index `playDates(leagueId, date)` in [firestore.indexes.json](firestore.indexes.json).
- Coordinator live dashboard with check-ins, no-shows, late arrivals, court assignment, and score status in [CoordinatorDashboardClient.tsx](src/app/ladder/coordinator/[playDateId]/CoordinatorDashboardClient.tsx).
- Check-in fallback via play-date code (`setPlayDateCheckInCode` / `createCheckInByCode`) and `adminOverrideCheckIn`.
- Club-scoped league list and coordinator assignment in [ClubManageClient.tsx](src/app/clubs/manage/[clubId]/ClubManageClient.tsx).
- Regeneration confirmation dialog plus schedule snapshots in [ScheduleClient.tsx](src/app/leagues/[leagueId]/schedule/ScheduleClient.tsx).

What follows is the current open queue, highest-risk first.

## 1. `fcmTokens` has no Firestore rule — push is dead

`firestore.rules` has no `match /fcmTokens/{...}` block, so it falls through to the terminal `allow read, write: if false`. [src/lib/fcm.ts](src/lib/fcm.ts) writes token documents with `setDoc`, and that write can only fail with permission-denied.

The server half is already built: `sendPushToUser` / `sendPushToMany` in [functions/src/lib/push.ts](functions/src/lib/push.ts) read `fcmTokens` and prune rejected tokens. It has nothing to read.

Two viable designs — pick one deliberately:

- **Client-write rule.** Add a rule scoping each document to its owner (`request.resource.data.userId == request.auth.uid` on create, `resource.data.userId == request.auth.uid` on read/update/delete). Simplest, keeps `fcm.ts` unchanged. Note the document id is not the uid, so both the request and resource forms are needed.
- **Callable.** Route registration through a `registerFcmToken` function and leave the collection Functions-only. Consistent with how every other sensitive write behaves, at the cost of another callable.

Add rules-test coverage either way — a test asserting one user cannot write another user's token document.

## 2. Enforce App Check

`enforceAppCheck` in [functions/src/lib/secureCallable.ts](functions/src/lib/secureCallable.ts) is env-gated and defaults to `false`. The client already mints tokens. Follow the rollout in the README's "Enabling App Check" section — in particular, confirm verified requests in Console → App Check → Metrics *before* setting `ENFORCE_APP_CHECK=true`, because it is a deploy-time option and flipping it blind rejects every callable.

## 3. Per-club scope on Storage club logos

[storage.rules](storage.rules) lets any `CLUB_ADMIN` write `/clubs/{clubId}/**`, so a director of club A can overwrite club B's logo. Scope is currently enforced only by UI. Storage rules cannot query Firestore, so this needs either a claim carrying the director's club ids or an upload callable that issues scoped write access.

## 4. Split public and private profile data

`users/{uid}` is `allow read: if true` and holds email, phone number, and account status alongside display fields. Split into a public profile document and a private account document, then narrow the public read. This is the largest remaining item and touches most read paths.

## 5. Run rules tests in CI

[.github/workflows/deploy.yml](.github/workflows/deploy.yml) runs `npm test` but not `npm run test:rules`, so `firestore.rules` deploys to production with no automated verification. Needs a Java-provisioned job step running the emulator. Given the rules are now the entire client-side authorization boundary, this is worth more than it looks.

## 6. Rotate the leaked test-admin credential

`tests/e2e/.env.test` was committed with a live password for the `SITE_ADMIN` account. It is now untracked and gitignored, and history has been rewritten locally, but **the password itself must still be rotated in Firebase Console** — the rewrite does not invalidate a credential that was already published. Rotate, then update the local `.env.test`.

## Verification

```bash
npm test          # domain engines + mirror drift guard
npm run typecheck
npm run test:rules   # requires Java on PATH
```
