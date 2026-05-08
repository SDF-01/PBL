# Use Case Testing Document

Created: 2026-05-05
Reviewed: 2026-05-08

## Purpose

This document is a role-based end-user testing script for the application. Testers should use it to verify that each major part of the site works as expected and that role-restricted actions are only available to the correct personas.

## Current Implementation Notes

This app is currently a static Next.js export that talks directly to Firebase. Some flows are available in the UI and allowed by current Firestore/Storage rules, while other flows remain production-risky until they move behind trusted backend commands.

When testing privileged workflows, record one of these outcomes:

- Pass: The workflow completes and the resulting data is correct.
- Expected Block: The UI or Firebase rules block the action because a trusted backend is still required.
- Security Fail: An unauthorized user can complete a restricted action, mutate another user's data, cross club/league boundaries, or alter protected fields.

Production-readiness testing should treat role assignment, club approval, league administration, ladder generation/finalization, ELO/stat mutation, audit logging, push fanout, and tournament operations as security-sensitive even when the current client UI can trigger them.

## Personas

- Player: Standard logged-in player.
- League Coordinator: Staff user who manages league play dates, sessions, scores, and disputes.
- Club Director: Staff user who manages a club, leagues, members, coordinators, and facilities.
- Site Admin: Platform administrator who manages users, clubs, roles, announcements, and audit logs.
- Guest: Not logged in.

## Testing Rule For Role Access

- Player actions should also be tested by League Coordinator, Club Director, and Site Admin when those roles can access player mode or player-facing pages.
- Staff-only actions should be verified as unavailable to Player and Guest.
- Site Admin-only actions should be verified as unavailable to Player, League Coordinator, Club Director, and Guest.
- Cross-tenant access should be tested with at least two clubs and two leagues. A director/coordinator for Club A should not be able to manage Club B data.
- Storage uploads should be tested for owner/scope, file type, and file size. Current known risk: club-logo paths accept any authenticated writer at the Storage rules layer.
- Push notifications should be tested as token registration only unless a trusted server sender has been deployed.

## Tester Result Format

For every test case, the tester should fill in:

- Tester:
- Pass or Fail:
- What I Did:
- If Failed, Why:

---

## 1. Authentication And Navigation

| ID | Persona(s) | Use Case | Desired Outcome | Tester | Pass/Fail | What I Did | If Failed, Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-01 | Guest | Open the home page and review unauthenticated navigation. | Guest can see public pages and sign-in/sign-up options without accessing protected admin tools. |  |  |  |  |
| AUTH-02 | Guest | Attempt to open `/dashboard`. | Guest is prompted to sign in or blocked from protected user content. |  |  |  |  |
| AUTH-03 | Guest | Sign up with valid email/password information. | Account is created and user lands in an authenticated player experience. |  |  |  |  |
| AUTH-04 | Player, League Coordinator, Club Director, Site Admin | Sign in with valid credentials. | User is authenticated and the app shows navigation appropriate to their role. |  |  |  |  |
| AUTH-05 | Player, League Coordinator, Club Director, Site Admin | Sign out. | User session ends and protected pages are no longer accessible. |  |  |  |  |
| AUTH-06 | League Coordinator, Club Director, Site Admin | Switch between staff/admin mode and player mode where available. | User can switch views without losing session, and the selected mode persists after refresh if supported. |  |  |  |  |

---

## 2. Player Dashboard And Home

| ID | Persona(s) | Use Case | Desired Outcome | Tester | Pass/Fail | What I Did | If Failed, Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DASH-01 | Player, League Coordinator, Club Director, Site Admin | Open the player dashboard with no active session. | Dashboard shows current standing, upcoming play dates, recent matches, and quick actions. |  |  |  |  |
| DASH-02 | Player, League Coordinator, Club Director, Site Admin | Open dashboard during an active session. | Player sees assigned court, current match, next match, and score actions. |  |  |  |  |
| DASH-03 | Player, League Coordinator, Club Director, Site Admin | Use quick action to open check-in. | Check-in page opens from the dashboard. |  |  |  |  |
| DASH-04 | Player, League Coordinator, Club Director, Site Admin | Use quick action to open standings. | Standings/leaderboard page opens from the dashboard. |  |  |  |  |
| DASH-05 | Player, League Coordinator, Club Director, Site Admin | Review recent match results. | Recent matches show score, win/loss state, and match context. |  |  |  |  |

