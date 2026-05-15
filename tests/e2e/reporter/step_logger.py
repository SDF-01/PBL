"""
StepLogger — context-manager step recorder with automatic screenshots.

Usage in a test:
    def test_something(self, player, steps):
        steps.page = player.page        # bind once per test
        with steps.step("Open profile"):
            player.navigate_to_own_profile()
        with steps.step("Assert name visible"):
            player.assert_profile_loaded()
"""
from __future__ import annotations

import base64
import traceback
from contextlib import contextmanager
from typing import Generator, Optional

from playwright.sync_api import Page

from tests.e2e.reporter.models import StepRecord


class StepLogger:
    """Collects named steps with optional Playwright screenshots."""

    def __init__(self) -> None:
        self._steps: list[StepRecord] = []
        self.page: Optional[Page] = None

    # ── Public API ────────────────────────────────────────────────────────────

    @contextmanager
    def step(self, description: str) -> Generator[None, None, None]:
        """
        Context manager for a single test step.
        Captures a screenshot after the block completes (pass or fail).
        """
        idx = len(self._steps) + 1
        rec = StepRecord(index=idx, description=description)
        try:
            yield
            rec.passed = True
        except Exception as exc:
            rec.passed = False
            rec.error = f"{type(exc).__name__}: {exc}"
            rec.screenshot_b64 = self._capture()
            self._steps.append(rec)
            raise
        else:
            rec.screenshot_b64 = self._capture()
            self._steps.append(rec)

    def capture(self, description: str = "Manual capture") -> None:
        """Take a named screenshot outside a step block (e.g., mid-step evidence)."""
        idx = len(self._steps) + 1
        self._steps.append(
            StepRecord(
                index=idx,
                description=description,
                passed=True,
                screenshot_b64=self._capture(),
            )
        )

    # ── Internals ─────────────────────────────────────────────────────────────

    def _capture(self) -> str | None:
        if self.page is None:
            return None
        try:
            raw = self.page.screenshot(full_page=False)
            return base64.b64encode(raw).decode("ascii")
        except Exception:
            return None

    @property
    def records(self) -> list[StepRecord]:
        return list(self._steps)

    def clear(self) -> None:
        self._steps.clear()
