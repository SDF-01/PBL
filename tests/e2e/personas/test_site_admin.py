"""
Site Admin persona tests.
"""
import pytest
from playwright.sync_api import expect, Page

from tests.e2e.config import Config
from tests.e2e.pages import AdminPage, DashboardPage
from tests.e2e.reporter.step_logger import StepLogger


@pytest.mark.admin
class TestAdminDashboard:

    @pytest.mark.use_case(
        id="UC-ADM-001",
        name="Site Admin dashboard shows admin panel link",
        persona="Admin",
        criteria=[
            "Dashboard loads for Site Admin",
            "Admin hub link is visible in the nav",
        ],
    )
    def test_admin_dashboard_loads(self, admin_page_ctx: Page, steps: StepLogger):
        dash = DashboardPage(admin_page_ctx)
        steps.page = admin_page_ctx
        with steps.step("Navigate to dashboard as Site Admin"):
            dash.navigate_to_dashboard()
        with steps.step("Verify dashboard loaded"):
            dash.assert_dashboard_loaded()
        with steps.step("Verify admin panel link is visible"):
            assert dash.is_admin_ui_visible()

    @pytest.mark.use_case(
        id="UC-ADM-002",
        name="Admin hub page loads and shows key sections",
        persona="Admin",
        criteria=[
            "Admin hub is accessible at /admin",
            "Links or sections for Clubs, Users, and Audit are visible",
        ],
    )
    def test_admin_hub_shows_key_sections(self, admin: AdminPage, steps: StepLogger):
        steps.page = admin.page
        with steps.step("Navigate to /admin"):
            admin.navigate_to_admin_hub()
            admin.wait_for_spinner_gone()
        with steps.step("Verify Clubs section is visible"):
            expect(admin.page.get_by_text("Clubs", exact=False).first).to_be_visible(timeout=8_000)
        with steps.step("Verify Users section is visible"):
            expect(admin.page.get_by_text("Users", exact=False).first).to_be_visible(timeout=8_000)
        with steps.step("Verify Audit section is visible"):
            expect(admin.page.get_by_text("Audit", exact=False).first).to_be_visible(timeout=8_000)


@pytest.mark.admin
class TestClubApprovals:

    @pytest.mark.use_case(
        id="UC-ADM-003",
        name="Pending clubs page loads for Site Admin",
        persona="Admin",
        criteria=[
            "The /admin/clubs page renders pending club cards or an empty state",
        ],
    )
    def test_pending_clubs_page_loads(self, admin: AdminPage, steps: StepLogger):
        steps.page = admin.page
        with steps.step("Navigate to /admin/clubs"):
            admin.navigate_to_pending_clubs()
        with steps.step("Verify page content is visible"):
            admin.assert_pending_clubs_visible()

    @pytest.mark.use_case(
        id="UC-ADM-004",
        name="Pending club card shows Approve and Reject buttons",
        persona="Admin",
        criteria=[
            "Each pending club card has an Approve button",
            "Each pending club card has a Reject button",
        ],
    )
    def test_pending_club_shows_approve_and_reject_buttons(
        self, admin: AdminPage, steps: StepLogger
    ):
        steps.page = admin.page
        with steps.step("Navigate to pending clubs"):
            admin.navigate_to_pending_clubs()
            admin.wait_for_spinner_gone()
        with steps.step("Check for pending clubs"):
            if admin.pending_club_cards.count() == 0:
                pytest.skip("No pending clubs — create one with the director persona first")
        with steps.step("Verify Approve button is on first pending card"):
            expect(admin.pending_club_cards.first.get_by_role("button", name="Approve")).to_be_visible()
        with steps.step("Verify Reject button is on first pending card"):
            expect(admin.pending_club_cards.first.get_by_role("button", name="Reject")).to_be_visible()

    @pytest.mark.slow
    @pytest.mark.use_case(
        id="UC-ADM-005",
        name="Admin approves a pending club",
        persona="Admin",
        criteria=[
            "Clicking Approve and confirming removes the club from the pending queue",
            "Success toast is shown",
        ],
    )
    def test_approve_pending_club(self, admin: AdminPage, steps: StepLogger):
        steps.page = admin.page
        with steps.step("Navigate to pending clubs"):
            admin.navigate_to_pending_clubs()
        with steps.step("Check for pending clubs"):
            if admin.pending_club_cards.count() == 0:
                pytest.skip("No pending clubs to approve")
        with steps.step("Approve the first pending club"):
            admin.approve_first_pending_club()
        with steps.step("Verify page updates"):
            admin.wait_for_page_ready()

    @pytest.mark.slow
    @pytest.mark.use_case(
        id="UC-ADM-006",
        name="Admin rejects a pending club with a reason",
        persona="Admin",
        criteria=[
            "Clicking Reject opens a dialog for a rejection reason",
            "Confirming rejection removes the club from the pending queue",
        ],
    )
    def test_reject_pending_club(self, admin: AdminPage, steps: StepLogger):
        steps.page = admin.page
        with steps.step("Navigate to pending clubs"):
            admin.navigate_to_pending_clubs()
        with steps.step("Check for pending clubs"):
            if admin.pending_club_cards.count() == 0:
                pytest.skip("No pending clubs to reject")
        with steps.step("Reject the first pending club with reason"):
            admin.reject_first_pending_club(reason="Does not meet E2E criteria")
        with steps.step("Verify page updates"):
            admin.wait_for_page_ready()

    @pytest.mark.use_case(
        id="UC-ADM-007",
        name="Approved clubs list is accessible",
        persona="Admin",
        criteria=[
            "The /admin/clubs/approved page loads for Site Admin",
        ],
    )
    def test_approved_clubs_list_loads(self, admin: AdminPage, steps: StepLogger):
        steps.page = admin.page
        with steps.step("Navigate to /admin/clubs/approved"):
            admin.goto("/admin/clubs/approved")
            admin.wait_for_page_ready()
        with steps.step("Verify main content is rendered"):
            expect(admin.page.get_by_role("main")).to_be_visible(timeout=10_000)