---

## 3. Player Profiles And Discovery

| ID | Persona(s) | Use Case | Desired Outcome | Tester | Pass/Fail | What I Did | If Failed, Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PLAYER-01 | Player, League Coordinator, Club Director, Site Admin | Create or edit own player profile. | Profile saves display name, location, DUPR, paddle info, bio/style, and related fields. |  |  |  |  |
| PLAYER-02 | Player, League Coordinator, Club Director, Site Admin | Open the player directory. | Directory lists players ranked by ELO with profile links. |  |  |  |  |
| PLAYER-03 | Player, League Coordinator, Club Director, Site Admin | Search player directory by name or city. | Results filter correctly and empty state appears if no matches exist. |  |  |  |  |
| PLAYER-04 | Player, League Coordinator, Club Director, Site Admin | Filter player directory by skill band. | Only players in selected skill band appear. |  |  |  |  |
| PLAYER-05 | Player, League Coordinator, Club Director, Site Admin | Open another player's profile. | Profile shows public player information, ELO, record, DUPR, equipment, and recent ELO changes. |  |  |  |  |
| PLAYER-06 | Player, League Coordinator, Club Director, Site Admin | View own profile. | User sees edit option and complete profile stats. |  |  |  |  |
| PLAYER-07 | Player, League Coordinator, Club Director, Site Admin | Open an opponent profile after having played them. | Head-to-head record versus current user appears when data exists. |  |  |  |  |
| PLAYER-08 | Guest | Attempt to access profile edit page. | Guest cannot edit a profile and is prompted to authenticate. |  |  |  |  |

---

## 4. Standings And Leaderboards

| ID | Persona(s) | Use Case | Desired Outcome | Tester | Pass/Fail | What I Did | If Failed, Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| STAND-01 | Player, League Coordinator, Club Director, Site Admin | Open season standings. | Standings show rank, player, ELO, W/L, win percentage, and trend indicator where available. |  |  |  |  |
| STAND-02 | Player, League Coordinator, Club Director, Site Admin | Identify current user in standings. | Current user is visually marked as "You" or otherwise distinguishable. |  |  |  |  |
| STAND-03 | Player, League Coordinator, Club Director, Site Admin | Click a player from standings. | Player profile opens successfully. |  |  |  |  |
| STAND-04 | Player, League Coordinator, Club Director, Site Admin | View standings when no players exist. | Helpful empty state appears with next action. |  |  |  |  |

---

## 5. Clubs Public Experience

| ID | Persona(s) | Use Case | Desired Outcome | Tester | Pass/Fail | What I Did | If Failed, Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CLUBPUB-01 | Guest, Player, League Coordinator, Club Director, Site Admin | Open a public club page. | Club name, location, description, stats, leagues, facilities, and coordinators display where data exists. |  |  |  |  |
| CLUBPUB-02 | Guest | Use club page join/sign-up call to action. | Guest is routed to account creation or login before joining. |  |  |  |  |
| CLUBPUB-03 | Player, League Coordinator, Club Director, Site Admin | View active leagues on club page. | Active leagues are listed with view/join actions where allowed. |  |  |  |  |
| CLUBPUB-04 | Player, League Coordinator, Club Director, Site Admin | Open facility map from club page. | Facility details and embedded map display when address exists. |  |  |  |  |
| CLUBPUB-05 | Player | Verify manage club actions are not available. | Player cannot see director-only manage controls. |  |  |  |  |
| CLUBPUB-06 | Club Director, Site Admin | Verify manage club action is available for authorized club. | Authorized user can open the club management page. |  |  |  |  |

---

## 6. Club Management

