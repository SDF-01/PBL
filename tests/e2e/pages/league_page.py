"""League page objects — create, roster, schedule, standings."""
from __future__ import annotations

from playwright.sync_api import Page, Locator, expect

from tests.e2e.config import Config
from tests.e2e.pages.base_page import BasePage


class LeaguePage(BasePage):
    def __init__(self, page: Page) -> None:
        super().__init__(page)

    # ── Locators ──────────────────────────────────────────────────────────────

    @property
    def league_cards(self) -> Locator:
        return self.page.locator("[data-testid='league-card'], .league-card")

    @property
    def create_league_button(self) -> Locator:
        return self.page.get_by_role("button", name="Create League").or_(
            self.page.get_by_role("link", name="Create League")
        )

    @property
    def league_name_field(self) -> Locator:
        return self.page.get_by_label("League Name", exact=False)

    @property
    def league_description_field(self) -> Locator:
        return self.page.get_by_label("Description", exact=False)

    @property
    def submit_button(self) -> Locator:
        return self.page.get_by_role("button", name="Create").or_(
            self.page.get_by_role("button", name="Submit")
        )

    @property
    def join_league_button(self) -> Locator:
        return self.page.get_by_role("button", name="Join League").or_(
            self.page.get_by_role("button", name="Register")
        )

    @property
    def roster_rows(self) -> Locator:
        return self.page.get_by_role("row")

    @property
    def schedule_events(self) -> Locator:
        return self.page.locator("[data-testid='schedule-event']")

    @property
    def standings_table(self) -> Locator:
        return self.page.get_by_role("table").first

    # Coordinator-specific
    @property
    def add_player_button(self) -> Locator:
        return self.page.get_by_role("button", name="Add Player")

    @property
    def remove_player_button(self) -> Locator:
        return self.page.get_by_role("button", name="Remove")

    # ── Navigation ────────────────────────────────────────────────────────────

    def navigate_to_leagues(self) -> None:
        self.goto(Config.Routes.LEAGUES)
        self.wait_for_page_ready()

    def navigate_to_league(self, league_id: str) -> None:
        self.goto(f"/leagues/{league_id}")
        self.wait_for_page_ready()

    def navigate_to_roster(self, league_id: str) -> None:
        self.goto(f"/leagues/{league_id}/roster")
        self.wait_for_page_ready()

    def navigate_to_schedule(self, league_id: str) -> None:
        self.goto(f"/leagues/{league_id}/schedule")
        self.wait_for_page_ready()

    def navigate_to_standings(self, league_id: str) -> None:
        self.goto(f"/leagues/{league_id}/standings")
        self.wait_for_page_ready()

    def navigate_to_create_league(self) -> None:
        self.goto(f"{Config.Routes.LEAGUES}/create")
        self.wait_for_page_ready()

    # ── Actions ───────────────────────────────────────────────────────────────

    def create_league(
        self,
        name: str,
        description: str = "",
        club_id: str | None = None,
    ) -> None:
        self.navigate_to_create_league()
        self.league_name_field.fill(name)
        if description:
            self.league_description_field.fill(description)
        if club_id:
            self.page.get_by_label("Club", exact=False).select_option(club_id)
        self.submit_button.click()
        self.wait_for_page_ready()

    def join_league(self, league_id: str) -> None:
        self.navigate_to_league(league_id)
        self.join_league_button.click()
        self.wait_for_toast()

    def add_player_to_roster(self, league_id: str, player_name_or_email: str) -> None:
        self.navigate_to_roster(league_id)
        self.add_player_button.click()
        dialog = self.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=5_000)
        dialog.get_by_role("textbox").fill(player_name_or_email)
        dialog.get_by_role("button", name="Add").click()
        self.wait_for_toast()

    def remove_player_from_roster(self, league_id: str, player_name: str) -> None:
        self.navigate_to_roster(league_id)
        row = self.page.get_by_role("row").filter(has_text=player_name)
        row.get_by_role("button", name="Remove").click()
        confirm = self.page.get_by_role("dialog")
        confirm.get_by_role("button", name="Confirm").click()
        self.wait_for_toast()

    def click_first_league(self) -> None:
        self.league_cards.first.click()
        self.wait_for_page_ready()

    # ── Assertions ────────────────────────────────────────────────────────────

    def assert_leagues_loaded(self) -> None:
        self.wait_for_spinner_gone()
        expect(
            self.league_cards.first.or_(
                self.page.get_by_text("No leagues found", exact=False)
            )
        ).to_be_visible(timeout=10_000)

    def assert_player_in_roster(self, player_name: str) -> None:
        expect(self.page.get_by_text(player_name, exact=False)).to_be_visible(
            timeout=8_000
        )

    def assert_player_not_in_roster(self, player_name: str) -> None:
        expect(self.page.get_by_text(player_name, exact=False)).not_to_be_visible(
            timeout=8_000
        )

    def assert_standings_loaded(self) -> None:
        self.wait_for_spinner_gone()
        expect(self.standings_table).to_be_visible(timeout=10_000)
