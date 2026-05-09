# UX/UI Desktop & Mobile Persona Audit
**Platform:** Pickleball League (PBL Arena)  
**Stack:** Next.js 15 · Firebase Auth + Firestore · Static Export · Tailwind CSS  
**Audit date:** 2026-05-08  
**Auditor:** Claude Code (automated structural + code-based UX review)

---

## Executive Summary

**Verdict: Controlled Beta — score 71/100**

PBL Arena has a strong visual identity, a well-structured component library, and a device-aware layout system that clearly reflects intentional design thinking. The dark RPG aesthetic (obsidian surfaces, ember/rune/spectral accents, pixel + fantasy typography) is distinctive and internally consistent. The permission system is well-designed. Real-time Firestore subscriptions power live session and leaderboard data.

However, several UX gaps prevent this from being production-ready:

- **Players have no guided onboarding.** After signing up they are deposited at the profile edit page with no explanation of what to do next.
- **The League Coordinator has no dedicated operational screen.** Coordinating a live session happens through the same dashboard the player uses, with no elevated controls, no "coordinator mode" indicator, and no live-session HUD.
- **Club Director oversight of leagues, coordinators, and member health is limited.** The `/clubs/manage/[clubId]` page exists but no club-level performance dashboard or coordinator approval workflow is visible in the code.
- **Mobile score submission and court-side workflows are partially speculative** — `ScoreModal` is only mounted from the dashboard and has no standalone entry point accessible during a match.
- **Accessibility is undertested.** The custom dark palette, pixel typography, and icon-heavy navigation need manual contrast and keyboard-navigation audits.
- **The tablet breakpoint (768–1024px) is a dead zone** — desktop sidebar appears at `lg` (1024px), but the mobile tab bar disappears below that; the 768–1024px range gets neither sidebar nor tab bar on many pages.

### Biggest UX risks by persona

| Persona | Biggest risk |
|---|---|
| Player | No onboarding → high first-session drop-off |
| League Coordinator | No live-session command surface → coordinator has to navigate like a player |
| Club Director | No club health dashboard → blind to participation and coordinator performance |
| Site Admin | Platform announcement is mass-blast with no targeting, preview, or undo |

---

## Current UX/UI Inventory

### Pages

| Route | Purpose | Primary persona |
|---|---|---|
| `/` | Device-aware landing page | Guest/Player |
| `/auth/login` | Email + Google sign-in | Guest |
| `/auth/signup` | Email account creation | Guest |
| `/dashboard` | Dual-mode: Player home or Admin hub | Player / Admin |
| `/players` | Leaderboard / player directory | Player |
| `/players/view?uid=` | Player profile card | Player (self + others) |
| `/players/edit` | Profile editor | Player |
| `/clubs` | Club directory | Guest / Player |
| `/clubs/[clubId]` | Club detail page | Player / Guest |
| `/clubs/create` | Club submission form | Aspiring Director |
| `/clubs/manage/[clubId]` | Club management | Club Director |
| `/clubs/my` | Clubs I run or coordinate | Club Director / Coordinator |
| `/leagues/create` | League creation form | Club Director / Coordinator |
| `/leagues/[leagueId]` | League details + join | Player / Coordinator |
| `/leagues/[leagueId]/roster` | Enrolled players | Player / Coordinator |
| `/leagues/[leagueId]/standings` | ELO-sorted standings | Player |
| `/leagues/[leagueId]/schedule` | Round-robin schedule | Player / Coordinator |
| `/games` | Combined play dates + tournaments | Player |
| `/ladder/play-dates` | Manage / view play date sessions | Coordinator / Player |
| `/ladder/check-in` | Location-based geofence check-in | Player |
| `/ladder/session` | Live court assignment screen | Coordinator / Player |
| `/ladder/standings` | Ladder leaderboard | Player |
| `/ladder/seasons` | Season management | Coordinator |
| `/tournaments` | Tournament directory | Player / Guest |
| `/tournaments/new` | Create tournament | Coordinator / Admin |
| `/tournaments/view` | Bracket viewer | Player / Guest |
| `/notifications` | Notification center | Player |
| `/admin` | Admin control panel hub | Site Admin |
| `/admin/clubs` | Club approval queue | Site Admin |
| `/admin/clubs/approved` | Manage approved clubs | Site Admin |
| `/admin/users` | User role management | Site Admin |
| `/admin/audit` | Audit log with CSV export | Site Admin |
| `/admin/testing` | Test account switcher | Site Admin |

### Layout components

| Component | Role |
|---|---|
| `ResponsiveShell` | Master device-aware layout switcher |
| `TopNav` | Desktop sticky header with role-conditional nav links |
| `AppSidebar` | Desktop-only (lg+) sidebar, 240px, multi-section |
| `MobileTopBar` | Mobile sticky header: logo + bell + sign-in |
| `MobileTabBar` | Mobile sticky footer: 4–5 dynamic tabs |
| `SiteFooter` | Desktop-only footer with nav links |
| `BackToHome` | Minimal breadcrumb: ← Back + Home link |
| `TestModeBanner` | Amber banner when signed in as test account |

### UI component library

| Component | Variants / notes |
|---|---|
| `Button` | primary, rune, ghost, outline, danger, link · sm/md/lg/icon |
| `Panel` | base, raised, quest, hud, inventory · none/sm/md/lg padding |
| `RuneChip` | 9 tones · optional pulse animation |
| `EmptyState` | Single size · icon + title + description + optional CTA |
| `Skeleton` | Single, Card, List, Text variants |
| `ConfirmDialog` | title, description, variant (danger/primary) · fixed max-w-sm |
| `Toaster` | success/error/info · 4500ms auto-dismiss · top-right fixed |
| `ImageUpload` | File picker with preview, drag-and-drop |

### Design system

| Token | Value |
|---|---|
| Primary surface | `obsidian-800` #0b0c12 |
| Primary text | `ash-100` #e7e9f0 |
| Primary action | `ember-500` #ff6a1f |
| Admin/elevated | `rune-500` #7b4dff |
| Info/secondary | `spectral-500` #3ee0ff |
| Success | #4ade80 |
| Danger | `crimson-500` #e03a4d |
| Display font | Press Start 2P (pixel/8-bit) |
| Heading font | Cinzel (luxury serif) |
| Body font | Inter |
| Mono font | JetBrains Mono |
| Border radius | `rounded-pixel` 2px (sharp bevel) |

---

## Design Maturity Assessment

**Rating: Controlled Beta**

The platform sits between MVP and production-grade SaaS:

**Mature elements:**
- Cohesive visual identity with a unique market position
- Device-aware architecture with separate mobile/desktop component trees
- Role-based access control throughout the UI
- Real-time Firestore data in core flows
- Firestore security rules properly deployed and tested
- CI/CD pipeline with automated builds and hosting deploys

