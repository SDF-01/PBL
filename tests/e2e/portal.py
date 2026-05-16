#!/usr/bin/env python3
"""
PBL Arena E2E Test Portal

A local web server with a browser UI to launch Playwright tests group by group
and inspect results as JSON.

Usage (from repo root):
    py -3 tests/e2e/portal.py                  # starts Next.js dev server too
    py -3 tests/e2e/portal.py --no-devserver   # assumes app is already running
    py -3 tests/e2e/portal.py --port 4000      # custom portal port
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import threading
import time
import traceback
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

# ── Paths ──────────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).parent.parent.parent
TESTS_ROOT = Path(__file__).parent.parent
REPORTS_DIR = Path(__file__).parent / "reports"
RESULTS_JSON = REPORTS_DIR / "run_results.json"
PYTHON = sys.executable

# ── Test group registry ────────────────────────────────────────────────────────

TEST_GROUPS = [
    {
        "id": "auth",
        "name": "Authentication",
        "marker": "auth",
        "file": "tests/e2e/test_auth.py",
        "description": "Login, signup, logout, password reset flows",
        "color": "#4f86f7",
    },
    {
        "id": "rbac",
        "name": "Role-Based Access Control",
        "marker": "rbac",
        "file": "tests/e2e/test_rbac.py",
        "description": "Route protection and role-visibility checks",
        "color": "#f7a94f",
    },
    {
        "id": "player",
        "name": "Player Persona",
        "marker": "player",
        "file": "tests/e2e/personas/test_player.py",
        "description": "Profile, search, leaderboard, ladder, clubs, notifications",
        "color": "#4ff7a0",
    },
    {
        "id": "coordinator",
        "name": "League Coordinator",
        "marker": "coordinator",
        "file": "tests/e2e/personas/test_league_coordinator.py",
        "description": "Play dates, sessions, check-in, scores, roster",
        "color": "#f74f86",
    },
    {
        "id": "director",
        "name": "Club Director",
        "marker": "director",
        "file": "tests/e2e/personas/test_club_director.py",
        "description": "Club creation, editing, member management, leagues",
        "color": "#a04ff7",
    },
    {
        "id": "admin",
        "name": "Site Admin",
        "marker": "admin",
        "file": "tests/e2e/personas/test_site_admin.py",
        "description": "Admin hub, user management, club approval queue",
        "color": "#f7f74f",
    },
    {
        "id": "all",
        "name": "Full Suite",
        "marker": None,
        "file": "tests/e2e",
        "description": "All tests across every persona and flow",
        "color": "#4ff7f7",
    },
]

# ── In-memory run store ────────────────────────────────────────────────────────

_runs: dict[str, dict[str, Any]] = {}
_runs_lock = threading.Lock()


def _new_run(group_id: str) -> str:
    run_id = str(uuid.uuid4())
    with _runs_lock:
        _runs[run_id] = {
            "run_id": run_id,
            "group_id": group_id,
            "status": "pending",
            "output": "",
            "results": None,
            "started_at": time.time(),
            "finished_at": None,
            "summary": None,
        }
    return run_id


def _update_run(run_id: str, **kwargs: Any) -> None:
    with _runs_lock:
        if run_id in _runs:
            _runs[run_id].update(kwargs)


def _get_run(run_id: str) -> dict | None:
    with _runs_lock:
        return dict(_runs[run_id]) if run_id in _runs else None


# ── Pytest runner ──────────────────────────────────────────────────────────────

def _run_pytest(run_id: str, group: dict) -> None:
    """Execute pytest for the given group in a background thread."""
    try:
        _update_run(run_id, status="running")
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)

        cmd = [
            PYTHON, "-m", "pytest",
            group["file"],
            "-p", "tests.e2e.reporter.plugin",
            "--tb=short",
            "-v",
            "--timeout=60",
        ]
        if group["marker"]:
            cmd += ["-m", group["marker"]]

        proc = subprocess.Popen(
            cmd,
            cwd=str(REPO_ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )

        output_lines: list[str] = []
        for line in iter(proc.stdout.readline, ""):
            output_lines.append(line)
            _update_run(run_id, output="".join(output_lines))

        proc.wait()
        full_output = "".join(output_lines)

        # Read JSON results written by the reporter plugin
        results = None
        summary = None
        if RESULTS_JSON.exists():
            try:
                results = json.loads(RESULTS_JSON.read_text(encoding="utf-8"))
                passed = sum(1 for r in results if r["status"] == "PASS")
                failed = sum(1 for r in results if r["status"] == "FAIL")
                errors = sum(1 for r in results if r["status"] not in ("PASS", "FAIL", "SKIP"))
                skipped = sum(1 for r in results if r["status"] == "SKIP")
                summary = {
                    "total": len(results),
                    "passed": passed,
                    "failed": failed,
                    "errors": errors,
                    "skipped": skipped,
                    "returncode": proc.returncode,
                }
            except Exception:
                pass

        _update_run(
            run_id,
            status="complete" if proc.returncode == 0 else "failed",
            output=full_output,
            results=results,
            summary=summary,
            finished_at=time.time(),
        )
    except Exception as exc:
        _update_run(
            run_id,
            status="error",
            output=traceback.format_exc(),
            finished_at=time.time(),
        )


# ── HTTP handler ───────────────────────────────────────────────────────────────

class PortalHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # silence access log
        pass

    # ── Routing ──────────────────────────────────────────────────────────────

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/" or path == "/index.html":
            self._serve_html()
        elif path == "/api/groups":
            self._json(TEST_GROUPS)
        elif path == "/api/runs":
            with _runs_lock:
                self._json(list(_runs.values()))
        elif path.startswith("/api/run/"):
            run_id = path[len("/api/run/"):]
            run = _get_run(run_id)
            if run:
                self._json(run)
            else:
                self._not_found()
        else:
            self._not_found()

    def do_POST(self):
        path = self.path.split("?")[0]
        if path == "/api/run":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body)
                group_id = data.get("group_id")
            except Exception:
                self._error(400, "Invalid JSON body")
                return

            group = next((g for g in TEST_GROUPS if g["id"] == group_id), None)
            if not group:
                self._error(400, f"Unknown group_id: {group_id!r}")
                return

            run_id = _new_run(group_id)
            t = threading.Thread(target=_run_pytest, args=(run_id, group), daemon=True)
            t.start()
            self._json({"run_id": run_id}, status=202)
        else:
            self._not_found()

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, data: Any, status: int = 200) -> None:
        body = json.dumps(data, indent=2, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status: int, message: str) -> None:
        self._json({"error": message}, status=status)

    def _not_found(self) -> None:
        self._json({"error": "Not found"}, status=404)

    def _serve_html(self) -> None:
        body = _HTML.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


# ── Embedded HTML UI ──────────────────────────────────────────────────────────

_HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PBL Arena — E2E Test Portal</title>
<style>
  :root {
    --bg: #0f1117;
    --surface: #1a1d27;
    --border: #2a2d3a;
    --text: #e2e8f0;
    --muted: #64748b;
    --accent: #4f86f7;
    --pass: #22c55e;
    --fail: #ef4444;
    --error: #f97316;
    --skip: #94a3b8;
    --running: #facc15;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; }
  header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 16px 32px; display: flex; align-items: center; gap: 12px; }
  header h1 { font-size: 1.25rem; font-weight: 700; }
  header span { color: var(--muted); font-size: 0.875rem; }
  .status-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--muted); }
  .status-dot.online { background: var(--pass); }
  main { padding: 32px; max-width: 1400px; margin: 0 auto; }
  h2 { font-size: 1rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 16px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-bottom: 40px; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 20px; display: flex; flex-direction: column; gap: 10px; transition: border-color .15s; }
  .card:hover { border-color: var(--accent); }
  .card-header { display: flex; align-items: center; gap: 10px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .card-name { font-weight: 700; font-size: 1rem; }
  .card-desc { font-size: 0.8rem; color: var(--muted); line-height: 1.4; flex: 1; }
  .btn { padding: 8px 18px; border-radius: 6px; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 600; transition: opacity .15s; }
  .btn:disabled { opacity: .4; cursor: not-allowed; }
  .btn-run { background: var(--accent); color: #fff; }
  .btn-run:hover:not(:disabled) { opacity: .85; }
  .run-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  .run-panel-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; }
  .run-panel-header h3 { font-size: 1rem; font-weight: 700; flex: 1; }
  .badge { padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
  .badge-running { background: #facc1522; color: var(--running); border: 1px solid var(--running); }
  .badge-complete { background: #22c55e22; color: var(--pass); border: 1px solid var(--pass); }
  .badge-failed { background: #ef444422; color: var(--fail); border: 1px solid var(--fail); }
  .badge-error { background: #f9731622; color: var(--error); border: 1px solid var(--error); }
  .badge-pending { background: #64748b22; color: var(--muted); border: 1px solid var(--muted); }
  .tabs { display: flex; border-bottom: 1px solid var(--border); }
  .tab { padding: 10px 20px; cursor: pointer; font-size: 0.875rem; font-weight: 600; color: var(--muted); border-bottom: 2px solid transparent; transition: all .15s; }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .tab-content { display: none; }
  .tab-content.active { display: block; }
  .output-box { background: #0a0c14; padding: 16px 20px; font-family: 'Consolas', 'Courier New', monospace; font-size: 0.78rem; white-space: pre-wrap; word-break: break-all; max-height: 420px; overflow-y: auto; line-height: 1.5; }
  .json-box { background: #0a0c14; padding: 16px 20px; font-family: 'Consolas', 'Courier New', monospace; font-size: 0.78rem; white-space: pre-wrap; word-break: break-all; max-height: 520px; overflow-y: auto; line-height: 1.5; }
  .summary-bar { display: flex; gap: 24px; padding: 14px 20px; border-bottom: 1px solid var(--border); }
  .summary-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .summary-num { font-size: 1.5rem; font-weight: 800; }
  .summary-lbl { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
  .results-list { padding: 0; }
  .result-row { display: grid; grid-template-columns: 110px 1fr 80px 90px; gap: 12px; align-items: center; padding: 10px 20px; border-bottom: 1px solid var(--border); font-size: 0.825rem; }
  .result-row:last-child { border-bottom: none; }
  .result-id { font-family: monospace; color: var(--muted); }
  .result-name { font-weight: 500; }
  .result-persona { color: var(--muted); }
  .result-status { font-weight: 700; text-align: right; }
  .s-PASS { color: var(--pass); }
  .s-FAIL { color: var(--fail); }
  .s-ERROR { color: var(--error); }
  .s-SKIP { color: var(--skip); }
  .empty-state { padding: 60px; text-align: center; color: var(--muted); }
  .copy-btn { padding: 4px 12px; font-size: 0.75rem; border-radius: 5px; border: 1px solid var(--border); background: transparent; color: var(--muted); cursor: pointer; }
  .copy-btn:hover { background: var(--border); color: var(--text); }
</style>
</head>
<body>
<header>
  <div class="status-dot" id="serverDot"></div>
  <h1>PBL Arena</h1>
  <span>E2E Test Portal</span>
</header>
<main>
  <h2>Test Groups</h2>
  <div class="grid" id="groupGrid"></div>

  <h2>Active Run</h2>
  <div id="runPanel">
    <div class="empty-state">No run started yet. Click a test group above to begin.</div>
  </div>
</main>

<script>
const API = '';
let currentRunId = null;
let pollTimer = null;

// ── Load groups ───────────────────────────────────────────────────────────────
async function loadGroups() {
  const res = await fetch(`${API}/api/groups`);
  const groups = await res.json();
  const grid = document.getElementById('groupGrid');
  grid.innerHTML = '';
  groups.forEach(g => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-header">
        <div class="dot" style="background:${g.color}"></div>
        <span class="card-name">${g.name}</span>
      </div>
      <p class="card-desc">${g.description}</p>
      <button class="btn btn-run" onclick="startRun('${g.id}', this)">Run Tests</button>
    `;
    grid.appendChild(card);
  });
}

// ── Start a run ───────────────────────────────────────────────────────────────
async function startRun(groupId, btn) {
  btn.disabled = true;
  btn.textContent = 'Starting...';
  try {
    const res = await fetch(`${API}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); btn.disabled = false; btn.textContent = 'Run Tests'; return; }
    currentRunId = data.run_id;
    renderRun({ run_id: data.run_id, group_id: groupId, status: 'pending', output: '', results: null, summary: null });
    startPolling();
  } catch(e) {
    alert('Failed to start run: ' + e);
    btn.disabled = false;
    btn.textContent = 'Run Tests';
  }
}

// ── Poll for updates ──────────────────────────────────────────────────────────
function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!currentRunId) return;
    try {
      const res = await fetch(`${API}/api/run/${currentRunId}`);
      const run = await res.json();
      renderRun(run);
      if (run.status !== 'pending' && run.status !== 'running') {
        clearInterval(pollTimer);
        // Re-enable all run buttons
        document.querySelectorAll('.btn-run').forEach(b => { b.disabled = false; b.textContent = 'Run Tests'; });
      }
    } catch(e) {}
  }, 1500);
}

// ── Render the active run panel ───────────────────────────────────────────────
let activeTab = 'output';

function renderRun(run) {
  const panel = document.getElementById('runPanel');
  const badgeClass = {
    pending: 'badge-pending', running: 'badge-running',
    complete: 'badge-complete', failed: 'badge-failed', error: 'badge-error',
  }[run.status] || 'badge-pending';
  const badgeText = run.status.toUpperCase();

  const duration = run.finished_at && run.started_at
    ? `${(run.finished_at - run.started_at).toFixed(1)}s` : '';

  let summaryHtml = '';
  if (run.summary) {
    const s = run.summary;
    summaryHtml = `<div class="summary-bar">
      <div class="summary-item"><span class="summary-num s-PASS">${s.passed}</span><span class="summary-lbl">Passed</span></div>
      <div class="summary-item"><span class="summary-num s-FAIL">${s.failed}</span><span class="summary-lbl">Failed</span></div>
      <div class="summary-item"><span class="summary-num s-ERROR">${s.errors}</span><span class="summary-lbl">Errors</span></div>
      <div class="summary-item"><span class="summary-num s-SKIP">${s.skipped}</span><span class="summary-lbl">Skipped</span></div>
      <div class="summary-item"><span class="summary-num" style="color:var(--muted)">${s.total}</span><span class="summary-lbl">Total</span></div>
      ${duration ? `<div class="summary-item"><span class="summary-num" style="color:var(--accent)">${duration}</span><span class="summary-lbl">Duration</span></div>` : ''}
    </div>`;
  }

  const resultsHtml = run.results
    ? (run.results.length === 0
      ? '<div class="empty-state">No results recorded.</div>'
      : `<div class="results-list">${run.results.map(r => `
          <div class="result-row">
            <span class="result-id">${r.uc_id}</span>
            <span class="result-name">${r.name}</span>
            <span class="result-persona" style="color:var(--muted)">${r.persona}</span>
            <span class="result-status s-${r.status}">${r.status}</span>
          </div>`).join('')}</div>`)
    : '<div class="empty-state" style="padding:30px">Results will appear when the run finishes.</div>';

  const jsonText = run.results ? JSON.stringify(run.results, null, 2) : '// Results will appear when the run finishes.';
  const outputText = escHtml(run.output || 'Waiting for output...');

  panel.innerHTML = `
    <div class="run-panel">
      <div class="run-panel-header">
        <h3>Run: ${run.group_id} <span style="font-size:.8rem;color:var(--muted);font-weight:400">#${run.run_id.slice(0,8)}</span></h3>
        <span class="badge ${badgeClass}">${badgeText}</span>
      </div>
      ${summaryHtml}
      <div class="tabs">
        <div class="tab ${activeTab==='results'?'active':''}" onclick="switchTab('results')">Results</div>
        <div class="tab ${activeTab==='json'?'active':''}" onclick="switchTab('json')">JSON <button class="copy-btn" onclick="copyJson(event)">Copy</button></div>
        <div class="tab ${activeTab==='output'?'active':''}" onclick="switchTab('output')">Raw Output</div>
      </div>
      <div class="tab-content ${activeTab==='results'?'active':''}" id="tab-results">${resultsHtml}</div>
      <div class="tab-content ${activeTab==='json'?'active':''}" id="tab-json"><div class="json-box" id="jsonBox">${escHtml(jsonText)}</div></div>
      <div class="tab-content ${activeTab==='output'?'active':''}" id="tab-output"><div class="output-box" id="outputBox">${outputText}</div></div>
    </div>`;

  // Auto-scroll output box while running
  if (run.status === 'running' && activeTab === 'output') {
    const box = document.getElementById('outputBox');
    if (box) box.scrollTop = box.scrollHeight;
  }
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.textContent.trim().startsWith(tab.charAt(0).toUpperCase() + tab.slice(1))));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));
}

function copyJson(e) {
  e.stopPropagation();
  const box = document.getElementById('jsonBox');
  if (box) navigator.clipboard.writeText(box.innerText).then(() => { e.target.textContent = 'Copied!'; setTimeout(() => e.target.textContent = 'Copy', 1500); });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Server heartbeat ──────────────────────────────────────────────────────────
async function checkServer() {
  try {
    await fetch(`${API}/api/groups`);
    document.getElementById('serverDot').className = 'status-dot online';
  } catch { document.getElementById('serverDot').className = 'status-dot'; }
}

loadGroups();
checkServer();
setInterval(checkServer, 10000);
</script>
</body>
</html>"""