@pytest.mark.admin
class TestUserManagement:

    @pytest.mark.use_case(
        id="UC-ADM-008",
        name="User management page loads with Email and Role columns",
        persona="Admin",
        criteria=[
            "The /admin/users page renders",
            "A column header for Email is visible",
            "A column header for Role is visible",
        ],
    )
    def test_user_management_has_email_and_role_columns(self, admin: AdminPage, steps: StepLogger):
        steps.page = admin.page
        with steps.step("Navigate to /admin/users"):
            admin.navigate_to_user_management()
            admin.wait_for_spinner_gone()
        with steps.step("Verify Email column header is visible"):
            expect(
                admin.page.get_by_role("columnheader").filter(has_text="Email").first
            ).to_be_visible(timeout=8_000)
        with steps.step("Verify Role column header is visible"):
            expect(
                admin.page.get_by_role("columnheader").filter(has_text="Role").first
            ).to_be_visible(timeout=8_000)

    @pytest.mark.use_case(
        id="UC-ADM-009",
        name="Assign Role dialog opens for a user",
        persona="Admin",
        criteria=[
            "Clicking Edit or Assign Role on a user row opens a dialog",
            "Dialog can be dismissed",
        ],
    )
    def test_assign_role_dialog_opens(self, admin: AdminPage, steps: StepLogger):
        steps.page = admin.page
        with steps.step("Navigate to user management"):
            admin.navigate_to_user_management()
            admin.wait_for_spinner_gone()
        with steps.step("Check for users in the list"):
            edit_btn = admin.page.get_by_role("button", name="Edit").or_(
                admin.page.get_by_role("button", name="Assign Role")
            )
            if edit_btn.count() == 0:
                pytest.skip("No users to edit — seed test accounts first")
        with steps.step("Click Edit on first user"):
            edit_btn.first.click()
        with steps.step("Verify dialog opens"):
            expect(admin.page.get_by_role("dialog")).to_be_visible(timeout=5_000)
        with steps.step("Dismiss dialog"):
            admin.page.keyboard.press("Escape")

    @pytest.mark.slow
    @pytest.mark.use_case(
        id="UC-ADM-010",
        name="Admin assigns LeagueCoordinator role to a user",
        persona="Admin",
        criteria=[
            "Admin selects LeagueCoordinator in the role dialog and saves",
            "User row shows the LeagueCoordinator role badge",
        ],
    )
    def test_assign_coordinator_role_to_user(self, admin: AdminPage, steps: StepLogger):
        steps.page = admin.page
        coordinator_email = Config.COORDINATOR["email"]
        with steps.step("Navigate to user management"):
            admin.navigate_to_user_management()
        with steps.step(f"Find coordinator user ({coordinator_email})"):
            row = admin.page.get_by_role("row").filter(has_text=coordinator_email)
            if row.count() == 0:
                pytest.skip(f"User {coordinator_email} not found")
        with steps.step("Assign LeagueCoordinator role"):
            admin.assign_role_to_user(coordinator_email, "LeagueCoordinator")
        with steps.step("Verify role badge is visible on user row"):
            admin.assert_user_has_role(coordinator_email, "LeagueCoordinator")

    @pytest.mark.slow
    @pytest.mark.use_case(
        id="UC-ADM-011",
        name="Admin assigns ClubDirector role to a user",
        persona="Admin",
        criteria=[
            "Admin assigns ClubDirector role and saves",
            "User row shows the ClubDirector badge",
        ],
    )
    def test_assign_director_role_to_user(self, admin: AdminPage, steps: StepLogger):
        steps.page = admin.page
        director_email = Config.DIRECTOR["email"]
        with steps.step("Navigate to user management"):
            admin.navigate_to_user_management()
        with steps.step(f"Find director user ({director_email})"):
            row = admin.page.get_by_role("row").filter(has_text=director_email)
            if row.count() == 0:
                pytest.skip(f"User {director_email} not found")
        with steps.step("Assign ClubDirector role"):
            admin.assign_role_to_user(director_email, "ClubDirector")
        with steps.step("Verify role badge is visible"):
            admin.assert_user_has_role(director_email, "ClubDirector")


