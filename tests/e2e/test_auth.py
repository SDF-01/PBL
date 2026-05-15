"""
Authentication flow tests — login, signup, logout, password reset.
"""
import pytest
from playwright.sync_api import expect

from tests.e2e.config import Config
from tests.e2e.pages import AuthPage
from tests.e2e.reporter.step_logger import StepLogger


@pytest.mark.auth
class TestEmailLogin:

    @pytest.mark.use_case(
        id="UC-AUTH-001",
        name="Valid credentials redirect to app",
        persona="Auth",
        criteria=[
            "Login form accepts email and password",
            "Correct credentials redirect away from /auth/login",
            "User is not returned to the login page",
        ],
    )
    def test_valid_credentials_redirect_to_app(self, auth_page: AuthPage, steps: StepLogger):
        steps.page = auth_page.page
        with steps.step("Navigate to login page"):
            auth_page.navigate_to_login()
        with steps.step("Enter valid player credentials and submit"):
            auth_page.sign_in(Config.PLAYER["email"], Config.PLAYER["password"])
        with steps.step("Verify redirected away from login"):
            auth_page.assert_signed_in()
            assert "/auth/login" not in auth_page.page.url

    @pytest.mark.use_case(
        id="UC-AUTH-002",
        name="Wrong password shows error message",
        persona="Auth",
        criteria=[
            "Submitting an incorrect password shows an inline error",
            "User remains on the login page",
            "No redirect occurs",
        ],
    )
    def test_wrong_password_shows_error(self, auth_page: AuthPage, steps: StepLogger):
        steps.page = auth_page.page
        with steps.step("Navigate to login page"):
            auth_page.navigate_to_login()
        with steps.step("Submit with wrong password"):
            auth_page.sign_in(Config.PLAYER["email"], "WrongPassword999!")
        with steps.step("Verify error message is visible"):
            auth_page.assert_error_visible()
        with steps.step("Verify still on login page"):
            assert "/auth/login" in auth_page.page.url

    @pytest.mark.use_case(
        id="UC-AUTH-003",
        name="Empty email prevents form submission",
        persona="Auth",
        criteria=[
            "Submitting with a blank email field does not navigate away",
            "Client-side validation fires before network request",
        ],
    )
    def test_empty_email_shows_validation(self, auth_page: AuthPage, steps: StepLogger):
        steps.page = auth_page.page
        with steps.step("Navigate to login page"):
            auth_page.navigate_to_login()
        with steps.step("Fill only password, leave email blank"):
            auth_page.page.get_by_label("Password").fill("somepassword")
        with steps.step("Click Sign In without email"):
            auth_page.sign_in_button.click()
        with steps.step("Confirm still on login page"):
            assert "/auth/login" in auth_page.page.url

    @pytest.mark.use_case(
        id="UC-AUTH-004",
        name="Unknown email shows authentication error",
        persona="Auth",
        criteria=[
            "A non-existent account returns an error",
            "No crash or unhandled exception occurs",
        ],
    )
    def test_unknown_email_shows_error(self, auth_page: AuthPage, steps: StepLogger):
        steps.page = auth_page.page
        with steps.step("Navigate to login page"):
            auth_page.navigate_to_login()
        with steps.step("Submit credentials for non-existent account"):
            auth_page.sign_in("nonexistent.user999@pbl-arena.test", "SomePassword123!")
        with steps.step("Verify error is displayed"):
            auth_page.assert_error_visible()

    @pytest.mark.use_case(
        id="UC-AUTH-005",
        name="Login page has signup link",
        persona="Auth",
        criteria=[
            "A 'Sign Up' or 'Create Account' link is visible on the login page",
            "Clicking it navigates to /auth/signup",
        ],
    )
    def test_login_page_has_signup_link(self, auth_page: AuthPage, steps: StepLogger):
        steps.page = auth_page.page
        with steps.step("Navigate to login page"):
            auth_page.navigate_to_login()
        with steps.step("Find signup link"):
            signup_link = auth_page.page.get_by_role("link", name="Sign Up").or_(
                auth_page.page.get_by_role("link", name="Create Account")
            )
            expect(signup_link.first).to_be_visible()
        with steps.step("Click signup link and verify navigation"):
            signup_link.first.click()
            assert "/auth/signup" in auth_page.page.url

    @pytest.mark.use_case(
        id="UC-AUTH-006",
        name="Login page has forgot-password link",
        persona="Auth",
        criteria=[
            "A forgot-password link is visible on the login page",
        ],
    )
    def test_login_page_has_forgot_password_link(self, auth_page: AuthPage, steps: StepLogger):
        steps.page = auth_page.page
        with steps.step("Navigate to login page"):
            auth_page.navigate_to_login()
        with steps.step("Verify forgot-password link is visible"):
            link = auth_page.page.get_by_role("link", name="Forgot").or_(
                auth_page.page.get_by_text("Forgot Password", exact=False)
            )
            expect(link.first).to_be_visible()