# ── Dev server launcher ────────────────────────────────────────────────────────

def _start_devserver(base_url: str) -> subprocess.Popen | None:
    try:
        urllib.request.urlopen(base_url, timeout=2)
        print(f"  App already running at {base_url}")
        return None
    except Exception:
        pass

    print("  Starting Next.js dev server...")
    proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=str(REPO_ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        shell=True,
    )
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        try:
            urllib.request.urlopen(base_url, timeout=3)
            print(f"  Dev server ready at {base_url}")
            return proc
        except Exception:
            time.sleep(1.5)
    print("  Warning: dev server did not respond in 90s — continuing anyway")
    return proc


# ── Entry point ────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="PBL Arena E2E Test Portal")
    parser.add_argument("--port", type=int, default=4000, help="Portal port (default: 4000)")
    parser.add_argument("--no-devserver", action="store_true", help="Skip starting the Next.js dev server")
    parser.add_argument("--base-url", default="http://localhost:3000", help="App base URL")
    args = parser.parse_args()

    dev_proc = None
    if not args.no_devserver:
        dev_proc = _start_devserver(args.base_url)

    server = ThreadingHTTPServer(("0.0.0.0", args.port), PortalHandler)
    print(f"\n  PBL Arena E2E Portal -> http://localhost:{args.port}\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Shutting down portal...")
    finally:
        server.shutdown()
        if dev_proc:
            dev_proc.terminate()


if __name__ == "__main__":
    main()
