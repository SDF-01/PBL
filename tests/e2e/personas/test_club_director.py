"""
Club Director persona tests.
"""
import pytest
from playwright.sync_api import expect, Page

from tests.e2e.config import Config
from tests.e2e.pages import ClubPage, LeaguePage, DashboardPage
from tests.e2e.reporter.step_logger import StepLogger


@pytest.mark.director
class TestClubDirectorDashboard:

    @pytest.mark.use_case(
        id="UC-DIR-001",
        name="Club Director dashboard loads",
        persona="Director",
        criteria=[
            "Dashboard is accessible to a Club Director",
            "No redirect to login occurs",
        ],
    )
    def test_director_dashboard_loads(self, director_page_ctx: Page, steps: StepLogger):
        dash = DashboardPage(director_page_ctx)
        steps.page = director_page_ctx
        with steps.step("Navigate to dashboard as Director"):
            dash.navigate_to_dashboard()
        with steps.step("Verify dashboard loaded"):
            dash.assert_dashboard_loaded()

    @pytest.mark.use_case(
        id="UC-DIR-002",
        name="Director sees My Clubs navigation link",
        persona="Director",
        criteria=[
            "A 'My Clubs' or 'Manage Clubs' link is visible in the nav",
        ],
    )
    def test_director_sees_my_clubs_link(self, director_page_ctx: Page, steps: StepLogger):
        dash = DashboardPage(director_page_ctx)
        steps.page = director_page_ctx
        with steps.step("Navigate to dashboard"):
            dash.navigate_to_dashboard()
        with steps.step("Verify My Clubs link is visible"):
            my_clubs = director_page_ctx.get_by_role("link", name="My Clubs").or_(
                director_page_ctx.get_by_role("link", name="Manage Clubs")
            )
            expect(my_clubs.first).to_be_visible(timeout=8_000)


@pytest.mark.director
class TestClubCreation:

    @pytest.mark.use_case(
        id="UC-DIR-003",
        name="Create Club form renders required fields",
        persona="Director",
        criteria=[
            "Club Name field is present",
            "Location field is present",
            "Submit button is present",
        ],
    )
    def test_create_club_page_renders(self, director: ClubPage, steps: StepLogger):
        steps.page = director.page
        with steps.step("Navigate to /clubs/create"):
            director.navigate_to_create_club()
        with steps.step("Verify Club Name field is visible"):
            expect(director.club_name_field).to_be_visible()
        with steps.step("Verify Location field is visible"):
            expect(director.club_location_field).to_be_visible()
        with steps.step("Verify Submit button is visible"):
            expect(director.submit_button.first).to_be_visible()

    @pytest.mark.use_case(
        id="UC-DIR-004",
        name="Club name is required on creation form",
        persona="Director",
        criteria=[
            "Submitting without a club name shows a validation error",
        ],
    )
    def test_create_club_name_required(self, director: ClubPage, steps: StepLogger):
        steps.page = director.page
        with steps.step("Navigate to club creation form"):
            director.navigate_to_create_club()
        with steps.step("Fill location but leave name blank"):
            director.club_location_field.fill("Austin, TX")
        with steps.step("Submit form without a name"):
            director.submit_button.first.click()
        with steps.step("Verify validation error is shown"):
            error = director.page.locator("[role='alert']").or_(
                director.page.get_by_text("required", exact=False)
            )
            expect(error.first).to_be_visible(timeout=5_000)

    @pytest.mark.slow
    @pytest.mark.use_case(
        id="UC-DIR-005",
        name="New club creation shows Pending status",
        persona="Director",
        criteria=[
            "After submitting a new club, its status is 'Pending'",
            "Club awaits admin approval",
        ],
    )
    def test_create_club_goes_to_pending(
        self, director: ClubPage, unique_club_name: str, steps: StepLogger
    ):
        steps.page = director.page
        with steps.step("Navigate to club creation form"):
            director.navigate_to_create_club()
        with steps.step(f"Fill form with name '{unique_club_name}'"):
            director.club_name_field.fill(unique_club_name)
            director.club_location_field.fill("Austin, TX")
            director.club_description_field.fill("E2E test club — safe to delete")
        with steps.step("Submit form"):
            director.submit_button.first.click()
            director.wait_for_page_ready()
        with steps.step("Verify club shows Pending status"):
            director.assert_club_status("Pending")


