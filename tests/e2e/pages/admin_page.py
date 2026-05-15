"""Admin page objects — club approvals, user management, audit log."""
from __future__ import annotations

from playwright.sync_api import Page, Locator, expect

from tests.e2e.config import Config
from tests.e2e.pages.base_page import BasePage


class AdminPage(BasePage):
    def __init__(self, page: Page) -> None:
        super().__init__(page)

    # ── Locators ──────────────────────────────────────────────────────────────

    @property
    def pending_club_cards(self) -> Locator:
        return self.page.locator("[data-testid='pending-club'], .pending-club-card")

    @property
    def approved_club_cards(self) -> Locator:
        return self.page.locator(
            "[data-testid='approved-club'], .approved-club-card"
        )

    @property
    def approve_button(self) -> Locator:
        return self.page.get_by_role("button", name="Approve")

    @property
    def reject_button(self) -> Locator:
        return self.page.get_by_role("button", name="Reject")

    @property
    def user_rows(self) -> Locator:
        return self.page.get_by_role("row")

    @property
    def audit_log_entries(self) -> Locator:
        return self.page.locator("[data-testid='audit-entry'], .audit-entry")

    @property
    def assign_role_button(self) -> Locator:
        return self.page.get_by_role("button", name="Assign Role").or_(
            self.page.get_by_role("button", name="Edit Role")
        )

    @property
    def role_select(self) -> Locator:
        return self.page.get_by_label("Role", exact=False)

    # ── Navigation ────────────────────────────────────────────────────────────

    def navigate_to_admin_hub(self) -> None:
        self.goto(Config.Routes.ADMIN)
        self.wait_for_page_ready()

    def navigate_to_pending_clubs(self) -> None:
        self.goto(Config.Routes.ADMIN_CLUBS)
        self.wait_for_page_ready()

    def navigate_to_user_management(self) -> None:
        self.goto(Config.Routes.ADMIN_USERS)
        self.wait_for_page_ready()

    def navigate_to_audit_log(self) -> None:
        self.goto(Config.Routes.ADMIN_AUDIT)
        self.wait_for_page_ready()

    # ── Actions ───────────────────────────────────────────────────────────────

    def approve_first_pending_club(self) -> None:
        self.navigate_to_pending_clubs()
        first = self.pending_club_cards.first
        expect(first).to_be_visible(timeout=10_000)
        first.get_by_role("button", name="Approve").click()
        confirm = self.page.get_by_role("dialog")
        confirm.get_by_role("button", name="Confirm").or_(
            confirm.get_by_role("button", name="Approve")
        ).click()
        self.wait_for_toast()

    def reject_first_pending_club(self, reason: str = "Does not meet requirements") -> None:
        self.navigate_to_pending_clubs()
        first = self.pending_club_cards.first
        expect(first).to_be_visible(timeout=10_000)
        first.get_by_role("button", name="Reject").click()
        dialog = self.page.get_by_role("dialog")
        reason_field = dialog.get_by_label("Reason", exact=False)
        if reason_field.is_visible():
            reason_field.fill(reason)
        dialog.get_by_role("button", name="Reject").or_(
            dialog.get_by_role("button", name="Confirm")
        ).click()
        self.wait_for_toast()

    def assign_role_to_user(
        self,
        user_name_or_email: str,
        role: str,
        club_id: str | None = None,
        league_id: str | None = None,
    ) -> None:
        """Find a user row and assign them a role via dialog."""
        self.navigate_to_user_management()
        row = self.page.get_by_role("row").filter(has_text=user_name_or_email)
        row.get_by_role("button", name="Edit").or_(
            row.get_by_role("button", name="Assign Role")
        ).click()
        dialog = self.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=5_000)
        dialog.get_by_label("Role", exact=False).select_option(role)
        if club_id:
            dialog.get_by_label("Club", exact=False).select_option(club_id)
        if league_id:
            dialog.get_by_label("League", exact=False).select_option(league_id)
        dialog.get_by_role("button", name="Save").or_(
            dialog.get_by_role("button", name="Assign")
        ).click()
        self.wait_for_toast()

    def remove_role_from_user(self, user_name_or_email: str, role: str) -> None:
        self.navigate_to_user_management()
        row = self.page.get_by_role("row").filter(has_text=user_name_or_email)
        role_chip = row.get_by_text(role, exact=False)
        role_chip.get_by_role("button").or_(
            role_chip.locator("+ button")
        ).click()
        confirm = self.page.get_by_role("dialog")
        confirm.get_by_role("button", name="Remove").or_(
            confirm.get_by_role("button", name="Confirm")
        ).click()
        self.wait_for_toast()

    # ── Assertions ────────────────────────────────────────────────────────────

    def assert_admin_hub_loaded(self) -> None:
        self.wait_for_spinner_gone()
        expect(self.page.get_by_role("heading", name="Admin", exact=False)).to_be_visible(
            timeout=10_000
        )

    def assert_pending_clubs_visible(self) -> None:
        self.wait_for_spinner_gone()
        expect(
            self.pending_club_cards.first.or_(
                self.page.get_by_text("No pending clubs", exact=False)
            )
        ).to_be_visible(timeout=10_000)

    def assert_user_has_role(self, user_name_or_email: str, role: str) -> None:
        row = self.page.get_by_role("row").filter(has_text=user_name_or_email)
        expect(row.get_by_text(role, exact=False)).to_be_visible(timeout=8_000)

    def assert_audit_log_loaded(self) -> None:
        self.wait_for_spinner_gone()
        expect(
            self.audit_log_entries.first.or_(
                self.page.get_by_text("No audit events", exact=False)
            )
        ).to_be_visible(timeout=10_000)
