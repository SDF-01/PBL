"""Auth page objects — login, signup, logout, password reset."""
from __future__ import annotations

from playwright.sync_api import Page, expect

from tests.e2e.config import Config
from tests.e2e.pages.base_page import BasePage


class AuthPage(BasePage):
    def __init__(self, page: Page) -> None:
        super().__init__(page)

    # ── Locators ──────────────────────────────────────────────────────────────

    @property
    def email_field(self):
        return self.page.get_by_label("Email", exact=False)

    @property
    def password_field(self):
        return self.page.get_by_label("Password", exact=False)

    @property
    def sign_in_button(self):
        return self.page.get_by_role("button", name="Sign In")

    @property
    def sign_up_button(self):
        return self.page.get_by_role("button", name="Sign Up")

    @property
    def google_button(self):
        return self.page.get_by_role("button", name="Google")

    @property
    def error_message(self):
        return self.page.locator("[role='alert'], .text-red-500, .text-destructive")

    # ── Actions ───────────────────────────────────────────────────────────────

    def navigate_to_login(self) -> None:
        self.goto(Config.Routes.LOGIN)
        self.wait_for_page_ready()

    def navigate_to_signup(self) -> None:
        self.goto(Config.Routes.SIGNUP)
        self.wait_for_page_ready()

    def navigate_to_forgot_password(self) -> None:
        self.goto(Config.Routes.FORGOT_PASSWORD)
        self.wait_for_page_ready()

    def sign_in(self, email: str, password: str) -> None:
        """Fill credentials and submit the login form."""
        self.email_field.fill(email)
        self.password_field.fill(password)
        self.sign_in_button.click()
        # Wait until redirected away from login
        self.page.wait_for_url(
            lambda url: "/auth/login" not in url, timeout=15_000
        )

    def sign_in_as(self, persona: str) -> None:
        """Sign in using a named persona from Config."""
        creds = {
            "player": Config.PLAYER,
            "coordinator": Config.COORDINATOR,
            "director": Config.DIRECTOR,
            "admin": Config.ADMIN,
        }[persona]
        self.navigate_to_login()
        self.sign_in(creds["email"], creds["password"])

    def sign_up(
        self,
        email: str,
        password: str,
        first_name: str,
        last_name: str,
        phone: str = "",
    ) -> None:
        """Fill and submit the registration form."""
        self.navigate_to_signup()
        self.page.get_by_label("First Name").fill(first_name)
        self.page.get_by_label("Last Name").fill(last_name)
        self.page.get_by_label("Email").fill(email)
        if phone:
            self.page.get_by_label("Phone").fill(phone)
        self.page.get_by_label("Password").fill(password)
        self.sign_up_button.click()
        self.wait_for_page_ready()

    def sign_out(self) -> None:
        """Click sign-out from nav or profile menu."""
        # Try dropdown/profile menu first
        profile_trigger = self.page.locator(
            "[aria-label='Profile menu'], [data-testid='user-menu']"
        ).first
        try:
            profile_trigger.click(timeout=3_000)
        except Exception:
            pass

        sign_out_btn = self.page.get_by_role("button", name="Sign Out").or_(
            self.page.get_by_role("menuitem", name="Sign Out")
        )
        sign_out_btn.click()
        self.page.wait_for_url(
            lambda url: "/auth/login" in url or url.endswith("/"), timeout=10_000
        )

    def request_password_reset(self, email: str) -> None:
        self.navigate_to_forgot_password()
        self.page.get_by_label("Email").fill(email)
        self.page.get_by_role("button", name="Send Reset Email").click()
        self.wait_for_page_ready()

    # ── Assertions ────────────────────────────────────────────────────────────

    def assert_on_login_page(self) -> None:
        expect(self.page).to_have_url(
            lambda url: "/auth/login" in url, timeout=5_000
        )

    def assert_signed_in(self) -> None:
        assert "/auth/login" not in self.page.url, (
            f"Expected to be signed in but URL is: {self.page.url}"
        )

    def assert_error_visible(self, text: str | None = None) -> None:
        error = self.error_message
        expect(error.first).to_be_visible(timeout=5_000)
        if text:
            expect(error.first).to_contain_text(text)