**Gaps preventing production rating:**
- No guided onboarding for new players (critical retention risk)
- League Coordinator live-session UX is insufficient for real use at courts
- Missing custom 404/error pages
- Accessibility not formally verified
- Tablet experience is a gap (768–1024px dead zone)
- No progressive disclosure in admin workflows (mass announcement has no confirmation)
- Several empty states are missing or generic

---

## Persona-Specific UX Findings

---

### Player UX Findings

#### What works

- Leaderboard with real-time updates, name search, and skill band filter is clean and scannable
- Player profile card is rich: ELO chart, stat grid, head-to-head, top partners, equipment
- Follow and Challenge actions are accessible on the profile page
- Notification bell in mobile top bar with live unread count
- Mobile tab bar provides fast access to Games, Rankings, and Dates
- Check-in flow uses geofence (automatic on arrival) — excellent court-side UX when GPS is accurate
- Dashboard adapts to whether a live session is active or not

#### What is confusing

- **No onboarding sequence.** After Google sign-in, the player lands on their profile edit page with no explanation. There is no welcome screen, no step indicator, no guidance on what to do next.
- **League discovery is not surfaced.** Players can browse `/clubs` to find clubs, then navigate to a league from there, but there is no "Join a League" entry point in the player tab bar or dashboard.
- **"Challenge" has no visible confirmation flow.** Clicking Challenge sends a notification but there is no in-app dialogue where the opponent can accept/decline. The outcome is unclear to both parties.
- **Score submission is only reachable from the dashboard.** If the player navigates away during a session, they must go back to the dashboard to find the Submit Score button. There is no persistent score entry shortcut.
- **Check-in failure is silent.** If geolocation fails or the player is outside the geofence, the error is shown as a toast. There is no fallback (manual check-in, coordinator override) visible in the UI.
- **Standing movement is shown as an icon (up/down arrow) but without a numeric rank.** A player cannot see "I moved from rank 12 to rank 9 this week."
- **No session history.** Players cannot view their past sessions, past match results, or score history from a dedicated page.

#### Missing states

- First-time user onboarding flow (multi-step or single welcome screen)
- Check-in failure with coordinator override option
- "No active session" message on dashboard that also shows when the next session is scheduled
- Score dispute status view for the disputing player
- League join confirmation (what happens after clicking Join?)
- Partner stat drill-down (clicking a partner on the profile page goes where?)

#### Mobile risks

- Score entry modal on a 375px screen with a numeric keyboard — touch target size for +/- buttons unverified
- Tab bar labels at `text-[10px]` may be unreadable on low-resolution screens
- "View Courts" and "View Standings" on the session dashboard may stack awkwardly if both shown simultaneously
- Long player display names truncate in list rows — OK, but tooltip or expand option missing

#### Recommended improvements

| Improvement | Priority |
|---|---|
| Add a 3-step onboarding flow: profile → find a club → check in | Immediate |
| Add "Join a League" shortcut to dashboard and mobile tab bar | Immediate |
| Add persistent "Submit Score" floating action button during active sessions | High |
| Show numeric rank change on standings (e.g., "↑3 positions") | High |
| Add check-in fallback: manual coordinator override or QR code entry | High |
| Add session history page at `/me/history` | Medium |
| Show next session date/time on dashboard when no session is active | Medium |
| Challenge flow: add accept/decline screen for the challenged player | Medium |
| Increase touch targets for score modal inputs to minimum 44px | High |

---

### League Coordinator UX Findings

#### What works

- Play dates can be created from `/ladder/play-dates` with venue and season selection
- Session page `/ladder/session` shows live court assignments
- Check-in list is available so coordinators can track arrivals
- Score submission works through the same ScoreModal players use
- Coordinator permissions gate certain actions (generate schedule, manage roster roles)

#### What is confusing

- **No coordinator mode indicator.** When a coordinator logs in, they see the same dashboard as a player. There is no banner, badge, or mode indicator that says "You are managing this session." The coordinator must mentally track what is different about their view.
- **No coordinator command surface for live sessions.** Moving a player between courts, handling a no-show, and reassigning partners all require the coordinator to know which Firestore actions are permitted. There is no dedicated "Coordinator Tools" panel visible during a session.
- **No-show handling has no defined workflow.** If a player does not arrive after check-in opens, there is no "Mark as no-show" button that visibly removes them from court assignments.
- **Score disputes have no coordinator review queue.** If a score is disputed, the coordinator presumably resolves it, but there is no visible queue or escalation UI in the codebase.
- **League schedule generation is in `/leagues/[leagueId]/schedule`** but generating matches for a ladder session (not league) seems separate — the distinction between ladder sessions and league matches is not visually explained.
- **Coordinator vs. player scope is unclear.** A coordinator for League A can see the schedule for League B if they navigate there — the scope of their authority is not visually bounded.

#### Missing states

- Coordinator mode active indicator / mode banner
- Live session command panel with: mark no-show, move player, close session, override check-in
- Score dispute review queue for coordinators
- Coordinator's pending action summary ("3 players not yet checked in")
- Session recap/summary after closing a session

#### Live-session risks

- Coordinator must navigate multiple pages during live play (check-in list, courts, scores) with no single-screen overview
- On mobile, jumping between pages loses context — no persistent session context in nav
- No offline fallback if connectivity drops at outdoor courts

#### Recommended improvements

| Improvement | Priority |
|---|---|
| Add a "Coordinator Mode" banner/indicator when operating as coordinator | Immediate |
| Create a single-page coordinator session dashboard with check-ins, courts, and scores in tabs | Immediate |
| Add "Mark No-Show" and "Override Check-In" buttons visible to coordinators | High |
| Add score dispute queue accessible from coordinator view | High |
| Add sticky session context in mobile top bar during active session | High |
| Add session close/wrap-up confirmation with automatic standings recalculation | Medium |
| Show coordinator's scope clearly ("You are managing: Summer League 2026") | Medium |

---

### Club Director UX Findings

#### What works

- Club creation form exists and submits to an approval workflow
- Club management page `/clubs/manage/[clubId]` exists with multiple tabs
- Club Directors can post club notes/announcements
- Directors can assign League Coordinator role to users from the admin users page
- Club followers/members concept exists in Firestore

#### What is confusing

- **No club-level health dashboard.** The director cannot see at a glance: how many active members, which leagues are active, participation rates, or coordinator performance.
- **Coordinator approval is indirect.** To grant someone the League Coordinator role, the Director must go to `/admin/users`, find the user, and change their role — this is the Site Admin user management page, not a Director-specific tool. The Director should have a dedicated "Manage Staff" section under their club.
- **No way to view all leagues under a club in one place.** The `/leagues` section does not appear to offer a "my club's leagues" filter. Directors must navigate to each league individually.
- **Club approval status is only visible in `/clubs/my`** (assumed). After submitting a club, there is no persistent status indicator showing "pending approval" in other parts of the UI.
- **Director vs. Coordinator distinction is not visualized.** The UI does not show the Director who their coordinators are, what sessions they ran, or how they performed.
- **Club posts/announcements have no scheduling or targeting.** A director posts a note and all followers see it immediately. No ability to draft, preview, or schedule.

