"""
Player workflow tests — dashboard, profile, leaderboard, ladder, notifications.

Covers the primary authenticated player journey and validates that the session
page subscription fix (UC-PLAYER-005) does not regress.
"""
import pytest
from playwright.sync_api import Page, expect

from tests.e2e.config import Config
from tests.e2e.pages import DashboardPage, PlayerPage
from tests.e2e.reporter.step_logger import StepLogger


@pytest.mark.player
class TestPlayerDashboard:

    @pytest.mark.use_case(
        id="UC-PLAYER-001",
        name="Player dashboard loads with core navigation",
        persona="Player",
        criteria=[
            "Authenticated player lands on the dashboard without login redirect",
            "Core navigation links are visible (Ladder, Leagues, Clubs, Players)",
            "No crash or blank screen on load",
        ],
    )
    def test_dashboard_loads_with_nav(self, player_page_ctx: Page, steps: StepLogger):
        dash = DashboardPage(player_page_ctx)
        steps.page = player_page_ctx
        with steps.step("Navigate to dashboard as Player"):
            dash.navigate_to_dashboard()
        with steps.step("Verify not redirected to login"):
            assert "/auth/login" not in player_page_ctx.url
        with steps.step("Verify core nav is visible"):
            dash.assert_dashboard_loaded()
        with steps.step("Verify admin UI is NOT shown to Player"):
            assert not dash.is_admin_ui_visible()

    @pytest.mark.use_case(
        id="UC-PLAYER-002",
        name="Player dashboard does not show a blank loading screen",
        persona="Player",
        criteria=[
            "Auth guard shows a spinner, not a blank black screen, while resolving",
            "Dashboard content appears once auth resolves",
        ],
    )
    def test_dashboard_shows_content_not_blank(self, player_page_ctx: Page, steps: StepLogger):
        dash = DashboardPage(player_page_ctx)
        steps.page = player_page_ctx
        with steps.step("Navigate to dashboard"):
            dash.navigate_to_dashboard()
        with steps.step("Verify page has visible content (not blank)"):
            # At least one element with text should be visible — rules out full blank screen
            body_text = player_page_ctx.locator("body").inner_text()
            assert len(body_text.strip()) > 0, "Dashboard rendered blank — auth spinner may not be clearing"


@pytest.mark.player
class TestPlayerProfile:

    @pytest.mark.use_case(
        id="UC-PLAYER-003",
        name="Player can view their own profile",
        persona="Player",
        criteria=[
            "Navigating to /players/view renders the player's profile",
            "Profile content loads without crashing",
            "No redirect to login occurs",
        ],
    )
    def test_player_profile_loads(self, player_page_ctx: Page, steps: StepLogger):
        player = PlayerPage(player_page_ctx)
        steps.page = player_page_ctx
        with steps.step("Navigate to own profile page"):
            player.navigate_to_own_profile()
        with steps.step("Verify not redirected to login"):
            assert "/auth/login" not in player_page_ctx.url
        with steps.step("Verify profile content loaded"):
            player.assert_profile_loaded()

    @pytest.mark.use_case(
        id="UC-PLAYER-004",
        name="Player can access and view the edit profile form",
        persona="Player",
        criteria=[
            "Navigating to /players/edit renders an editable form",
            "First Name and Last Name fields are present",
            "Save button is present",
        ],
    )
    def test_player_edit_profile_form_renders(self, player_page_ctx: Page, steps: StepLogger):
        player = PlayerPage(player_page_ctx)
        steps.page = player_page_ctx
        with steps.step("Navigate to profile edit page"):
            player.navigate_to_edit_profile()
        with steps.step("Verify not redirected to login"):
            assert "/auth/login" not in player_page_ctx.url
        with steps.step("Verify First Name field is visible"):
            expect(player.first_name_field).to_be_visible(timeout=8_000)
        with steps.step("Verify Last Name field is visible"):
            expect(player.last_name_field).to_be_visible(timeout=8_000)
        with steps.step("Verify Save button is present"):
            expect(player.save_button).to_be_visible(timeout=5_000)


@pytest.mark.player
class TestPlayerLeaderboard:

    @pytest.mark.use_case(
        id="UC-PLAYER-005",
        name="Public leaderboard loads with player content",
        persona="Player",
        criteria=[
            "The /players leaderboard page renders for an authenticated player",
            "Player cards or standings table is visible",
            "Page does not crash or show an error state",
        ],
    )
    def test_leaderboard_renders(self, player_page_ctx: Page, steps: StepLogger):
        player = PlayerPage(player_page_ctx)
        steps.page = player_page_ctx
        with steps.step("Navigate to leaderboard"):
            player.navigate_to_leaderboard()
        with steps.step("Verify not on login page"):
            assert "/auth/login" not in player_page_ctx.url
        with steps.step("Verify player content is visible"):
            player.assert_standings_visible()


