"""Player-related page objects — profile, search, standings."""
from __future__ import annotations

from playwright.sync_api import Page, Locator, expect

from tests.e2e.config import Config
from tests.e2e.pages.base_page import BasePage


class PlayerPage(BasePage):
    def __init__(self, page: Page) -> None:
        super().__init__(page)

    # ── Locators ──────────────────────────────────────────────────────────────

    @property
    def edit_profile_button(self) -> Locator:
        return self.page.get_by_role("button", name="Edit Profile").or_(
            self.page.get_by_role("link", name="Edit Profile")
        )

    @property
    def display_name_field(self) -> Locator:
        return self.page.get_by_label("Display Name", exact=False)

    @property
    def first_name_field(self) -> Locator:
        return self.page.get_by_label("First Name", exact=False)

    @property
    def last_name_field(self) -> Locator:
        return self.page.get_by_label("Last Name", exact=False)

    @property
    def phone_field(self) -> Locator:
        return self.page.get_by_label("Phone", exact=False)

    @property
    def save_button(self) -> Locator:
        return self.page.get_by_role("button", name="Save")

    @property
    def search_input(self) -> Locator:
        return self.page.get_by_role("searchbox").or_(
            self.page.get_by_placeholder("Search players", exact=False)
        )

    @property
    def player_cards(self) -> Locator:
        return self.page.locator("[data-testid='player-card'], .player-card")

    @property
    def standings_table(self) -> Locator:
        return self.page.get_by_role("table").first

    @property
    def elo_rating(self) -> Locator:
        return self.page.get_by_text("ELO", exact=False).or_(
            self.page.get_by_text("Rating", exact=False)
        )

    # ── Navigation ────────────────────────────────────────────────────────────

    def navigate_to_own_profile(self) -> None:
        self.goto(Config.Routes.PLAYER_VIEW)
        self.wait_for_page_ready()

    def navigate_to_edit_profile(self) -> None:
        self.goto(Config.Routes.PLAYER_EDIT)
        self.wait_for_page_ready()

    def navigate_to_search(self) -> None:
        self.goto(Config.Routes.PLAYER_SEARCH)
        self.wait_for_page_ready()

    def navigate_to_leaderboard(self) -> None:
        self.goto(Config.Routes.PLAYERS)
        self.wait_for_page_ready()

    def navigate_to_ladder_standings(self) -> None:
        self.goto(Config.Routes.LADDER_STANDINGS)
        self.wait_for_page_ready()

    # ── Actions ───────────────────────────────────────────────────────────────

    def update_profile(
        self,
        first_name: str | None = None,
        last_name: str | None = None,
        phone: str | None = None,
    ) -> None:
        """Fill and submit the profile edit form."""
        self.navigate_to_edit_profile()
        if first_name:
            self.first_name_field.fill(first_name)
        if last_name:
            self.last_name_field.fill(last_name)
        if phone:
            self.phone_field.fill(phone)
        self.save_button.click()
        self.wait_for_toast()

    def search_player(self, query: str) -> None:
        self.navigate_to_search()
        self.search_input.fill(query)
        self.page.keyboard.press("Enter")
        self.wait_for_page_ready()

    def click_first_player_result(self) -> None:
        self.player_cards.first.click()
        self.wait_for_page_ready()

    # ── Assertions ────────────────────────────────────────────────────────────

    def assert_profile_loaded(self) -> None:
        self.wait_for_spinner_gone()
        # Either the edit button or the profile heading is visible
        profile_indicator = (
            self.edit_profile_button.or_(
                self.page.get_by_role("heading", name="Player Profile", exact=False)
            ).or_(
                self.page.get_by_text("Wins", exact=False)
            )
        )
        expect(profile_indicator.first).to_be_visible(timeout=10_000)

    def assert_player_listed(self, name: str) -> None:
        expect(self.page.get_by_text(name, exact=False)).to_be_visible(timeout=8_000)

    def assert_standings_visible(self) -> None:
        self.wait_for_spinner_gone()
        expect(self.standings_table.or_(self.player_cards.first)).to_be_visible(
            timeout=10_000
        )
