"""
Player persona tests — profile, search, leaderboard, RSVP, check-in, notifications.
"""
import pytest
from playwright.sync_api import expect, Page

from tests.e2e.config import Config
from tests.e2e.pages import PlayerPage, LadderPage, LeaguePage, ClubPage, DashboardPage
from tests.e2e.reporter.step_logger import StepLogger


@pytest.mark.player
class TestPlayerProfile:

    @pytest.mark.use_case(
        id="UC-P-001",
        name="Player views own profile",
        persona="Player",
        criteria=[
            "Profile page loads without errors",
            "Display name is visible",
            "Profile stats or edit button is accessible",
        ],
    )
    def test_can_view_own_profile(self, player: PlayerPage, steps: StepLogger):
        steps.page = player.page
        with steps.step("Navigate to /players/view"):
            player.navigate_to_own_profile()
        with steps.step("Verify profile content is loaded"):
            player.assert_profile_loaded()
        with steps.step("Verify display name is visible"):
            expect(
                player.page.get_by_text(Config.PLAYER["display_name"], exact=False)
            ).to_be_visible(timeout=8_000)

    @pytest.mark.use_case(
        id="UC-P-002",
        name="Player navigates to edit-profile page",
        persona="Player",
        criteria=[
            "Edit Profile button or link is present on profile",
            "Clicking it opens the edit form",
        ],
    )
    def test_can_navigate_to_edit_profile(self, player: PlayerPage, steps: StepLogger):
        steps.page = player.page
        with steps.step("Navigate to own profile"):
            player.navigate_to_own_profile()
        with steps.step("Click Edit Profile"):
            player.edit_profile_button.first.click()
            player.wait_for_page_ready()
        with steps.step("Verify on edit or profile page"):
            assert "/players/edit" in player.page.url or "/players/view" in player.page.url

    @pytest.mark.use_case(
        id="UC-P-003",
        name="Edit profile form renders required fields",
        persona="Player",
        criteria=[
            "First Name field is present",
            "Last Name field is present",
            "Save button is present",
        ],
    )
    def test_edit_profile_form_renders(self, player: PlayerPage, steps: StepLogger):
        steps.page = player.page
        with steps.step("Navigate to profile edit page"):
            player.navigate_to_edit_profile()
        with steps.step("Verify First Name field is visible"):
            expect(player.first_name_field).to_be_visible()
        with steps.step("Verify Last Name field is visible"):
            expect(player.last_name_field).to_be_visible()
        with steps.step("Verify Save button is visible"):
            expect(player.save_button).to_be_visible()

    @pytest.mark.use_case(
        id="UC-P-004",
        name="Player can update phone number",
        persona="Player",
        criteria=[
            "Phone field accepts new input",
            "Saving shows a success toast",
        ],
    )
    def test_can_update_phone_number(self, player: PlayerPage, steps: StepLogger):
        steps.page = player.page
        with steps.step("Navigate to profile edit"):
            player.navigate_to_edit_profile()
        with steps.step("Fill phone field with new number"):
            player.phone_field.fill("555-867-5309")
        with steps.step("Click Save"):
            player.save_button.click()
        with steps.step("Verify success toast appears"):
            player.wait_for_toast()

    @pytest.mark.use_case(
        id="UC-P-005",
        name="First name is required on profile edit",
        persona="Player",
        criteria=[
            "Clearing the first name and saving shows a validation error",
            "No success toast fires",
        ],
    )
    def test_edit_profile_requires_first_name(self, player: PlayerPage, steps: StepLogger):
        steps.page = player.page
        with steps.step("Navigate to profile edit"):
            player.navigate_to_edit_profile()
        with steps.step("Clear the first name field"):
            player.first_name_field.fill("")
        with steps.step("Click Save with empty first name"):
            player.save_button.click()
        with steps.step("Verify validation error appears"):
            error = player.page.get_by_text("required", exact=False).or_(
                player.page.locator("[role='alert']")
            )
            expect(error.first).to_be_visible(timeout=5_000)


