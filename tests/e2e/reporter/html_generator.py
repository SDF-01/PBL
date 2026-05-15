"""
Generates a self-contained HTML report from UseCaseResult objects.
No external dependencies — pure stdlib string generation.
"""
from __future__ import annotations

import html
import json
from datetime import datetime
from pathlib import Path
from typing import Sequence

from tests.e2e.reporter.models import StepRecord, UseCaseResult


# ── Public entry point ────────────────────────────────────────────────────────


def generate_report(results: Sequence[UseCaseResult], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(_build_html(results), encoding="utf-8")


# ── HTML construction ─────────────────────────────────────────────────────────


def _build_html(results: Sequence[UseCaseResult]) -> str:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    total = len(results)
    passed = sum(1 for r in results if r.status == "PASS")
    failed = sum(1 for r in results if r.status == "FAIL")
    skipped = sum(1 for r in results if r.status == "SKIP")
    personas = sorted({r.persona for r in results})

    rows = "\n".join(_row(r) for r in results)
    persona_filters = "\n".join(
        f'<button class="filter-btn" onclick="filterPersona(\'{p}\')">{p}</button>'
        for p in personas
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PBL Arena — E2E Test Report</title>
<style>
{_css()}
</style>
</head>
<body>

<!-- ── Header ── -->
<header>
  <div class="header-inner">
    <div class="brand">
      <span class="brand-icon">🏓</span>
      <div>
        <h1>PBL Arena</h1>
        <p class="subtitle">End-to-End Test Report &mdash; {html.escape(now)}</p>
      </div>
    </div>
    <div class="summary-bar">
      <div class="stat total"><span class="num">{total}</span><span class="lbl">Total</span></div>
      <div class="stat pass"><span class="num">{passed}</span><span class="lbl">Passed</span></div>
      <div class="stat fail"><span class="num">{failed}</span><span class="lbl">Failed</span></div>
      <div class="stat skip"><span class="num">{skipped}</span><span class="lbl">Skipped</span></div>
    </div>
  </div>
</header>

<!-- ── Toolbar ── -->
<div class="toolbar">
  <div class="filter-group">
    <span class="filter-label">Status:</span>
    <button class="filter-btn active" onclick="filterStatus('all')">All</button>
    <button class="filter-btn" onclick="filterStatus('PASS')">&#10003; Pass</button>
    <button class="filter-btn" onclick="filterStatus('FAIL')">&#10007; Fail</button>
    <button class="filter-btn" onclick="filterStatus('SKIP')">&#9900; Skip</button>
  </div>
  <div class="filter-group">
    <span class="filter-label">Persona:</span>
    <button class="filter-btn active" onclick="filterPersona('all')">All</button>
    {persona_filters}
  </div>
  <div class="filter-group">
    <button class="action-btn" onclick="exportCSV()">&#8659; Export Validation CSV</button>
    <button class="action-btn" onclick="window.print()">&#128438; Print / PDF</button>
    <button class="action-btn" onclick="expandAll()">&#43; Expand All</button>
    <button class="action-btn" onclick="collapseAll()">&#8722; Collapse All</button>
  </div>
</div>

<!-- ── Table ── -->
<div class="table-wrapper">
<table id="report-table">
  <thead>
    <tr>
      <th class="col-uc">Use Case</th>
      <th class="col-ac">Acceptance Criteria</th>
      <th class="col-steps">Steps &amp; Evidence</th>
      <th class="col-status">Status</th>
      <th class="col-hv">Human Validation &#10003;</th>
    </tr>
  </thead>
  <tbody>
{rows}
  </tbody>
</table>
</div>

<!-- ── Lightbox ── -->
<div id="lightbox" onclick="closeLightbox()">
  <img id="lightbox-img" src="" alt="Step screenshot">
  <button class="lb-close" onclick="closeLightbox()">&#10005;</button>
</div>

<script>
{_js()}
</script>
</body>
</html>"""


# ── Row rendering ─────────────────────────────────────────────────────────────


def _row(r: UseCaseResult) -> str:
    row_class = f"test-row {r.status.lower()}"
    persona_cls = r.persona.lower().replace(" ", "-")

    # ── Column 1: Use Case ────────────────────────────────────────────────
    uc_cell = f"""<td class="col-uc">
      <span class="uc-id">{html.escape(r.uc_id)}</span>
      <div class="uc-name">{html.escape(r.name)}</div>
      <span class="persona-badge {persona_cls}">{html.escape(r.persona)}</span>
      <div class="duration">{r.duration_s}s</div>
    </td>"""

    # ── Column 2: Acceptance Criteria ────────────────────────────────────
    if r.criteria:
        items = "\n".join(
            f'<li class="criterion {'met' if r.status == 'PASS' else 'unmet'}">'
            f"{html.escape(c)}</li>"
            for c in r.criteria
        )
        criteria_content = f"<ul class='criteria-list'>{items}</ul>"
    else:
        criteria_content = '<span class="no-criteria">No criteria defined</span>'

    ac_cell = f'<td class="col-ac">{criteria_content}</td>'

    # ── Column 3: Steps & Evidence ────────────────────────────────────────
    steps_html = _steps_html(r)
    steps_cell = f"""<td class="col-steps">
      <button class="toggle-steps" onclick="toggleSteps(this)">
        &#9654; {len(r.steps)} step{'s' if len(r.steps) != 1 else ''}
      </button>
      <div class="steps-container collapsed">
        {steps_html}
      </div>
    </td>"""

    # ── Column 4: Status ──────────────────────────────────────────────────
    status_icon = {"PASS": "✓", "FAIL": "✗", "SKIP": "◦", "ERROR": "⚠"}.get(
        r.status, "?"
    )
    error_block = ""
    if r.error_message:
        tb_escaped = html.escape(r.error_traceback or r.error_message)
        error_block = (
            f'<details class="error-details">'
            f'<summary>Error details</summary>'
            f'<pre class="tb">{tb_escaped}</pre>'
            f"</details>"
        )
    status_cell = f"""<td class="col-status">
      <span class="status-badge {r.status.lower()}">{status_icon} {html.escape(r.status)}</span>
      {error_block}
    </td>"""

    # ── Column 5: Human Validation ────────────────────────────────────────
    safe_id = r.node_id.replace('"', '\\"').replace("'", "\\'")
    hv_cell = f"""<td class="col-hv">
      <div class="hv-inner" data-test-id="{html.escape(r.node_id)}">
        <label class="validated-label">
          <input type="checkbox" class="validated-cb"
            onchange="saveValidation(this)"
            data-key="{html.escape(r.node_id)}">
          Validated
        </label>
        <input type="text" class="validator-name"
          placeholder="Validator name"
          onchange="saveValidation(this)"
          data-key="{html.escape(r.node_id)}">
        <textarea class="notes-field" rows="3"
          placeholder="Notes / observations..."
          oninput="saveValidation(this)"
          data-key="{html.escape(r.node_id)}"></textarea>
        <span class="validation-time"></span>
      </div>
    </td>"""

    return (
        f'<tr class="{row_class}" '
        f'data-status="{r.status}" '
        f'data-persona="{html.escape(r.persona)}">\n'
        f"  {uc_cell}\n"
        f"  {ac_cell}\n"
        f"  {steps_cell}\n"
        f"  {status_cell}\n"
        f"  {hv_cell}\n"
        f"</tr>"
    )


def _steps_html(r: UseCaseResult) -> str:
    if not r.steps:
        return '<p class="no-steps">No steps recorded.</p>'

    parts: list[str] = []
    for s in r.steps:
        status_cls = "passed" if s.passed else "failed"
        icon = "✓" if s.passed else "✗"
        err_html = (
            f'<div class="step-error">{html.escape(s.error)}</div>'
            if s.error
            else ""
        )
        if s.screenshot_b64:
            thumb = (
                f'<img class="step-thumb" '
                f'src="data:image/png;base64,{s.screenshot_b64}" '
                f'alt="Step {s.index} screenshot" '
                f'onclick="openLightbox(this)" '
                f'title="Click to enlarge">'
            )
        else:
            thumb = '<span class="no-screenshot">No screenshot</span>'

        parts.append(
            f'<div class="step-item {status_cls}">'
            f'<span class="step-num">{s.index}</span>'
            f'<div class="step-body">'
            f'<div class="step-desc">'
            f'<span class="step-icon">{icon}</span>'
            f"{html.escape(s.description)}"
            f"</div>"
            f"{err_html}"
            f'<div class="step-evidence">{thumb}</div>'
            f"</div>"
            f"</div>"
        )
    return "\n".join(parts)


# ── CSS ────────────────────────────────────────────────────────────────────────


def _css() -> str:
    return """
/* ── Reset & base ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0e0e12;
  color: #e2e2e8;
  font-size: 14px;
  line-height: 1.5;
}

/* ── Header ── */
header {
  background: linear-gradient(135deg, #1a1a24 0%, #12121c 100%);
  border-bottom: 1px solid #2a2a38;
  padding: 1rem 1.5rem;
}
.header-inner {
  max-width: 1600px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
.brand { display: flex; align-items: center; gap: 0.75rem; }
.brand-icon { font-size: 2rem; }
.brand h1 { font-size: 1.4rem; font-weight: 700; color: #f5a623; letter-spacing: -0.02em; }
.subtitle { font-size: 0.8rem; color: #888; }

.summary-bar { display: flex; gap: 1rem; flex-wrap: wrap; }
.stat {
  background: #1e1e2e;
  border: 1px solid #2a2a3a;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  text-align: center;
  min-width: 70px;
}
.stat .num { display: block; font-size: 1.6rem; font-weight: 700; line-height: 1; }
.stat .lbl { display: block; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-top: 2px; }
.stat.pass .num { color: #4ade80; }
.stat.fail .num { color: #f87171; }
.stat.skip .num { color: #facc15; }
.stat.total .num { color: #a5b4fc; }

/* ── Toolbar ── */
.toolbar {
  background: #13131d;
  border-bottom: 1px solid #2a2a38;
  padding: 0.6rem 1.5rem;
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  align-items: center;
  max-width: 1600px;
  margin: 0 auto;
}
.filter-group { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.filter-label { font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.06em; }
.filter-btn {
  background: #1e1e2e;
  border: 1px solid #3a3a4e;
  color: #ccc;
  padding: 0.25rem 0.7rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.78rem;
  transition: background 0.15s, border-color 0.15s;
}
.filter-btn:hover, .filter-btn.active {
  background: #2e2e44;
  border-color: #f5a623;
  color: #f5a623;
}
.action-btn {
  background: #2a2a3e;
  border: 1px solid #4a4a66;
  color: #ccc;
  padding: 0.3rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.78rem;
  transition: background 0.15s;
}
.action-btn:hover { background: #3a3a54; color: #fff; }

/* ── Table wrapper ── */
.table-wrapper {
  max-width: 1600px;
  margin: 1rem auto;
  padding: 0 1rem;
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
thead th {
  background: #1a1a28;
  border: 1px solid #2a2a3a;
  padding: 0.6rem 0.75rem;
  text-align: left;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #aaa;
  position: sticky;
  top: 0;
  z-index: 10;
}
.col-uc    { width: 18%; }
.col-ac    { width: 20%; }
.col-steps { width: 34%; }
.col-status{ width: 10%; }
.col-hv    { width: 18%; }

/* ── Rows ── */
.test-row td {
  border: 1px solid #22222e;
  padding: 0.65rem 0.75rem;
  vertical-align: top;
}
.test-row { background: #14141e; }
.test-row:nth-child(even) { background: #13131c; }
.test-row.fail td:first-child { border-left: 3px solid #f87171; }
.test-row.pass td:first-child { border-left: 3px solid #4ade80; }
.test-row.skip td:first-child { border-left: 3px solid #facc15; }
.test-row.hidden { display: none; }

/* ── Use Case cell ── */
.uc-id {
  display: inline-block;
  background: #2a2a3e;
  border: 1px solid #4a4a66;
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 0.7rem;
  font-family: monospace;
  color: #a5b4fc;
  margin-bottom: 4px;
}
.uc-name { font-weight: 600; color: #e2e2f0; margin: 4px 0; font-size: 0.88rem; }
.persona-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 3px;
}
.persona-badge.player      { background: #1a3a2a; color: #4ade80; border: 1px solid #2a5a3a; }
.persona-badge.coordinator { background: #1a2a4a; color: #60a5fa; border: 1px solid #2a4a7a; }
.persona-badge.director    { background: #2a1a3a; color: #c084fc; border: 1px solid #4a2a6a; }
.persona-badge.admin       { background: #3a1a1a; color: #f87171; border: 1px solid #6a2a2a; }
.persona-badge.auth        { background: #2a2a1a; color: #facc15; border: 1px solid #5a5a2a; }
.persona-badge.rbac        { background: #1a2a2a; color: #2dd4bf; border: 1px solid #2a5a5a; }
.duration { font-size: 0.7rem; color: #666; margin-top: 4px; }

/* ── Criteria cell ── */
.criteria-list { padding-left: 1.1rem; }
.criteria-list li { font-size: 0.82rem; margin-bottom: 3px; color: #ccc; }
.criteria-list li.met::marker { color: #4ade80; content: "✓  "; }
.criteria-list li.unmet::marker { color: #f87171; content: "✗  "; }
.no-criteria { font-size: 0.78rem; color: #555; font-style: italic; }

/* ── Steps cell ── */
.toggle-steps {
  background: #1e1e2e;
  border: 1px solid #3a3a4e;
  color: #a5b4fc;
  font-size: 0.78rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 0.5rem;
  transition: background 0.15s;
}
.toggle-steps:hover { background: #2a2a44; }
.steps-container { transition: max-height 0.2s; }
.steps-container.collapsed { display: none; }

.step-item {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px dashed #1e1e2e;
}
.step-item:last-child { border-bottom: none; margin-bottom: 0; }
.step-num {
  flex-shrink: 0;
  width: 1.4rem;
  height: 1.4rem;
  background: #2a2a3e;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  color: #888;
  margin-top: 2px;
}
.step-item.passed .step-num { background: #1a3a2a; color: #4ade80; }
.step-item.failed .step-num { background: #3a1a1a; color: #f87171; }
.step-body { flex: 1; min-width: 0; }
.step-desc { font-size: 0.82rem; color: #ccc; display: flex; align-items: baseline; gap: 0.3rem; }
.step-icon { font-size: 0.75rem; flex-shrink: 0; }
.step-item.passed .step-icon { color: #4ade80; }
.step-item.failed .step-icon { color: #f87171; }
.step-error { font-size: 0.75rem; color: #f87171; background: #2a1010; border-radius: 4px; padding: 0.3rem 0.5rem; margin-top: 0.3rem; font-family: monospace; word-break: break-all; }
.step-evidence { margin-top: 0.4rem; }
.step-thumb {
  max-width: 100%;
  max-height: 120px;
  border: 1px solid #2a2a3e;
  border-radius: 4px;
  cursor: zoom-in;
  display: block;
  object-fit: cover;
  transition: opacity 0.15s;
}
.step-thumb:hover { opacity: 0.85; border-color: #f5a623; }
.no-screenshot { font-size: 0.72rem; color: #444; font-style: italic; }
.no-steps { font-size: 0.78rem; color: #555; font-style: italic; }

/* ── Status cell ── */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.status-badge.pass  { background: #14321e; color: #4ade80; border: 1px solid #2a5a38; }
.status-badge.fail  { background: #321414; color: #f87171; border: 1px solid #5a2828; }
.status-badge.skip  { background: #2a2a10; color: #facc15; border: 1px solid #5a5a20; }
.status-badge.error { background: #3a1a00; color: #fb923c; border: 1px solid #6a3000; }
.error-details { margin-top: 0.5rem; }
.error-details summary { font-size: 0.75rem; color: #f87171; cursor: pointer; }
pre.tb {
  font-size: 0.7rem;
  color: #f87171;
  background: #200a0a;
  padding: 0.5rem;
  border-radius: 4px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin-top: 0.3rem;
  max-height: 200px;
  overflow-y: auto;
}

/* ── Human Validation cell ── */
.hv-inner { display: flex; flex-direction: column; gap: 0.4rem; }
.validated-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: #ccc;
  cursor: pointer;
}
.validated-cb {
  width: 1rem;
  height: 1rem;
  accent-color: #4ade80;
  cursor: pointer;
}
.validator-name {
  background: #1a1a2a;
  border: 1px solid #3a3a4e;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-size: 0.78rem;
  color: #ccc;
  width: 100%;
}
.validator-name:focus { outline: none; border-color: #f5a623; }
.notes-field {
  background: #1a1a2a;
  border: 1px solid #3a3a4e;
  border-radius: 4px;
  padding: 0.3rem 0.5rem;
  font-size: 0.78rem;
  color: #ccc;
  width: 100%;
  resize: vertical;
  font-family: inherit;
}
.notes-field:focus { outline: none; border-color: #f5a623; }
.validation-time { font-size: 0.68rem; color: #555; font-style: italic; }

/* ── Lightbox ── */
#lightbox {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.92);
  z-index: 1000;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
}
#lightbox.open { display: flex; }
#lightbox-img {
  max-width: 90vw;
  max-height: 90vh;
  border-radius: 6px;
  box-shadow: 0 0 60px rgba(0,0,0,0.8);
}
.lb-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: #2a2a3e;
  border: 1px solid #4a4a66;
  color: #ccc;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lb-close:hover { background: #3a3a54; color: #fff; }

/* ── Print ── */
@media print {
  header, .toolbar { position: static; }
  .steps-container.collapsed { display: block !important; }
  #lightbox { display: none !important; }
  .col-hv { background: white; color: black; }
  body { background: white; color: black; font-size: 11px; }
  .status-badge.pass { color: green; background: #e8ffe8; }
  .status-badge.fail { color: red; background: #ffe8e8; }
  .step-thumb { max-height: 80px; }
  .table-wrapper { overflow: visible; }
}
"""


# ── JavaScript ────────────────────────────────────────────────────────────────


def _js() -> str:
    return r"""
const STORAGE_KEY = 'pbl-e2e-validation';

// ── Persistence ──────────────────────────────────────────────────────────────

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function saveAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function saveValidation(el) {
  const all = loadAll();
  const key = el.dataset.key;
  const cell = el.closest('.hv-inner');
  const cb   = cell.querySelector('.validated-cb');
  const name = cell.querySelector('.validator-name');
  const notes = cell.querySelector('.notes-field');
  const timeEl = cell.querySelector('.validation-time');

  all[key] = {
    validated: cb.checked,
    validator: name.value,
    notes: notes.value,
    timestamp: new Date().toISOString(),
  };
  saveAll(all);

  if (timeEl) {
    timeEl.textContent = 'Saved ' + new Date().toLocaleTimeString();
  }
}

function restoreValidations() {
  const all = loadAll();
  document.querySelectorAll('.hv-inner').forEach(cell => {
    const key = cell.dataset.test-id || cell.querySelector('[data-key]')?.dataset.key;
    if (!key || !all[key]) return;
    const d = all[key];
    const cb = cell.querySelector('.validated-cb');
    const name = cell.querySelector('.validator-name');
    const notes = cell.querySelector('.notes-field');
    const timeEl = cell.querySelector('.validation-time');
    if (cb && d.validated !== undefined) cb.checked = d.validated;
    if (name && d.validator) name.value = d.validator;
    if (notes && d.notes) notes.value = d.notes;
    if (timeEl && d.timestamp) {
      timeEl.textContent = 'Saved ' + new Date(d.timestamp).toLocaleString();
    }
  });
}

// ── Filters ──────────────────────────────────────────────────────────────────

let activeStatus  = 'all';
let activePersona = 'all';

function applyFilters() {
  document.querySelectorAll('.test-row').forEach(row => {
    const statusMatch  = activeStatus  === 'all' || row.dataset.status  === activeStatus;
    const personaMatch = activePersona === 'all' || row.dataset.persona === activePersona;
    row.classList.toggle('hidden', !(statusMatch && personaMatch));
  });
}

function filterStatus(val) {
  activeStatus = val;
  document.querySelectorAll('.filter-group:nth-child(1) .filter-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.trim().includes(val) || val === 'all' && b.textContent.trim() === 'All');
  });
  applyFilters();
}

function filterPersona(val) {
  activePersona = val;
  document.querySelectorAll('.filter-group:nth-child(2) .filter-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.trim() === val || val === 'all' && b.textContent.trim() === 'All');
  });
  applyFilters();
}

// ── Steps toggle ─────────────────────────────────────────────────────────────

function toggleSteps(btn) {
  const container = btn.nextElementSibling;
  const collapsed = container.classList.toggle('collapsed');
  btn.textContent = btn.textContent.replace(collapsed ? '▾' : '▶', collapsed ? '▶' : '▾');
}

function expandAll() {
  document.querySelectorAll('.steps-container').forEach(c => c.classList.remove('collapsed'));
  document.querySelectorAll('.toggle-steps').forEach(b => {
    b.textContent = b.textContent.replace('▶', '▾');
  });
}

function collapseAll() {
  document.querySelectorAll('.steps-container').forEach(c => c.classList.add('collapsed'));
  document.querySelectorAll('.toggle-steps').forEach(b => {
    b.textContent = b.textContent.replace('▾', '▶');
  });
}

// ── Lightbox ─────────────────────────────────────────────────────────────────

function openLightbox(img) {
  const lb = document.getElementById('lightbox');
  document.getElementById('lightbox-img').src = img.src;
  lb.classList.add('open');
  event.stopPropagation();
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeLightbox();
});

// ── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV() {
  const all = loadAll();
  const headers = ['Test ID','Use Case','Persona','Status','Validated','Validator','Notes','Timestamp'];
  const rows = [headers.join(',')];

  document.querySelectorAll('.test-row').forEach(row => {
    const key     = row.querySelector('[data-key]')?.dataset.key || '';
    const ucId    = row.querySelector('.uc-id')?.textContent.trim() || '';
    const ucName  = row.querySelector('.uc-name')?.textContent.trim() || '';
    const persona = row.dataset.persona || '';
    const status  = row.dataset.status || '';
    const d       = all[key] || {};

    function esc(s) { return '"' + String(s || '').replace(/"/g, '""') + '"'; }
    rows.push([
      esc(ucId),
      esc(ucName),
      esc(persona),
      esc(status),
      esc(d.validated ? 'Yes' : 'No'),
      esc(d.validator || ''),
      esc(d.notes || ''),
      esc(d.timestamp || ''),
    ].join(','));
  });

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'pbl_validation.csv' });
  a.click();
  URL.revokeObjectURL(url);
}

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  restoreValidations();
});
"""