#### Missing dashboards or controls

- Club health overview: member count, active leagues, check-in rates, top players
- "My Staff" section: list coordinators by name with their assigned leagues and last active date
- League management from within the club context
- Club settings: geofence, venue assignment, contact info
- Member management: view all members, remove members, approve join requests

#### Permission visibility risks

- Director may not realize they share the Site Admin "Manage Users" page when assigning coordinator roles — it exposes all platform users, which is confusing and potentially concerning
- The scope of a Director's access (this club only vs. platform-wide actions) is not communicated

#### Recommended improvements

| Improvement | Priority |
|---|---|
| Add club health dashboard tab in `/clubs/manage/[clubId]` | High |
| Add "My Staff" tab showing coordinators under this club with their leagues | High |
| Create Director-scoped "Add Coordinator" flow (search users → assign to league, no platform-wide exposure) | Immediate |
| Add "Leagues" tab in club management showing all leagues under this club | High |
| Show club approval status badge on the club manage page header | Medium |
| Add club announcement drafting/preview before sending | Medium |

---

### Site Admin UX Findings

#### What works

- Admin hub with stat cards (pending/approved/rejected clubs, total users, elevated roles) is informative
- Club approval workflow with approve/reject + reason is solid
- User role management with audit trail is well designed
- Audit log with CSV export gives full history
- Confirmation dialog for destructive role changes
- Test accounts page for QA (newly added)
- Recent role events panel on hub page

#### What is confusing

- **Platform announcement is a mass-blast with no safety rail.** The "Send to All Users" button sends to every user simultaneously with no preview, no confirmation dialog, no undo, and no targeting. One mis-click sends garbage to thousands of users.
- **No platform suspension tool.** If a club is found to be abusive post-approval, the only option appears to be rejecting it (which is for pending clubs). There is no "suspend approved club" or "suspend user account" action.
- **Site Admin and Club Director see the same "Manage Users" page.** The page is not scoped by club, so a Club Director navigating there (if they discover the route) sees all platform users.
- **Admin hub lacks live platform health indicators.** There are no metrics for active sessions, match volume this week, error rates, or flagged content.
- **"Regenerate" for league schedules has no confirmation.** Coordinators/Admins can regenerate a full schedule, deleting all existing matches, with a single button press and no warning.
- **Test mode entry is clean but exit requires re-auth popup** (recently improved). On first use it may confuse admins who don't expect a Google popup.

#### Missing platform controls

- Suspend/unsuspend club (post-approval moderation tool)
- Suspend/unsuspend user account
- Platform announcement preview + confirmation dialog + rate limiting
- Flag review queue (disputed scores, reported content)
- Platform health metrics (sessions active now, matches today, new sign-ups this week)

#### Dangerous action risks

- Mass announcement has no confirmation modal — **must be fixed before production**
- Schedule regeneration (deletes all matches) has no confirmation dialog
- Role changes do have a confirmation dialog — this is good

#### Recommended improvements

| Improvement | Priority |
|---|---|
| Add confirmation dialog to "Send Platform Announcement" with user count and preview | Immediate |
| Add "Suspend Club" action to approved clubs management | High |
| Add "Suspend User" action to user management | High |
| Add confirmation dialog to "Regenerate Schedule" button | Immediate |
| Add platform health metrics to admin hub (active sessions, matches today, new users) | High |
| Scope Club Director access to the user management page to their club only | High |
| Add platform announcement targeting (all users, specific club, specific role) | Medium |

---

## Desktop Experience Review

### Player (desktop)

The player desktop experience is the strongest of the four personas. The leaderboard, profile, and game pages are well-organized with a clear visual hierarchy. The AppSidebar provides quick access to core features. The ELO chart on the profile page is a standout feature.

**Gaps:**
- The sidebar is 240px wide and not collapsible — on 1024–1280px screens (common laptop resolution), content area is narrow
- The dashboard lacks a quick-access "Submit Score" card when a session is active — users must know to look for the modal
- No persistent session context in the sidebar (e.g., "Active session: Ember Courts — Court 3")

### League Coordinator (desktop)

The coordinator gets the most benefit from desktop because they have more screen space to see court assignments and check-ins. However, there is no coordinator-specific desktop layout or consolidated command panel.

**Gaps:**
- Must jump between `/ladder/session`, `/ladder/check-in`, and `/ladder/play-dates` — no single consolidated view
- No keyboard shortcut to quickly switch between session management views
- Court assignment table is unverified for large sessions (16+ players on 4 courts) — may need horizontal scroll or condensed view

### Club Director (desktop)

The club management page benefits from desktop space, but the absence of a health dashboard means the director has no at-a-glance overview of their club's performance.

**Gaps:**
- Stats cards on the admin hub include platform-level stats but no club-level stats for Directors who aren't Site Admins
- The "Manage Clubs" quick action links to a page that is Site Admin–only, which is confusing for Club Directors who also have admin-like responsibilities

### Site Admin (desktop)

The admin hub is solid on desktop. Stat cards, quick actions, announcement, and recent events fit naturally on a wide layout.

**Gaps:**
- The audit log table probably needs column sorting and better filtering — cannot verify without reading the full component, but long audit logs become unmanageable without it
- No keyboard navigation through the admin quick action cards

---

## Mobile Experience Review

### Player court-side (mobile)

**What works:** The MobileTabBar gives fast access to key areas. The check-in flow (if GPS works) is touch-friendly. Notifications are accessible from the top bar.

**Risks:**
- Score entry modal on a 375px screen: if the modal uses number inputs with plus/minus buttons, these need to be at least 44×44px. This cannot be verified without running the app.
- If the player locks their phone during a session and unlocks it, React state is lost — they must re-navigate to the modal
- "View Courts" and "View Standings" on the dashboard are buttons that link to separate pages — on mobile, back navigation is cumbersome (no breadcrumb, just "←")
- Check-in confirmation state: after checking in, is the player shown immediate confirmation on-screen, or just a toast that fades?

### League Coordinator live-session (mobile)

**Critical issue:** The coordinator managing a live session at a club cannot see check-ins, courts, and scores simultaneously on mobile. They must tab between three separate pages. At a real venue with 16+ players, this is unworkable.

**Required:** A mobile-optimized coordinator session dashboard with bottom tabs for Check-Ins | Courts | Scores within the session context.

### Touch target size

- Mobile tab bar labels are `text-[10px]` — borderline too small for larger fingers
- Confirm/Cancel buttons in dialogs are sized with `Button size="sm"` (h-8, 32px) — below the 44px minimum recommendation for touch targets
- Role dropdown in roster management (`text-[11px]`, `py-1`) is too small for fat-finger use

### Mobile navigation

- 5-tab mobile bar is compact but functional
- No swipe-to-go-back gesture support (relies on native browser back)
- No persistent context indicator showing which league/session you are currently in