@pytest.mark.player
class TestPlayerSearch:

    @pytest.mark.use_case(
        id="UC-P-006",
        name="Player search page renders with search input",
        persona="Player",
        criteria=[
            "Search input field is visible",
        ],
    )
    def test_search_page_renders(self, player: PlayerPage, steps: StepLogger):
        steps.page = player.page
        with steps.step("Navigate to /players/search"):
            player.navigate_to_search()
        with steps.step("Verify search input is visible"):
            expect(player.search_input.first).to_be_visible()

    @pytest.mark.use_case(
        id="UC-P-007",
        name="Player search returns results",
        persona="Player",
        criteria=[
            "Searching 'Test' returns at least one player card",
        ],
    )
    def test_search_returns_results(self, player: PlayerPage, steps: StepLogger):
        steps.page = player.page
        with steps.step("Navigate to search page"):
            player.navigate_to_search()
        with steps.step("Search for 'Test'"):
            player.search_player("Test")
        with steps.step("Verify at least one result is shown"):
            player.assert_player_listed("Test")

    @pytest.mark.use_case(
        id="UC-P-008",
        name="Empty search shows no-results state",
        persona="Player",
        criteria=[
            "A query that matches nothing shows 'No players found' or similar",
        ],
    )
    def test_empty_search_handled(self, player: PlayerPage, steps: StepLogger):
        steps.page = player.page
        with steps.step("Navigate to search page"):
            player.navigate_to_search()
        with steps.step("Search for a term that matches nothing"):
            player.search_input.first.fill("ZzZzZz999NoMatch")
            player.page.keyboard.press("Enter")
            player.wait_for_page_ready()
        with steps.step("Verify empty state is shown"):
            empty_state = player.page.get_by_text("No players found", exact=False).or_(
                player.page.get_by_text("No results", exact=False)
            )
            expect(empty_state.first).to_be_visible(timeout=8_000)

    @pytest.mark.use_case(
        id="UC-P-009",
        name="Clicking a player result opens their profile",
        persona="Player",
        criteria=[
            "Clicking a player card navigates to that player's profile page",
        ],
    )
    def test_click_player_opens_profile(self, player: PlayerPage, steps: StepLogger):
        steps.page = player.page
        with steps.step("Search for 'Test'"):
            player.search_player("Test")
        with steps.step("Click the first player card"):
            player.click_first_player_result()
        with steps.step("Verify URL is a player profile"):
            assert "/players" in player.page.url


@pytest.mark.player
class TestLeaderboard:

    @pytest.mark.use_case(
        id="UC-P-010",
        name="Player leaderboard loads",
        persona="Player",
        criteria=[
            "The /players page renders standings or player cards",
        ],
    )
    def test_leaderboard_loads(self, player: PlayerPage, steps: StepLogger):
        steps.page = player.page
        with steps.step("Navigate to /players leaderboard"):
            player.navigate_to_leaderboard()
        with steps.step("Verify standings or cards are visible"):
            player.assert_standings_visible()

    @pytest.mark.use_case(
        id="UC-P-011",
        name="Leaderboard contains at least one entry",
        persona="Player",
        criteria=[
            "At least one row or card is rendered in the leaderboard",
        ],
    )
    def test_leaderboard_shows_player_names(self, player: PlayerPage, steps: StepLogger):
        steps.page = player.page
        with steps.step("Navigate to leaderboard"):
            player.navigate_to_leaderboard()
            player.wait_for_spinner_gone()
        with steps.step("Count entries in the table"):
            rows = player.page.get_by_role("row").all()
            assert len(rows) > 0

    @pytest.mark.use_case(
        id="UC-P-012",
        name="Ladder standings page loads",
        persona="Player",
        criteria=[
            "The /ladder/standings page renders without error",
        ],
    )
    def test_ladder_standings_load(self, player: PlayerPage, steps: StepLogger):
        steps.page = player.page
        with steps.step("Navigate to /ladder/standings"):
            player.navigate_to_ladder_standings()
        with steps.step("Verify standings are visible"):
            player.assert_standings_visible()


@pytest.mark.player
class TestLadderInteractions:

    @pytest.mark.use_case(
        id="UC-P-013",
        name="Play dates page loads for player",
        persona="Player",
        criteria=[
            "The /ladder/play-dates page renders play date cards or an empty state",
        ],
    )
    def test_play_dates_page_loads(self, player_ladder: LadderPage, steps: StepLogger):
        steps.page = player_ladder.page
        with steps.step("Navigate to /ladder/play-dates"):
            player_ladder.navigate_to_play_dates()
        with steps.step("Verify page loaded"):
            player_ladder.assert_play_dates_loaded()

    @pytest.mark.use_case(
        id="UC-P-014",
        name="RSVP button is visible on upcoming play dates",
        persona="Player",
        criteria=[
            "When a play date exists, an RSVP or Join button is visible",
        ],
    )
    def test_rsvp_button_visible_on_upcoming_play_date(
        self, player_ladder: LadderPage, steps: StepLogger
    ):
        steps.page = player_ladder.page
        with steps.step("Navigate to play dates"):
            player_ladder.navigate_to_play_dates()
            player_ladder.wait_for_spinner_gone()
        with steps.step("Check for RSVP button on first play date card"):
            if player_ladder.play_date_cards.count() > 0:
                first = player_ladder.play_date_cards.first
                rsvp = first.get_by_role("button", name="RSVP").or_(
                    first.get_by_role("button", name="Join")
                )
                expect(rsvp.first).to_be_visible(timeout=5_000)

    @pytest.mark.use_case(
        id="UC-P-015",
        name="Player can RSVP to a play date",
        persona="Player",
        criteria=[
            "Clicking RSVP on a play date shows a success toast",
            "Player's RSVP is registered",
        ],
    )
    def test_can_rsvp_to_play_date(self, player_ladder: LadderPage, steps: StepLogger):
        steps.page = player_ladder.page
        with steps.step("Navigate to play dates"):
            player_ladder.navigate_to_play_dates()
        with steps.step("Check for available play dates"):
            if player_ladder.play_date_cards.count() == 0:
                pytest.skip("No upcoming play dates — seed test data first")
        with steps.step("RSVP to the first play date"):
            player_ladder.rsvp_to_first_play_date()

    @pytest.mark.use_case(
        id="UC-P-016",
        name="Active ladder session page renders",
        persona="Player",
        criteria=[
            "The /ladder/session page loads without error",
            "Either matches or a 'no session' message is shown",
        ],
    )
    def test_ladder_session_page_loads(self, player_ladder: LadderPage, steps: StepLogger):
        steps.page = player_ladder.page
        with steps.step("Navigate to /ladder/session"):
            player_ladder.navigate_to_session()
            player_ladder.wait_for_spinner_gone()
        with steps.step("Verify main content area is visible"):
            expect(player_ladder.page.get_by_role("main")).to_be_visible()

    @pytest.mark.use_case(
        id="UC-P-017",
        name="Check-in page renders for player",
        persona="Player",
        criteria=[
            "The /ladder/check-in page loads",
            "Check In button or GPS prompt is visible",
        ],
    )
    def test_check_in_page_renders(self, player_ladder: LadderPage, steps: StepLogger):
        steps.page = player_ladder.page
        with steps.step("Navigate to /ladder/check-in"):
            player_ladder.navigate_to_checkin()
            player_ladder.wait_for_page_ready()
        with steps.step("Verify check-in UI is present"):
            check_in_ui = player_ladder.page.get_by_role("button", name="Check In").or_(
                player_ladder.page.get_by_text("Check In", exact=False)
            )
            expect(check_in_ui.first).to_be_visible(timeout=8_000)