| ID | Persona(s) | Use Case | Desired Outcome | Tester | Pass/Fail | What I Did | If Failed, Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CLUBMGT-01 | Club Director, Site Admin | Open club management page for authorized club. | Management dashboard opens with overview, leagues, facilities, members, and coordinators sections. |  |  |  |  |
| CLUBMGT-02 | Player, Guest | Attempt to open club management page. | Access is denied or user is prompted to authenticate. |  |  |  |  |
| CLUBMGT-03 | Club Director, Site Admin | Review club overview stats. | Active leagues, players/members, and coordinators are visible. |  |  |  |  |
| CLUBMGT-04 | Club Director, Site Admin | Create a league from club management. | League is created and appears in club league list. |  |  |  |  |
| CLUBMGT-05 | Club Director, Site Admin | Edit facility information. | Facility changes save and display on management and public club pages. |  |  |  |  |
| CLUBMGT-06 | Club Director, Site Admin | Delete facility information. | Confirmation appears before delete; facility is removed after confirmation. |  |  |  |  |
| CLUBMGT-07 | Club Director, Site Admin | Set facility surface type and indoor/outdoor state. | Surface and indoor/outdoor values save and display correctly. |  |  |  |  |
| CLUBMGT-08 | Club Director, Site Admin | Add venue for check-in. | Venue is created with name, address, and check-in radius. |  |  |  |  |
| CLUBMGT-09 | Club Director, Site Admin | View member directory. | Active club members and league memberships appear. |  |  |  |  |
| CLUBMGT-10 | Club Director, Site Admin | Remove a member from a league. | Confirmation appears; member is removed from that league after confirmation. |  |  |  |  |
| CLUBMGT-11 | Club Director, Site Admin | Copy invite link. | Invite link copies successfully and can be opened by another user. |  |  |  |  |
| CLUBMGT-12 | Club Director, Site Admin | Send club-wide announcement. | All active club members receive an in-app notification. |  |  |  |  |
| CLUBMGT-13 | Club Director, Site Admin | Assign a league coordinator by email. | Existing user receives coordinator role for the club. |  |  |  |  |
| CLUBMGT-14 | Club Director, Site Admin | Remove a coordinator. | Coordinator role is removed and user no longer has coordinator access. |  |  |  |  |

---

## 7. League Management

| ID | Persona(s) | Use Case | Desired Outcome | Tester | Pass/Fail | What I Did | If Failed, Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LEAGUE-01 | Guest, Player, League Coordinator, Club Director, Site Admin | Open a league details page. | League details, location, format, next play date, and role-appropriate actions display. |  |  |  |  |
| LEAGUE-02 | Guest | Attempt to join league. | Guest is asked to create account or log in. |  |  |  |  |
| LEAGUE-03 | Player, League Coordinator, Club Director, Site Admin | Join a league as a non-member. | Membership is created and league shows member state. |  |  |  |  |
| LEAGUE-04 | Player, League Coordinator, Club Director, Site Admin | Leave a league as an active member. | Membership changes to left/removed state and member controls update. |  |  |  |  |
| LEAGUE-05 | Player, League Coordinator, Club Director, Site Admin | Open league roster. | Roster lists members, skill bands, ELO, W/L, and assignment/member status. |  |  |  |  |
| LEAGUE-06 | Club Director, League Coordinator, Site Admin | Open league settings editor. | Authorized staff can edit permitted league settings. |  |  |  |  |
| LEAGUE-07 | Player, Guest | Verify league settings editor is unavailable. | Player/Guest cannot see or use staff league settings controls. |  |  |  |  |
| LEAGUE-08 | Club Director, League Coordinator, Site Admin | Save league settings. | Changes persist and appear on league details. |  |  |  |  |

---

## 8. Play Dates, Check-In, And Sessions

