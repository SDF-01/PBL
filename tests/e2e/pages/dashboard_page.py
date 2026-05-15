"""Dashboard page object — role-aware home after login."""
from __future__ import annotations

from playwright.sync_api import Page, expect

from tests.e2e.config import Config
from tests.e2e.pages.base_page import BasePage


class DashboardPage(BasePage):
    def __init__(self, page: Page) -> None:
        super().__init__(page)

    @property
    def welcome_heading(self):
        return self.page.get_by_role("heading").first

    @property
    def admin_panel_link(self):
        return self.page.get_by_role("link", name="Admin")

    @property
    def nav_leagues(self):
        return self.page.get_by_role("link", name="Leagues")

    @property
    def nav_ladder(self):
        return self.page.get_by_role("link", name="Ladder")

    @property
    def nav_clubs(self):
        return self.page.get_by_role("link", name="Clubs")

    @property
    def nav_players(self):
        return self.page.get_by_role("link", name="Players")

    @property
    def nav_tournaments(self):
        return self.page.get_by_role("link", name="Tournaments")

    def navigate_to_dashboard(self) -> None:
        self.goto("/")
        self.wait_for_page_ready()

    def is_admin_ui_visible(self) -> bool:
        """Check if admin-only elements are visible on the dashboard."""
        return self.admin_panel_link.is_visible()

    def is_coordinator_ui_visible(self) -> bool:
        """Check for coordinator-specific UI elements."""
        return self.page.get_by_text("Coordinator", exact=False).is_visible()

    def navigate_to(self, section: str) -> None:
        """Navigate to a main section via nav links."""
        section_map = {
            "leagues": self.nav_leagues,
            "ladder": self.nav_ladder,
            "clubs": self.nav_clubs,
            "players": self.nav_players,
            "tournaments": self.nav_tournaments,
        }
        link = section_map.get(section.lower())
        if link is None:
            raise ValueError(f"Unknown section: {section}")
        link.first.click()
        self.wait_for_page_ready()

    def assert_dashboard_loaded(self) -> None:
        expect(self.page).not_to_have_url(
            lambda url: "/auth/login" in url, timeout=10_000
        )
        self.wait_for_spinner_gone()
