# Next Agent TODO

## Context

This is a Next.js 15 + React 19 + Firebase app for pickleball leagues, clubs, ladder play dates, check-ins, sessions, scoring, standings, and admin workflows.

Key files:

- `src/app/leagues/[leagueId]/LeagueDetailsClient.tsx`: league detail page and member/staff action panels.
- `src/app/ladder/check-in/page.tsx`: current check-in flow; global page with play-date selector and optional `?playDate=`.
- `src/app/ladder/play-dates/page.tsx`: global play-date list and direct check-in links.
- `src/lib/ladder/repo.ts`: ladder read helpers.
- `src/lib/ladder/write.ts`: check-in and ladder write helpers.
- `src/lib/firestore/types.ts`: `LeagueDoc`, `PlayDateDoc`, and `CheckInDoc` shapes.
- `UX_UI_DESKTOP_MOBILE_PERSONA_AUDIT.md`: existing product/UX audit with many enhancement ideas.

## Primary Enhancement

Check-in should only be available from the league page after the user has selected a match day.

Current behavior:

- Many surfaces link to `/ladder/check-in` directly.
- The check-in page can list/select play dates globally.
- The league page member card has a generic `Check In` button linking to `/ladder/check-in`.

Target behavior:

- League detail page shows that league's match days/play dates.
- User selects a match day on the league page.
- Check-in button appears/enables only for the selected match day when check-in is open.
- Check-in link includes the selected play date: `/ladder/check-in?playDate={playDateId}`.
- Regular players should not use `/ladder/check-in` as a global "pick any play date" entry point.

## Suggested Implementation

1. Add `listPlayDatesByLeague(leagueId: string)` in `src/lib/ladder/repo.ts`.
   - Query `COLLECTIONS.playDates`.
   - Filter `where("leagueId", "==", leagueId)`.
   - Order by `date` ascending.
   - Return `PlayDateDoc[]`.

2. Update `src/app/leagues/[leagueId]/LeagueDetailsClient.tsx`.
   - Import `listPlayDatesByLeague` and `PlayDateDoc`.
   - Add `playDates` and `selectedPlayDateId` state.
   - Fetch play dates after the league loads.
   - In the active member panel, replace the generic Check In link with a match-day selector plus a gated button.
   - Enable the button only when `selectedPlayDate.status === "CHECK_IN_OPEN"`.

3. Tighten `src/app/ladder/check-in/page.tsx`.
   - If there is no `playDate` query param, guide regular players back to the league page or play-date list instead of showing a global selector.
   - Keep `?playDate=` deep links working.
   - Decide whether coordinators/admins should retain global management access.

4. Remove or redirect generic check-in entry points.
   - `src/app/(authenticated)/dashboard/page.tsx`
   - `src/app/HomeMobile.tsx`
   - `src/app/HomeDesktop.tsx`
   - `src/components/layout/AppSidebar.tsx`
   - `src/components/layout/SiteFooter.tsx`
   - `src/components/player/PlayerDashboardFallback.tsx`
   - `src/app/ladder/session/page.tsx`
   - Review `src/app/games/page.tsx` and `src/app/ladder/play-dates/page.tsx`; those already pass `?playDate=`, so decide whether they remain acceptable.

## Next Enhancement Bundle

- Coordinator live session dashboard: combine check-ins, no-shows, court assignment, and score status in one screen.
- Check-in fallback: QR/manual code or coordinator override when GPS fails.
- No-show and late-arrival workflow on the check-in management panel.
- Club director league management: club-scoped league list, participation stats, coordinator assignments.
- Schedule safety: confirmation dialog before regenerating league schedules.

## Verification

Run:

```bash
npm run typecheck
npm test
```

If Firebase index errors appear for the new league play-date query, add the required Firestore composite index for `playDates` on `leagueId` plus `date`.