| ID | Persona(s) | Use Case | Desired Outcome | Tester | Pass/Fail | What I Did | If Failed, Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SESSION-01 | Player, League Coordinator, Club Director, Site Admin | Open play date list. | Play dates show date, season, venue, play date status, and session status badges. |  |  |  |  |
| SESSION-02 | League Coordinator, Club Director, Site Admin | Create a venue from play dates. | Venue is created with latitude, longitude, and geofence radius. |  |  |  |  |
| SESSION-03 | League Coordinator, Club Director, Site Admin | Create a new play date. | Play date appears in list and can be opened for check-in. |  |  |  |  |
| SESSION-04 | Player, League Coordinator, Club Director, Site Admin | Check in for a play date while inside geofence. | User check-in is accepted and recorded. |  |  |  |  |
| SESSION-05 | Player, League Coordinator, Club Director, Site Admin | Attempt check-in outside geofence. | App blocks or flags check-in according to geofence validation rules. |  |  |  |  |
| SESSION-06 | League Coordinator, Club Director, Site Admin | Review attendance for a play date. | Staff can review checked-in players before generating sessions. |  |  |  |  |
| SESSION-07 | League Coordinator, Club Director, Site Admin | Generate a session from checked-in players. | Courts and matches are generated and players are assigned. |  |  |  |  |
| SESSION-08 | Player, League Coordinator, Club Director, Site Admin | Open active session page. | Current court, match, next match, standings, and live court data display. |  |  |  |  |
| SESSION-09 | Player, League Coordinator, Club Director, Site Admin | View live courts. | Each court shows assigned players, current/last game, scores, and progress. |  |  |  |  |
| SESSION-10 | Player, League Coordinator, Club Director, Site Admin | Keep active session open while another user submits/verifies score. | Page updates through real-time subscription without manual refresh. |  |  |  |  |
| SESSION-11 | League Coordinator, Club Director, Site Admin | Finalize session after all scores are complete. | Finalization completes, ratings/stats update, and movement notifications are sent. |  |  |  |  |
| SESSION-12 | Player | Attempt staff-only session generation/finalization. | Player cannot generate or finalize sessions. |  |  |  |  |

---

## 9. Score Submission, Verification, And Disputes

| ID | Persona(s) | Use Case | Desired Outcome | Tester | Pass/Fail | What I Did | If Failed, Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SCORE-01 | Player, League Coordinator, Club Director, Site Admin | Submit score for scheduled match. | Score saves, match moves to submitted/awaiting verification, and opponents receive notification. |  |  |  |  |
| SCORE-02 | Player, League Coordinator, Club Director, Site Admin | Try to submit tied score. | App prevents tied ladder score submission. |  |  |  |  |
| SCORE-03 | Player, League Coordinator, Club Director, Site Admin | Verify opponent-submitted score. | Score becomes verified and session progress updates. |  |  |  |  |
| SCORE-04 | Player, League Coordinator, Club Director, Site Admin | Dispute an incorrect score. | Match becomes disputed and verification is paused. |  |  |  |  |
| SCORE-05 | League Coordinator, Club Director, Site Admin | Open dispute panel. | Disputed matches are listed with score, sides, session, and reason. |  |  |  |  |
| SCORE-06 | League Coordinator, Club Director, Site Admin | Accept a disputed submitted score. | Dispute resolves and match becomes verified. |  |  |  |  |
| SCORE-07 | League Coordinator, Club Director, Site Admin | Override disputed score. | Admin-entered score saves and dispute resolves. |  |  |  |  |
| SCORE-08 | Player | Attempt to access admin dispute resolution tools. | Player cannot access dispute resolution panel. |  |  |  |  |

---

## 10. Tournaments

