# Ladder League MVP Implementation Guide

## Overview

This document provides integration instructions for the newly implemented Ladder League features based on the League_Builders_Spec_V4 requirements.

## What's Been Implemented

### Core Business Logic ✅
- [x] Session generation engine (court distribution, rotations)
- [x] Session finalization with movement calculation
- [x] Rotation algorithms for 4-player and 5-player courts
- [x] ELO rating system (doubles-adapted)
- [x] Geofence check-in validation

### Admin Features ✅
- [x] Admin mode toggle (Player/Admin switching)
- [x] Admin dashboard with workflow steps
- [x] Attendance review UI
- [x] Session generation dialog with placement strategies
- [x] Session generation persistence

### Player Features ✅
- [x] Court-centric home screen
- [x] Score submission interface
- [x] Score verification interface
- [x] Live standings display
- [x] Next match preview

### Data Persistence ✅
- [x] Firestore write functions for session generation
- [x] Firestore write functions for finalization
- [x] Audit trail support
- [x] Match score submission and ELO application

## File Structure Reference

```
src/
├── domain/ladder/
│   ├── rotations.ts              # Rotation generation algorithms
│   ├── rotations.test.ts         # Unit tests for rotations
│   ├── distribution.ts           # Court distribution logic
│   ├── generation.ts             # Session generation orchestrator
│   └── finalization.ts           # Session finalization and movement
├── lib/
│   ├── admin-context.tsx         # Admin mode state management
│   └── ladder/
│       └── write.ts              # (UPDATED) Session persistence functions
└── components/
    ├── ui/
    │   └── ModeToggle.tsx         # Admin/Player mode switch
    ├── admin/
    │   ├── AdminDashboard.tsx     # Main admin dashboard
    │   ├── AttendanceReview.tsx   # Check-in review UI
    │   └── SessionGenerationDialog.tsx # Generation configuration UI
    └── player/
        ├── PlayerHome.tsx         # Court-centric player screen
        ├── ScoreSubmission.tsx    # Score entry UI
        ├── ScoreVerification.tsx  # Score verification UI
        └── LiveStandings.tsx      # Standings display
```

## Integration Steps

### Step 1: Update Layout with Admin Mode Provider

**File:** `src/app/layout.tsx`

```typescript
import { AdminModeProvider } from "@/lib/admin-context";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <AdminModeProvider>
          {/* Existing providers */}
          {children}
        </AdminModeProvider>
      </body>
    </html>
  );
}
```

### Step 2: Add Mode Toggle to Top Navigation

**File:** `src/components/layout/TopNav.tsx`

```typescript
import { ModeToggle } from "@/components/ui/ModeToggle";
import { useAdminMode } from "@/lib/admin-context";

export function TopNav() {
  const { isAdminMode } = useAdminMode();

  return (
    <nav className="flex items-center justify-between p-4">
      {/* Existing nav content */}
      {isAdminMode && <ModeToggle />}
    </nav>
  );
}
```

### Step 3: Conditionally Show Admin Dashboard or Player Views

**File:** `src/app/(authenticated)/dashboard/page.tsx` or equivalent

```typescript
"use client";

import { useAdminMode } from "@/lib/admin-context";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { PlayerHome } from "@/components/player/PlayerHome";

export default function DashboardPage() {
  const { isAdminMode } = useAdminMode();

  if (isAdminMode) {
    return <AdminDashboard {...props} />;
  }

  return <PlayerHome {...props} />;
}
```

### Step 4: Create Session Generation Endpoint (Optional - Client Can Do Direct Writes)

**File:** `src/app/api/ladder/generate-session/route.ts` (optional)

```typescript
import { generateLadderSession, validateGeneratedSession } from "@/domain/ladder/generation";
import { persistGeneratedSession } from "@/lib/ladder/write";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { playDateId, seasonId, checkInIds } = await req.json();

  // Fetch data from Firestore
  // Generate session
  // Validate
  // Persist

  return NextResponse.json({ success: true, sessionId });
}
```

## API Reference

### Session Generation

```typescript
import { generateLadderSession } from "@/domain/ladder/generation";
import { persistGeneratedSession } from "@/lib/ladder/write";

// Generate session (returns object, doesn't persist yet)
const generated = generateLadderSession({
  playDate,
  season,
  checkIns,
  sessionKind: "A",
  distribution: "TOP_HEAVY",
});

// Validate before persisting
const errors = validateGeneratedSession(generated);
if (errors.length > 0) {
  console.error("Validation errors:", errors);
  return;
}

// Persist to Firestore
await persistGeneratedSession({
  sessionDoc: generated.session,
  courts: generated.courts,
  matches: generated.matches,
  generatedBy: userId,
});
```

### Score Submission

```typescript
import { submitLadderMatchScore } from "@/lib/ladder/write";

await submitLadderMatchScore({
  matchId: "match_id",
  scoreA: 11,
  scoreB: 8,
  submittedBy: userId,
});
```

### Score Verification

```typescript
import { verifyLadderMatchScore } from "@/lib/ladder/write";

await verifyLadderMatchScore(matchId, verifiedBy);
```

### Session Finalization

```typescript
import {
  calculateSessionResults,
  createStandingsSnapshot,
  updateCumulativeStats,
} from "@/domain/ladder/finalization";
import { finalizeSession } from "@/lib/ladder/write";

// Calculate results
const results = calculateSessionResults(courts, matches);

// Create standings snapshot
const standings = createStandingsSnapshot(sessionId, results);

// Update player stats
const cumulativeStats = updateCumulativeStats(previousStats, results);

// Finalize in Firestore
await finalizeSession(sessionId, standings, cumulativeStats, adminId);
```