### Forms on mobile

- Signup form uses `md:col-span-2` grids that collapse to single column — good
- Venue creation form includes lat/lng fields — on mobile these are confusing numeric inputs; "Use my location" button is better but may not be prominent
- Date inputs use native `type="date"` — correct choice for mobile

### Modals on mobile

- ConfirmDialog uses `max-w-sm` with `p-4` padding — likely fits fine on most phones
- No transition that feels native on iOS (slide up from bottom would feel more natural than centered overlay fade)

### Tables on mobile

- The standings page uses a CSS grid with `hidden sm:block` and `hidden md:block` columns — the responsive hiding is appropriate
- The roster page uses a 2-col card grid that collapses to 1-col on mobile — good

---

## Persona-Based Critical User Journey UX Matrix

### Player Journey Matrix

| Journey | Current experience | UX risk if confusing | Required improvement | Priority |
|---|---|---|---|---|
| Sign up | Email form or Google; works well | Low — flow is standard | Add password strength indicator | Low |
| Login | Email or Google; error messages are friendly | Low | None critical | Low |
| Complete profile | Lands on edit page with no guidance | High — new user has no idea what to fill in or why | Add welcome screen with step progress indicator | Immediate |
| Find and join a league | Must browse /clubs → find league → click Join | High — discovery path is too long | Add "Find a League" CTA on dashboard and tab bar | High |
| Check in for session | Geofence check-in — automatic if in range | High — silent failure if GPS fails or outside fence | Add fallback: coordinator QR override or manual code | High |
| View court/match assignment | Dashboard shows assigned court after check-in | Medium — buried in dashboard layout | Surface court assignment as a persistent full-width card | High |
| Submit score | ScoreModal accessible only from dashboard | High — if player navigates away they cannot find it | Add floating action button or persistent score card during sessions | Immediate |
| Verify score | Verify button on dashboard — unclear which match | Medium | Label clearly which match needs verification | Medium |
| View standings | /ladder/standings — requires navigation | Low | Add standings shortcut to active session dashboard | Low |
| View personal stats | /players/view?uid=own | Medium — must know to visit own profile | Add "My Stats" quick link on dashboard | Medium |
| Mobile court-side use | Tab bar works; score modal touch targets unverified | High — failure at courts during play is the worst moment | Test score modal on physical device; increase button sizes | Immediate |

### League Coordinator Journey Matrix

| Journey | Current experience | UX risk if confusing | Required improvement | Priority |
|---|---|---|---|---|
| Create league/session | Create play date from /ladder/play-dates | Low — form is functional | Add season/venue validation step | Low |
| Review check-ins | Check-in list available but requires navigation | High — in live session, coordinator needs this instantly | Add coordinator session dashboard with check-in tab | Immediate |
| Assign/adjust courts | /ladder/session shows court assignments | Medium — unclear if coordinator can override assignments | Add explicit "Reassign Court" control visible only to coordinators | High |
| Generate matches | Available on session page | Low | Add confirmation ("This will generate X matches for Y players") | Medium |
| Handle late arrivals / no-shows | No dedicated workflow | Critical — coordinators must handle this constantly | Add "Mark No-Show" / "Late Arrival" buttons per player on check-in list | Immediate |
| Review submitted scores | Visible on session dashboard | Medium — no coordinator-specific score queue | Add score review tab in coordinator session dashboard | High |
| Resolve disputes | No visible dispute resolution UI | Critical — coordinators cannot resolve disputes in-app | Add dispute resolution panel with accept/override/request-replay options | Immediate |
| Update standings | Likely auto-calculated | Low | Confirm standings auto-refresh on score submission | Low |
| Session wrap-up | No close/finalize workflow | High — coordinator may not know session is done | Add "Close Session" button that confirms and locks scores | High |
| Switch coordinator/player mode | No mode switch — same dashboard | Medium | Add "Coordinator Tools" expandable panel visible only to coordinators | High |

### Club Director Journey Matrix

| Journey | Current experience | UX risk if confusing | Required improvement | Priority |
|---|---|---|---|---|
| Create/manage club | /clubs/create → approval → /clubs/manage/[clubId] | Medium — approval wait has no status indicator | Add "Pending Approval" banner on manage page while awaiting | High |
| Approve coordinators | Must go to /admin/users (platform-wide!) | High — Director should not see all platform users | Add Director-scoped "Add Staff" flow under /clubs/manage/[clubId] | Immediate |
| Manage leagues | No club-scoped league list visible | High — Director cannot see all leagues under their club | Add Leagues tab to club management page | High |
| Review participation | No participation stats visible | High — Director has no view of club health | Add club health dashboard: members, check-in rates, leagues, top players | High |
| Review club-level dashboards | Not present | High | Create club director dashboard page | High |
| Manage permissions | Role assignment buried in admin users | Medium | Director-scoped staff management tab | High |
| Monitor operational health | No tool | High — director cannot see if coordinators are active | Add coordinator activity log under club manage | Medium |

### Site Admin Journey Matrix

| Journey | Current experience | UX risk if confusing | Required improvement | Priority |
|---|---|---|---|---|
| Review club applications | /admin/clubs — approval queue, well designed | Low | None critical | Low |
| Approve/reject/suspend clubs | Approve/reject with reason: good. Suspend: missing | High — no way to suspend an approved bad actor | Add "Suspend" action to approved club management | Immediate |
| Manage elevated roles | /admin/users with audit trail — solid | Low | Scope Director's access to their club only | Medium |
| Investigate platform issues | Audit log + user management — adequate | Medium — no cross-club view or search | Add cross-club search and incident log | Medium |
| Review platform dashboard | Stat cards on admin hub — good | Low | Add real-time metrics (active sessions now, matches today) | Medium |
| Confirm dangerous action safeguards | Role changes: confirmed. Announcement: NOT confirmed | Critical — mass announcement has no confirmation | Add preview + confirmation + user count to announcement form | Immediate |
| Regenerate schedule | Single-click deletes all matches | High | Add "Are you sure? This deletes X matches" confirmation | Immediate |

---

## Page-by-Page UX Findings

### `/` — Landing Page
- **Primary persona:** Guest / returning Player
- **Strengths:** Device-aware rendering (HomeMobile vs. HomeDesktop); strong visual brand on desktop
- **Weaknesses:** Not audited in full code detail — HomeMobile.tsx and HomeDesktop.tsx not read. CTA structure, hero copy, and value proposition cannot be verified.
- **Recommended changes:** Ensure landing page clearly explains all 4 personas' value props; include "Sign in with Google" as primary CTA on both mobile and desktop
- **Priority:** Medium (existing users bypass this page)

### `/auth/login` — Login
- **Primary persona:** Returning Player / Admin
- **Strengths:** Google OAuth as primary action; friendly auth error messages; redirect param support
- **Weaknesses:** No "remember me"; no biometric login prompt on mobile; no rate-limit UI feedback beyond toast
- **Recommended changes:** Show "rate limited, try again in X minutes" instead of generic toast; add Face ID / Touch ID prompt consideration for iOS PWA
- **Priority:** Low