| ID | Persona(s) | Use Case | Desired Outcome | Tester | Pass/Fail | What I Did | If Failed, Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TOURNEY-01 | Guest, Player, League Coordinator, Club Director, Site Admin | Open tournaments list or tournament page. | Tournaments display publicly where available. |  |  |  |  |
| TOURNEY-02 | Player, League Coordinator, Club Director, Site Admin | Register for tournament. | User registration is created and status appears on tournament page. |  |  |  |  |
| TOURNEY-03 | Player, League Coordinator, Club Director, Site Admin | Withdraw from tournament. | Registration changes to withdrawn state. |  |  |  |  |
| TOURNEY-04 | Tournament Director, Site Admin | Confirm, waitlist, or reject entrants. | Entrant status updates and user receives notification where applicable. |  |  |  |  |
| TOURNEY-05 | Tournament Director, Site Admin | Publish bracket. | Confirmation appears; bracket is created and visible in bracket tab. |  |  |  |  |
| TOURNEY-06 | Guest, Player, League Coordinator, Club Director, Site Admin | View published bracket. | Visual bracket renders with seeds/entrant names by round. |  |  |  |  |
| TOURNEY-07 | Tournament Director, Site Admin | Start tournament. | Tournament status changes from seeded to in progress. |  |  |  |  |
| TOURNEY-08 | Tournament Director, Site Admin | Enter tournament match score from matches tab. | Score saves and match status/winner updates. |  |  |  |  |
| TOURNEY-09 | Player | Attempt director-only tournament controls. | Player cannot confirm entrants, publish bracket, start tournament, or enter director-only scores. |  |  |  |  |

---

## 11. Notifications

| ID | Persona(s) | Use Case | Desired Outcome | Tester | Pass/Fail | What I Did | If Failed, Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NOTIF-01 | Player, League Coordinator, Club Director, Site Admin | Open notifications inbox. | Recent notifications are listed in newest-first order. |  |  |  |  |
| NOTIF-02 | Player, League Coordinator, Club Director, Site Admin | Mark notification as read. | Notification read state updates and unread indicator disappears. |  |  |  |  |
| NOTIF-03 | Player, League Coordinator, Club Director, Site Admin | Click notification with link. | User is routed to linked page and notification is marked read. |  |  |  |  |
| NOTIF-04 | Player, League Coordinator, Club Director, Site Admin | Receive score submitted notification. | Opponent/partner sees notification asking them to verify or dispute score. |  |  |  |  |
| NOTIF-05 | Player, League Coordinator, Club Director, Site Admin | Receive movement notification after session finalization. | Promoted/demoted player gets in-app notification. |  |  |  |  |
| NOTIF-06 | Guest | Attempt to open notifications. | Guest is prompted to sign in. |  |  |  |  |

---

## 12. Site Admin Console

| ID | Persona(s) | Use Case | Desired Outcome | Tester | Pass/Fail | What I Did | If Failed, Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ADMIN-01 | Site Admin | Open admin control panel. | Admin dashboard displays platform overview and admin quick actions. |  |  |  |  |
| ADMIN-02 | Player, League Coordinator, Club Director, Guest | Attempt to open site admin-only pages. | Access is denied for unauthorized personas. |  |  |  |  |
| ADMIN-03 | Site Admin | Search users by name or email. | Matching users are shown; non-matching search shows empty state. |  |  |  |  |
| ADMIN-04 | Site Admin | Filter users by role. | User list updates to selected role only. |  |  |  |  |
| ADMIN-05 | Site Admin | Change a user's role. | Confirmation dialog appears; role updates after confirmation and audit event is written. |  |  |  |  |
| ADMIN-06 | Site Admin | Try assigning Site Admin role. | Extra warning is displayed before confirming high-risk role change. |  |  |  |  |
| ADMIN-07 | Site Admin | Send platform-wide announcement. | All listed users receive an in-app notification. |  |  |  |  |
| ADMIN-08 | Site Admin | Review pending club approvals. | Pending clubs can be reviewed and approved/rejected with reason where required. |  |  |  |  |
| ADMIN-09 | Site Admin | Open approved clubs page. | Approved clubs and management details are visible. |  |  |  |  |

---

## 13. Audit Log

