# Pickleball League

A competitive **Pickleball League, Tournament Bracket Tracking, Competition Management, and Community Platform** — styled as an 8-bit RPG fused with a premium obsidian-stone design language. Built to feel like an elite sports operations platform skinned through a retro fantasy lens.

> This repository contains the **Phase 1 foundation**: architecture, design system, domain model, bracket engine, and core UI shell. Subsequent phases fill in registration flows, live scoring, analytics, and deployment polish.

---

## Stack

| Layer          | Choice                              | Why                                                           |
|----------------|-------------------------------------|---------------------------------------------------------------|
| Framework      | **Next.js 15 (App Router)**         | Full-stack RSC, typed routes, scale for admin + public.       |
| Language       | **TypeScript** (strict)             | Durability, editor DX, contract enforcement.                  |
| Styling        | **Tailwind CSS** + CSS vars         | Design tokens + utility-first; zero runtime.                  |
| Components     | **CVA primitives**                  | Composable, shadcn-style philosophy, zero lock-in.            |
| Server state   | **TanStack Query**                  | Caching, retries, suspense-compatible.                        |
| UI state       | **Zustand**                         | Minimal, no boilerplate.                                      |
| Forms          | **React Hook Form + Zod**           | Schema-driven validation, shared with server actions.         |
| Animation      | **Framer Motion**                   | Restrained, accessible micro-interactions.                    |
| Database       | **PostgreSQL + Prisma**             | Relational fidelity, migrations, typed client.                |
| Tests          | **Vitest** + Playwright (Phase 5)   | Pure-logic verification for the bracket engine.               |

---

## Folder Structure

```
src/
├─ app/                      # Next.js App Router
│  ├─ (authenticated)/       # Authenticated route group w/ sidebar shell
│  │  ├─ layout.tsx
│  │  └─ dashboard/page.tsx
│  ├─ tournaments/
│  │  ├─ page.tsx
│  │  └─ [slug]/page.tsx     # Uses engine to render bracket
│  ├─ layout.tsx             # Root HTML + fonts + theme
│  └─ page.tsx               # Homepage
├─ components/
│  ├─ brand/                 # CrestLogo (pixel SVG)
│  ├─ bracket/               # BracketView (battle-tree)
│  ├─ layout/                # TopNav, AppSidebar, SiteFooter
│  └─ ui/                    # Primitives: Panel, Button, RuneChip
├─ domain/
│  └─ bracket/               # Pure domain logic (no React, no Prisma)
│     ├─ types.ts
│     ├─ seeding.ts          # PRNG, standard seed order, snake
│     ├─ singleElim.ts
│     ├─ doubleElim.ts
│     ├─ roundRobin.ts
│     ├─ progression.ts      # advanceMatch / undoAdvancement
│     ├─ scoring.ts          # Pickleball score validation
│     ├─ standings.ts        # Wins / point diff / tiebreaks
│     └─ *.test.ts           # 20 unit tests, all passing
├─ lib/
│  ├─ cn.ts                  # className merger
│  ├─ labels.ts              # Operational + themed labels
│  └─ prisma.ts              # PrismaClient singleton
└─ styles/
   └─ globals.css            # Design tokens + component layers
prisma/
├─ schema.prisma             # Full domain (see below)
└─ seed.ts                   # Realistic mock data
```

### Layering rule

```
app/  →  components/  →  domain/  ←  lib/ (utilities only)
                          ↑
                    Pure, framework-agnostic, deterministic.
```

The `domain/bracket/` module has **zero** React or Prisma imports. Callers project engine output onto Prisma models. This keeps the engine easy to test, portable to a future Go/Rust backend, and immune to framework churn.

---

## Design System

### Color tokens

Obsidian surfaces (900 → 300), ash text (500 → 100), and five accent families:

| Accent     | Hex       | Use                                    |
|------------|-----------|----------------------------------------|
| Ember      | `#ff6a1f` | Primary action, warmth, urgency        |
| Rune       | `#7b4dff` | Secondary energy, selection, live feed |
| Spectral   | `#3ee0ff` | Focus, info, links, navigation         |
| Crimson    | `#e03a4d` | Championship emphasis, destructive     |
| Gold       | `#e8b84a` | Trophies, mythic tier                  |

### Surface primitives

- **`.slab`** — foundational obsidian stone panel
- **`.slab-raised`** — raised variant for cards
- **`.quest-board`** — parchment-warm variant for announcements
- **`.inventory-slot`** — interactive RPG slot (achievements, trophies, features)
- **`.battle-hud`** — scoreboard / live-match HUD
- **`.rune-chip`** — status badge with semantic tones

### Typography

- **Display (Press Start 2P)** — reserved for logo / small emphases. Never body text.
- **Heading (Cinzel)** — fantasy-tech section headers.
- **Body (Inter)** — everything readable.
- **Mono (JetBrains Mono)** — scores, ratings, data.

### Accessibility

- Focus ring: spectral cyan, 2px + 4px halo.
- `prefers-reduced-motion` honored globally.
- Color is never the sole status signal — always paired with label text.
- Contrast: all body text ≥ 4.5:1 on its surface.

---

