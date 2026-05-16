#!/usr/bin/env python3
"""
PBL Arena E2E Test Portal

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

REPO_ROOT       = Path(__file__).parent.parent.parent
E2E_DIR         = Path(__file__).parent
REPORTS_DIR     = E2E_DIR / "reports"
AUTH_DIR        = E2E_DIR / ".auth"
RESULTS_JSON    = REPORTS_DIR / "run_results.json"
FIX_PROMPT_FILE = REPORTS_DIR / "fix_prompt.md"
CUSTOM_FILE     = REPORTS_DIR / "custom_tests.json"
CUSTOM_RUNNER   = E2E_DIR / "custom_runner.py"
PYTHON          = sys.executable

# Set in main() from --base-url arg; defaults to live site
TARGET_BASE_URL = "https://pickleleauge.web.app"

# ── Predefined test groups ─────────────────────────────────────────────────────

BUILTIN_GROUPS = [
    {"id": "auth",        "name": "Authentication",          "marker": "auth",        "file": "tests/e2e/test_auth.py",                         "description": "Login, signup, logout, password reset flows", "color": "#4f86f7"},
    {"id": "rbac",        "name": "Role-Based Access Control","marker": "rbac",        "file": "tests/e2e/test_rbac.py",                         "description": "Route protection and role-visibility checks", "color": "#f7a94f"},
    {"id": "player",      "name": "Player Persona",           "marker": "player",      "file": "tests/e2e/personas/test_player.py",               "description": "Profile, search, leaderboard, ladder, clubs, notifications", "color": "#4ff7a0"},
    {"id": "coordinator", "name": "League Coordinator",       "marker": "coordinator", "file": "tests/e2e/personas/test_league_coordinator.py",   "description": "Play dates, sessions, check-in, scores, roster", "color": "#f74f86"},
    {"id": "director",    "name": "Club Director",            "marker": "director",    "file": "tests/e2e/personas/test_club_director.py",        "description": "Club creation, editing, member management, leagues", "color": "#a04ff7"},
    {"id": "admin",       "name": "Site Admin",               "marker": "admin",       "file": "tests/e2e/personas/test_site_admin.py",           "description": "Admin hub, user management, club approval queue", "color": "#f7f74f"},
    {"id": "all",         "name": "Full Suite",               "marker": None,          "file": "tests/e2e",                                       "description": "All tests across every persona and flow", "color": "#4ff7f7"},
]

# ── Custom test storage ────────────────────────────────────────────────────────

_custom_lock = threading.Lock()


def _load_custom() -> dict:
    try:
        if CUSTOM_FILE.exists():
            return json.loads(CUSTOM_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {"cases": {}, "groups": {}}


def _save_custom(data: dict) -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    CUSTOM_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _next_case_id() -> str:
    data = _load_custom()
    existing = [k for k in data["cases"] if k.startswith("UC-CUSTOM-")]
    nums = []
    for k in existing:
        try:
            nums.append(int(k.split("-")[-1]))
        except ValueError:
            pass
    n = (max(nums) + 1) if nums else 1
    return f"UC-CUSTOM-{n:03d}"


def _next_group_id() -> str:
    data = _load_custom()
    existing = [k for k in data["groups"] if k.startswith("GROUP-")]
    nums = []
    for k in existing:
        try:
            nums.append(int(k.split("-")[-1]))
        except ValueError:
            pass
    n = (max(nums) + 1) if nums else 1
    return f"GROUP-{n:03d}"


# ── In-memory run store ────────────────────────────────────────────────────────

_runs: dict[str, dict[str, Any]] = {}
_runs_lock = threading.Lock()


def _new_run(label: str) -> str:
    run_id = str(uuid.uuid4())
    with _runs_lock:
        _runs[run_id] = {
            "run_id": run_id, "label": label, "status": "pending",
            "output": "", "results": None, "started_at": time.time(),
            "finished_at": None, "summary": None,
        }
    return run_id


def _update_run(run_id: str, **kw: Any) -> None:
    with _runs_lock:
        if run_id in _runs:
            _runs[run_id].update(kw)


def _get_run(run_id: str) -> dict | None:
    with _runs_lock:
        return dict(_runs[run_id]) if run_id in _runs else None


# ── Builtin pytest runner ──────────────────────────────────────────────────────

def _run_pytest(run_id: str, group: dict) -> None:
    try:
        _update_run(run_id, status="running")
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        cmd = [PYTHON, "-m", "pytest", group["file"],
               "-p", "tests.e2e.reporter.plugin", "--tb=short", "-v", "--timeout=60"]
        if group.get("marker"):
            cmd += ["-m", group["marker"]]
        proc = subprocess.Popen(cmd, cwd=str(REPO_ROOT),
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, encoding="utf-8", errors="replace")
        lines: list[str] = []
        for line in iter(proc.stdout.readline, ""):
            lines.append(line)
            _update_run(run_id, output="".join(lines))
        proc.wait()
        results, summary = None, None
        if RESULTS_JSON.exists():
            try:
                results = json.loads(RESULTS_JSON.read_text(encoding="utf-8"))
                summary = _make_summary(results, proc.returncode)
            except Exception:
                pass
        _update_run(run_id, status="complete" if proc.returncode == 0 else "failed",
                    output="".join(lines), results=results, summary=summary,
                    finished_at=time.time())
    except Exception:
        _update_run(run_id, status="error", output=traceback.format_exc(), finished_at=time.time())


# ── Custom test runner ─────────────────────────────────────────────────────────

def _run_custom(run_id: str, group: dict, case_ids: list[str]) -> None:
    try:
        _update_run(run_id, status="running")
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        out_file = REPORTS_DIR / f"custom_run_{run_id}.json"
        cmd = [PYTHON, str(CUSTOM_RUNNER),
               "--cases-file", str(CUSTOM_FILE),
               "--case-ids", *case_ids,
               "--output-file", str(out_file),
               "--auth-dir", str(AUTH_DIR),
               "--base-url", TARGET_BASE_URL]
        proc = subprocess.Popen(cmd, cwd=str(REPO_ROOT),
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, encoding="utf-8", errors="replace")
        lines: list[str] = []
        for line in iter(proc.stdout.readline, ""):
            lines.append(line)
            _update_run(run_id, output="".join(lines))
        proc.wait()
        results, summary = None, None
        if out_file.exists():
            try:
                results = json.loads(out_file.read_text(encoding="utf-8"))
                summary = _make_summary(results, proc.returncode)
            except Exception:
                pass
        _update_run(run_id, status="complete" if proc.returncode == 0 else "failed",
                    output="".join(lines), results=results, summary=summary,
                    finished_at=time.time())
    except Exception:
        _update_run(run_id, status="error", output=traceback.format_exc(), finished_at=time.time())


def _make_summary(results: list[dict], returncode: int) -> dict:
    passed  = sum(1 for r in results if r["status"] == "PASS")
    failed  = sum(1 for r in results if r["status"] == "FAIL")
    errors  = sum(1 for r in results if r["status"] not in ("PASS", "FAIL", "SKIP"))
    skipped = sum(1 for r in results if r["status"] == "SKIP")
    return {"total": len(results), "passed": passed, "failed": failed,
            "errors": errors, "skipped": skipped, "returncode": returncode}


# ── HTTP handler ───────────────────────────────────────────────────────────────

class PortalHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args): pass

    def do_GET(self):
        p = self.path.split("?")[0]
        if p in ("/", "/index.html"):          self._html()
        elif p == "/api/groups":               self._json(BUILTIN_GROUPS)
        elif p == "/api/custom/cases":
            with _custom_lock: d = _load_custom()
            self._json(list(d["cases"].values()))
        elif p == "/api/custom/groups":
            with _custom_lock: d = _load_custom()
            self._json(list(d["groups"].values()))
        elif p.startswith("/api/run/"):        run_id = p[len("/api/run/"):]; self._json(_get_run(run_id) or {"error": "not found"}, 404 if not _get_run(run_id) else 200)
        else:                                  self._err(404, "Not found")

    def do_POST(self):
        p = self.path.split("?")[0]
        n = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(n)

        if p == "/api/run":
            d = json.loads(body)
            group = next((g for g in BUILTIN_GROUPS if g["id"] == d.get("group_id")), None)
            if not group: self._err(400, "unknown group_id"); return
            rid = _new_run(group["id"])
            threading.Thread(target=_run_pytest, args=(rid, group), daemon=True).start()
            self._json({"run_id": rid}, 202)

        elif p == "/api/custom/run":
            d = json.loads(body)
            gid = d.get("group_id")
            with _custom_lock: data = _load_custom()
            group = data["groups"].get(gid)
            if not group: self._err(400, f"unknown group {gid!r}"); return
            case_ids = group.get("case_ids", [])
            if not case_ids: self._err(400, "group has no cases"); return
            rid = _new_run(f"custom:{group['name']}")
            threading.Thread(target=_run_custom, args=(rid, group, case_ids), daemon=True).start()
            self._json({"run_id": rid}, 202)

        elif p == "/api/custom/cases":
            d = json.loads(body)
            if not d.get("id"): d["id"] = _next_case_id()
            with _custom_lock:
                data = _load_custom()
                data["cases"][d["id"]] = d
                _save_custom(data)
            self._json(d)

        elif p == "/api/custom/groups":
            d = json.loads(body)
            if not d.get("id"): d["id"] = _next_group_id()
            with _custom_lock:
                data = _load_custom()
                data["groups"][d["id"]] = d
                _save_custom(data)
            self._json(d)

        elif p == "/api/save-prompt":
            d = json.loads(body)
            REPORTS_DIR.mkdir(parents=True, exist_ok=True)
            FIX_PROMPT_FILE.write_text(d.get("prompt", ""), encoding="utf-8")
            self._json({"saved": str(FIX_PROMPT_FILE)})

        else: self._err(404, "Not found")

    def do_DELETE(self):
        p = self.path.split("?")[0]
        if p.startswith("/api/custom/cases/"):
            cid = p[len("/api/custom/cases/"):]
            with _custom_lock:
                data = _load_custom()
                data["cases"].pop(cid, None)
                _save_custom(data)
            self._json({"deleted": cid})
        elif p.startswith("/api/custom/groups/"):
            gid = p[len("/api/custom/groups/"):]
            with _custom_lock:
                data = _load_custom()
                data["groups"].pop(gid, None)
                _save_custom(data)
            self._json({"deleted": gid})
        else:
            self._err(404, "Not found")

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, data: Any, status: int = 200) -> None:
        body = json.dumps(data, indent=2, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _err(self, status: int, msg: str) -> None:
        self._json({"error": msg}, status)

    def _html(self) -> None:
        body = _HTML.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


# ── HTML ───────────────────────────────────────────────────────────────────────

_HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PBL Arena — E2E Test Portal</title>
<style>
:root{--bg:#0f1117;--sur:#1a1d27;--sur2:#12151f;--bor:#2a2d3a;--tx:#e2e8f0;--mu:#64748b;--ac:#4f86f7;--pass:#22c55e;--fail:#ef4444;--err:#f97316;--skip:#94a3b8;--warn:#facc15;}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--tx);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;padding-bottom:90px}
/* header */
header{background:var(--sur);border-bottom:1px solid var(--bor);padding:13px 28px;display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:50}
header h1{font-size:1.1rem;font-weight:700}
header span{color:var(--mu);font-size:.82rem}
.dot{width:8px;height:8px;border-radius:50%;background:var(--mu);flex-shrink:0}
.dot.on{background:var(--pass);box-shadow:0 0 5px var(--pass)}
/* layout */
main{padding:24px 28px;max-width:1480px;margin:0 auto}
.sec-label{font-size:.7rem;font-weight:700;color:var(--mu);text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px;display:flex;align-items:center;gap:10px}
.sec-label hr{flex:1;border:none;border-top:1px solid var(--bor)}
/* cards */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin-bottom:28px}
.card{background:var(--sur);border:1px solid var(--bor);border-radius:9px;padding:16px;display:flex;flex-direction:column;gap:9px;transition:border-color .15s}
.card:hover{border-color:var(--ac)}
.card-h{display:flex;align-items:center;gap:8px}
.cdot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.cname{font-weight:700;font-size:.9rem}
.cdesc{font-size:.76rem;color:var(--mu);line-height:1.42;flex:1}
.card-btns{display:flex;gap:6px;flex-wrap:wrap}
/* buttons */
.btn{padding:6px 14px;border-radius:6px;border:none;cursor:pointer;font-size:.82rem;font-weight:600;transition:opacity .15s}
.btn:disabled{opacity:.35;cursor:not-allowed}
.btn-pri{background:var(--ac);color:#fff}
.btn-pri:hover:not(:disabled){opacity:.82}
.btn-ghost{background:transparent;color:var(--mu);border:1px solid var(--bor)}
.btn-ghost:hover{background:var(--bor);color:var(--tx)}
.btn-sm{padding:4px 9px;font-size:.74rem}
.btn-danger{background:#ef444418;color:var(--fail);border:1px solid #ef444430}
.btn-green{background:#22c55e18;color:var(--pass);border:1px solid #22c55e30}
/* custom case rows */
.case-row{display:flex;align-items:center;gap:10px;padding:9px 14px;background:var(--sur);border:1px solid var(--bor);border-radius:7px;margin-bottom:7px}
.case-row .case-id{font-family:monospace;font-size:.76rem;color:var(--mu);min-width:110px}
.case-row .case-name{flex:1;font-size:.83rem;font-weight:500}
.case-row .case-persona{font-size:.75rem;color:var(--mu)}
.case-row .case-btns{display:flex;gap:5px}
/* group rows */
.group-row{display:flex;align-items:center;gap:10px;padding:9px 14px;background:var(--sur);border:1px solid var(--bor);border-radius:7px;margin-bottom:7px}
.group-row .group-name{flex:1;font-weight:700;font-size:.88rem}
.group-row .group-meta{font-size:.75rem;color:var(--mu)}
/* run panel */
.run-panel{background:var(--sur);border:1px solid var(--bor);border-radius:9px;overflow:hidden}
.run-hdr{padding:12px 18px;border-bottom:1px solid var(--bor);display:flex;align-items:center;gap:10px}
.run-hdr h3{font-size:.9rem;font-weight:700;flex:1}
.badge{padding:2px 9px;border-radius:20px;font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em}
.b-pending{background:#64748b20;color:var(--mu);border:1px solid var(--mu)}
.b-running{background:#facc1520;color:var(--warn);border:1px solid var(--warn)}
.b-complete{background:#22c55e20;color:var(--pass);border:1px solid var(--pass)}
.b-failed{background:#ef444420;color:var(--fail);border:1px solid var(--fail)}
.b-error{background:#f9731620;color:var(--err);border:1px solid var(--err)}
.sum-bar{display:flex;gap:24px;padding:12px 18px;border-bottom:1px solid var(--bor)}
.si{display:flex;flex-direction:column;align-items:center;gap:1px}
.sn{font-size:1.4rem;font-weight:800}
.sl{font-size:.66rem;color:var(--mu);text-transform:uppercase;letter-spacing:.07em}
/* tabs */
.tabs{display:flex;border-bottom:1px solid var(--bor)}
.tab{padding:9px 18px;cursor:pointer;font-size:.82rem;font-weight:600;color:var(--mu);border-bottom:2px solid transparent;transition:all .15s;user-select:none}
.tab.act{color:var(--ac);border-bottom-color:var(--ac)}
.tc{display:none}
.tc.act{display:block}
.outbox{background:#090b12;padding:14px 18px;font-family:'Consolas',monospace;font-size:.76rem;white-space:pre-wrap;word-break:break-all;max-height:420px;overflow-y:auto;line-height:1.52}
.jbox{background:#090b12;padding:14px 18px;font-family:'Consolas',monospace;font-size:.76rem;white-space:pre-wrap;word-break:break-all;max-height:500px;overflow-y:auto;line-height:1.52}
/* results */
.rl{}
.ri{border-bottom:1px solid var(--bor)}
.ri:last-child{border-bottom:none}
.rh{display:grid;grid-template-columns:20px 26px 105px 1fr 82px 52px 74px;gap:8px;align-items:center;padding:10px 16px;cursor:pointer;transition:background .12s;user-select:none}
.rh:hover{background:rgba(255,255,255,.024)}
.eic{color:var(--mu);font-size:.6rem;transition:transform .2s;display:flex;align-items:center;justify-content:center}
.eic.open{transform:rotate(90deg)}
.rid{font-family:monospace;font-size:.76rem;color:var(--mu)}
.rname{font-size:.8rem;font-weight:500}
.rp{font-size:.76rem;color:var(--mu)}
.rdu{font-size:.76rem;color:var(--mu);text-align:right}
.rs{font-size:.76rem;font-weight:800;text-align:right}
.s-PASS{color:var(--pass)}.s-FAIL{color:var(--fail)}.s-ERROR{color:var(--err)}.s-SKIP{color:var(--skip)}
/* detail */
.rd{display:none;background:var(--sur2);border-top:1px solid var(--bor);padding:16px 22px 18px}
.dgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.dbox{background:var(--sur);border:1px solid var(--bor);border-radius:7px;padding:12px 14px}
.dbox h4{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--mu);margin-bottom:8px}
.clist{list-style:none}
.clist li{padding:2px 0;font-size:.78rem;line-height:1.45;display:flex;gap:5px}
.clist li::before{content:'✓';color:var(--mu);flex-shrink:0}
.slist{list-style:none}
.si2{display:flex;gap:7px;align-items:flex-start;padding:2px 0;font-size:.77rem;line-height:1.43}
.sp{color:var(--pass);flex-shrink:0}.sf{color:var(--fail);flex-shrink:0}
.se{display:block;color:var(--err);font-size:.71rem;font-family:monospace;margin-top:1px}
.wbox{background:#150a0a;border:1px solid #3a1010;border-radius:7px;padding:10px 12px;font-family:monospace;font-size:.75rem;color:#fca5a5;white-space:pre-wrap;word-break:break-all;max-height:110px;overflow-y:auto;line-height:1.48}
.sugbox{font-size:.8rem;line-height:1.63;color:var(--tx);white-space:pre-line}
/* accept row */
.fa{margin-top:12px;display:flex;align-items:center;gap:9px;padding:10px 13px;background:rgba(79,134,247,.07);border:1px solid rgba(79,134,247,.2);border-radius:7px;cursor:pointer;transition:background .15s,border-color .15s}
.fa:hover{background:rgba(79,134,247,.12);border-color:rgba(79,134,247,.38)}
.fa.acc{background:rgba(79,134,247,.18);border-color:var(--ac)}
.fa input[type=checkbox]{width:15px;height:15px;accent-color:var(--ac);cursor:pointer;flex-shrink:0}
.fa label{cursor:pointer;font-size:.82rem;font-weight:600;flex:1}
.fa.acc label{color:var(--ac)}
/* gen bar */
#gb{position:fixed;bottom:0;left:0;right:0;background:#0d1525;border-top:1px solid var(--ac);padding:11px 28px;display:flex;align-items:center;gap:14px;transform:translateY(100%);transition:transform .25s;z-index:100}
#gb.vis{transform:translateY(0)}
#gb .pill{background:var(--ac);color:#fff;font-weight:800;font-size:.82rem;padding:3px 10px;border-radius:20px}
/* modals */
.ov{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:200;display:none;align-items:center;justify-content:center;padding:20px}
.ov.open{display:flex}
.modal{background:var(--sur);border:1px solid var(--bor);border-radius:11px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.55)}
.modal-sm{width:min(560px,100%);max-height:90vh}
.modal-lg{width:min(820px,100%);max-height:90vh}
.modal-xl{width:min(980px,100%);max-height:92vh}
.mhd{padding:14px 18px;border-bottom:1px solid var(--bor);display:flex;align-items:center;gap:10px}
.mhd h2{font-size:.95rem;font-weight:700;flex:1}
.mbody{padding:18px;overflow-y:auto;flex:1}
.mfoot{padding:12px 18px;border-top:1px solid var(--bor);display:flex;align-items:center;gap:8px}
/* form fields */
.field{display:flex;flex-direction:column;gap:5px;margin-bottom:13px}
.field label{font-size:.76rem;font-weight:600;color:var(--mu)}
.field input,.field select,.field textarea{background:#090b12;border:1px solid var(--bor);border-radius:6px;padding:7px 10px;color:var(--tx);font-size:.83rem;font-family:inherit;outline:none;transition:border-color .15s}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--ac)}
.field select option{background:var(--sur)}
/* step builder */
.step-card{background:#090b12;border:1px solid var(--bor);border-radius:7px;padding:11px 13px;margin-bottom:8px}
.step-row{display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap}
.step-row select{background:#090b12;border:1px solid var(--bor);border-radius:5px;padding:5px 8px;color:var(--tx);font-size:.78rem;flex-shrink:0}
.step-row input{background:#090b12;border:1px solid var(--bor);border-radius:5px;padding:5px 8px;color:var(--tx);font-size:.78rem;flex:1;min-width:80px}
.step-num{color:var(--mu);font-size:.72rem;font-family:monospace;min-width:22px;padding-top:7px}
/* criteria */
.crit-row{display:flex;gap:7px;align-items:center;margin-bottom:7px}
.crit-row input{flex:1;background:#090b12;border:1px solid var(--bor);border-radius:5px;padding:6px 9px;color:var(--tx);font-size:.82rem}
/* case checkboxes */
.case-check-row{display:flex;align-items:center;gap:9px;padding:8px 12px;border:1px solid var(--bor);border-radius:6px;margin-bottom:6px;cursor:pointer;transition:background .12s}
.case-check-row:hover{background:rgba(255,255,255,.03)}
.case-check-row input[type=checkbox]{accent-color:var(--ac);width:15px;height:15px}
/* prompt */
.pta{width:100%;height:340px;background:#090b12;border:1px solid var(--bor);border-radius:7px;padding:13px 14px;color:var(--tx);font-family:'Consolas',monospace;font-size:.75rem;resize:vertical;line-height:1.52}
/* misc */
.empty{padding:48px;text-align:center;color:var(--mu);font-size:.85rem}
.icopy{padding:2px 8px;font-size:.7rem;border-radius:4px;border:1px solid var(--bor);background:transparent;color:var(--mu);cursor:pointer}
.icopy:hover{background:var(--bor);color:var(--tx)}
#cstat{font-size:.76rem;color:var(--pass);flex:1}
.persona-tag{font-size:.7rem;padding:1px 7px;border-radius:10px;border:1px solid var(--bor);color:var(--mu)}
</style>
</head>
<body>
<header>
  <div class="dot" id="sdot"></div>
  <h1>PBL Arena</h1>
  <span>E2E Test Portal</span>
</header>
<main>

<!-- ── Builtin groups ─────────────────────────────────────────────────── -->
<div class="sec-label">Test Groups<hr></div>
<div class="grid" id="groupGrid"></div>

<!-- ── Custom tests ──────────────────────────────────────────────────── -->
<div class="sec-label">
  Custom Tests
  <button class="btn btn-ghost btn-sm" onclick="openCaseEditor(null)">+ New Use Case</button>
  <button class="btn btn-ghost btn-sm" onclick="openGroupEditor(null)">+ New Action Group</button>
  <hr>
</div>

<div id="customCases" style="margin-bottom:10px"></div>
<div id="customGroups" style="margin-bottom:28px"></div>

<!-- ── Active run ─────────────────────────────────────────────────────── -->
<div class="sec-label">Active Run<hr></div>
<div id="runPanel">
  <div class="run-panel"><div class="empty">No run started — click a test group or action group to begin.</div></div>
</div>

</main>

<!-- ── Gen bar ─────────────────────────────────────────────────────────── -->
<div id="gb">
  <span class="pill" id="gbCnt">0</span>
  <span style="font-size:.86rem;flex:1">fix<span id="gbPl">es</span> selected</span>
  <button class="btn btn-ghost btn-sm" onclick="clearFixes()">Clear</button>
  <button class="btn btn-pri" onclick="openPromptModal()">Generate Claude Prompt</button>
</div>

<!-- ── Case editor modal ───────────────────────────────────────────────── -->
<div class="ov" id="caseOv">
  <div class="modal modal-xl">
    <div class="mhd">
      <h2 id="ceTitle">New Use Case</h2>
      <button class="btn btn-ghost btn-sm" onclick="closeCaseEditor()">✕</button>
    </div>
    <div class="mbody" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <!-- left -->
      <div>
        <div class="field"><label>Use Case ID (auto-assigned if blank)</label><input id="ceId" placeholder="UC-CUSTOM-001"></div>
        <div class="field"><label>Name *</label><input id="ceName" placeholder="e.g. Verify leaderboard loads"></div>
        <div class="field"><label>Description</label><input id="ceDesc" placeholder="What this test checks (optional)"></div>
        <div class="field">
          <label>Run as Persona</label>
          <select id="cePersona">
            <option value="anon">Anonymous (not signed in)</option>
            <option value="player">Player</option>
            <option value="coordinator">League Coordinator</option>
            <option value="director">Club Director</option>
            <option value="admin">Site Admin</option>
          </select>
        </div>
        <div class="field">
          <label>Acceptance Criteria</label>
          <div id="critList"></div>
          <button class="btn btn-ghost btn-sm" onclick="addCrit()" style="margin-top:4px">+ Add Criterion</button>
        </div>
      </div>
      <!-- right: step builder -->
      <div>
        <div class="field" style="margin-bottom:8px"><label>Test Steps</label></div>
        <div id="stepList"></div>
        <button class="btn btn-ghost btn-sm" onclick="addStep()">+ Add Step</button>
        <div style="margin-top:14px;padding:10px 12px;background:#090b12;border-radius:6px;border:1px solid var(--bor)">
          <p style="font-size:.72rem;color:var(--mu);line-height:1.55">
            <strong style="color:var(--tx)">Step types:</strong><br>
            Navigate · Click (role/text) · Fill (placeholder/label)<br>
            Assert text visible · Assert URL · Wait for load
          </p>
        </div>
      </div>
    </div>
    <div class="mfoot">
      <span style="font-size:.78rem;color:var(--mu);flex:1" id="ceErr"></span>
      <button class="btn btn-ghost" onclick="closeCaseEditor()">Cancel</button>
      <button class="btn btn-pri" onclick="saveCase()">Save Use Case</button>
    </div>
  </div>
</div>

<!-- ── Group editor modal ──────────────────────────────────────────────── -->
<div class="ov" id="groupOv">
  <div class="modal modal-sm">
    <div class="mhd">
      <h2 id="geTitle">New Action Group</h2>
      <button class="btn btn-ghost btn-sm" onclick="closeGroupEditor()">✕</button>
    </div>
    <div class="mbody">
      <div class="field"><label>Group Name *</label><input id="geName" placeholder="e.g. Smoke Tests"></div>
      <div class="field"><label>Description</label><input id="geDesc" placeholder="Optional description"></div>
      <div class="field">
        <label>Select Use Cases to include</label>
        <div id="geList" style="margin-top:6px;max-height:260px;overflow-y:auto"></div>
      </div>
    </div>
    <div class="mfoot">
      <span style="font-size:.78rem;color:var(--mu);flex:1" id="geErr"></span>
      <button class="btn btn-ghost" onclick="closeGroupEditor()">Cancel</button>
      <button class="btn btn-pri" onclick="saveGroup()">Save Group</button>
    </div>
  </div>
</div>

<!-- ── Prompt modal ────────────────────────────────────────────────────── -->
<div class="ov" id="pmOv">
  <div class="modal modal-lg">
    <div class="mhd">
      <h2>Claude Code Fix Prompt</h2>
      <button class="btn btn-ghost btn-sm" onclick="closePm()">✕</button>
    </div>
    <div class="mbody">
      <p style="font-size:.8rem;color:var(--mu);margin-bottom:12px;line-height:1.55">
        All accepted fixes are included below. Copy and paste this prompt into <strong>Claude Code</strong> to have the issues investigated and fixed automatically. It is also saved to <code style="color:var(--ac)">tests/e2e/reports/fix_prompt.md</code>.
      </p>
      <textarea class="pta" id="pmTa" spellcheck="false"></textarea>
    </div>
    <div class="mfoot">
      <span id="cstat"></span>
      <button class="btn btn-ghost" onclick="closePm()">Cancel</button>
      <button class="btn btn-pri" onclick="copyAndSave()">Copy &amp; Save</button>
    </div>
  </div>
</div>

<script>
// ── State ─────────────────────────────────────────────────────────────────────
const API = '';
let currentRunId = null, pollTimer = null, activeTab = 'output';
let _results = [], _sugs = [], _accepted = new Map();
let _customCases = [], _customGroups = [];
// case editor
let _editingCase = null;
let _ceCrits = [], _ceSteps = [];
// group editor
let _editingGroup = null;

// ── Boot ──────────────────────────────────────────────────────────────────────
loadGroups(); loadCustom(); ping(); setInterval(ping, 12000);

// ── Builtin groups ────────────────────────────────────────────────────────────
async function loadGroups() {
  const groups = await fetch(`${API}/api/groups`).then(r=>r.json());
  document.getElementById('groupGrid').innerHTML = groups.map(g=>`
    <div class="card">
      <div class="card-h"><div class="cdot" style="background:${g.color}"></div><span class="cname">${g.name}</span></div>
      <p class="cdesc">${g.description}</p>
      <div class="card-btns"><button class="btn btn-pri" id="btn-${g.id}" onclick="startBuiltin('${g.id}',this)">Run Tests</button></div>
    </div>`).join('');
}

async function startBuiltin(gid, btn) {
  btn.disabled=true; btn.textContent='Starting…';
  const res = await fetch(`${API}/api/run`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({group_id:gid})});
  const d = await res.json();
  if(!res.ok){alert(d.error);btn.disabled=false;btn.textContent='Run Tests';return;}
  beginRun(d.run_id, gid);
}

// ── Custom tests ──────────────────────────────────────────────────────────────
async function loadCustom() {
  [_customCases, _customGroups] = await Promise.all([
    fetch(`${API}/api/custom/cases`).then(r=>r.json()),
    fetch(`${API}/api/custom/groups`).then(r=>r.json()),
  ]);
  renderCustomCases(); renderCustomGroups();
}

function renderCustomCases() {
  const el = document.getElementById('customCases');
  if(!_customCases.length){el.innerHTML='<p style="font-size:.78rem;color:var(--mu);margin-bottom:10px">No custom use cases yet — click <strong>+ New Use Case</strong> to create one.</p>';return;}
  el.innerHTML = _customCases.map(c=>`
    <div class="case-row">
      <span class="case-id">${esc(c.id)}</span>
      <span class="case-name">${esc(c.name)}</span>
      <span class="persona-tag">${esc(c.persona||'anon')}</span>
      <span class="case-persona">${(c.steps||[]).length} step${(c.steps||[]).length!==1?'s':''}</span>
      <span class="case-btns">
        <button class="btn btn-ghost btn-sm" onclick="openCaseEditor('${c.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCase('${c.id}')">✕</button>
      </span>
    </div>`).join('');
}

function renderCustomGroups() {
  const el = document.getElementById('customGroups');
  if(!_customGroups.length){el.innerHTML='<p style="font-size:.78rem;color:var(--mu);margin-bottom:10px">No action groups yet — click <strong>+ New Action Group</strong> to build one.</p>';return;}
  el.innerHTML = _customGroups.map(g=>`
    <div class="group-row">
      <span style="font-size:.9rem">⚙</span>
      <span class="group-name">${esc(g.name)}</span>
      <span class="group-meta">${(g.case_ids||[]).length} case${(g.case_ids||[]).length!==1?'s':''}</span>
      ${g.description?`<span class="group-meta">— ${esc(g.description)}</span>`:''}
      <span class="case-btns">
        <button class="btn btn-green btn-sm" onclick="runCustomGroup('${g.id}',this)">▶ Run</button>
        <button class="btn btn-ghost btn-sm" onclick="openGroupEditor('${g.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteGroup('${g.id}')">✕</button>
      </span>
    </div>`).join('');
}

async function runCustomGroup(gid, btn) {
  btn.disabled=true; btn.textContent='Starting…';
  const res = await fetch(`${API}/api/custom/run`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({group_id:gid})});
  const d = await res.json();
  if(!res.ok){alert(d.error);btn.disabled=false;btn.textContent='▶ Run';return;}
  beginRun(d.run_id, d.run_id.slice(0,8));
  btn.disabled=false; btn.textContent='▶ Run';
}

async function deleteCase(id) {
  if(!confirm(`Delete use case ${id}?`)) return;
  await fetch(`${API}/api/custom/cases/${id}`,{method:'DELETE'});
  await loadCustom();
}

async function deleteGroup(id) {
  if(!confirm(`Delete action group ${id}?`)) return;
  await fetch(`${API}/api/custom/groups/${id}`,{method:'DELETE'});
  await loadCustom();
}

// ── Case editor ───────────────────────────────────────────────────────────────
const STEP_TYPES = [
  {v:'navigate',        l:'Navigate to URL',             fields:['url:/path/to/page']},
  {v:'click_role',      l:'Click button/link (by name)', fields:['role:button|link|heading|menuitem','name:Button text']},
  {v:'click_text',      l:'Click element (by text)',     fields:['text:Visible text']},
  {v:'fill_placeholder',l:'Type into field (placeholder)',fields:['placeholder:Hint text','value:Value to type']},
  {v:'fill_label',      l:'Type into field (label)',     fields:['label:Label text','value:Value to type']},
  {v:'assert_text',     l:'Assert text is visible',      fields:['text:Expected text']},
  {v:'assert_url_contains',l:'Assert URL contains',      fields:['contains:/expected/path']},
  {v:'assert_not_url',  l:'Assert URL does NOT contain', fields:['not_contains:/should/not/be']},
  {v:'wait_networkidle',l:'Wait for page to load',       fields:[]},
];

function openCaseEditor(id) {
  _editingCase = id ? _customCases.find(c=>c.id===id) : null;
  _ceCrits = _editingCase ? [...(_editingCase.criteria||[])] : [''];
  _ceSteps = _editingCase ? (_editingCase.steps||[]).map(s=>({...s})) : [];
  document.getElementById('ceTitle').textContent = id ? 'Edit Use Case' : 'New Use Case';
  document.getElementById('ceId').value   = id || '';
  document.getElementById('ceName').value = _editingCase?.name || '';
  document.getElementById('ceDesc').value = _editingCase?.description || '';
  document.getElementById('cePersona').value = _editingCase?.persona || 'anon';
  document.getElementById('ceErr').textContent = '';
  renderCrits(); renderSteps();
  document.getElementById('caseOv').classList.add('open');
}
function closeCaseEditor(){ document.getElementById('caseOv').classList.remove('open'); }

function renderCrits() {
  document.getElementById('critList').innerHTML = _ceCrits.map((c,i)=>`
    <div class="crit-row">
      <input value="${esc(c)}" placeholder="e.g. Page loads without errors" oninput="_ceCrits[${i}]=this.value">
      <button class="btn btn-danger btn-sm" onclick="_ceCrits.splice(${i},1);renderCrits()">✕</button>
    </div>`).join('');
}
function addCrit(){ _ceCrits.push(''); renderCrits(); }

function renderSteps() {
  document.getElementById('stepList').innerHTML = _ceSteps.map((s,i)=>{
    const typeOpts = STEP_TYPES.map(t=>`<option value="${t.v}" ${s.type===t.v?'selected':''}>${t.l}</option>`).join('');
    const typeInfo = STEP_TYPES.find(t=>t.v===s.type) || STEP_TYPES[0];
    const extraFields = typeInfo.fields.map(f=>{
      const [key,ph] = f.split(':');
      if(key==='role') return `<select class="step-field" oninput="_ceSteps[${i}]['${key}']=this.value" style="background:#090b12;border:1px solid var(--bor);border-radius:5px;padding:5px 8px;color:var(--tx);font-size:.76rem">
        ${['button','link','heading','menuitem','tab','checkbox','combobox','textbox'].map(r=>`<option value="${r}" ${s[key]===r?'selected':''}>${r}</option>`).join('')}
      </select>`;
      return `<input style="flex:1;min-width:80px;background:#090b12;border:1px solid var(--bor);border-radius:5px;padding:5px 8px;color:var(--tx);font-size:.76rem" placeholder="${ph}" value="${esc(s[key]||'')}" oninput="_ceSteps[${i}]['${key}']=this.value">`;
    }).join('');
    return `<div class="step-card">
      <div class="step-row">
        <span class="step-num">${i+1}.</span>
        <select style="background:#090b12;border:1px solid var(--bor);border-radius:5px;padding:5px 8px;color:var(--tx);font-size:.76rem" onchange="changeStepType(${i},this.value)">${typeOpts}</select>
        ${extraFields}
        <button class="btn btn-danger btn-sm" onclick="_ceSteps.splice(${i},1);renderSteps()">✕</button>
      </div>
    </div>`;
  }).join('');
}

function addStep(){
  _ceSteps.push({type:'navigate',url:''});
  renderSteps();
}
function changeStepType(i, val){
  const t = STEP_TYPES.find(t=>t.v===val);
  const newStep = {type:val};
  // initialize fields
  (t?.fields||[]).forEach(f=>{ const [k]=f.split(':'); newStep[k]=''; });
  _ceSteps[i] = newStep;
  renderSteps();
}

async function saveCase(){
  const id   = document.getElementById('ceId').value.trim() || null;
  const name = document.getElementById('ceName').value.trim();
  if(!name){ document.getElementById('ceErr').textContent='Name is required'; return; }
  const data = {
    id, name,
    description: document.getElementById('ceDesc').value.trim(),
    persona:     document.getElementById('cePersona').value,
    criteria:    _ceCrits.filter(c=>c.trim()),
    steps:       _ceSteps,
  };
  const res = await fetch(`${API}/api/custom/cases`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  if(!res.ok){ document.getElementById('ceErr').textContent=(await res.json()).error; return; }
  closeCaseEditor();
  await loadCustom();
}

// ── Group editor ──────────────────────────────────────────────────────────────
function openGroupEditor(id) {
  _editingGroup = id ? _customGroups.find(g=>g.id===id) : null;
  document.getElementById('geTitle').textContent = id ? 'Edit Action Group' : 'New Action Group';
  document.getElementById('geName').value = _editingGroup?.name || '';
  document.getElementById('geDesc').value = _editingGroup?.description || '';
  document.getElementById('geErr').textContent = '';
  const selected = new Set(_editingGroup?.case_ids||[]);
  document.getElementById('geList').innerHTML = _customCases.length
    ? _customCases.map(c=>`
        <div class="case-check-row" onclick="toggleGroupCase('${c.id}')">
          <input type="checkbox" id="gcc-${c.id}" ${selected.has(c.id)?'checked':''} onclick="event.stopPropagation();toggleGroupCase('${c.id}')">
          <label for="gcc-${c.id}" style="flex:1;cursor:pointer"><strong>${esc(c.id)}</strong> — ${esc(c.name)} <span class="persona-tag">${esc(c.persona||'anon')}</span></label>
        </div>`).join('')
    : '<p style="font-size:.78rem;color:var(--mu)">No custom use cases yet — create some first.</p>';
  document.getElementById('groupOv').classList.add('open');
}
function closeGroupEditor(){ document.getElementById('groupOv').classList.remove('open'); }

function toggleGroupCase(id){
  const cb = document.getElementById(`gcc-${id}`);
  if(cb) cb.checked = !cb.checked;
}

async function saveGroup(){
  const name = document.getElementById('geName').value.trim();
  if(!name){ document.getElementById('geErr').textContent='Name is required'; return; }
  const caseIds = _customCases.filter(c=>{
    const cb = document.getElementById(`gcc-${c.id}`);
    return cb && cb.checked;
  }).map(c=>c.id);
  const data = {
    id: _editingGroup?.id || null,
    name,
    description: document.getElementById('geDesc').value.trim(),
    case_ids: caseIds,
  };
  const res = await fetch(`${API}/api/custom/groups`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  if(!res.ok){ document.getElementById('geErr').textContent=(await res.json()).error; return; }
  closeGroupEditor();
  await loadCustom();
}

// ── Run management ────────────────────────────────────────────────────────────
function beginRun(run_id, label){
  currentRunId=run_id; _results=[]; _sugs=[]; _accepted.clear(); updateGenBar();
  renderRun({run_id,label,status:'pending',output:'',results:null,summary:null});
  startPoll();
}

function startPoll(){
  clearInterval(pollTimer);
  pollTimer=setInterval(async()=>{
    if(!currentRunId)return;
    const run=await fetch(`${API}/api/run/${currentRunId}`).then(r=>r.json());
    renderRun(run);
    if(!['pending','running'].includes(run.status)){
      clearInterval(pollTimer);
      document.querySelectorAll('.btn-pri:not(#gb button)').forEach(b=>{if(b.textContent==='Starting…'){b.disabled=false;b.textContent='Run Tests';}});
    }
  },1500);
}

function renderRun(run){
  const bc={pending:'b-pending',running:'b-running',complete:'b-complete',failed:'b-failed',error:'b-error'}[run.status]||'b-pending';
  const dur=run.finished_at&&run.started_at?`${(run.finished_at-run.started_at).toFixed(1)}s`:'';
  let sumHtml='';
  if(run.summary){const s=run.summary;sumHtml=`<div class="sum-bar">
    <div class="si"><span class="sn s-PASS">${s.passed}</span><span class="sl">Passed</span></div>
    <div class="si"><span class="sn s-FAIL">${s.failed}</span><span class="sl">Failed</span></div>
    <div class="si"><span class="sn s-ERROR">${s.errors}</span><span class="sl">Errors</span></div>
    <div class="si"><span class="sn s-SKIP">${s.skipped}</span><span class="sl">Skipped</span></div>
    <div class="si"><span class="sn" style="color:var(--mu)">${s.total}</span><span class="sl">Total</span></div>
    ${dur?`<div class="si"><span class="sn" style="color:var(--ac)">${dur}</span><span class="sl">Duration</span></div>`:''}
  </div>`;}
  if(run.results&&run.results!==_results){_results=run.results;_sugs=_results.map(r=>buildSug(r));}
  const resList=buildResList();
  const jText=run.results?JSON.stringify(run.results,null,2):'// Results will appear when run finishes.';
  document.getElementById('runPanel').innerHTML=`<div class="run-panel">
    <div class="run-hdr"><h3>Run: ${esc(run.label||run.run_id.slice(0,8))} <span style="font-size:.75rem;color:var(--mu);font-weight:400">#${run.run_id.slice(0,8)}</span></h3><span class="badge ${bc}">${run.status}</span></div>
    ${sumHtml}
    <div class="tabs">
      <div class="tab ${activeTab==='results'?'act':''}" onclick="switchTab('results')">Results</div>
      <div class="tab ${activeTab==='json'?'act':''}" onclick="switchTab('json')">JSON <button class="icopy" onclick="cpJson(event)">Copy</button></div>
      <div class="tab ${activeTab==='output'?'act':''}" onclick="switchTab('output')">Raw Output</div>
    </div>
    <div class="tc ${activeTab==='results'?'act':''}" id="tc-results">${resList}</div>
    <div class="tc ${activeTab==='json'?'act':''}" id="tc-json"><div class="jbox" id="jbox">${esc(jText)}</div></div>
    <div class="tc ${activeTab==='output'?'act':''}" id="tc-output"><div class="outbox" id="obox">${esc(run.output||'Waiting…')}</div></div>
  </div>`;
  // Restore accepted checkboxes
  _accepted.forEach((_,idx)=>{const cb=document.getElementById(`cb-${idx}`);const fa=document.getElementById(`fa-${idx}`);if(cb)cb.checked=true;if(fa)fa.classList.add('acc');});
  if(run.status==='running'&&activeTab==='output'){const b=document.getElementById('obox');if(b)b.scrollTop=b.scrollHeight;}
}

// ── Results list ──────────────────────────────────────────────────────────────
function buildResList(){
  if(!_results||!_results.length) return '<div class="empty">Results will appear when the run finishes.</div>';
  return '<div class="rl">'+_results.map((r,i)=>buildResItem(r,i)).join('')+'</div>';
}
function buildResItem(r,i){
  const canFix=r.status==='FAIL'||r.status==='ERROR';
  const sug=_sugs[i]||'';
  const fs=r.steps?r.steps.find(s=>!s.passed):null;
  const cHtml=(r.criteria&&r.criteria.length)?`<ul class="clist">${r.criteria.map(c=>`<li>${esc(c)}</li>`).join('')}</ul>`:`<p style="color:var(--mu);font-size:.76rem">No criteria defined.</p>`;
  const stHtml=(r.steps&&r.steps.length)?`<ul class="slist">${r.steps.map(s=>`<li class="si2"><span class="${s.passed?'sp':'sf'}">${s.passed?'✓':'✗'}</span><span>${esc(s.description)}${s.error?`<span class="se">${esc(s.error.split('\n')[0].slice(0,120))}</span>`:''}</span></li>`).join('')}</ul>`:`<p style="color:var(--mu);font-size:.76rem">No steps recorded.</p>`;
  const whyHtml=(r.error_message&&r.status!=='PASS')?`<div class="dbox" style="grid-column:1/-1;margin-bottom:0"><h4>Why It Failed</h4><div class="wbox">${esc(r.error_message)}</div></div>`:'';
  const fixHtml=canFix?`<div class="dbox" style="grid-column:1/-1">
    <h4>Suggested Fix</h4>
    <div class="sugbox">${esc(sug)}</div>
    <div class="fa" id="fa-${i}" onclick="clickFa(${i})">
      <input type="checkbox" id="cb-${i}" onclick="event.stopPropagation()" onchange="fixChange(${i})">
      <label for="cb-${i}">Accept this fix — include in Claude Code prompt</label>
    </div>
  </div>`:'';
  return `<div class="ri" id="ri-${i}">
    <div class="rh" onclick="toggleExp(${i})">
      <span class="eic" id="ei-${i}">&#9658;</span>
      <span style="display:flex;align-items:center;justify-content:center">
        ${canFix?`<input type="checkbox" id="cb2-${i}" onclick="event.stopPropagation()" onchange="syncCb(${i})" style="width:14px;height:14px;accent-color:var(--ac);cursor:pointer" title="Accept fix">`:``}
      </span>
      <span class="rid">${esc(r.uc_id)}</span>
      <span class="rname">${esc(r.name)}</span>
      <span class="rp">${esc(r.persona)}</span>
      <span class="rdu">${r.duration_s}s</span>
      <span class="rs s-${r.status}">${r.status}</span>
    </div>
    <div class="rd" id="rd-${i}">
      <div class="dgrid">
        <div class="dbox"><h4>Expected Behavior</h4>${cHtml}</div>
        <div class="dbox"><h4>Steps Taken</h4>${stHtml}</div>
        ${whyHtml}
        ${fixHtml}
      </div>
    </div>
  </div>`;
}

// ── Expand ────────────────────────────────────────────────────────────────────
function toggleExp(i){
  const d=document.getElementById(`rd-${i}`),ic=document.getElementById(`ei-${i}`);
  if(!d)return; const o=d.style.display==='block';
  d.style.display=o?'none':'block'; ic.classList.toggle('open',!o);
}

// ── Checkbox logic ────────────────────────────────────────────────────────────
function clickFa(i){const cb=document.getElementById(`cb-${i}`);if(cb){cb.checked=!cb.checked;fixChange(i);}}
function fixChange(i){
  const cb=document.getElementById(`cb-${i}`),cb2=document.getElementById(`cb2-${i}`),fa=document.getElementById(`fa-${i}`);
  const chk=cb?cb.checked:false;
  if(cb2)cb2.checked=chk;if(fa)fa.classList.toggle('acc',chk);
  if(chk) _accepted.set(i,{result:_results[i],sug:_sugs[i]});
  else _accepted.delete(i);
  updateGenBar();
}
function syncCb(i){
  const cb2=document.getElementById(`cb2-${i}`),cb=document.getElementById(`cb-${i}`);
  if(!cb2||!cb)return;
  const d=document.getElementById(`rd-${i}`),ic=document.getElementById(`ei-${i}`);
  if(d&&d.style.display!=='block'){d.style.display='block';ic&&ic.classList.add('open');}
  cb.checked=cb2.checked; fixChange(i);
}
function clearFixes(){
  _accepted.clear();
  document.querySelectorAll('[id^="cb-"],[id^="cb2-"]').forEach(e=>e.checked=false);
  document.querySelectorAll('[id^="fa-"]').forEach(e=>e.classList.remove('acc'));
  updateGenBar();
}
function updateGenBar(){
  const n=_accepted.size;
  document.getElementById('gbCnt').textContent=n;
  document.getElementById('gbPl').textContent=n===1?'':'s';
  document.getElementById('gb').classList.toggle('vis',n>0);
}

// ── Suggestion builder ────────────────────────────────────────────────────────
function buildSug(r){
  const {name,persona,criteria,error_message,steps,status,uc_id}=r;
  const err=error_message||'';
  const fs=steps?steps.find(s=>!s.passed):null;
  const sd=fs?fs.description:'';
  const se=fs&&fs.error?fs.error:'';
  if(status==='PASS'||status==='SKIP') return 'Test passed — no fix needed.';
  if(status==='ERROR'){
    if(/fixture|_context|authentication/i.test(err))
      return `Fixture setup error: the ${persona} test account does not exist in Firebase.\n\nFix: Run \`npm run seed:test\` from the repo root (requires FIREBASE_SERVICE_ACCOUNT_JSON env var).\n\nAlternatively, manually create the account in Firebase Auth Console and assign the ${persona} role in Firestore.`;
    if(/timeout/i.test(err))
      return `Fixture timed out — authentication likely failed.\n\nFix: Verify the test account credentials in .env.test and confirm the account exists in Firebase. Also check that the login form selectors in auth_page.py match the current app HTML.`;
    return `Test infrastructure error.\n\nFix: Review the error above. Confirm fixtures are configured, test accounts are seeded, and the dev server is running at BASE_URL.\n\nError: ${err.split('\n').slice(-1)[0]}`;
  }
  if(status==='FAIL'){
    if(/TimeoutError/i.test(err)||/TimeoutError/i.test(se))
      return `Locator timeout during: "${sd}".\n\nThe selector did not find the element within the timeout window.\n\nFix:\n• Open the app and inspect the element\n• Update the locator in tests/e2e/pages/ to use:\n  get_by_placeholder("hint") for inputs\n  get_by_role("button", name="...") for buttons\n  get_by_test_id("...") if data-testid is present\n• Remove get_by_label() for fields without proper for= attributes`;
    if(/strict mode|StrictMode/i.test(err))
      return `Multiple elements matched the locator during: "${sd}".\n\nFix: Scope the locator, e.g.:\n  page.get_by_role("main").get_by_role("button", name="...")\n  page.locator("form").get_by_placeholder("...")`;
    if(/AssertionError/.test(err)&&(/auth\/login|url/i.test(err)))
      return `URL assertion failed during: "${sd}".\n\nFix:\n• For login tests: verify the account exists in Firebase\n• For RBAC tests: check both URL redirect AND inline login UI rendering\n• Update the assertion to accept client-side auth guard behavior (URL may not change)`;
    if(/AssertionError/.test(err)&&/visible/i.test(err))
      return `Element visibility failed during: "${sd}".\n\nFix: Inspect the element in the live app and update the selector. Add a wait:\n  expect(locator).to_be_visible(timeout=8000)`;
    if(/signup|AUTH-00[789]/i.test(name+uc_id))
      return `Signup form field selectors may not match the DOM.\n\nFix: Use placeholder selectors in auth_page.py sign_up():\n  First Name  → get_by_placeholder("Jane")\n  Last Name   → get_by_placeholder("Smith")\n  Email       → get_by_placeholder("you@example.com")\n  Password    → get_by_placeholder("At least 6 characters")\n  Confirm PW  → get_by_placeholder("Repeat your password")`;
    return `Assertion failed during: "${sd}".\n\nFix: Compare the test expectation against the current app UI. Update the page object selector or assertion to match what the app actually renders.\n\nError: ${err.split('\n').slice(-1)[0]}`;
  }
  return 'Review the error above and update the relevant page object or test assertion.';
}

// ── Prompt generation ─────────────────────────────────────────────────────────
function buildPrompt(){
  if(!_accepted.size) return '';
  const fixes=[..._accepted.values()];
  let p=`# E2E Test Fix Request\n\nI have ${fixes.length} failing E2E Playwright test${fixes.length>1?'s':''} to fix.\n`;
  p+=`**Test framework:** Python Playwright + pytest (Page Object Model)\n`;
  p+=`**Test directory:** \`tests/e2e/\`  **Page objects:** \`tests/e2e/pages/\`\n`;
  p+=`**App:** Next.js 15 + Firebase Auth (client-side auth guards — no server-side redirects on auth failure)\n\n---\n\n`;
  fixes.forEach(({result:r,sug},i)=>{
    const fs=r.steps?r.steps.find(s=>!s.passed):null;
    p+=`## Issue ${i+1}: ${r.uc_id} — ${r.name}\n\n`;
    p+=`**Status:** ${r.status}  **Persona:** ${r.persona}\n**Test node:** \`${r.node_id}\`\n\n`;
    if(r.criteria?.length){p+=`**Acceptance criteria (do not change):**\n`;r.criteria.forEach(c=>{p+=`- ${c}\n`;});p+='\n';}
    if(fs){p+=`**Failed at step:** "${fs.description}"\n`;if(fs.error)p+=`\`\`\`\n${fs.error.slice(0,500)}\n\`\`\`\n\n`;}
    if(r.error_message)p+=`**Error:**\n\`\`\`\n${r.error_message.slice(0,700)}\n\`\`\`\n\n`;
    p+=`**Suggested fix:**\n${sug}\n\n---\n\n`;
  });
  p+=`## Instructions\n\n`;
  p+=`1. Read the relevant test files and page objects **before** making changes\n`;
  p+=`2. Fix selectors to match the actual DOM — prefer \`get_by_placeholder()\`, \`get_by_role()\`, \`get_by_test_id()\`\n`;
  p+=`3. Fix assertions where the expectation doesn't match current app behavior\n`;
  p+=`4. **Do NOT change the acceptance criteria** — only fix the implementation\n`;
  p+=`5. Do not silence failures with try/except — fix the root cause\n`;
  p+=`6. Briefly explain what you changed and why\n`;
  return p;
}

function openPromptModal(){const p=buildPrompt();if(!p)return;document.getElementById('pmTa').value=p;document.getElementById('cstat').textContent='';document.getElementById('pmOv').classList.add('open');}
function closePm(){document.getElementById('pmOv').classList.remove('open');}
async function copyAndSave(){
  const t=document.getElementById('pmTa').value;
  try{await navigator.clipboard.writeText(t);}catch{}
  try{
    await fetch(`${API}/api/save-prompt`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:t})});
    document.getElementById('cstat').textContent='Copied & saved to tests/e2e/reports/fix_prompt.md — paste into Claude Code';
  }catch{document.getElementById('cstat').textContent='Copied to clipboard';}
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function switchTab(n){
  activeTab=n;
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('act',t.textContent.trim().toLowerCase().startsWith(n)));
  document.querySelectorAll('.tc').forEach(c=>c.classList.toggle('act',c.id===`tc-${n}`));
}
function cpJson(e){e.stopPropagation();const b=document.getElementById('jbox');if(b)navigator.clipboard.writeText(b.innerText).then(()=>{e.target.textContent='Copied!';setTimeout(()=>e.target.textContent='Copy',1600);});}

// ── Utils ─────────────────────────────────────────────────────────────────────
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
async function ping(){try{await fetch(`${API}/api/groups`);document.getElementById('sdot').className='dot on';}catch{document.getElementById('sdot').className='dot';}}
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
    proc = subprocess.Popen(["npm", "run", "dev"], cwd=str(REPO_ROOT),
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=True)
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
    parser.add_argument("--port", type=int, default=4000)
    parser.add_argument("--no-devserver", action="store_true", default=True)
    parser.add_argument("--base-url", default="https://pickleleauge.web.app")
    args = parser.parse_args()

    global TARGET_BASE_URL
    TARGET_BASE_URL = args.base_url

    dev_proc = None
    if not args.no_devserver:
        dev_proc = _start_devserver(args.base_url)

    server = ThreadingHTTPServer(("0.0.0.0", args.port), PortalHandler)
    print(f"\n  PBL Arena E2E Portal -> http://localhost:{args.port}")
    print(f"  Testing against:       {TARGET_BASE_URL}\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Shutting down...")
    finally:
        server.shutdown()
        if dev_proc:
            dev_proc.terminate()


if __name__ == "__main__":
    main()