| ID | Persona(s) | Use Case | Desired Outcome | Tester | Pass/Fail | What I Did | If Failed, Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AUDIT-01 | Site Admin | Open audit log. | Audit events are visible with type, notes, user, role/club details, and timestamp. |  |  |  |  |
| AUDIT-02 | Player, League Coordinator, Club Director, Guest | Attempt to open audit log. | Unauthorized personas cannot access the audit log. |  |  |  |  |
| AUDIT-03 | Site Admin | Filter audit log by event type. | Only selected event type appears. |  |  |  |  |
| AUDIT-04 | Site Admin | Filter audit log by date range. | Only events within selected dates appear. |  |  |  |  |
| AUDIT-05 | Site Admin | Clear audit filters. | Full recent audit list returns. |  |  |  |  |
| AUDIT-06 | Site Admin | Export audit CSV. | CSV downloads with filtered audit rows. |  |  |  |  |

---

## 14. UI, Loading, Empty States, And Safety

| ID | Persona(s) | Use Case | Desired Outcome | Tester | Pass/Fail | What I Did | If Failed, Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UI-01 | Guest, Player, League Coordinator, Club Director, Site Admin | Open pages with no data. | Empty states explain that no data exists and provide a helpful next step when appropriate. |  |  |  |  |
| UI-02 | Guest, Player, League Coordinator, Club Director, Site Admin | Load data-heavy pages on slow network. | Skeleton/loading states appear and are replaced by content. |  |  |  |  |
| UI-03 | Player, League Coordinator, Club Director, Site Admin | Trigger successful action toast. | Toast appears once with success message and disappears automatically. |  |  |  |  |
| UI-04 | Player, League Coordinator, Club Director, Site Admin | Trigger failed action toast/error. | Error feedback explains the failure without breaking the page. |  |  |  |  |
| UI-05 | Player, League Coordinator, Club Director, Site Admin | Attempt destructive action. | Confirmation dialog appears before delete/remove action completes. |  |  |  |  |
| UI-06 | Guest, Player, League Coordinator, Club Director, Site Admin | Test core pages on mobile viewport. | Content fits, navigation is usable, and text/buttons do not overlap. |  |  |  |  |
| UI-07 | Guest, Player, League Coordinator, Club Director, Site Admin | Test core pages on desktop viewport. | Layout is readable, controls are aligned, and no content is hidden unintentionally. |  |  |  |  |

---

## 15. Storage, Push, Social, And Schedule

| ID | Persona(s) | Use Case | Desired Outcome | Tester | Pass/Fail | What I Did | If Failed, Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MEDIA-01 | Player | Upload a player profile photo under 5 MB. | Image uploads to Storage, profile saves the URL, and the image displays after refresh. |  |  |  |  |
| MEDIA-02 | Player | Try uploading a non-image or image larger than 5 MB as profile photo. | Upload is rejected with clear feedback and no profile URL is saved. |  |  |  |  |
| MEDIA-03 | Club Director, Site Admin | Upload a club logo from club management. | Logo uploads and appears on the club public and management pages. |  |  |  |  |
| MEDIA-04 | Player | Attempt to write or replace another club's logo path outside the normal UI. | Storage rules or backend scope checks deny the write. Current known risk if this succeeds before Storage hardening. |  |  |  |  |
| PUSH-01 | Player, League Coordinator, Club Director, Site Admin | Enable push notifications from the banner. | Browser permission is requested and an FCM token is stored for the signed-in user. |  |  |  |  |
| PUSH-02 | Player, League Coordinator, Club Director, Site Admin | Sign out after enabling push notifications. | User session ends; stale token cleanup should run where supported. |  |  |  |  |
| PUSH-03 | Player, League Coordinator, Club Director, Site Admin | Receive a background push notification. | Only test this when a trusted server sender exists; otherwise record Expected Block / Not Implemented. |  |  |  |  |
| SOCIAL-01 | Player | Follow another player from their profile. | Follow state updates and the followed player receives an in-app notification where rules allow it. |  |  |  |  |
| SOCIAL-02 | Player | Unfollow another player. | Follow state is removed and the UI updates after refresh. |  |  |  |  |
| SOCIAL-03 | Player | Challenge another player from their profile. | Challenge is created, appears in incoming/outgoing challenge lists, and sends an in-app notification. |  |  |  |  |
| SOCIAL-04 | Player | Accept or decline an incoming challenge. | Challenge status updates and the challenger receives an in-app notification. |  |  |  |  |
| SOCIAL-05 | Club Director | Create a club post. | Post appears on the public club page and followed-club feed. |  |  |  |  |
| RSVP-01 | Player | RSVP attending for a play date. | RSVP saves, persists after refresh, and staff can see headcount. |  |  |  |  |
| RSVP-02 | Player | Remove RSVP for a play date. | RSVP is deleted and the play date UI returns to the default state. |  |  |  |  |
| SCHEDULE-01 | Club Director, League Coordinator, Site Admin | Generate round-robin league schedule from roster. | Existing schedule is replaced with generated matches ordered by round. |  |  |  |  |
| SCHEDULE-02 | Player, Guest | Attempt to generate or overwrite a league schedule. | Unauthorized personas cannot create, delete, or overwrite schedule matches. |  |  |  |  |