### Session B Generation from Session A

```typescript
import { generateSessionBFromSessionA } from "@/domain/ladder/generation";

const sessionB = generateSessionBFromSessionA(
  sessionA,
  courtsA,
  matchesA,
  playDate,
  season
);

await persistGeneratedSession({...});
```

## Component Props Reference

### AdminDashboard

```typescript
interface AdminDashboardProps {
  currentSeason?: LadderSeasonDoc;
  upcomingPlayDates: PlayDateDoc[];
  selectedPlayDate?: PlayDateDoc;
  onSelectPlayDate: (pd: PlayDateDoc) => void;
  onCreateSeason: () => void;
  onCreatePlayDate: () => void;
  onReviewAttendance: (pd: PlayDateDoc) => void;
  onGenerateSession: (pd: PlayDateDoc) => void;
  onMonitorSession: (session: LadderSessionDoc) => void;
  onFinalizeSession: (session: LadderSessionDoc) => void;
}
```

### PlayerHome

```typescript
interface PlayerHomeProps {
  currentSession?: LadderSessionDoc;
  assignedCourt?: LadderCourtDoc;
  currentMatch?: LadderMatchDoc & { courtNumber: number };
  nextMatch?: LadderMatchDoc & { courtNumber: number };
  sitOutMatch?: LadderMatchDoc;
  playerId: string;
  onEnterScore: () => void;
  onVerifyScore: () => void;
  onViewStandings: () => void;
  onViewCourts: () => void;
}
```

### LiveStandings

```typescript
interface LiveStandingsProps {
  sessionKind: "A" | "B";
  courtStandings: CourtStandings[];
  currentPlayerId?: string;
}
```

## Real-Time Features

### Subscribe to Session Changes

```typescript
import { subscribeToSession } from "@/lib/ladder/repo";

const unsubscribe = subscribeToSession(sessionId, (session) => {
  setCurrentSession(session);
});

// Cleanup
return () => unsubscribe();
```

### Subscribe to Match Updates

```typescript
import { subscribeToMatches } from "@/lib/ladder/repo";

const unsubscribe = subscribeToMatches(sessionId, (matches) => {
  setMatches(matches);
});
```

### Subscribe to Court Assignments

```typescript
import { subscribeToCourtsBySession } from "@/lib/ladder/repo";

const unsubscribe = subscribeToCourtsBySession(sessionId, (courts) => {
  setCourts(courts);
});
```

## Testing

### Unit Tests (Pre-Implemented)

Run rotation algorithm tests:
```bash
npm test src/domain/ladder/rotations.test.ts
```

### Manual Testing Checklist

- [ ] Session generation with 12, 13, 14, 15, 16 players (spec examples)
- [ ] Court distribution placement strategies (TOP_HEAVY, MIDDLE, BOTTOM_HEAVY)
- [ ] Rotation partnerships balanced across court
- [ ] Score submission and ELO application
- [ ] Score verification UI updates
- [ ] Session finalization calculates correct movement
- [ ] Session B generated only from Session A participants
- [ ] Admin mode toggle switches interface
- [ ] Geofence check-in validation
- [ ] Audit trail entries created

## Deployment Checklist

- [ ] Run `npm run typecheck` to verify TypeScript
- [ ] Run `npm test` to verify all tests pass
- [ ] Run `npm run build` to build for production
- [ ] Test on Firebase emulator (`firebase emulators:start`)
- [ ] Deploy to Firebase Hosting: `firebase deploy`
- [ ] Verify Firestore rules allow admin writes
- [ ] Test check-in from venue location
- [ ] Test session generation with real play date
- [ ] Test score submission flow end-to-end
- [ ] Monitor Firestore logs for errors

## Configuration

### Season Defaults (Set When Creating Season)

```typescript
{
  targetPointsPerGame: 11,           // Points to win
  movementPattern: "ONE_UP_ONE_DOWN", // or "TWO_UP_TWO_DOWN"
  courtDistributionPlacement: "TOP_HEAVY" // or "MIDDLE", "BOTTOM_HEAVY"
}
```

### Venue Configuration

```typescript
{
  name: "Riverside Courts",
  lat: 40.7128,
  lng: -74.0060,
  radiusMeters: 75 // Allow this distance from venue
}
```

## Performance Optimizations

1. **Pagination** - Needed for large player counts (1000+)
2. **Caching** - Cache standings snapshots
3. **Batch Operations** - Use batch writes for session generation
4. **Indexed Queries** - Firestore indexes pre-configured in indexes.json

## Known Limitations

1. **Multiplayer Concurrent Generation** - Add write lock if admins generate simultaneously
2. **Large Court Counts** - >20 courts may need pagination
3. **Mobile Bandwidth** - Large standings may need pagination or compression
4. **Real-time Sync Limits** - Firestore has document write limits (~1 write/sec per document)

## Support Resources

- **Spec Document:** League_Builders_Spec_V4.pdf
- **Firestore Rules:** firestore.rules
- **Database Schema:** firestore.indexes.json
- **Type Definitions:** src/lib/firestore/types.ts

## Next Steps After Deployment

1. **Analytics Dashboard** - Add performance tracking
2. **Historical Trends** - ELO history graphs
3. **API Endpoints** - Public API for external integrations (DUPR sync)
4. **Mobile App** - React Native companion app
5. **Notifications** - Push notifications for check-in and verification
6. **Leaderboard** - Season-long leaderboard