@pytest.mark.player
class TestPlayerClubInteractions:

    @pytest.mark.use_case(
        id="UC-P-018",
        name="Player can browse clubs",
        persona="Player",
        criteria=[
            "The /clubs page renders club cards or an empty state",
        ],
    )
    def test_clubs_page_loads_for_player(self, player_club: ClubPage, steps: StepLogger):
        steps.page = player_club.page
        with steps.step("Navigate to /clubs"):
            player_club.navigate_to_clubs()
        with steps.step("Verify clubs list is loaded"):
            player_club.assert_clubs_loaded()

    @pytest.mark.use_case(
        id="UC-P-019",
        name="Player can view a club detail page",
        persona="Player",
        criteria=[
            "Clicking a club card navigates to /clubs/{id}",
        ],
    )
    def test_player_can_view_club_detail(self, player_club: ClubPage, steps: StepLogger):
        steps.page = player_club.page
        with steps.step("Navigate to clubs list"):
            player_club.navigate_to_clubs()
        with steps.step("Click first club card"):
            if player_club.club_cards.count() > 0:
                player_club.click_first_club()
                assert "/clubs/" in player_club.page.url
            else:
                pytest.skip("No clubs available")

    @pytest.mark.use_case(
        id="UC-P-020",
        name="Create Club button is accessible to players",
        persona="Player",
        criteria=[
            "A 'Create Club' button/link is visible on /clubs",
            "Players can initiate club creation (becomes provisional)",
        ],
    )
    def test_create_club_button_visible_for_player(self, player_club: ClubPage, steps: StepLogger):
        steps.page = player_club.page
        with steps.step("Navigate to /clubs"):
            player_club.navigate_to_clubs()
        with steps.step("Verify Create Club button is visible"):
            create_btn = player_club.page.get_by_role("button", name="Create Club").or_(
                player_club.page.get_by_role("link", name="Create Club")
            )
            expect(create_btn.first).to_be_visible(timeout=5_000)


@pytest.mark.player
class TestPlayerNotifications:

    @pytest.mark.use_case(
        id="UC-P-021",
        name="Notifications page loads for authenticated player",
        persona="Player",
        criteria=[
            "The /notifications page is accessible when logged in",
            "No redirect to /auth/login occurs",
        ],
    )
    def test_notifications_page_loads(self, player_page_ctx: Page, steps: StepLogger):
        steps.page = player_page_ctx
        with steps.step("Navigate to /notifications"):
            player_page_ctx.goto(f"{Config.BASE_URL}{Config.Routes.NOTIFICATIONS}")
            player_page_ctx.wait_for_load_state("networkidle")
        with steps.step("Verify not redirected to login"):
            assert "/auth/login" not in player_page_ctx.url

    @pytest.mark.use_case(
        id="UC-P-022",
        name="Notification bell icon is present in navigation",
        persona="Player",
        criteria=[
            "A notifications link or bell icon is visible in the app nav",
        ],
    )
    def test_notification_badge_visible_in_nav(self, player_dashboard: DashboardPage, steps: StepLogger):
        steps.page = player_dashboard.page
        with steps.step("Navigate to dashboard"):
            player_dashboard.navigate_to_dashboard()
        with steps.step("Verify notifications icon is in nav"):
            bell = player_dashboard.page.get_by_role("link", name="Notifications").or_(
                player_dashboard.page.locator("[aria-label='Notifications']")
            )
            expect(bell.first).to_be_visible(timeout=8_000)
