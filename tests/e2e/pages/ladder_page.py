"""Ladder / play-date page objects."""
from __future__ import annotations

from playwright.sync_api import Page, Locator, expect

from tests.e2e.config import Config
from tests.e2e.pages.base_page import BasePage


class LadderPage(BasePage):
    def __init__(self, page: Page) -> None:
        super().__init__(page)

    # ── Locators ──────────────────────────────────────────────────────────────

    @property
    def play_date_cards(self) -> Locator:
        return self.page.locator("[data-testid='play-date-card'], .play-date-card")

    @property
    def rsvp_button(self) -> Locator:
        return self.page.get_by_role("button", name="RSVP").or_(
            self.page.get_by_role("button", name="Join")
        )

    @property
    def cancel_rsvp_button(self) -> Locator:
        return self.page.get_by_role("button", name="Cancel RSVP").or_(
            self.page.get_by_role("button", name="Leave")
        )

    @property
    def check_in_button(self) -> Locator:
        return self.page.get_by_role("button", name="Check In")

    @property
    def check_in_code_input(self) -> Locator:
        return self.page.get_by_label("Check-in Code", exact=False).or_(
            self.page.get_by_placeholder("Enter code", exact=False)
        )

    @property
    def session_matches(self) -> Locator:
        return self.page.locator("[data-testid='match-card'], .match-card")

    @property
    def standings_rows(self) -> Locator:
        return self.page.get_by_role("row")

    # Coordinator-only elements
    @property
    def create_play_date_button(self) -> Locator:
        return self.page.get_by_role("button", name="Create Play Date").or_(
            self.page.get_by_role("link", name="Create Play Date")
        )

    @property
    def generate_rotation_button(self) -> Locator:
        return self.page.get_by_role("button", name="Generate Rotation").or_(
            self.page.get_by_role("button", name="Generate Session")
        )

    @property
    def finalize_session_button(self) -> Locator:
        return self.page.get_by_role("button", name="Finalize Session").or_(
            self.page.get_by_role("button", name="Close Session")
        )

    @property
    def coordinator_dashboard_link(self) -> Locator:
        return self.page.get_by_role("link", name="Coordinator").or_(
            self.page.get_by_role("link", name="Manage Session")
        )

    # ── Navigation ────────────────────────────────────────────────────────────

    def navigate_to_play_dates(self) -> None:
        self.goto(Config.Routes.LADDER_PLAY_DATES)
        self.wait_for_page_ready()

    def navigate_to_session(self) -> None:
        self.goto(Config.Routes.LADDER_SESSION)
        self.wait_for_page_ready()

    def navigate_to_standings(self) -> None:
        self.goto(Config.Routes.LADDER_STANDINGS)
        self.wait_for_page_ready()

    def navigate_to_checkin(self) -> None:
        self.goto(Config.Routes.LADDER_CHECKIN)
        self.wait_for_page_ready()

    def navigate_to_seasons(self) -> None:
        self.goto(Config.Routes.LADDER_SEASONS)
        self.wait_for_page_ready()

    # ── Player actions ────────────────────────────────────────────────────────

    def rsvp_to_first_play_date(self) -> None:
        """RSVP to the first available play date."""
        self.navigate_to_play_dates()
        first_card = self.play_date_cards.first
        expect(first_card).to_be_visible(timeout=10_000)
        first_card.get_by_role("button", name="RSVP").click()
        self.wait_for_toast()

    def cancel_rsvp_first_play_date(self) -> None:
        self.navigate_to_play_dates()
        first_card = self.play_date_cards.first
        first_card.get_by_role("button", name="Cancel RSVP").click()
        self.wait_for_toast()

    def check_in_with_code(self, code: str) -> None:
        self.navigate_to_checkin()
        self.check_in_code_input.fill(code)
        self.check_in_button.click()
        self.wait_for_page_ready()

    def submit_match_score(
        self, match_locator: Locator, my_score: int, opponent_score: int
    ) -> None:
        match_locator.get_by_role("button", name="Submit Score").click()
        dialog = self.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=5_000)
        dialog.get_by_label("My Score", exact=False).fill(str(my_score))
        dialog.get_by_label("Opponent Score", exact=False).fill(str(opponent_score))
        dialog.get_by_role("button", name="Submit").click()
        self.wait_for_toast()

    # ── Coordinator actions ───────────────────────────────────────────────────

    def create_play_date(
        self,
        date: str,
        time: str = "10:00 AM",
        max_participants: int = 16,
    ) -> None:
        """Open create dialog and fill play date details."""
        self.create_play_date_button.click()
        dialog = self.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=5_000)
        dialog.get_by_label("Date", exact=False).fill(date)
        dialog.get_by_label("Time", exact=False).fill(time)
        max_field = dialog.get_by_label("Max Participants", exact=False)
        max_field.fill(str(max_participants))
        dialog.get_by_role("button", name="Create").click()
        self.wait_for_toast()

    def generate_session_rotation(self) -> None:
        self.generate_rotation_button.click()
        dialog = self.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=5_000)
        dialog.get_by_role("button", name="Generate").or_(
            dialog.get_by_role("button", name="Confirm")
        ).click()
        self.wait_for_page_ready()

    def finalize_session(self) -> None:
        self.finalize_session_button.click()
        confirm_dialog = self.page.get_by_role("dialog")
        confirm_dialog.get_by_role("button", name="Confirm").or_(
            confirm_dialog.get_by_role("button", name="Finalize")
        ).click()
        self.wait_for_toast()

    def admin_check_in_player(self, player_name: str) -> None:
        """Force check-in a player by name from coordinator dashboard."""
        row = self.page.get_by_role("row").filter(has_text=player_name)
        row.get_by_role("button", name="Check In").click()
        self.wait_for_toast()

    # ── Assertions ────────────────────────────────────────────────────────────

    def assert_play_dates_loaded(self) -> None:
        self.wait_for_spinner_gone()
        expect(
            self.play_date_cards.first.or_(
                self.page.get_by_text("No upcoming play dates", exact=False)
            )
        ).to_be_visible(timeout=10_000)

    def assert_checked_in(self) -> None:
        checked_in = self.page.get_by_text("Checked In", exact=False).or_(
            self.page.get_by_text("Check-in Complete", exact=False)
        )
        expect(checked_in.first).to_be_visible(timeout=8_000)

    def assert_session_active(self) -> None:
        expect(
            self.session_matches.first.or_(
                self.page.get_by_text("In Progress", exact=False)
            )
        ).to_be_visible(timeout=10_000)