### `/auth/signup` — Sign Up
- **Primary persona:** New Player
- **Strengths:** 2-column grid collapses well; optional fields are clearly optional; skill rating guidance
- **Weaknesses:** No password strength indicator; no email verification step communicated; no progress indicator
- **Recommended changes:** Add password strength meter; add "We'll send you a verification email" note (if applicable); auto-focus first field on mount
- **Priority:** Medium

### `/dashboard` — Player / Admin Dashboard
- **Primary persona:** Player (default); Admin (if elevated role)
- **Strengths:** Adapts to session state; shows court/match info; ScoreModal integration; leaderboard rank in fallback
- **Weaknesses:** No visual distinction between "player mode" and "admin mode" header; coordinator controls are invisible; no next-session reminder; "Submit Score" buried in modal flow
- **Recommended changes:** Add role badge ("Player" / "Coordinator" / "Director") to dashboard header; surface next session date in fallback state; add floating Submit Score shortcut during active sessions
- **Priority:** High

### `/players` — Leaderboard
- **Primary persona:** Player
- **Strengths:** Real-time, search + skill band filter, "you" badge, responsive columns
- **Weaknesses:** Rank is recomputed on every filter change (could feel slow at 100+ players); no "follow" shortcut from list row; no pagination or infinite scroll for future scale
- **Recommended changes:** Memoize filtered + sorted list; add inline follow button per row; prepare pagination for >100 players
- **Priority:** Low

### `/players/view?uid=` — Player Profile
- **Primary persona:** Player (self and others)
- **Strengths:** Rich content: ELO chart, stat grid, H2H record, partners, equipment; follow and challenge actions
- **Weaknesses:** Challenge has no visible accept/decline flow; ELO chart SVG may not be accessible (no ARIA); "Top Doubles Partners" section requires fetching — if slow, shows skeleton for long time
- **Recommended changes:** Add alt text to ELO chart SVG or switch to an accessible chart library; add challenge status tracker; add "played X matches in last 30 days" for activity signal
- **Priority:** Medium

### `/players/edit` — Profile Editor
- **Primary persona:** Player
- **Strengths:** Organized into sections; optional fields clear; home venue dropdown; DUPR section
- **Weaknesses:** No inline field validation on blur; required field (`displayName`) has no asterisk until submit error; no save confirmation animation (just toast); no autosave
- **Recommended changes:** Add red underline on blur for required empty fields; show field-level success icon on valid entry; change button label to "Create Profile" for first-time users (appears to already do this — verify)
- **Priority:** Medium

### `/leagues/[leagueId]` — League Details
- **Primary persona:** Player / Coordinator
- **Strengths:** Join button, Stripe payment link, schedule/roster/standings navigation
- **Weaknesses:** Navigation to roster/standings/schedule are separate pages requiring full page loads; league status (active/closed/draft) may not be visually prominent; join confirmation state unclear
- **Recommended changes:** Show league status as a prominent banner (e.g., "Registration Open" in ember, "Season Active" in rune); add inline join success confirmation ("You're enrolled!")
- **Priority:** Medium

### `/leagues/[leagueId]/roster` — Roster
- **Primary persona:** Player / Coordinator
- **Strengths:** 2-col card grid, captain crown, stats row, role dropdown for coordinators, "show all" toggle
- **Weaknesses:** Role dropdown (`text-[11px]`, small padding) is too small for mobile touch; status normalization (`"active"` vs `"ACTIVE"`) works but is a code smell that could cause bugs
- **Recommended changes:** Increase role selector touch target on mobile; normalize status to a single canonical case in Firestore
- **Priority:** Medium

### `/leagues/[leagueId]/standings` — Standings
- **Primary persona:** Player
- **Strengths:** Rank colors (gold/silver/bronze for top 3), trend arrows, ELO display, skill band chips
- **Weaknesses:** W-L and Win% columns hidden on sm/md — mobile player sees very little information; trend is "last 3 matches" but this is only in the legend, not per-row
- **Recommended changes:** Show W-L inline on mobile (replace Win% with W-L on small screens); add per-row tooltip showing "up/down/held based on last 3 matches"
- **Priority:** Low

### `/leagues/[leagueId]/schedule` — Schedule
- **Primary persona:** Player / Coordinator
- **Strengths:** Round-grouped matches; player names linkable; coordinator generate/regenerate button
- **Weaknesses:** No confirmation before regenerating (destroys all existing matches); match status chips show raw status strings ("PENDING", "COMPLETED") which could be more human-readable; no way to click a match to enter a score
- **Recommended changes:** Add confirmation dialog to Regenerate; humanize status labels; make each match row clickable to submit/view score
- **Priority:** High (regenerate confirmation is urgent)

### `/clubs` — Club Directory
- **Primary persona:** Player / Guest
- **Strengths:** Search, location filter, card grid, league count footer
- **Weaknesses:** "Run a club?" CTA at bottom is easy to miss; no map view for location-based discovery; no filtering by "accepting members"
- **Recommended changes:** Move "Start a Club" CTA to header or sidebar; add "Open to Join" filter badge on cards
- **Priority:** Low

### `/clubs/manage/[clubId]` — Club Management
- **Primary persona:** Club Director
- **Could not fully read** — needs specific audit of all management tabs
- **Known gap:** No club health dashboard tab; staff management not scoped to Director

### `/games` — Games Hub
- **Primary persona:** Player
- **Strengths:** Combined play dates + tournaments; home venue auto-detection; status badges pulse on active
- **Weaknesses:** Two very different concepts (ladder sessions vs. tournaments) on one page may confuse new players; no "Register for Tournament" CTA on the games page card (just "View Bracket")
- **Recommended changes:** Separate into two distinct sections with clear headers; add "Register" button on tournament cards when status is REGISTRATION_OPEN
- **Priority:** Medium

### `/ladder/check-in` — Check In
- **Primary persona:** Player
- **Cannot fully verify** — geofence check-in depends on location API. Critical flow for court-side use.
- **Known risk:** No fallback if GPS unavailable; no QR-code alternative
- **Recommended changes:** Add coordinator manual override; show distance from venue in real-time; add "I'm here but can't check in" report button
- **Priority:** High

### `/ladder/session` — Live Session
- **Primary persona:** Coordinator / Player
- **Cannot fully verify** — court assignment and match flow are core to the product
- **Known gap:** No coordinator-specific controls visible in the code structure
- **Recommended changes:** Add coordinator overlay panel with no-show, court move, and session close controls
- **Priority:** Immediate

### `/admin` — Admin Hub
- **Primary persona:** Site Admin
- **Strengths:** Stat cards, quick actions grid, recent events, announcement tool
- **Weaknesses:** Mass announcement has no confirmation or preview; announcement reaches test accounts too
- **Recommended changes:** Wrap "Send to All Users" in ConfirmDialog showing user count; add "Exclude test accounts" checkbox; add character limit display on body textarea
- **Priority:** Immediate