---

## 16. Security Regression Flow

Use this after Firestore or Storage rules changes, backend-command changes, or role-management changes.

| ID | Persona(s) | Use Case | Desired Outcome | Tester | Pass/Fail | What I Did | If Failed, Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SEC-01 | Player | Attempt to self-promote by editing `users/{uid}.role`. | Write is denied and user's role remains Player. |  |  |  |  |
| SEC-02 | Player | Attempt to create or activate `userRoles` for self. | Write is denied. |  |  |  |  |
| SEC-03 | Club Director | Attempt to assign a coordinator role for a club they do not manage. | Write is denied by backend or rules. |  |  |  |  |
| SEC-04 | League Coordinator | Attempt to create or edit a league in another club. | Write is denied by backend or rules. |  |  |  |  |
| SEC-05 | Player | Attempt to update ELO, stats, or create an `eloEvents` record. | Write is denied. |  |  |  |  |
| SEC-06 | Player | Attempt to create confirmed check-in data with forged geolocation/status. | Backend/rules reject forged confirmed status or flag it for staff review. |  |  |  |  |
| SEC-07 | Guest | Attempt to read private/authenticated profile surfaces. | Guest is blocked from authenticated player profile data. |  |  |  |  |
| SEC-08 | Guest | Attempt to read operational attendance/session data. | Public operational reads should be denied after privacy hardening; record current exposure if still public. |  |  |  |  |
| SEC-09 | Player | Attempt to edit notification title/body/href instead of marking read. | Only read-state updates are allowed after rules hardening. |  |  |  |  |
| SEC-10 | Site Admin | Run Firestore rules test suite. | `npm run test:rules` passes in emulator environment. |  |  |  |  |

---

## 17. Regression Test Flow

Use this as a full smoke test after major releases.

| ID | Persona(s) | Use Case | Desired Outcome | Tester | Pass/Fail | What I Did | If Failed, Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REG-01 | Site Admin | Create/approve required club and roles. | Test club, director, coordinator, and player accounts are ready. |  |  |  |  |
| REG-02 | Club Director | Create league, facility, venue, and invite players. | Club has playable league and venue data. |  |  |  |  |
| REG-03 | Player | Join league and create/edit profile. | Player appears in roster and leaderboard/profile areas. |  |  |  |  |
| REG-04 | League Coordinator | Create play date and open check-in. | Play date is available for players to check in. |  |  |  |  |
| REG-05 | Player | Check in for play date. | Player attendance is recorded. |  |  |  |  |
| REG-06 | League Coordinator | Generate session. | Courts and matches are generated. |  |  |  |  |
| REG-07 | Player | Submit score. | Score is submitted and opponent receives notification. |  |  |  |  |
| REG-08 | Player | Verify score. | Match becomes verified. |  |  |  |  |
| REG-09 | League Coordinator | Finalize session. | Player stats/ELO update and notifications are sent. |  |  |  |  |
| REG-10 | Site Admin | Review audit and user/admin pages. | Admin records and role controls remain functional after flow. |  |  |  |  |
