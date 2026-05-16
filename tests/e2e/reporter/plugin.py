"""
Pytest plugin — collects use_case marker data + step records per test,
then generates the HTML report in pytest_sessionfinish.
"""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import pytest

from tests.e2e.reporter.models import UseCaseResult
from tests.e2e.reporter.html_generator import generate_report

# Registry shared across the entire session
_results: list[UseCaseResult] = []
_start_times: dict[str, float] = {}


# ── Hooks ─────────────────────────────────────────────────────────────────────


def pytest_runtest_setup(item: pytest.Item) -> None:
    _start_times[item.nodeid] = time.monotonic()


def pytest_runtest_logreport(report: pytest.TestReport) -> None:
    if report.when != "call":
        return

    item = _find_item_by_nodeid(report.nodeid)
    uc_mark = _get_use_case_mark(report.nodeid)

    uc_id = uc_mark.get("id", "UC-???") if uc_mark else "UC-???"
    name = uc_mark.get("name", report.nodeid.split("::")[-1].replace("_", " ")) if uc_mark else report.nodeid.split("::")[-1].replace("_", " ")
    persona = uc_mark.get("persona", _infer_persona(report.nodeid)) if uc_mark else _infer_persona(report.nodeid)
    criteria = uc_mark.get("criteria", []) if uc_mark else []

    duration = time.monotonic() - _start_times.get(report.nodeid, time.monotonic())

    if report.passed:
        status = "PASS"
        error_msg = None
        tb = None
    elif report.skipped:
        status = "SKIP"
        error_msg = str(report.longrepr) if report.longrepr else None
        tb = None
    else:
        status = "FAIL"
        if report.longrepr:
            error_msg = str(report.longrepr).split("\n")[-1]
            tb = str(report.longrepr)
        else:
            error_msg = "Unknown failure"
            tb = None

    # Pull steps from the StepLogger stored on the item (set by the fixture)
    steps = []
    if hasattr(report, "_pbl_steps"):
        steps = report._pbl_steps

    result = UseCaseResult(
        node_id=report.nodeid,
        uc_id=uc_id,
        name=name,
        persona=persona,
        criteria=criteria,
        steps=steps,
        status=status,
        duration_s=round(duration, 2),
        error_message=error_msg,
        error_traceback=tb,
    )
    _results.append(result)


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    if not _results:
        return

    import json

    report_dir = Path(__file__).parent.parent / "reports"
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / "e2e_report.html"

    generate_report(_results, report_path)
    print(f"\n\n  E2E Report -> {report_path.resolve()}\n")

    # Write machine-readable JSON for the portal
    json_path = report_dir / "run_results.json"
    json_path.write_text(
        json.dumps([_result_to_dict(r) for r in _results], indent=2),
        encoding="utf-8",
    )


def _result_to_dict(r) -> dict:
    return {
        "node_id": r.node_id,
        "uc_id": r.uc_id,
        "name": r.name,
        "persona": r.persona,
        "criteria": r.criteria,
        "status": r.status,
        "duration_s": r.duration_s,
        "error_message": r.error_message,
        "steps": [
            {
                "index": s.index,
                "description": s.description,
                "passed": s.passed,
                "error": s.error,
                "screenshot_b64": s.screenshot_b64,
            }
            for s in r.steps
        ],
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

# Items are not directly accessible in logreport; we cache mark data via
# the pytest_collection_finish hook instead.
_item_marks: dict[str, dict[str, Any]] = {}


def pytest_collection_finish(session: pytest.Session) -> None:
    for item in session.items:
        mark = item.get_closest_marker("use_case")
        if mark:
            _item_marks[item.nodeid] = mark.kwargs


def _get_use_case_mark(nodeid: str) -> dict[str, Any] | None:
    return _item_marks.get(nodeid)


def _find_item_by_nodeid(nodeid: str):
    return None


def _infer_persona(nodeid: str) -> str:
    parts = nodeid.lower()
    if "player" in parts:
        return "Player"
    if "coordinator" in parts:
        return "Coordinator"
    if "director" in parts:
        return "Director"
    if "admin" in parts:
        return "Admin"
    if "auth" in parts:
        return "Auth"
    if "rbac" in parts:
        return "RBAC"
    return "General"