@pytest.mark.admin
class TestAuditLog:

    @pytest.mark.use_case(
        id="UC-ADM-012",
        name="Audit log page loads for Site Admin",
        persona="Admin",
        criteria=[
            "The /admin/audit page renders",
            "A Timestamp or Date column header is visible",
        ],
    )
    def test_audit_log_page_loads(self, admin: AdminPage, steps: StepLogger):
        steps.page = admin.page
        with steps.step("Navigate to /admin/audit"):
            admin.navigate_to_audit_log()
            admin.wait_for_spinner_gone()
        with steps.step("Verify audit log loaded"):
            admin.assert_audit_log_loaded()
        with steps.step("Verify timestamp column is present"):
            timestamp = admin.page.get_by_text("Date", exact=False).or_(
                admin.page.get_by_text("Timestamp", exact=False)
            )
            expect(timestamp.first).to_be_visible(timeout=8_000)


@pytest.mark.admin
class TestAdminGlobalAccess:

    @pytest.mark.use_case(
        id="UC-ADM-013",
        name="Admin can browse all leagues",
        persona="Admin",
        criteria=[
            "Site Admin can view /leagues without restriction",
        ],
    )
    def test_admin_can_view_all_leagues(self, admin_page_ctx: Page, steps: StepLogger):
        steps.page = admin_page_ctx
        with steps.step("Navigate to /leagues as Admin"):
            admin_page_ctx.goto(f"{Config.BASE_URL}{Config.Routes.LEAGUES}")
            admin_page_ctx.wait_for_load_state("networkidle")
        with steps.step("Verify not redirected to login"):
            assert "/auth/login" not in admin_page_ctx.url

    @pytest.mark.use_case(
        id="UC-ADM-014",
        name="Admin can browse all clubs",
        persona="Admin",
        criteria=[
            "Site Admin can view /clubs without restriction",
        ],
    )
    def test_admin_can_view_all_clubs(self, admin_page_ctx: Page, steps: StepLogger):
        steps.page = admin_page_ctx
        with steps.step("Navigate to /clubs as Admin"):
            admin_page_ctx.goto(f"{Config.BASE_URL}{Config.Routes.CLUBS}")
            admin_page_ctx.wait_for_load_state("networkidle")
        with steps.step("Verify not redirected to login"):
            assert "/auth/login" not in admin_page_ctx.url

    @pytest.mark.use_case(
        id="UC-ADM-015",
        name="Import courts page is accessible to Admin",
        persona="Admin",
        criteria=[
            "The /admin/import-courts page loads for Site Admin",
        ],
    )
    def test_import_courts_page_accessible(self, admin: AdminPage, steps: StepLogger):
        steps.page = admin.page
        with steps.step("Navigate to /admin/import-courts"):
            admin.goto("/admin/import-courts")
            admin.wait_for_page_ready()
        with steps.step("Verify not redirected to login"):
            assert "/auth/login" not in admin.page.url

    @pytest.mark.use_case(
        id="UC-ADM-016",
        name="Admin testing utility page is accessible",
        persona="Admin",
        criteria=[
            "The /admin/testing page loads for Site Admin",
        ],
    )
    def test_admin_testing_page_accessible(self, admin: AdminPage, steps: StepLogger):
        steps.page = admin.page
        with steps.step("Navigate to /admin/testing"):
            admin.goto("/admin/testing")
            admin.wait_for_page_ready()
        with steps.step("Verify not redirected to login"):
            assert "/auth/login" not in admin.page.url