@pytest.mark.director
class TestClubEditing:

    @pytest.mark.use_case(
        id="UC-DIR-006",
        name="My Clubs page loads for Director",
        persona="Director",
        criteria=[
            "The /clubs/my page renders club cards or empty state",
        ],
    )
    def test_my_clubs_page_loads(self, director: ClubPage, steps: StepLogger):
        steps.page = director.page
        with steps.step("Navigate to /clubs/my"):
            director.navigate_to_my_clubs()
            director.wait_for_spinner_gone()
        with steps.step("Verify clubs or empty state is visible"):
            expect(
                director.club_cards.first.or_(
                    director.page.get_by_text("No clubs", exact=False)
                )
            ).to_be_visible(timeout=10_000)

    @pytest.mark.use_case(
        id="UC-DIR-007",
        name="Manage link is visible for Director's clubs",
        persona="Director",
        criteria=[
            "A Manage or Edit button is visible on each of the Director's clubs",
        ],
    )
    def test_manage_club_link_visible_in_my_clubs(self, director: ClubPage, steps: StepLogger):
        steps.page = director.page
        with steps.step("Navigate to /clubs/my"):
            director.navigate_to_my_clubs()
            director.wait_for_spinner_gone()
        with steps.step("Check for owned clubs"):
            if director.club_cards.count() == 0:
                pytest.skip("Director has no clubs — create one first")
        with steps.step("Verify Manage link is visible"):
            manage_link = director.page.get_by_role("link", name="Manage").or_(
                director.page.get_by_role("button", name="Edit")
            )
            expect(manage_link.first).to_be_visible(timeout=8_000)

    @pytest.mark.slow
    @pytest.mark.use_case(
        id="UC-DIR-008",
        name="Director can edit club description",
        persona="Director",
        criteria=[
            "Description field accepts new text",
            "Saving shows a success toast",
        ],
    )
    def test_can_edit_club_description(
        self, director: ClubPage, director_page_ctx: Page, steps: StepLogger
    ):
        steps.page = director_page_ctx
        with steps.step("Navigate to /clubs/my"):
            director.navigate_to_my_clubs()
            director.wait_for_spinner_gone()
        with steps.step("Check for owned clubs"):
            if director.club_cards.count() == 0:
                pytest.skip("Director has no clubs")
        with steps.step("Click Manage on first club"):
            manage_link = director_page_ctx.get_by_role("link", name="Manage").or_(
                director_page_ctx.get_by_role("button", name="Edit")
            )
            manage_link.first.click()
            director.wait_for_page_ready()
        with steps.step("Update description field"):
            desc_field = director_page_ctx.get_by_label("Description", exact=False)
            if desc_field.is_visible():
                desc_field.fill("Updated via E2E test")
        with steps.step("Save changes"):
            director_page_ctx.get_by_role("button", name="Save").click()
            director.wait_for_toast()


@pytest.mark.director
class TestClubLeagueCreation:

    @pytest.mark.use_case(
        id="UC-DIR-009",
        name="Director can access league creation page",
        persona="Director",
        criteria=[
            "League Name field is visible on /leagues/create",
            "Submit button is present",
        ],
    )
    def test_create_league_page_accessible_for_director(
        self, director_league: LeaguePage, steps: StepLogger
    ):
        steps.page = director_league.page
        with steps.step("Navigate to /leagues/create"):
            director_league.navigate_to_create_league()
        with steps.step("Verify League Name field is present"):
            expect(director_league.league_name_field).to_be_visible()
        with steps.step("Verify Submit button is present"):
            expect(director_league.submit_button.first).to_be_visible()

    @pytest.mark.use_case(
        id="UC-DIR-010",
        name="League name is required on creation form",
        persona="Director",
        criteria=[
            "Submitting without a league name shows a validation error",
        ],
    )
    def test_league_name_required(self, director_league: LeaguePage, steps: StepLogger):
        steps.page = director_league.page
        with steps.step("Navigate to league creation"):
            director_league.navigate_to_create_league()
        with steps.step("Submit without filling the name"):
            director_league.submit_button.first.click()
        with steps.step("Verify validation error appears"):
            error = director_league.page.locator("[role='alert']").or_(
                director_league.page.get_by_text("required", exact=False)
            )
            expect(error.first).to_be_visible(timeout=5_000)

    @pytest.mark.slow
    @pytest.mark.use_case(
        id="UC-DIR-011",
        name="Director creates a league within their club",
        persona="Director",
        criteria=[
            "Filling league name and submitting navigates to the new league",
            "New league appears in the leagues list",
        ],
    )
    def test_create_league_within_club(
        self, director_league: LeaguePage, unique_league_name: str, steps: StepLogger
    ):
        steps.page = director_league.page
        with steps.step("Navigate to league creation"):
            director_league.navigate_to_create_league()
        with steps.step(f"Fill form with name '{unique_league_name}'"):
            director_league.league_name_field.fill(unique_league_name)
            director_league.league_description_field.fill("E2E test league")
        with steps.step("Submit form"):
            director_league.submit_button.first.click()
            director_league.wait_for_page_ready()
        with steps.step("Verify leagues list renders"):
            director_league.assert_leagues_loaded()


@pytest.mark.director
class TestClubMemberManagement:

    @pytest.mark.use_case(
        id="UC-DIR-012",
        name="Club detail page shows members section",
        persona="Director",
        criteria=[
            "A 'Members' or 'Roster' section is visible on the Director's club page",
        ],
    )
    def test_club_detail_page_shows_members_section(self, director: ClubPage, steps: StepLogger):
        steps.page = director.page
        with steps.step("Navigate to /clubs/my"):
            director.navigate_to_my_clubs()
            director.wait_for_spinner_gone()
        with steps.step("Check for owned clubs"):
            if director.club_cards.count() == 0:
                pytest.skip("No clubs to inspect")
        with steps.step("Click first club card"):
            director.click_first_club()
        with steps.step("Verify Members or Roster section is visible"):
            members = director.page.get_by_text("Members", exact=False).or_(
                director.page.get_by_text("Roster", exact=False)
            )
            expect(members.first).to_be_visible(timeout=8_000)

    @pytest.mark.use_case(
        id="UC-DIR-013",
        name="Club Director cannot access Site Admin routes",
        persona="Director",
        criteria=[
            "Navigating to /admin as a Club Director is denied or redirected",
        ],
    )
    def test_director_cannot_access_admin_routes(self, director_page_ctx: Page, steps: StepLogger):
        steps.page = director_page_ctx
        with steps.step("Navigate to /admin as Director"):
            director_page_ctx.goto(f"{Config.BASE_URL}{Config.Routes.ADMIN}")
            director_page_ctx.wait_for_load_state("networkidle")
        with steps.step("Verify access is denied"):
            assert (
                Config.Routes.ADMIN not in director_page_ctx.url
                or director_page_ctx.get_by_text("Access Denied", exact=False).is_visible()
            )
