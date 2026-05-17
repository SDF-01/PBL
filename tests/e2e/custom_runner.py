#!/usr/bin/env python3
"""
Custom test case runner for PBL Arena E2E portal.

Reads case definitions from a JSON file, runs each one with Playwright,
and writes results to an output JSON file.

Usage (called by portal.py):
    py -3 tests/e2e/custom_runner.py
        --cases-file  PATH
        --case-ids    ID1 ID2 ...
        --output-file PATH
        --auth-dir    PATH
        --base-url    http://localhost:3000
        [--headless true|false]
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
import time
from pathlib import Path
from typing import Any

try:
    from playwright.sync_api import sync_playwright, Page
except ImportError:
    print(json.dumps([{"error": "playwright not installed"}]))
    sys.exit(1)


# ── Step executor ──────────────────────────────────────────────────────────────

def _auto_desc(step: dict) -> str:
    t = step.get("type", "")
    if t == "navigate":        return f"Navigate to {step.get('url', '/')}"
    if t == "click_role":      return f"Click {step.get('role','element')} \"{step.get('name','')}\""
    if t == "click_text":      return f"Click \"{step.get('text','')}\""
    if t == "fill_placeholder":return f"Fill \"{step.get('placeholder','')}\" with value"
    if t == "fill_label":      return f"Fill \"{step.get('label','')}\" with value"
    if t == "assert_text":     return f"Assert text \"{step.get('text','')}\" is visible"
    if t == "assert_url_contains":     return f"Assert URL contains \"{step.get('contains','')}\""
    if t == "assert_not_url":  return f"Assert URL does NOT contain \"{step.get('not_contains','')}\""
    if t == "wait_networkidle":return "Wait for page to load"
    if t == "screenshot":      return step.get("label", "Take screenshot")
    return f"Step: {t}"


def _capture(page: Page) -> str | None:
    try:
        raw = page.screenshot(full_page=False)
        return base64.b64encode(raw).decode("ascii")
    except Exception:
        return None


def _run_step(page: Page, step: dict, base_url: str) -> None:
    t = step.get("type", "")

    if t == "navigate":
        url = step.get("url", "/")
        page.goto(base_url.rstrip("/") + url, wait_until="networkidle")

    elif t == "click_role":
        role = step.get("role", "button")
        name = step.get("name", "")
        loc = page.get_by_role(role, name=name) if name else page.get_by_role(role)
        loc.first.click()
        page.wait_for_load_state("networkidle")

    elif t == "click_text":
        text = step.get("text", "")
        exact = step.get("exact", False)
        page.get_by_text(text, exact=exact).first.click()
        page.wait_for_load_state("networkidle")

    elif t == "fill_placeholder":
        ph  = step.get("placeholder", "")
        val = step.get("value", "")
        page.get_by_placeholder(ph).fill(val)

    elif t == "fill_label":
        lbl = step.get("label", "")
        val = step.get("value", "")
        page.get_by_label(lbl).fill(val)

    elif t == "assert_text":
        text  = step.get("text", "")
        exact = step.get("exact", False)
        el = page.get_by_text(text, exact=exact).first
        assert el.is_visible(timeout=8_000), f"Expected text not visible: {text!r}"

    elif t == "assert_url_contains":
        contains = step.get("contains", "")
        assert contains in page.url, (
            f"URL {page.url!r} does not contain {contains!r}"
        )

    elif t == "assert_not_url":
        fragment = step.get("not_contains", "")
        assert fragment not in page.url, (
            f"URL should not contain {fragment!r} but got: {page.url!r}"
        )

    elif t == "wait_networkidle":
        page.wait_for_load_state("networkidle")

    elif t == "screenshot":
        pass  # screenshot taken after every step automatically

    else:
        raise ValueError(f"Unknown step type: {t!r}")


def run_case(pw, case: dict, auth_dir: Path, base_url: str, headless: bool) -> dict:
    persona = case.get("persona", "anon")
    auth_path = auth_dir / f"{persona}.json"

    browser = pw.chromium.launch(headless=headless, slow_mo=0)
    ctx_kwargs: dict[str, Any] = {
        "viewport": {"width": 1280, "height": 800},
        "locale": "en-US",
    }
    if persona != "anon" and auth_path.exists():
        ctx_kwargs["storage_state"] = str(auth_path)

    ctx = browser.new_context(**ctx_kwargs)
    ctx.set_default_timeout(15_000)
    ctx.set_default_navigation_timeout(30_000)
    page = ctx.new_page()

    step_records: list[dict] = []
    overall_passed = True
    start = time.monotonic()
    error_message = None

    for i, step in enumerate(case.get("steps", [])):
        desc = step.get("description") or _auto_desc(step)
        rec: dict[str, Any] = {
            "index": i + 1,
            "description": desc,
            "passed": True,
            "error": None,
            "screenshot_b64": None,
        }
        try:
            _run_step(page, step, base_url)
            rec["passed"] = True
        except Exception as exc:
            rec["passed"] = False
            rec["error"] = f"{type(exc).__name__}: {exc}"
            overall_passed = False
            error_message = rec["error"]
        finally:
            rec["screenshot_b64"] = _capture(page)
        step_records.append(rec)
        if not rec["passed"]:
            break  # stop on first failure

    duration = round(time.monotonic() - start, 2)

    try:
        browser.close()
    except Exception:
        pass

    return {
        "node_id": f"custom::{case['id']}",
        "uc_id": case["id"],
        "name": case.get("name", case["id"]),
        "persona": persona.capitalize(),
        "criteria": case.get("criteria", []),
        "steps": step_records,
        "status": "PASS" if overall_passed else "FAIL",
        "duration_s": duration,
        "error_message": error_message,
        "error_traceback": None,
    }


# ── Entry point ────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cases-file",  required=True)
    parser.add_argument("--case-ids",    nargs="+", required=True)
    parser.add_argument("--output-file", required=True)
    parser.add_argument("--auth-dir",    required=True)
    parser.add_argument("--base-url",    default="http://localhost:3000")
    parser.add_argument("--headless",    default="true")
    args = parser.parse_args()

    headless = args.headless.lower() != "false"
    auth_dir = Path(args.auth_dir)
    output_file = Path(args.output_file)

    cases_data = json.loads(Path(args.cases_file).read_text(encoding="utf-8"))
    all_cases: dict = cases_data.get("cases", {})

    requested = args.case_ids
    missing = [cid for cid in requested if cid not in all_cases]
    for cid in missing:
        print(f"  WARNING: unknown case ID skipped: {cid}", flush=True, file=sys.stderr)

    cases_to_run = [all_cases[cid] for cid in requested if cid in all_cases]

    if not cases_to_run:
        print("  ERROR: no valid cases to run — all requested IDs are unknown", flush=True, file=sys.stderr)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        output_file.write_text(json.dumps([], indent=2), encoding="utf-8")
        sys.exit(1)

    results = []
    with sync_playwright() as pw:
        for case in cases_to_run:
            print(f"  Running: {case['id']} — {case.get('name', '')}", flush=True)
            result = run_case(pw, case, auth_dir, args.base_url, headless)
            results.append(result)
            status = result["status"]
            print(f"  {status}: {case['id']}", flush=True)

    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\n  Custom run complete — {len(results)} cases", flush=True)


if __name__ == "__main__":
    main()