@pytest.mark.auth
class TestSignup:

    @pytest.mark.use_case(
        id="UC-AUTH-007",
        name="Signup form renders all required fields",
        persona="Auth",
        criteria=[
            "First Name field is present",
            "Last Name field is present",
            "Email field is present",
            "Password field is present",
        ],
    )
    def test_signup_form_renders_all_fields(self, auth_page: AuthPage, steps: StepLogger):
        steps.page = auth_page.page
        with steps.step("Navigate to signup page"):
            auth_page.navigate_to_signup()
        with steps.step("Verify First Name field exists"):
            expect(auth_page.page.get_by_label("First Name", exact=False)).to_be_visible()
        with steps.step("Verify Last Name field exists"):
            expect(auth_page.page.get_by_label("Last Name", exact=False)).to_be_visible()
        with steps.step("Verify Email field exists"):
            expect(auth_page.page.get_by_label("Email", exact=False)).to_be_visible()
        with steps.step("Verify Password field exists"):
            expect(auth_page.page.get_by_label("Password", exact=False)).to_be_visible()

    @pytest.mark.use_case(
        id="UC-AUTH-008",
        name="Weak password shows strength indicator",
        persona="Auth",
        criteria=[
            "Typing a weak password surfaces a visual strength indicator",
            "Indicator appears without form submission",
        ],
    )
    def test_weak_password_shows_strength_indicator(self, auth_page: AuthPage, steps: StepLogger):
        steps.page = auth_page.page
        with steps.step("Navigate to signup page"):
            auth_page.navigate_to_signup()
        with steps.step("Type a weak password"):
            auth_page.page.get_by_label("Password").fill("abc")
        with steps.step("Verify strength indicator appears"):
            strength = auth_page.page.get_by_text("Weak", exact=False).or_(
                auth_page.page.locator(".password-strength, [data-testid='pw-strength']")
            )
            expect(strength.first).to_be_visible(timeout=3_000)

    @pytest.mark.use_case(
        id="UC-AUTH-009",
        name="Duplicate email returns error on signup",
        persona="Auth",
        criteria=[
            "Registering with an already-used email shows an error",
            "No account is created",
        ],
    )
    def test_duplicate_email_shows_error(self, auth_page: AuthPage, steps: StepLogger):
        steps.page = auth_page.page
        with steps.step("Navigate to signup page"):
            auth_page.navigate_to_signup()
        with steps.step("Submit form with an existing email"):
            auth_page.sign_up(
                email=Config.PLAYER["email"],
                password="NewPassword123!",
                first_name="Dup",
                last_name="User",
            )
        with steps.step("Verify error message is shown"):
            auth_page.assert_error_visible()


@pytest.mark.auth
class TestPasswordReset:

    @pytest.mark.use_case(
        id="UC-AUTH-010",
        name="Forgot password form renders correctly",
        persona="Auth",
        criteria=[
            "Email field is present",
            "Submit button is present",
        ],
    )
    def test_forgot_password_form_renders(self, auth_page: AuthPage, steps: StepLogger):
        steps.page = auth_page.page
        with steps.step("Navigate to forgot-password page"):
            auth_page.navigate_to_forgot_password()
        with steps.step("Verify email field is visible"):
            expect(auth_page.page.get_by_label("Email", exact=False)).to_be_visible()
        with steps.step("Verify send-reset button is visible"):
            expect(
                auth_page.page.get_by_role("button", name="Send Reset Email").or_(
                    auth_page.page.get_by_role("button", name="Send")
                )
            ).to_be_visible()

    @pytest.mark.use_case(
        id="UC-AUTH-011",
        name="Unknown email handled gracefully on password reset",
        persona="Auth",
        criteria=[
            "Submitting an unknown email does not crash the page",
            "A confirmation or success message is shown",
        ],
    )
    def test_unknown_email_handled_gracefully(self, auth_page: AuthPage, steps: StepLogger):
        steps.page = auth_page.page
        with steps.step("Navigate to forgot-password page"):
            auth_page.navigate_to_forgot_password()
        with steps.step("Submit an unknown email"):
            auth_page.request_password_reset("totally.unknown@pbl-arena.test")
        with steps.step("Verify confirmation message appears"):
            confirmation = auth_page.page.get_by_text("Reset email", exact=False).or_(
                auth_page.page.get_by_text("Check your email", exact=False)
            )
            expect(confirmation.first).to_be_visible(timeout=8_000)


@pytest.mark.auth
class TestSignOut:

    @pytest.mark.use_case(
        id="UC-AUTH-012",
        name="Sign out redirects to login or home",
        persona="Auth",
        criteria=[
            "Clicking sign-out removes the authenticated session",
            "User is redirected to /auth/login or the home page",
        ],
    )
    def test_sign_out_redirects_to_login(self, player_page_ctx, steps: StepLogger):
        auth = AuthPage(player_page_ctx)
        steps.page = player_page_ctx
        with steps.step("Navigate to dashboard as player"):
            auth.navigate_to_dashboard()
        with steps.step("Trigger sign-out"):
            auth.sign_out()
        with steps.step("Verify redirected to login or home"):
            assert "/auth/login" in auth.page.url or auth.page.url.endswith("/")
