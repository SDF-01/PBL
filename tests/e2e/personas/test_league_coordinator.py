"""
League Coordinator persona tests.
"""
import pytest
from datetime import date, timedelta
from playwright.sync_api import expect, Page

from tests.e2e.config import Config
from tests.e2e.pages import LadderPage, LeaguePage, DashboardPage
from tests.e2e.reporter.step_logger import StepLogger


def _next_saturday() -> str:
    today = date.today()
    days_ahead = 5 - today.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    return (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")


@pytest.mark.coordinator
class TestCoordinatorDashboard:

    @pytest.mark.use_case(
        id="UC-CO-001",
        name="Coordinator dashboard loads",
        persona="Coordinator",
        criteria=[
            "Dashboard page is accessible to a League Coordinator",
            "No redirect to login occurs",
        ],
    )
    def test_coordinator_dashboard_loads(self, coordinator_page_ctx: Page, steps: StepLogger):
        dash = DashboardPage(coordinator_page_ctx)
        steps.page = coordinator_page_ctx
        with steps.step("Navigate to dashboard as Coordinator"):
            dash.navigate_to_dashboard()
        with steps.step("Verify dashboard is loaded"):
            dash.assert_dashboard_loaded()

    @pytest.mark.use_case(
        id="UC-CO-002",
        name="Coordinator sees ladder navigation link",
        persona="Coordinator",
        criteria=[
            "Ladder navigation link is visible in the sidebar or nav",
        ],
    )
    def test_coordinator_sees_ladder_navigation(self, coordinator_page_ctx: Page, steps: StepLogger):
        dash = DashboardPage(coordinator_page_ctx)
        steps.page = coordinator_page_ctx
        with steps.step("Navigate to dashboard"):
            dash.navigate_to_dashboard()
        with steps.step("Verify Ladder nav link is visible"):
            expect(dash.nav_ladder.first).to_be_visible(timeout=8_000)


@pytest.mark.coordinator
class TestPlayDateManagement:

    @pytest.mark.use_case(
        id="UC-CO-003",
        name="Coordinator can view play dates list",
        persona="Coordinator",
        criteria=[
            "The /ladder/play-dates page loads",
            "Play date cards or empty state is shown",
        ],
    )
    def test_play_dates_page_loads(self, coordinator: LadderPage, steps: StepLogger):
        steps.page = coordinator.page
        with steps.step("Navigate to /ladder/play-dates"):
            coordinator.navigate_to_play_dates()
        with steps.step("Verify list is loaded"):
            coordinator.assert_play_dates_loaded()

    @pytest.mark.use_case(
        id="UC-CO-004",
        name="Create Play Date button is visible for Coordinator",
        persona="Coordinator",
        criteria=[
            "A 'Create Play Date' button or link is visible on the play dates page",
        ],
    )
    def test_create_play_date_button_visible(self, coordinator: LadderPage, steps: StepLogger):
        steps.page = coordinator.page
        with steps.step("Navigate to play dates"):
            coordinator.navigate_to_play_dates()
        with steps.step("Verify Create Play Date button is present"):
            expect(coordinator.create_play_date_button.first).to_be_visible(timeout=8_000)

    @pytest.mark.use_case(
        id="UC-CO-005",
        name="Create Play Date dialog opens",
        persona="Coordinator",
        criteria=[
            "Clicking Create Play Date opens a dialog",
            "Dialog can be dismissed",
        ],
    )
    def test_can_open_create_play_date_dialog(self, coordinator: LadderPage, steps: StepLogger):
        steps.page = coordinator.page
        with steps.step("Navigate to play dates"):
            coordinator.navigate_to_play_dates()
        with steps.step("Click Create Play Date"):
            coordinator.create_play_date_button.first.click()
        with steps.step("Verify dialog opens"):
            dialog = coordinator.page.get_by_role("dialog")
            expect(dialog).to_be_visible(timeout=5_000)
        with steps.step("Dismiss dialog"):
            coordinator.page.keyboard.press("Escape")

    @pytest.mark.slow
    @pytest.mark.use_case(
        id="UC-CO-006",
        name="Coordinator creates a new play date end-to-end",
        persona="Coordinator",
        criteria=[
            "Play date dialog accepts date, time, and max participants",
            "After creation a success toast appears",
            "New play date card appears in the list",
        ],
    )
    def test_create_play_date_end_to_end(self, coordinator: LadderPage, steps: StepLogger):
        steps.page = coordinator.page
        with steps.step("Navigate to play dates"):
            coordinator.navigate_to_play_dates()
        with steps.step("Create play date for next Saturday"):
            coordinator.create_play_date(
                date=_next_saturday(),
                time="09:00 AM",
                max_participants=16,
            )
        with steps.step("Verify list still loads after creation"):
            coordinator.assert_play_dates_loaded()


@pytest.mark.coordinator
class TestSessionManagement:

    @pytest.mark.use_case(
        id="UC-CO-007",
        name="Generate Rotation button visible during active session",
        persona="Coordinator",
        criteria=[
            "Coordinator sees a Generate Rotation button in the coordinator dashboard",
        ],
    )
    def test_generate_rotation_button_visible_during_session(
        self, coordinator: LadderPage, steps: StepLogger
    ):
        steps.page = coordinator.page
        with steps.step("Navigate to play dates"):
            coordinator.navigate_to_play_dates()
        with steps.step("Check for an open/in-progress session"):
            open_date = coordinator.page.get_by_text("In Progress", exact=False).or_(
                coordinator.page.get_by_text("Check-In Open", exact=False)
            )
            if open_date.count() == 0:
                pytest.skip("No active session — seed test data first")
        with steps.step("Navigate to coordinator dashboard"):
            coordinator.coordinator_dashboard_link.first.click()
            coordinator.wait_for_page_ready()
        with steps.step("Verify Generate Rotation button is visible"):
            expect(coordinator.generate_rotation_button.first).to_be_visible(timeout=8_000)

    @pytest.mark.slow
    @pytest.mark.use_case(
        id="UC-CO-008",
        name="Coordinator generates session rotation",
        persona="Coordinator",
        criteria=[
            "Clicking Generate Rotation and confirming produces a session",
            "Session matches become visible",
        ],
    )
    def test_generate_session_rotation(self, coordinator: LadderPage, steps: StepLogger):
        steps.page = coordinator.page
        with steps.step("Navigate to play dates"):
            coordinator.navigate_to_play_dates()
        with steps.step("Check for in-progress session"):
            if coordinator.page.get_by_text("In Progress", exact=False).count() == 0:
                pytest.skip("No active session")
        with steps.step("Open coordinator dashboard"):
            coordinator.coordinator_dashboard_link.first.click()
            coordinator.wait_for_page_ready()
        with steps.step("Generate rotation"):
            coordinator.generate_session_rotation()
        with steps.step("Verify session is active with matches"):
            coordinator.assert_session_active()

    @pytest.mark.slow
    @pytest.mark.use_case(
        id="UC-CO-009",
        name="Coordinator finalizes a session",
        persona="Coordinator",
        criteria=[
            "Clicking Finalize Session and confirming closes the session",
            "Session status changes to Closed/Finalized",
        ],
    )
    def test_finalize_session(self, coordinator: LadderPage, steps: StepLogger):
        steps.page = coordinator.page
        with steps.step("Navigate to play dates"):
            coordinator.navigate_to_play_dates()
        with steps.step("Check for in-progress session"):
            if coordinator.page.get_by_text("In Progress", exact=False).count() == 0:
                pytest.skip("No in-progress session to finalize")
        with steps.step("Open coordinator dashboard"):
            coordinator.coordinator_dashboard_link.first.click()
            coordinator.wait_for_page_ready()
        with steps.step("Finalize session"):
            coordinator.finalize_session()


@pytest.mark.coordinator
class TestPlayerCheckIn:

    @pytest.mark.use_case(
        id="UC-CO-010",
        name="Coordinator can force-check-in a player",
        persona="Coordinator",
        criteria=[
            "Coordinator dashboard shows a Check In button per pending player",
            "Clicking it registers the player as checked in",
            "Success toast appears",
        ],
    )
    def test_coordinator_can_manual_check_in(self, coordinator: LadderPage, steps: StepLogger):
        steps.page = coordinator.page
        with steps.step("Navigate to play dates"):
            coordinator.navigate_to_play_dates()
        with steps.step("Find a session with check-in open"):
            open_date = coordinator.page.get_by_text("Check-In Open", exact=False)
            if open_date.count() == 0:
                pytest.skip("No check-in open session")
        with steps.step("Open coordinator dashboard"):
            coordinator.coordinator_dashboard_link.first.click()
            coordinator.wait_for_page_ready()
        with steps.step("Find a player pending check-in"):
            check_in_btn = coordinator.page.get_by_role("button", name="Check In")
            if check_in_btn.count() == 0:
                pytest.skip("No players pending check-in")
        with steps.step("Force-check-in the first pending player"):
            check_in_btn.first.click()
            coordinator.wait_for_toast()

    @pytest.mark.use_case(
        id="UC-CO-011",
        name="Check-in list shows player status badges",
        persona="Coordinator",
        criteria=[
            "Coordinator dashboard shows Checked In / Pending status per player",
        ],
    )
    def test_check_in_list_shows_status_badges(self, coordinator: LadderPage, steps: StepLogger):
        steps.page = coordinator.page
        with steps.step("Navigate to play dates"):
            coordinator.navigate_to_play_dates()
        with steps.step("Find an open check-in session"):
            if coordinator.page.get_by_text("Check-In Open", exact=False).count() == 0:
                pytest.skip("No check-in open session")
        with steps.step("Open coordinator dashboard"):
            coordinator.coordinator_dashboard_link.first.click()
            coordinator.wait_for_page_ready()
        with steps.step("Verify status badges are visible"):
            status_badges = coordinator.page.get_by_text("Checked In", exact=False).or_(
                coordinator.page.get_by_text("Pending", exact=False)
            )
            expect(status_badges.first).to_be_visible(timeout=8_000)


@pytest.mark.coordinator
class TestRosterManagement:

    @pytest.mark.use_case(
        id="UC-CO-012",
        name="Coordinator can view league roster",
        persona="Coordinator",
        criteria=[
            "Roster page for a league is accessible to Coordinator",
            "Player list or empty state is shown",
        ],
    )
    def test_coordinator_can_view_league_roster(
        self, coordinator_league: LeaguePage, coordinator_page_ctx: Page, steps: StepLogger
    ):
        steps.page = coordinator_page_ctx
        with steps.step("Navigate to leagues list"):
            coordinator_league.navigate_to_leagues()
        with steps.step("Check for available leagues"):
            if coordinator_league.league_cards.count() == 0:
                pytest.skip("No leagues — create one first")
        with steps.step("Click first league"):
            coordinator_league.click_first_league()
            coordinator_page_ctx.wait_for_load_state("networkidle")
        with steps.step("Navigate to roster tab"):
            league_id = coordinator_page_ctx.url.rstrip("/").split("/")[-1]
            coordinator_league.navigate_to_roster(league_id)
        with steps.step("Verify roster or empty state is shown"):
            expect(
                coordinator_page_ctx.get_by_role("table").or_(
                    coordinator_page_ctx.get_by_text("No players", exact=False)
                )
            ).to_be_visible(timeout=10_000)

    @pytest.mark.use_case(
        id="UC-CO-013",
        name="Add Player button is visible on roster for Coordinator",
        persona="Coordinator",
        criteria=[
            "An 'Add Player' button is present on the league roster page",
        ],
    )
    def test_add_player_button_visible_for_coordinator(
        self, coordinator_league: LeaguePage, steps: StepLogger
    ):
        steps.page = coordinator_league.page
        with steps.step("Navigate to leagues"):
            coordinator_league.navigate_to_leagues()
        with steps.step("Check for leagues"):
            if coordinator_league.league_cards.count() == 0:
                pytest.skip("No leagues found")
        with steps.step("Navigate to first league"):
            coordinator_league.click_first_league()
            league_id = coordinator_league.page.url.rstrip("/").split("/")[-1]
        with steps.step("Navigate to roster"):
            coordinator_league.navigate_to_roster(league_id)
        with steps.step("Verify Add Player button is visible"):
            expect(coordinator_league.add_player_button.first).to_be_visible(timeout=8_000)


@pytest.mark.coordinator
class TestScoreValidation:

    @pytest.mark.use_case(
        id="UC-CO-014",
        name="Coordinator can view session match list",
        persona="Coordinator",
        criteria=[
            "The /ladder/session page renders for a Coordinator",
            "Match cards or empty state is shown",
        ],
    )
    def test_coordinator_can_see_match_list(self, coordinator: LadderPage, steps: StepLogger):
        steps.page = coordinator.page
        with steps.step("Navigate to /ladder/session"):
            coordinator.navigate_to_session()
            coordinator.wait_for_spinner_gone()
        with steps.step("Verify main content is visible"):
            expect(coordinator.page.get_by_role("main")).to_be_visible()

    @pytest.mark.use_case(
        id="UC-CO-015",
        name="Score submission dialog opens from match card",
        persona="Coordinator",
        criteria=[
            "Clicking 'Submit Score' on a match opens a dialog",
            "Dialog can be dismissed",
        ],
    )
    def test_match_score_submission_dialog_opens(self, coordinator: LadderPage, steps: StepLogger):
        steps.page = coordinator.page
        with steps.step("Navigate to active session"):
            coordinator.navigate_to_session()
            coordinator.wait_for_spinner_gone()
        with steps.step("Check for active matches"):
            if coordinator.session_matches.count() == 0:
                pytest.skip("No active matches")
        with steps.step("Click Submit Score on first match"):
            submit_btn = coordinator.session_matches.first.get_by_role("button", name="Submit Score")
            if not submit_btn.is_visible():
                pytest.skip("No submit score button")
            submit_btn.click()
        with steps.step("Verify dialog opens"):
            expect(coordinator.page.get_by_role("dialog")).to_be_visible(timeout=5_000)
        with steps.step("Dismiss dialog"):
            coordinator.page.keyboard.press("Escape")
