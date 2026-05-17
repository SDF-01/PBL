"""
Pytest fixtures and configuration for PBL Arena E2E tests.

Fixture hierarchy:
  browser_context_args  ← viewport, locale, permissions
  browser_context       ← one per session (auth state stored per persona)
  page                  ← one per test
  steps                 ← StepLogger bound to the active page
  auth_page / player_page / ... ← convenience page objects
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Generator

import pytest
from faker import Faker
from playwright.sync_api import (
    BrowserContext,
    Page,
    Playwright,
    sync_playwright,
)

from tests.e2e.config import Config
from tests.e2e.pages import (
    AdminPage,
    AuthPage,
    ClubPage,
    DashboardPage,
    LadderPage,
    LeaguePage,
    PlayerPage,
)
from tests.e2e.reporter.step_logger import StepLogger

fake = Faker()

# Paths where auth state is cached so each persona only logs in once per run
_AUTH_STATES_DIR = Path(__file__).parent / ".auth"
_AUTH_STATES_DIR.mkdir(exist_ok=True)


def _auth_state_path(persona: str) -> Path:
    return _AUTH_STATES_DIR / f"{persona}.json"


# ── Playwright / browser setup ─────────────────────────────────────────────────


@pytest.fixture(scope="session")
def playwright_instance() -> Generator[Playwright, None, None]:
    with sync_playwright() as pw:
        yield pw


@pytest.fixture(scope="session")
def browser_type(playwright_instance: Playwright):
    browsers = {
        "chromium": playwright_instance.chromium,
        "firefox": playwright_instance.firefox,
        "webkit": playwright_instance.webkit,
    }
    return browsers[Config.BROWSER]


@pytest.fixture(scope="session")
def browser(browser_type):
    b = browser_type.launch(
        headless=Config.HEADLESS,
        slow_mo=Config.SLOW_MO,
    )
    yield b
    b.close()


def _make_context(browser, persona: str | None = None) -> BrowserContext:
    """Create a browser context, restoring saved auth state if available."""
    state_path = _auth_state_path(persona) if persona else None
    storage_state = str(state_path) if (state_path and state_path.exists()) else None

    ctx = browser.new_context(
        viewport={"width": 1280, "height": 800},
        locale="en-US",
        timezone_id="America/Chicago",
        permissions=["geolocation"],
        geolocation={"latitude": 30.2672, "longitude": -97.7431},  # Austin, TX
        storage_state=storage_state,
        record_video_dir=(
            str(Config.VIDEOS_DIR) if os.getenv("RECORD_VIDEO") else None
        ),
    )
    ctx.set_default_timeout(Config.DEFAULT_TIMEOUT)
    ctx.set_default_navigation_timeout(Config.NAVIGATION_TIMEOUT)
    return ctx


# ── Per-persona authenticated contexts (session-scoped) ───────────────────────


def _authenticated_context(browser, persona: str) -> BrowserContext:
    """
    Return a browser context logged in as `persona`.
    Logs in once per test-run and caches the auth state to disk.
    """
    state_path = _auth_state_path(persona)
    ctx = _make_context(browser, persona)

    if not state_path.exists():
        page = ctx.new_page()
        auth = AuthPage(page)
        auth.sign_in_as(persona)
        ctx.storage_state(path=str(state_path))
        page.close()

    return ctx


@pytest.fixture(scope="session")
def player_context(browser) -> Generator[BrowserContext, None, None]:
    ctx = _authenticated_context(browser, "player")
    yield ctx
    ctx.close()


@pytest.fixture(scope="session")
def coordinator_context(browser) -> Generator[BrowserContext, None, None]:
    ctx = _authenticated_context(browser, "coordinator")
    yield ctx
    ctx.close()


@pytest.fixture(scope="session")
def director_context(browser) -> Generator[BrowserContext, None, None]:
    ctx = _authenticated_context(browser, "director")
    yield ctx
    ctx.close()


@pytest.fixture(scope="session")
def admin_context(browser) -> Generator[BrowserContext, None, None]:
    ctx = _authenticated_context(browser, "admin")
    yield ctx
    ctx.close()


# ── Per-test page fixtures (function-scoped) ──────────────────────────────────


def _make_page_fixture(context_fixture_name: str):
    """Return a plain function (no fixture decorator) for each persona context."""
    def _fixture(request) -> Generator[Page, None, None]:
        ctx = request.getfixturevalue(context_fixture_name)
        page = ctx.new_page()
        yield page
        rep = getattr(request.node, "rep_call", None)
        if rep and rep.failed:
            name = request.node.nodeid.replace("/", "_").replace("::", "_")
            path = Config.SCREENSHOTS_DIR / f"FAIL_{name}.png"
            path.parent.mkdir(parents=True, exist_ok=True)
            try:
                page.screenshot(path=str(path), full_page=True)
            except Exception:
                pass
        page.close()

    return _fixture


# Register per-persona page fixtures (apply @pytest.fixture exactly once each)
@pytest.fixture
def player_page_ctx(request) -> Generator[Page, None, None]:
    yield from _make_page_fixture("player_context")(request)


@pytest.fixture
def coordinator_page_ctx(request) -> Generator[Page, None, None]:
    yield from _make_page_fixture("coordinator_context")(request)


@pytest.fixture
def director_page_ctx(request) -> Generator[Page, None, None]:
    yield from _make_page_fixture("director_context")(request)


@pytest.fixture
def admin_page_ctx(request) -> Generator[Page, None, None]:
    yield from _make_page_fixture("admin_context")(request)


# ── Unauthenticated page ───────────────────────────────────────────────────────


@pytest.fixture
def anon_page(browser) -> Generator[Page, None, None]:
    ctx = _make_context(browser, persona=None)
    try:
        page = ctx.new_page()
    except Exception:
        ctx.close()
        raise
    yield page
    page.close()
    ctx.close()


# ── StepLogger fixture ────────────────────────────────────────────────────────


@pytest.fixture
def steps() -> StepLogger:
    """
    Provides a StepLogger for the current test.
    Bind it to the active page: steps.page = some_page_object.page
    Use it as: with steps.step("description"): ...
    """
    return StepLogger()


# ── Page-object convenience fixtures ─────────────────────────────────────────


@pytest.fixture
def auth_page(anon_page: Page) -> AuthPage:
    return AuthPage(anon_page)


@pytest.fixture
def player(player_page_ctx: Page) -> PlayerPage:
    return PlayerPage(player_page_ctx)


@pytest.fixture
def player_ladder(player_page_ctx: Page) -> LadderPage:
    return LadderPage(player_page_ctx)


@pytest.fixture
def player_club(player_page_ctx: Page) -> ClubPage:
    return ClubPage(player_page_ctx)


@pytest.fixture
def player_league(player_page_ctx: Page) -> LeaguePage:
    return LeaguePage(player_page_ctx)


@pytest.fixture
def player_dashboard(player_page_ctx: Page) -> DashboardPage:
    return DashboardPage(player_page_ctx)


@pytest.fixture
def coordinator(coordinator_page_ctx: Page) -> LadderPage:
    return LadderPage(coordinator_page_ctx)


@pytest.fixture
def coordinator_league(coordinator_page_ctx: Page) -> LeaguePage:
    return LeaguePage(coordinator_page_ctx)


@pytest.fixture
def director(director_page_ctx: Page) -> ClubPage:
    return ClubPage(director_page_ctx)


@pytest.fixture
def director_league(director_page_ctx: Page) -> LeaguePage:
    return LeaguePage(director_page_ctx)


@pytest.fixture
def admin(admin_page_ctx: Page) -> AdminPage:
    return AdminPage(admin_page_ctx)


# ── Test data helpers ─────────────────────────────────────────────────────────


@pytest.fixture
def unique_club_name() -> str:
    return f"Test Club {fake.unique.bothify(text='??-###')}"


@pytest.fixture
def unique_league_name() -> str:
    return f"Test League {fake.unique.bothify(text='??-###')}"


@pytest.fixture
def unique_email() -> str:
    return f"test.{fake.unique.bothify(text='???###')}@pbl-arena.test"


# ── Hooks: screenshot on failure + attach steps to report ─────────────────────


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item: pytest.Item, call):
    outcome = yield
    rep = outcome.get_result()
    setattr(item, "rep_" + rep.when, rep)

    # Attach step records to the report object so the plugin can read them
    if rep.when == "call":
        steps_fixture = item.funcargs.get("steps")
        if isinstance(steps_fixture, StepLogger):
            rep._pbl_steps = steps_fixture.records
        else:
            rep._pbl_steps = []