## Domain Model (Prisma)

Top-level entities grouped by concern:

| Concern            | Models                                                                     |
|--------------------|----------------------------------------------------------------------------|
| Identity & Access  | `User`, `Session`, `OrganizationMembership`, `Invitation`                  |
| Organizations      | `Organization`, `Venue`, `Court`                                           |
| Competitions       | `League`, `Season`, `Division`                                             |
| Tournaments        | `Tournament`, `Bracket`, `BracketRound`, `BracketNode`, `Pool`, `PoolEntry`|
| Registration       | `Registration`, `Team`, `TeamMember`                                       |
| Match & Scoring    | `Match`, `MatchParticipant`, `MatchGame`, `CheckIn`, `Dispute`             |
| Progression        | `PlayerProfile`, `Achievement`, `PlayerAchievement`, `Trophy`              |
| Standings          | `Standing`, `RankingSnapshot`                                              |
| Comms              | `Announcement`, `Notification`                                             |
| Governance         | `AuditLog`                                                                 |

Key design decisions:

- `BracketNode` holds `winnerNextNodeId` / `loserNextNodeId` pointers — a normalized, self-referential bracket graph that supports single elim, double elim, and consolation.
- `Registration` is the single source of truth for "who is entered" — whether a solo user or a team. This is what `BracketNode.participantAId` references.
- `AuditLog` captures `before`/`after` JSON snapshots. Every admin override writes one entry.
- `RankingSnapshot.payload` is JSON by design — rankings are an analytical artifact, not hot-path data.

---

## Bracket Engine

The engine lives in `src/domain/bracket/` and is fully unit-tested (**20 tests passing**).

### Public API

```ts
import {
  generateSingleElim, generateDoubleElim, generatePoolPlay,
  advanceMatch, undoAdvancement,
  computeStandings, validateMatchScore, resolveRules,
} from "@/domain/bracket";
```

### Key guarantees

- **Deterministic**: RANDOM seeding uses Mulberry32 with a caller-provided `rngSeed`. Same input → identical bracket.
- **BYE handling**: non-power-of-two fields auto-advance top seeds.
- **Audit-safe undo**: `undoAdvancement` throws if downstream has already advanced — forces admins to undo tip-first.
- **Pickleball-native scoring**: target / win-by / best-of configurable. Rejects invalid progressions (win-by-1, extra games, under-target).
- **Round-robin**: circle method with proper BYE insertion for odd fields.
- **Double-elimination**: WB + LB + Grand Final with correct LB node counts (`2·log₂N − 1` rounds) and alternating survival / drop-in wiring.

### Testing

```bash
npm test                   # run all bracket tests
npm run test:watch         # watch mode during engine work
```

---

## Route Map

**Public:** `/`, `/tournaments`, `/tournaments/[slug]`, `/leagues`, `/standings`, `/rankings`, `/players`, `/teams`, `/schedule`, `/hall-of-fame`, `/news`, `/clubs`, `/clubs/[slug]`

**Authenticated** (under `(authenticated)/` group): `/dashboard`, `/dashboard/player|team|admin|director|referee`, `/my-matches`, `/my-stats`, `/my-achievements`, `/notifications`, `/settings`, `/registrations`

**Admin:** `/admin/organizations`, `/admin/leagues`, `/admin/seasons`, `/admin/divisions`, `/admin/tournaments`, `/admin/tournaments/[id]/seeding|bracket|schedule`, `/admin/matches`, `/admin/courts`, `/admin/players`, `/admin/teams`, `/admin/announcements`, `/admin/analytics`, `/admin/settings`, `/admin/audit-log`

---

## Running Locally

```bash
# 1. Install
npm install

# 2. Environment
cp .env.example .env
#   edit DATABASE_URL to point at your Postgres

# 3. Database
npm run db:push        # sync schema (no migrations yet)
npm run db:seed        # load mock tournament, players, bracket

# 4. Dev
npm run dev            # http://localhost:3000

# 5. Verification
npm test               # bracket engine unit tests (20)
npm run typecheck      # strict TS across the codebase
```

---

## MVP Implementation Order

| Phase | Scope |
|-------|-------|
| **1 ✓** | Architecture, design system, schema, bracket engine, core layouts, homepage, dashboard skeleton, seed data |
| **2**   | Auth, org/league/season/division CRUD, tournament wizard, registration flow, profiles, schedule views |
| **3**   | Bracket generation from DB, live match flow, score reporting, standings projection, ranking system |
| **4**   | Notifications, announcements feed, analytics dashboard, achievements/trophies, archive & hall of fame |
| **5**   | Accessibility audit, performance tuning, e2e tests, deployment, observability |

---

## Non-Negotiables

1. Domain logic stays pure — no React, no Prisma.
2. Every admin mutation writes an `AuditLog` entry.
3. Responsive from day one. Mobile-first data tables.
4. Theme labels never replace operational labels — they augment.
5. Every status color is paired with text. Color is never sole signal.
6. Score submissions pass `validateMatchScore` before persisting.
7. Bracket state is projectable back to the engine — no drift.

---

## License

Proprietary — © Pickleball League.
# PBL
Pickle ball league
