"""
Hot-reload wrapper for the E2E test portal.

Watches tests/e2e/ for Python file changes and restarts the portal server
automatically — no manual kill/restart needed during development.

Usage:
    python -m tests.e2e.portal_dev
    python -m tests.e2e.portal_dev --port 4000
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

WATCH_DIR = Path(__file__).parent
PORTAL_MODULE = "tests.e2e.portal"


def _build_cmd(extra_args: list[str]) -> list[str]:
    return [sys.executable, "-m", PORTAL_MODULE] + extra_args


def _start(cmd: list[str]) -> subprocess.Popen:
    proc = subprocess.Popen(cmd)
    print(f"  Portal started  (pid {proc.pid})", flush=True)
    return proc


def main() -> None:
    try:
        from watchfiles import watch, DefaultFilter
    except ImportError:
        print("watchfiles not installed. Run:  pip install watchfiles")
        sys.exit(1)

    parser = argparse.ArgumentParser(description="Hot-reload portal wrapper")
    parser.add_argument("--port", type=int, default=4000)
    parser.add_argument("--base-url", default=None)
    args, unknown = parser.parse_known_args()

    extra: list[str] = ["--port", str(args.port)]
    if args.base_url:
        extra += ["--base-url", args.base_url]
    extra += unknown

    cmd = _build_cmd(extra)
    proc = _start(cmd)

    py_filter = DefaultFilter(ignore_paths=[], ignore_entity_patterns=[r".*__pycache__.*", r".*\.pyc$"])

    print(f"  Watching {WATCH_DIR} for changes…\n", flush=True)
    try:
        for changes in watch(WATCH_DIR, watch_filter=py_filter, stop_event=None):
            changed_files = sorted({str(Path(p).relative_to(WATCH_DIR)) for _, p in changes})
            print(f"\n  Changed: {', '.join(changed_files)}", flush=True)
            print("  Restarting portal…", flush=True)
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
            time.sleep(0.3)          # brief pause so the old port releases
            proc = _start(cmd)
    except KeyboardInterrupt:
        print("\n  Stopping portal…", flush=True)
        proc.terminate()
        proc.wait()
        print("  Done.", flush=True)


if __name__ == "__main__":
    main()
