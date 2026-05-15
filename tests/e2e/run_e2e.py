"""
PBL Arena E2E test runner with automatic dev-server management.

Usage:
  python tests/e2e/run_e2e.py                     # run all tests
  python tests/e2e/run_e2e.py -m player            # run player persona only
  python tests/e2e/run_e2e.py -m "not slow"        # skip write-heavy tests
  python tests/e2e/run_e2e.py --no-server          # skip server startup (already running)
  python tests/e2e/run_e2e.py --mode static        # serve the built 'out/' folder
  python tests/e2e/run_e2e.py -k test_login -v     # any extra pytest args work too

Environment variables (or .env.test):
  BASE_URL          default http://localhost:3000
  SERVER_START_CMD  override the startup command
  HEADLESS          true / false
  BROWSER           chromium / firefox / webkit
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent.parent   # repo root
E2E  = Path(__file__).resolve().parent                 # tests/e2e/
REPORT = E2E / "reports" / "e2e_report.html"

# ── Server management ─────────────────────────────────────────────────────────

_SERVER_CMDS = {
    "dev":    ["npm", "run", "dev"],
    "static": ["npm", "start"],          # serves the pre-built out/ directory
}


def _wait_for_server(url: str, timeout: int = 90, interval: float = 1.5) -> bool:
    print(f"  Waiting for server at {url} (timeout {timeout}s)...")
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            urllib.request.urlopen(url, timeout=3)
            return True
        except (urllib.error.URLError, OSError):
            time.sleep(interval)
    return False


def _start_server(mode: str) -> subprocess.Popen:
    cmd = os.getenv("SERVER_START_CMD", "").split() or _SERVER_CMDS.get(mode, _SERVER_CMDS["dev"])
    print(f"  Starting server: {' '.join(cmd)}")
    env = {**os.environ, "BROWSER": "none"}   # prevent Next.js auto-opening a browser
    proc = subprocess.Popen(
        cmd,
        cwd=str(ROOT),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    return proc


# ── Argument parsing ──────────────────────────────────────────────────────────


def _parse_args() -> tuple[argparse.Namespace, list[str]]:
    parser = argparse.ArgumentParser(
        description="Run PBL Arena E2E tests with optional dev-server startup.",
        add_help=True,
    )
    parser.add_argument(
        "--no-server",
        action="store_true",
        help="Skip server startup; assume the app is already running.",
    )
    parser.add_argument(
        "--mode",
        choices=["dev", "static"],
        default="dev",
        help="Server mode: 'dev' (npm run dev) or 'static' (npm start). Default: dev",
    )
    parser.add_argument(
        "--open-report",
        action="store_true",
        help="Open the HTML report in a browser after tests finish.",
    )
    parser.add_argument(
        "--base-url",
        default=os.getenv("BASE_URL", "http://localhost:3000"),
        help="Base URL to poll when waiting for the server.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=90,
        help="Seconds to wait for the server to become responsive. Default: 90",
    )
    return parser.parse_known_args()


# ── Main ──────────────────────────────────────────────────────────────────────


def main() -> int:
    args, pytest_extra = _parse_args()

    server_proc: subprocess.Popen | None = None
    exit_code = 1

    try:
        # ── Step 1: start server ─────────────────────────────────────────────
        if args.no_server:
            print(f"[run_e2e] Skipping server startup; assuming {args.base_url} is live.")
        else:
            print(f"\n[run_e2e] Starting {args.mode.upper()} server...")
            server_proc = _start_server(args.mode)
            ready = _wait_for_server(args.base_url, timeout=args.timeout)
            if not ready:
                print(f"\n[run_e2e] ERROR: Server did not respond at {args.base_url} "
                      f"within {args.timeout}s.")
                _dump_server_output(server_proc)
                return 1
            print(f"[run_e2e] Server ready at {args.base_url}\n")

        # ── Step 2: run pytest ───────────────────────────────────────────────
        pytest_cmd = [
            sys.executable, "-m", "pytest",
            "tests/e2e",
            "--tb=short",
            "-v",
            # activate our custom plugin
            "-p", "tests.e2e.reporter.plugin",
            *pytest_extra,
        ]
        print(f"[run_e2e] Running: {' '.join(pytest_cmd)}\n")
        result = subprocess.run(pytest_cmd, cwd=str(ROOT))
        exit_code = result.returncode

    finally:
        # ── Step 3: tear down server ─────────────────────────────────────────
        if server_proc is not None and server_proc.poll() is None:
            print("\n[run_e2e] Stopping dev server...")
            server_proc.terminate()
            try:
                server_proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server_proc.kill()

    # ── Step 4: report ───────────────────────────────────────────────────────
    if REPORT.exists():
        print(f"\n[run_e2e] Report: {REPORT.resolve()}")
        if args.open_report:
            webbrowser.open(REPORT.as_uri())
    else:
        print("\n[run_e2e] No HTML report generated (no tests collected?).")

    return exit_code


def _dump_server_output(proc: subprocess.Popen) -> None:
    try:
        out, _ = proc.communicate(timeout=2)
        if out:
            print("\n--- Server output ---")
            print(out.decode(errors="replace")[-2000:])
    except Exception:
        pass


if __name__ == "__main__":
    sys.exit(main())
