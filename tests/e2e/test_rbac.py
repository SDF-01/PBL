"""
Role-Based Access Control (RBAC) tests.
"""
import pytest
from playwright.sync_api import expect, Page

from tests.e2e.config import Config
from tests.e2e.pages import AdminPage, DashboardPage
from tests.e2e.reporter.step_logger import StepLogger


@pytest.mark.rbac
class TestAdminRouteProtection:

    @pytest.mark.use_case(
        id="UC-RBAC-001",
        name="Player cannot access admin hub",
        persona="RBAC",
        criteria=[
            "Navigating to /admin as a Player redirects or shows Access Denied",
            "Player does not see admin-only content",
        ],
    )
    def test_player_cannot_access_admin_hub(self, player_page_ctx: Page, steps: StepLogger):
        steps.page = player_page_ctx
        with steps.step("Navigate to /admin as Player"):
            player_page_ctx.goto(f"{Config.BASE_URL}{Config.Routes.ADMIN}")
            player_page_ctx.wait_for_load_state("networkidle")
        with steps.step("Verify access is denied"):
            assert (
                Config.Routes.ADMIN not in player_page_ctx.url
                or player_page_ctx.get_by_text("Access Denied", exact=False).is_visible()
                or player_page_ctx.get_by_text("Unauthorized", exact=False).is_visible()
            )

    @pytest.mark.use_case(
        id="UC-RBAC-002",
        name="Player cannot access admin club queue",
        persona="RBAC",
        criteria=[
            "Navigating to /admin/clubs as a Player is denied",
        ],
    )
    def test_player_cannot_access_admin_clubs(self, player_page_ctx: Page, steps: StepLogger):
        steps.page = player_page_ctx
        with steps.step("Navigate to /admin/clubs as Player"):
            player_page_ctx.goto(f"{Config.BASE_URL}{Config.Routes.ADMIN_CLUBS}")
            player_page_ctx.wait_for_load_state("networkidle")
        with steps.step("Verify Player is denied or redirected"):
            assert (
                Config.Routes.ADMIN_CLUBS not in player_page_ctx.url
                or player_page_ctx.get_by_text("Access Denied", exact=False).is_visible()
            )

    @pytest.mark.use_case(
        id="UC-RBAC-003",
        name="Player cannot access user management",
        persona="RBAC",
        criteria=[
            "Navigating to /admin/users as a Player is denied",
        ],
    )
    def test_player_cannot_access_user_management(self, player_page_ctx: Page, steps: StepLogger):
        steps.page = player_page_ctx
        with steps.step("Navigate to /admin/users as Player"):
            player_page_ctx.goto(f"{Config.BASE_URL}{Config.Routes.ADMIN_USERS}")
            player_page_ctx.wait_for_load_state("networkidle")
        with steps.step("Verify Player is denied"):
            assert (
                Config.Routes.ADMIN_USERS not in player_page_ctx.url
                or player_page_ctx.get_by_text("Access Denied", exact=False).is_visible()
            )

    @pytest.mark.use_case(
        id="UC-RBAC-004",
        name="Coordinator cannot access admin hub",
        persona="RBAC",
        criteria=[
            "A League Coordinator does not have Site Admin privileges",
            "Navigating to /admin is denied",
        ],
    )
    def test_coordinator_cannot_access_admin_hub(self, coordinator_page_ctx: Page, steps: StepLogger):
        steps.page = coordinator_page_ctx
        with steps.step("Navigate to /admin as Coordinator"):
            coordinator_page_ctx.goto(f"{Config.BASE_URL}{Config.Routes.ADMIN}")
            coordinator_page_ctx.wait_for_load_state("networkidle")
        with steps.step("Verify Coordinator is denied"):
            assert (
                Config.Routes.ADMIN not in coordinator_page_ctx.url
                or coordinator_page_ctx.get_by_text("Access Denied", exact=False).is_visible()
            )

    @pytest.mark.use_case(
        id="UC-RBAC-005",
        name="Site Admin can access admin hub",
        persona="RBAC",
        criteria=[
            "Site Admin navigates to /admin successfully",
            "Admin hub heading is visible",
        ],
    )
    def test_admin_can_access_admin_hub(self, admin_page_ctx: Page, steps: StepLogger):
        admin = AdminPage(admin_page_ctx)
        steps.page = admin_page_ctx
        with steps.step("Navigate to /admin as Site Admin"):
            admin.navigate_to_admin_hub()
        with steps.step("Verify admin hub is loaded"):
            admin.assert_admin_hub_loaded()


