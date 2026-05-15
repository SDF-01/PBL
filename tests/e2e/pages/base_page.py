"""Base page object — shared helpers for all pages."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

from playwright.sync_api import Page, Locator, expect

from tests.e2e.config import Config


class BasePage:
    def __init__(self, page: Page) -> None:
        self.page = page
        self.config = Config()

    # ── Navigation ────────────────────────────────────────────────────────────

    def goto(self, path: str = "/") -> None:
        url = Config.BASE_URL.rstrip("/") + path
        self.page.goto(url, wait_until="networkidle")

    def wait_for_url(self, pattern: str | re.Pattern, timeout: int = 15_000) -> None:
        self.page.wait_for_url(pattern, timeout=timeout)

    def current_path(self) -> str:
        return self.page.url.replace(Config.BASE_URL, "")

    # ── Assertions ────────────────────────────────────────────────────────────

    def expect_visible(self, locator: Locator, timeout: int = 8_000) -> None:
        expect(locator).to_be_visible(timeout=timeout)

    def expect_text(self, locator: Locator, text: str | re.Pattern) -> None:
        expect(locator).to_have_text(text)

    def expect_url_contains(self, substring: str) -> None:
        expect(self.page).to_have_url(re.compile(re.escape(substring)))

    # ── Interaction helpers ───────────────────────────────────────────────────

    def fill(self, selector: str, value: str) -> None:
        self.page.locator(selector).fill(value)

    def click(self, selector: str) -> None:
        self.page.locator(selector).click()

    def select_option(self, selector: str, value: str) -> None:
        self.page.locator(selector).select_option(value)

    def get_by_role(self, role: str, name: str | None = None) -> Locator:
        kwargs = {"name": name} if name else {}
        return self.page.get_by_role(role, **kwargs)  # type: ignore[arg-type]

    def get_by_label(self, label: str) -> Locator:
        return self.page.get_by_label(label)

    def get_by_test_id(self, test_id: str) -> Locator:
        return self.page.get_by_test_id(test_id)

    def get_by_text(self, text: str, exact: bool = False) -> Locator:
        return self.page.get_by_text(text, exact=exact)

    # ── Wait helpers ──────────────────────────────────────────────────────────

    def wait_for_toast(
        self, text: Optional[str] = None, timeout: int = 8_000
    ) -> Locator:
        """Wait for a toast/snackbar notification to appear."""
        selector = "[role='status'], [role='alert'], .toast, [data-sonner-toast]"
        toast = self.page.locator(selector).first
        toast.wait_for(state="visible", timeout=timeout)
        if text:
            expect(toast).to_contain_text(text)
        return toast

    def wait_for_spinner_gone(self, timeout: int = 15_000) -> None:
        """Wait for loading spinners to disappear."""
        spinner = self.page.locator(
            "[data-testid='spinner'], .animate-spin, [aria-label='Loading']"
        ).first
        try:
            spinner.wait_for(state="hidden", timeout=timeout)
        except Exception:
            pass  # No spinner present — that's fine

    def wait_for_page_ready(self) -> None:
        self.page.wait_for_load_state("networkidle")
        self.wait_for_spinner_gone()

    # ── Screenshot helpers ────────────────────────────────────────────────────

    def screenshot(self, name: str) -> Path:
        path = Config.SCREENSHOTS_DIR / f"{name}.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        self.page.screenshot(path=str(path), full_page=True)
        return path

    # ── Navigation bar helpers ────────────────────────────────────────────────

    def click_nav_link(self, label: str) -> None:
        """Click a sidebar or tab-bar nav link by aria-label or text."""
        nav = self.page.locator("nav, [role='navigation']")
        nav.get_by_text(label).click()

    def is_authenticated(self) -> bool:
        """Return True if the app shows authenticated UI."""
        return "/auth/login" not in self.page.url