### `/admin/users` — User Management
- **Primary persona:** Site Admin
- **Strengths:** Search, role filter, role change with confirmation dialog and audit trail
- **Weaknesses:** Page is accessible to Club Directors (unintentionally) if they discover the URL; no ability to view a user's full session/activity history
- **Recommended changes:** Gate page strictly to Site Admins (add redirect for Directors); add "View Profile" link per user row
- **Priority:** High

### `/notifications` — Notifications
- **Primary persona:** Player
- **Strengths:** Real-time unread badge, mark-as-read, click-to-navigate
- **Weaknesses:** No bulk "mark all as read"; no notification categories/filters; notifications for different contexts (score, league, announcement) look identical
- **Recommended changes:** Add "Mark All Read" button; add notification type icon/badge per row; group by date
- **Priority:** Medium

---

## Component-Level UX Findings

### Buttons
- The 6-variant system (primary, rune, ghost, outline, danger, link) is well-designed
- **Gap:** No loading state with spinner — text changes to "Saving…" but no visual feedback
- **Fix:** Add `loading?: boolean` prop that replaces text with `<Loader2 className="animate-spin" />` + optional text

### Forms
- Inputs use `.input` class consistently
- **Gap:** No required field asterisk, no inline validation on blur, no field-level success state
- **Fix:** Add `required` asterisk to label; add `onBlur` validation; add green checkmark for valid fields

### Cards / Panels
- 5 Panel variants cause decision fatigue for developers and visual inconsistency
- `quest` variant (parchment overlay) is used for action prompts and empty states — overloaded
- **Fix:** Consolidate to 3 variants: `surface` (base/raised), `accent` (quest/hud), `interactive` (inventory)

### Tables
- Standings and roster use CSS grid with responsive `hidden sm:block` columns — correct approach
- **Gap:** No sort interaction on standings table columns; players cannot sort by W-L or Win%
- **Fix:** Add click-to-sort on ELO, W-L, Win% columns with sort direction indicator

### Navigation
- Desktop AppSidebar is well-structured with labeled sections
- **Gap:** Sidebar is not collapsible; on 1024–1280px screens it compresses the content area significantly
- **Fix:** Add collapse toggle; store collapsed state in localStorage

### Modals
- ConfirmDialog is solid — overlay, stop-propagation, disabled state during save
- **Gap:** Buttons inside ConfirmDialog use `Button size="sm"` (h-8/32px) — below 44px touch minimum
- **Fix:** Use `size="md"` (h-10/40px) inside dialogs on mobile

### Toasts
- Position (top-right) is conventional on desktop but overlaps content on mobile (top-right may overlap the MobileTopBar notification bell)
- **Gap:** No exit animation — toast disappears instantly instead of sliding out
- **Fix:** Add `slide-out-to-right` or `fade-out` animation on dismiss; on mobile, consider `top-center` or `bottom-center` position

### Empty states
- `EmptyState` component exists and is used in several places
- **Gap:** Not consistently used — some pages show a plain Panel with text instead of the EmptyState component
- **Fix:** Audit all pages for empty states and replace ad-hoc text with the EmptyState component

### Loading states
- Skeleton components exist and are used
- **Gap:** Skeleton animations are simple opacity pulse — no shimmer gradient
- **Fix:** Replace `animate-pulse` on skeletons with a shimmer gradient animation for polish

### Role indicators
- RuneChip is used as a role badge (SITE_ADMIN → ember, CLUB_ADMIN → gold, etc.)
- **Gap:** No persistent role indicator on the page header telling the user what role they are currently acting as
- **Fix:** Add a role badge to the TopNav user menu (e.g., "Site Admin" chip next to avatar)

### Permission indicators
- Some actions are hidden when the user lacks permission
- **Gap:** When a Player navigates to a coordinator-only feature, they see nothing rather than "You don't have access — ask your coordinator"
- **Fix:** Show a contextual permission message instead of a hidden element

### Dangerous action confirmations
- ✅ Role changes: confirmed
- ✅ Club approval: requires reason field
- ❌ Platform announcement: no confirmation
- ❌ Schedule regeneration: no confirmation
- ❌ Session close: no flow exists
- **Fix:** All destructive/irreversible actions must have a ConfirmDialog

---

## Accessibility Findings

The following need manual testing or code changes:

