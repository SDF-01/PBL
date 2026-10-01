# Privileged Command Service

Every privileged write in this app — role grants, club approval, score submission and verification, ELO mutation, session generation and finalization — runs in a trusted command layer, never in the browser. This document covers where that layer runs and how to move it.

## Why it isn't Cloud Functions right now

Cloud Functions require the Firebase **Blaze** plan, in *both* generations. Project `pickleleauge` is on Spark, so `firebase deploy --only functions` fails immediately:

```
[error] Extensions require the Blaze plan, but project pickleleauge is not on the Blaze plan
GET .../projects/pickleleauge/billingInfo -> billingEnabled: false
```

Rather than move privileged logic back into the browser — which would be a real security regression, since custom claims can only be set by the Admin SDK — the command layer was made **transport-agnostic**. The same code runs in two places, and switching is configuration, not a rewrite.

## Shape

```
functions/src/
  commands/*.ts        Pure command logic. No transport imports.
                       Signature: (caller: CallerContext, data: unknown) => Promise<Result>
  registry.ts          COMMANDS map — the single source of truth for what exists.
  lib/auth.ts          callerFromClaim(uid, claimRole) -> CallerContext
  lib/errors.ts        Transport-agnostic HttpsError + HTTP status mapping
  index.ts             ADAPTER: Cloud Functions (onCall). Used when on Blaze.
  server/handler.ts    ADAPTER: vendor-neutral Request -> Response. Used now.
  server/node.ts       Node entry (any container host, and local dev)
netlify/functions/
  api.mts              Netlify entry — a pass-through to handler.ts
```

Command files import nothing from `firebase-functions`. Both adapters build from `registry.ts`, so the two transports can never expose different command sets — and `index.ts` carries a compile-time assertion that every registered command is exported.

## Security model — unchanged

Moving hosts changed the transport only:

- Authority is still the Firebase Auth **custom claim** `role`, the same value `firestore.rules` enforces.
- The HTTP adapter verifies the caller's Firebase ID token with the Admin SDK, then derives authority from `decoded.role` via the same `callerFromClaim` the Cloud Functions adapter uses.
- `users/{uid}.role` is still never consulted for authorization.
- Payloads are still validated server-side with the Zod schemas mirrored from `src/lib/schemas` (client-side validation is for fast feedback, never for trust).

What is *not* carried over: App Check. It attests Firebase SDK calls and does not apply to a non-Firebase host. It was already disabled (`ENFORCE_APP_CHECK` defaults false), so nothing regressed — but note it when planning the return to Blaze.

## Wire protocol

```
POST <base>/<commandName>
Authorization: Bearer <Firebase ID token>
Content-Type: application/json
body: the command's input object, unwrapped

200      -> the command's return value as JSON
4xx/5xx  -> { "error": { "code": <CommandErrorCode>, "message": string } }
```

`GET <base>/health` is an unauthenticated liveness probe.

Requests are authenticated **before** the command name is resolved, so an anonymous caller cannot enumerate which commands exist by comparing 404 against 401.

## Running locally

```bash
npm --prefix functions run serve:http
# -> http://localhost:8787
curl http://localhost:8787/health
```

Set `FIREBASE_SERVICE_ACCOUNT` (the service account JSON, one line) for real calls. Without it the service starts and answers `/health`, but commands return a generic `internal` error — the missing-config detail goes to the host log, never to the caller.

Point the web app at it with `NEXT_PUBLIC_COMMANDS_BASE_URL=http://localhost:8787` in `.env.local`.

## Deploying to Netlify (free tier, no card)

1. Create a Netlify site from this GitHub repo.
2. Build settings come from `netlify.toml`: it installs `functions/` dependencies, deploys `netlify/functions`, and skips the Next.js build (Firebase Hosting serves the site). Leave the build fields in the Netlify UI empty.
3. Environment variables:
   - `FIREBASE_SERVICE_ACCOUNT` — the service account JSON as a single line. Same value as the GitHub secret.
   - `ALLOWED_ORIGINS` — optional, comma-separated. Defaults to the two Firebase Hosting origins plus `http://localhost:3000`. Set this when you add a custom domain.
4. Deploy, then confirm `https://<site>.netlify.app/api/health` returns `{"ok":true,"commands":13}`.
5. Set `NEXT_PUBLIC_COMMANDS_BASE_URL=https://<site>.netlify.app/api` in the web build (`.env.local` locally, and the `Build static export` step in `.github/workflows/deploy.yml` for CI).

The handler is a standard `Request -> Response`, so other free hosts need only a thin entry file:

| Host | Entry |
|---|---|
| Deno Deploy | `Deno.serve(handleCommandRequest)` |
| Cloudflare Workers | `export default { fetch: handleCommandRequest }` |
| Node container / VPS | `functions/src/server/node.ts` (already present) |

## Going back to Cloud Functions

When the project is on Blaze:

1. Set the repository variable `DEPLOY_FUNCTIONS=true` (Settings → Secrets and variables → Actions → Variables). The deploy workflow's functions step is gated on it.
2. Restore `httpsCallable` in `src/lib/functions/client.ts`, or simply keep the HTTP transport — both work.
3. Optionally re-enable App Check (`ENFORCE_APP_CHECK=true`) once it's registered; see the README.

No command file changes either direction. That is the point of the split.

## Still Blaze-gated

**Firebase Storage.** The bucket is `pickleleauge.firebasestorage.app`, the post-October-2024 format, and Firebase requires Blaze for Cloud Storage on projects created after that change. Player photos and club logos flow through it in four components ([storage.ts](src/lib/storage.ts), [ImageUpload.tsx](src/components/ui/ImageUpload.tsx), [ClubCreateForm.tsx](src/components/clubs/ClubCreateForm.tsx), [players/edit](src/app/players/edit/page.tsx)). Verify whether uploads currently work; if they don't, that needs its own decision — the command service does not address it.