@pytest.mark.rbac
class TestDashboardRoleViews:

    @pytest.mark.use_case(
        id="UC-RBAC-006",
        name="Player dashboard does not show admin UI",
        persona="RBAC",
        criteria=[
            "Player sees a standard dashboard",
            "No admin panel link is visible",
        ],
    )
    def test_player_sees_player_dashboard(self, player_page_ctx: Page, steps: StepLogger):
        dash = DashboardPage(player_page_ctx)
        steps.page = player_page_ctx
        with steps.step("Navigate to dashboard as Player"):
            dash.navigate_to_dashboard()
        with steps.step("Verify dashboard loaded"):
            dash.assert_dashboard_loaded()
        with steps.step("Verify admin panel is NOT visible"):
            assert not dash.is_admin_ui_visible()

    @pytest.mark.use_case(
        id="UC-RBAC-007",
        name="Admin dashboard shows admin panel link",
        persona="RBAC",
        criteria=[
            "Site Admin sees an admin hub link on the dashboard",
        ],
    )
    def test_admin_dashboard_shows_admin_ui(self, admin_page_ctx: Page, steps: StepLogger):
        dash = DashboardPage(admin_page_ctx)
        steps.page = admin_page_ctx
        with steps.step("Navigate to dashboard as Site Admin"):
            dash.navigate_to_dashboard()
        with steps.step("Verify dashboard loaded"):
            dash.assert_dashboard_loaded()
        with steps.step("Verify admin panel link is visible"):
            assert dash.is_admin_ui_visible()


@pytest.mark.rbac
class TestClubManagementAccess:

    @pytest.mark.use_case(
        id="UC-RBAC-008",
        name="Player cannot reach manage-club page",
        persona="RBAC",
        criteria=[
            "Navigating to /clubs/manage/* as a Player is denied or redirected",
        ],
    )
    def test_player_cannot_manage_club(self, player_page_ctx: Page, steps: StepLogger):
        steps.page = player_page_ctx
        with steps.step("Navigate to /clubs/manage/some-id as Player"):
            player_page_ctx.goto(f"{Config.BASE_URL}/clubs/manage/some-club-id")
            player_page_ctx.wait_for_load_state("networkidle")
        with steps.step("Verify access is denied"):
            denied = (
                player_page_ctx.get_by_text("Access Denied", exact=False).is_visible()
                or player_page_ctx.get_by_text("Unauthorized", exact=False).is_visible()
                or "/clubs/manage/" not in player_page_ctx.url
            )
            assert denied

    @pytest.mark.use_case(
        id="UC-RBAC-009",
        name="Club Director can access my-clubs page",
        persona="RBAC",
        criteria=[
            "Club Director navigates to /clubs/my without being redirected to login",
        ],
    )
    def test_director_can_access_my_clubs(self, director_page_ctx: Page, steps: StepLogger):
        steps.page = director_page_ctx
        with steps.step("Navigate to /clubs/my as Director"):
            director_page_ctx.goto(f"{Config.BASE_URL}{Config.Routes.MY_CLUBS}")
            director_page_ctx.wait_for_load_state("networkidle")
        with steps.step("Verify not redirected to login"):
            assert "/auth/login" not in director_page_ctx.url


@pytest.mark.rbac
class TestUnauthenticatedRedirects:

    _PROTECTED_ROUTES = [
        Config.Routes.PLAYER_EDIT,
        Config.Routes.LADDER_SESSION,
        Config.Routes.MY_CLUBS,
        Config.Routes.NOTIFICATIONS,
    ]

    @pytest.mark.use_case(
        id="UC-RBAC-010",
        name="Unauthenticated user is redirected from protected pages",
        persona="RBAC",
        criteria=[
            "Accessing /players/edit without auth redirects to /auth/login",
            "Accessing /ladder/session without auth redirects to /auth/login",
            "Accessing /clubs/my without auth redirects to /auth/login",
            "Accessing /notifications without auth redirects to /auth/login",
        ],
    )
    @pytest.mark.parametrize("route", _PROTECTED_ROUTES)
    def test_unauthenticated_user_redirected(self, anon_page: Page, route: str, steps: StepLogger):
        steps.page = anon_page
        with steps.step(f"Navigate to {route} without authentication"):
            anon_page.goto(f"{Config.BASE_URL}{route}")
            anon_page.wait_for_load_state("networkidle")
        with steps.step("Verify redirect to /auth/login"):
            assert "/auth/login" in anon_page.url, (
                f"Expected redirect to /auth/login for {route}, got {anon_page.url}"
            )

    @pytest.mark.use_case(
        id="UC-RBAC-011",
        name="Public leaderboard is accessible without authentication",
        persona="RBAC",
        criteria=[
            "The /players page loads for unauthenticated users",
            "No redirect to /auth/login occurs",
        ],
    )
    def test_public_routes_accessible_without_auth(self, anon_page: Page, steps: StepLogger):
        steps.page = anon_page
        with steps.step("Navigate to /players (public leaderboard) without auth"):
            anon_page.goto(f"{Config.BASE_URL}{Config.Routes.PLAYERS}")
            anon_page.wait_for_load_state("networkidle")
        with steps.step("Verify NOT redirected to login"):
            assert "/auth/login" not in anon_page.url
