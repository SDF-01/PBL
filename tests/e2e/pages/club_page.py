"""Club page objects — create, browse, manage."""
from __future__ import annotations

from playwright.sync_api import Page, Locator, expect

from tests.e2e.config import Config
from tests.e2e.pages.base_page import BasePage


class ClubPage(BasePage):
    def __init__(self, page: Page) -> None:
        super().__init__(page)

    # ── Locators ──────────────────────────────────────────────────────────────

    @property
    def club_cards(self) -> Locator:
        return self.page.locator("[data-testid='club-card'], .club-card")

    @property
    def create_club_button(self) -> Locator:
        return self.page.get_by_role("button", name="Create Club").or_(
            self.page.get_by_role("link", name="Create Club")
        )

    @property
    def club_name_field(self) -> Locator:
        return self.page.get_by_label("Club Name", exact=False)

    @property
    def club_description_field(self) -> Locator:
        return self.page.get_by_label("Description", exact=False)

    @property
    def club_location_field(self) -> Locator:
        return self.page.get_by_label("Location", exact=False)

    @property
    def submit_button(self) -> Locator:
        return self.page.get_by_role("button", name="Submit").or_(
            self.page.get_by_role("button", name="Create")
        )

    @property
    def save_button(self) -> Locator:
        return self.page.get_by_role("button", name="Save")

    @property
    def follow_button(self) -> Locator:
        return self.page.get_by_role("button", name="Follow")

    @property
    def unfollow_button(self) -> Locator:
        return self.page.get_by_role("button", name="Unfollow")

    @property
    def join_button(self) -> Locator:
        return self.page.get_by_role("button", name="Join")

    @property
    def pending_badge(self) -> Locator:
        return self.page.get_by_text("Pending", exact=False).or_(
            self.page.locator("[data-testid='pending-badge']")
        )

    @property
    def approved_badge(self) -> Locator:
        return self.page.get_by_text("Approved", exact=False).or_(
            self.page.locator("[data-testid='approved-badge']")
        )

    # ── Navigation ────────────────────────────────────────────────────────────

    def navigate_to_clubs(self) -> None:
        self.goto(Config.Routes.CLUBS)
        self.wait_for_page_ready()

    def navigate_to_create_club(self) -> None:
        self.goto(Config.Routes.CLUB_CREATE)
        self.wait_for_page_ready()

    def navigate_to_my_clubs(self) -> None:
        self.goto(Config.Routes.MY_CLUBS)
        self.wait_for_page_ready()

    def navigate_to_club(self, club_id: str) -> None:
        self.goto(f"/clubs/{club_id}")
        self.wait_for_page_ready()

    def navigate_to_manage_club(self, club_id: str) -> None:
        self.goto(f"/clubs/manage/{club_id}")
        self.wait_for_page_ready()

    # ── Actions ───────────────────────────────────────────────────────────────

    def create_club(
        self, name: str, description: str = "", location: str = "Test City, TX"
    ) -> None:
        self.navigate_to_create_club()
        self.club_name_field.fill(name)
        if description:
            self.club_description_field.fill(description)
        self.club_location_field.fill(location)
        self.submit_button.click()
        self.wait_for_page_ready()

    def edit_club(
        self,
        club_id: str,
        name: str | None = None,
        description: str | None = None,
    ) -> None:
        self.navigate_to_manage_club(club_id)
        if name:
            self.club_name_field.fill(name)
        if description:
            self.club_description_field.fill(description)
        self.save_button.click()
        self.wait_for_toast()

    def follow_club(self, club_id: str) -> None:
        self.navigate_to_club(club_id)
        self.follow_button.click()
        self.wait_for_toast()

    def click_first_club(self) -> None:
        self.club_cards.first.click()
        self.wait_for_page_ready()

    # ── Assertions ────────────────────────────────────────────────────────────

    def assert_clubs_loaded(self) -> None:
        self.wait_for_spinner_gone()
        expect(
            self.club_cards.first.or_(
                self.page.get_by_text("No clubs found", exact=False)
            )
        ).to_be_visible(timeout=10_000)

    def assert_club_status(self, status: str) -> None:
        """Assert a club shows a specific status badge (pending, approved, etc.)."""
        badge = self.page.get_by_text(status.capitalize(), exact=False)
        expect(badge.first).to_be_visible(timeout=8_000)

    def assert_club_name_displayed(self, name: str) -> None:
        expect(self.page.get_by_text(name, exact=False)).to_be_visible(timeout=8_000)