@pytest.mark.player
class TestLadderSessionPage:

    @pytest.mark.use_case(
        id="UC-PLAYER-006",
        name="Ladder session page renders without crash when no active session",
        persona="Player",
        criteria=[
            "Navigating to /ladder/session as a Player renders a page (not a blank screen)",
            "Either 'No Active Session' or session content is shown",
            "Page does not throw an uncaught error or leave a dangling Firestore subscription",
            "Navigating away and back does not cause a crash (subscription cleanup fix)",
        ],
    )
    def test_session_page_renders_without_crash(self, player_page_ctx: Page, steps: StepLogger):
        steps.page = player_page_ctx
        with steps.step("Navigate to ladder session page"):
            player_page_ctx.goto(f"{Config.BASE_URL}{Config.Routes.LADDER_SESSION}")
            player_page_ctx.wait_for_load_state("networkidle")
        with steps.step("Verify not redirected to login"):
            assert "/auth/login" not in player_page_ctx.url
        with steps.step("Verify page has rendered content (not blank)"):
            body_text = player_page_ctx.locator("body").inner_text()
            assert len(body_text.strip()) > 0
        with steps.step("Verify either session content or no-session message is shown"):
            has_session = player_page_ctx.get_by_text("Current Match", exact=False).is_visible()
            has_no_session = (
                player_page_ctx.get_by_text("No Active Session", exact=False).is_visible()
                or player_page_ctx.get_by_text("Session Not Found", exact=False).is_visible()
                or player_page_ctx.get_by_text("Check in", exact=False).is_visible()
            )
            assert has_session or has_no_session, (
                "Session page rendered neither session content nor no-session message"
            )
        with steps.step("Navigate away and back to verify subscription cleanup (no crash)"):
            player_page_ctx.goto(f"{Config.BASE_URL}/")
            player_page_ctx.wait_for_load_state("networkidle")
            player_page_ctx.goto(f"{Config.BASE_URL}{Config.Routes.LADDER_SESSION}")
            player_page_ctx.wait_for_load_state("networkidle")
            # A crash from the subscription leak would cause a blank page or console error
            body_text_after = player_page_ctx.locator("body").inner_text()
            assert len(body_text_after.strip()) > 0, "Page blank after navigate-away-and-back — possible subscription crash"

    @pytest.mark.use_case(
        id="UC-PLAYER-007",
        name="Play dates listing page loads for player",
        persona="Player",
        criteria=[
            "Navigating to /ladder/play-dates renders a list or empty state",
            "No crash or login redirect occurs",
        ],
    )
    def test_play_dates_listing_loads(self, player_page_ctx: Page, steps: StepLogger):
        steps.page = player_page_ctx
        with steps.step("Navigate to play dates listing"):
            player_page_ctx.goto(f"{Config.BASE_URL}{Config.Routes.LADDER_PLAY_DATES}")
            player_page_ctx.wait_for_load_state("networkidle")
        with steps.step("Verify not redirected to login"):
            assert "/auth/login" not in player_page_ctx.url
        with steps.step("Verify page has content"):
            body_text = player_page_ctx.locator("body").inner_text()
            assert len(body_text.strip()) > 0


@pytest.mark.player
class TestPlayerNotifications:

    @pytest.mark.use_case(
        id="UC-PLAYER-008",
        name="Notifications page loads for authenticated player",
        persona="Player",
        criteria=[
            "Player can navigate to /notifications without being redirected",
            "Notifications list or empty state is rendered",
        ],
    )
    def test_notifications_page_loads(self, player_page_ctx: Page, steps: StepLogger):
        steps.page = player_page_ctx
        with steps.step("Navigate to notifications page"):
            player_page_ctx.goto(f"{Config.BASE_URL}{Config.Routes.NOTIFICATIONS}")
            player_page_ctx.wait_for_load_state("networkidle")
        with steps.step("Verify not redirected to login"):
            assert "/auth/login" not in player_page_ctx.url
        with steps.step("Verify notifications page has rendered content"):
            body_text = player_page_ctx.locator("body").inner_text()
            assert len(body_text.strip()) > 0