| Issue | Severity | Recommendation |
|---|---|---|
| Press Start 2P (pixel font) has poor legibility below 12px — used at `text-[9px]` and `text-[10px]` in chip/badge components | High | Set minimum font size of 11px for all text; use a more legible font for very small badges |
| Custom dark palette needs contrast ratio audit — ash-500 (#5a5f6d) on obsidian-700 (#111218) is approximately 3.8:1 | High | Aim for 4.5:1 for body text, 3:1 for large text; adjust ash-500 or surface colors |
| No `aria-label` visible on icon-only buttons (e.g., notification bell, X dismiss, follow toggle) | High | Add `aria-label` to all icon-only interactive elements |
| ELO trend chart is a custom SVG with no ARIA description | Medium | Add `role="img"` and `aria-label="ELO trend over last 20 matches"` |
| Mobile tab bar uses icon + text at `text-[10px]` — no ARIA roles | Medium | Add `role="tab"` and `aria-selected` to each tab |
| ConfirmDialog: no focus trap — keyboard users can tab behind the modal | High | Implement focus trap in ConfirmDialog using a library like `focus-trap-react` |
| Toast alerts lack `role="alert"` for screen reader announcement | High | Add `role="alert"` or `aria-live="polite"` to toast container |
| Form inputs: no `aria-describedby` linking error messages to input | Medium | Add `aria-describedby={errorId}` when error is displayed |
| Heading order: unknown if `h1` → `h2` → `h3` hierarchy is maintained across all pages | Medium | Audit with browser accessibility tree; fix heading order where h2 appears before h1 |
| Color alone used to convey status (RuneChip tones) — no pattern or icon distinction | Medium | Add a small icon inside each chip to supplement color coding |
| `reduced-motion` media query: custom animations (pulse-rune, flicker-ember, count-up) may not respect it | Low | Wrap all custom keyframes with `@media (prefers-reduced-motion: no-preference)` |

---

## Responsive Design Findings

### Desktop (1280px+)
- Layout is solid with sidebar + content + optional right panel
- Panel variants look correct at this width
- Typography scale works at large sizes

### Laptop (1024–1280px)
- Sidebar appears at `lg` breakpoint (1024px) but at 1024px the content area is ~784px — tight with sidebar
- Consider sidebar auto-collapsing below 1280px or using a narrower icon-only sidebar at 1024–1280px

### Tablet (768–1024px)
- **Critical gap:** At 768–1023px the sidebar is hidden (`hidden lg:flex`) but the mobile tab bar also does not appear (it only shows when `isMobile` is true, which is detection-based)
- This means tablet users at ~900px may get desktop TopNav + no sidebar + no bottom tab bar — a navigation dead zone
- **Fix:** Ensure tablet (768–1023px) gets either: (a) a condensed sidebar, (b) the mobile tab bar, or (c) a hamburger menu in the TopNav

### Mobile (320–767px)
- MobileTopBar + content + MobileTabBar is functional
- Tab bar at 5 items on 320px screens may be too dense
- Content padding: `py-6` (24px) and `px-4` (container) is appropriate
- Text is appropriately scaled

### Specific responsive issues

| Issue | Location | Fix |
|---|---|---|
| Table columns hidden at sm/md break information hierarchy | Standings, roster | Reorganize columns so rank, name, and one key stat always show |
| Score modal width at 375px — unverified | ScoreModal | Test on device; ensure full-width modal with large number inputs |
| League details action buttons (Join, View Roster, etc.) may wrap into multiple rows | `/leagues/[leagueId]` | Use a vertical button stack on mobile instead of flex-wrap |
| Admin stat cards grid: 2-col on mobile, 3-col on sm — works but cards are very small | `/admin` | Minimum 3-col on mobile; make stat number larger |
| Club card grid: 3-col on lg → 2-col on sm → 1-col on mobile — good | `/clubs` | No change needed |
| BackToHome shows on most pages but position and style is inconsistent | All pages | Standardize position (always below TopNav, always full-width container) |

---

## Role and Permission UX Findings

### Who the user is
**Current:** User's display name and avatar appear in TopNav (desktop) and MobileTopBar. Role is not shown.  
**Gap:** Users cannot tell at a glance whether they are operating as Player, Coordinator, Director, or Admin.  
**Fix:** Add a role chip next to the user's name/avatar in both nav bars.

### What role they currently have
**Current:** Hidden behind the `/admin` page access and permissions check.  
**Gap:** A player who has been promoted to League Coordinator may not realize their new capabilities.  
**Fix:** Show a "New role assigned" notification when role is changed; show role chip in nav persistently.

### What scope they are operating in
**Current:** No visual scope indicator.  
**Gap:** A coordinator managing League A cannot tell from the UI that they are in League A's context vs. League B.  
**Fix:** Add a "Currently managing: [League Name]" session context indicator in the top bar during active coordinator sessions.

### What they are allowed to do
**Current:** Disallowed actions are simply hidden.  
**Gap:** Players may think they are missing features rather than understanding they are locked to their role.  
**Fix:** Show grayed-out "Coordinator only" or "Admin only" labels on restricted features with a tooltip explaining why.

### Dangerous action protection
| Action | Protected? |
|---|---|
| Role change | ✅ ConfirmDialog with audit notice |
| Club approval | ✅ Requires reason |
| Platform announcement | ❌ No confirmation |
| Schedule regeneration | ❌ No confirmation |
| Account suspension | ❌ Feature does not exist |
| Test mode entry | ✅ Clear banner; Google re-auth on exit |

---

## Recommended Design System Improvements

### Typography
- Set minimum rendered font size: **11px** (currently `text-[9px]` used in some chips)
- Use Inter (body) for all badge text below 12px — Press Start 2P is illegible at small sizes
- Add a `text-base` (16px) default for all form inputs to prevent iOS auto-zoom on focus

### Spacing scale
- Standardize section spacing: `space-y-6` within pages, `gap-4` within grids — currently mixed (`space-y-4`, `space-y-5`, `space-y-6`, `space-y-8`)
- Standardize card padding to `p-4` (md) for player-facing content, `p-6` (lg) for admin/dashboard panels

### Color usage
- Reserve `ember` for primary actions only — currently used for admin badges (should be rune), active states, and warnings
- Use `crimson` for errors and danger actions only
- Use `gold` for trophies and top-rank indicators only
- Add semantic aliases: `--color-action`, `--color-admin`, `--color-danger`, `--color-info`

### Button hierarchy
- One `primary` button per screen section maximum
- Secondary actions use `outline` (not `ghost` — ghost is too low contrast)
- Danger actions always use `danger` variant with confirmation dialog
- Link-style actions (`link` variant) only for navigation, not data mutations

### Form patterns
- Required fields: add `*` after label, color `text-crimson-400`
- Error state: red bottom border on input + error message below in `text-crimson-400 text-xs`
- Success state: green checkmark icon at input right edge
- All inputs: minimum height 40px (touch-safe)

### Card / panel patterns
- Reduce to 3 variants: `surface`, `accent`, `interactive`
- `surface` = default container (current `base` + `raised`)
- `accent` = highlighted/featured content (current `quest`)
- `interactive` = clickable card (current `inventory`)
- Remove `hud` as a Panel variant — move to a dedicated `SessionHUD` component

### Page layout patterns
- Standard page: `max-w-3xl container mx-auto py-6 md:py-10 space-y-6`
- Wide admin page: `max-w-5xl container mx-auto py-6 space-y-8`
- Full-bleed: no max-width (landing, session HUD)

### Mobile navigation pattern
- Keep 4-tab default; 5th tab for elevated roles only
- Add `aria-current="page"` to active tab
- Increase icon size from current to 22px, labels to minimum 11px

### Role badge pattern
- Show in TopNav: `[Avatar] [Name] [ROLE_CHIP]`
- Show on dashboard header: `"Good morning, [Name]" + [Role] + [Scope]`
- On coordinator session: replace "League Coordinator" chip with "Managing: [League Name]"

### Permission indicator pattern
- Hidden feature → replace with grayed-out element + `aria-disabled` + tooltip "Coordinator required"
- Out-of-scope feature → show but disabled with "Not your league"

### Empty / loading / error state patterns
- All empty states: use `EmptyState` component consistently
- All loading states: use Skeleton with shimmer (add shimmer animation)
- All error states: use `Panel variant="accent"` with `crimson-400` text + retry button

### Destructive action confirmation pattern
- All irreversible actions: `ConfirmDialog` with red header, specific consequence description ("This will delete 24 scheduled matches"), typed confirmation for the most dangerous (e.g., type "DELETE" for platform-wide actions)

---

## Recommended UX/UI Implementation Plan

### Immediate (before next user-facing release)

1. Add `ConfirmDialog` to platform announcement form ("Send to X users?")
2. Add `ConfirmDialog` to schedule Regenerate button ("This will delete X matches")
3. Add a 3-step player onboarding flow post-signup: profile → club → check-in
4. Add coordinator mode indicator banner on dashboard
5. Add "No-Show" button to check-in list (coordinator only)
6. Add `role="alert"` to Toaster component
7. Add `aria-label` to all icon-only buttons across the app
8. Fix tablet (768–1023px) navigation gap — add hamburger or icon sidebar

### This week

9. Add role chip to TopNav and MobileTopBar showing current role
10. Add floating "Submit Score" button that persists during an active session
11. Add "Mark All Read" to notifications page
12. Add scope indicator to coordinator view ("Managing: [League Name]")
13. Add focus trap to ConfirmDialog
14. Increase all dialog button sizes to `size="md"` (h-10/40px) for touch compliance
15. Add player onboarding "next session" reminder to dashboard fallback state
16. Add "Find a League" entry point to player dashboard and mobile tab bar

### Before beta

17. Build coordinator session command panel (tabs: Check-Ins | Courts | Scores)
18. Build club director health dashboard tab
19. Build Director-scoped staff management (add/remove coordinators under their club)
20. Add club-scoped league list to club management page
21. Implement collapsible sidebar for desktop
22. Add shimmer animation to skeleton loading states
23. Add challenge accept/decline flow for the challenged player
24. Conduct contrast audit and fix ash-500/obsidian-700 combination
25. Add custom 404 page

### Before production

26. Add "Suspend Club" and "Suspend User" to admin tools
27. Add platform health metrics to admin hub (live sessions, matches today)
28. Add platform announcement targeting (role, club, or all)
29. Add session history page for players
30. Implement `@media (prefers-reduced-motion: no-preference)` on all custom animations
31. Full ARIA audit across all pages
32. Add check-in fallback (QR code or coordinator override)
33. Add push notification support for match assignments
34. Add sort controls to standings table
35. Add notification grouping by date and type

---

## Suggested Files to Modify

| File | Change needed |
|---|---|
| `src/components/ui/Toaster.tsx` | Add `role="alert"`, slide-out animation, mobile-safe positioning |
| `src/components/ui/ConfirmDialog.tsx` | Increase button sizes to `md`; add focus trap |
| `src/components/ui/Button.tsx` | Add `loading?: boolean` prop with spinner |
| `src/components/ui/Skeleton.tsx` | Add shimmer gradient animation |
| `src/components/ui/EmptyState.tsx` | Add `size` prop (sm/md/lg); standardize across all pages |
| `src/components/ui/Panel.tsx` | Consolidate 5 variants to 3; rename for clarity |
| `src/components/layout/ResponsiveShell.tsx` | Add tablet (768–1023px) nav fallback |
| `src/components/layout/TopNav.tsx` | Add role chip next to user name |
| `src/components/layout/MobileTopBar.tsx` | Add role chip; add `aria-label` to bell button |
| `src/components/layout/MobileTabBar.tsx` | Add `aria-current`, increase font-size to 11px minimum |
| `src/app/admin/page.tsx` | Wrap announcement in ConfirmDialog; add test account exclusion checkbox |
| `src/app/leagues/[leagueId]/schedule/ScheduleClient.tsx` | Add ConfirmDialog to Regenerate button |
| `src/app/dashboard/page.tsx` | Add role badge; add floating score button; add next session reminder |
| `src/app/auth/signup/page.tsx` | Add password strength indicator |
| `src/app/players/edit/page.tsx` | Add required field indicators; add blur validation |
| `src/app/notifications/page.tsx` | Add "Mark All Read"; add notification type icons |
| `src/styles/globals.css` | Add shimmer keyframe; wrap animations in reduced-motion media query; increase min font size |

---

## Release Readiness Score

**Overall: 71 / 100 — Controlled Beta**

| Dimension | Score | Notes |
|---|---|---|
| Overall UX maturity | 71/100 | Strong architecture; gaps in onboarding, coordinator UX, and admin safeguards |
| Desktop experience | 76/100 | Solid layout; sidebar compression at 1024–1280px; admin hub is functional |
| Mobile experience | 65/100 | Tab bar and top bar work; tablet dead zone; score entry and coordinator tools untested |
| Accessibility | 52/100 | Icon-only buttons unlabeled; no focus trap in dialogs; contrast unverified; no reduced-motion |
| Persona workflow clarity | 63/100 | Player is clearest; coordinator is incomplete; director oversight missing; admin needs safeguards |
| Visual design consistency | 84/100 | Strong identity; panel variant sprawl is the main inconsistency |
| SaaS production polish | 72/100 | Real-time data, role-based UI, audit trail all present; missing onboarding and error recovery |

---

## Design Fix Plan

### Immediate UX fixes (do before any new user touches the app)

1. `ConfirmDialog` on platform announcement — **prevents mass accidental blast**
2. `ConfirmDialog` on schedule regeneration — **prevents data loss**
3. `role="alert"` on Toaster — **screen reader compliance minimum**
4. `aria-label` on all icon-only buttons — **basic keyboard/screen-reader access**
5. Player onboarding welcome step post-signup — **critical for retention**

### Mobile responsiveness fixes

6. Tablet (768–1023px) navigation: add hamburger or icon-only sidebar
7. Increase ConfirmDialog button sizes to 40px height minimum
8. Verify ScoreModal touch targets on 375px screen
9. Toast positioning on mobile (consider bottom-center to avoid TopBar overlap)
10. Role dropdown touch targets in roster management

### Navigation and flow fixes

11. Add "Find a League" CTA to player dashboard and mobile tab bar
12. Add persistent "Submit Score" floating button during active sessions
13. Add scope/context indicator during coordinator session ("Managing: [League]")
14. Add next-session reminder on dashboard when no session is active
15. Add collapsible sidebar toggle for laptop screens

### Persona workflow fixes

16. Coordinator: no-show workflow with Mark No-Show button per player
17. Coordinator: consolidated session command panel (tabs: Check-Ins | Courts | Scores)
18. Club Director: staff management tab (scoped to their club)
19. Club Director: league list tab within club management
20. Club Director: club health dashboard (members, sessions, top players)
21. Site Admin: suspend club + suspend user account actions
22. Player: challenge accept/decline flow

### Role and permission clarity fixes

23. Role chip in TopNav and MobileTopBar (current role always visible)
24. "Coordinator only" tooltip on locked features instead of invisible hidden elements
25. Director-scoped coordinator assignment (not via platform-wide admin/users page)
26. Test mode banner is complete ✅ (already implemented)

### Accessibility fixes

27. Contrast audit: ash-500 on obsidian-700 — adjust to meet 4.5:1
28. Focus trap in ConfirmDialog
29. `aria-current="page"` on mobile tab bar tabs
30. Heading order audit across all pages
31. ELO chart SVG: add `role="img"` and `aria-label`
32. Add `@media (prefers-reduced-motion: no-preference)` wrapper to all custom keyframe animations

### Visual polish fixes

33. Shimmer animation on Skeleton components (replace opacity pulse)
34. Exit animation on toast dismiss (slide-out)
35. Consolidate Panel variants from 5 to 3 with clearer names
36. Set minimum font size 11px across all RuneChip/badge text
37. Reserve ember/rune/crimson/gold to their semantic meanings only

### SaaS production polish fixes

38. Custom 404 page matching brand
39. Error boundary wrapping major page sections
40. Session history page for players (`/me/history`)
41. Check-in fallback: coordinator override or QR code
42. Platform announcement targeting (not just "all users")
43. `prefers-color-scheme` detection (or confirm dark-only is intentional)
