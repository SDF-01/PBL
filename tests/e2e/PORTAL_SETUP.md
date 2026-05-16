# UC Test Portal — Setup & Adoption Guide

> This document is written for both human engineers and AI agents (Claude, Cursor, etc.).
> An agent reading this has everything it needs to wire the portal into a new project without
> further clarification from a human.

---

## What this is

A self-contained, zero-external-dependency local web portal for running Playwright E2E tests,
viewing results with per-step screenshots, accepting fix suggestions, and generating a Claude
Code prompt for automated repair.

**Two files form the complete module:**

| File | Purpose |
|---|---|
| `portal.py` | HTTP server + embedded UI (~1200 lines) |
| `custom_runner.py` | Subprocess driver for JSON-defined test cases |

Drop both files into any project's test directory and follow the steps below.

---

## Dependencies

```
python >= 3.10
playwright  (pip install playwright && playwright install chromium)
pytest      (pip install pytest pytest-timeout)
```

No other Python packages required. The server uses stdlib only (`http.server`, `threading`,
`subprocess`, `json`, `pathlib`).

If the project has existing pytest tests, also install whatever plugins those tests use
(e.g. `pytest-asyncio`, `faker`).

---

## Minimal adoption (5 minutes)

### 1. Copy the two files

```
your-project/
  tests/e2e/
    portal.py          ← copy here
    custom_runner.py   ← copy here
```

### 2. Configure `PORTAL_CONFIG` (lines 47–50 of portal.py)

```python
PORTAL_CONFIG: dict = {
    "app_name": "Your App Name",        # shown in the portal header
    "base_url": "https://yourapp.com",  # URL tests run against
}
```

Or drop a `portal.json` file next to `portal.py` — it overrides the dict without editing Python:

```json
{
  "app_name": "Acme Dashboard",
  "base_url": "https://dashboard.acme.io"
}
```

### 3. Replace `BUILTIN_GROUPS` (lines 63–71 of portal.py)

Each entry maps one card on the portal UI to a pytest file or marker:

```python
BUILTIN_GROUPS = [
    {
        "id":          "smoke",                    # unique slug, used in API calls
        "name":        "Smoke Tests",              # card title
        "description": "Critical path checks",    # card subtitle
        "color":       "#4f86f7",                  # dot color (any CSS color)
        "marker":      "smoke",                    # pytest -m <marker>, or None
        "file":        "tests/e2e/test_smoke.py",  # path passed to pytest
    },
    {
        "id":    "all",
        "name":  "Full Suite",
        "description": "Every test",
        "color": "#4ff7f7",
        "marker": None,
        "file":  "tests/e2e",                      # directory runs all tests in it
    },
]
```

### 4. Start

```bash
py -3 tests/e2e/portal.py
# or
python tests/e2e/portal.py --port 4000 --base-url https://yourapp.com
```

Open `http://localhost:4000`.

---

## Persona / authenticated tests

The portal supports tests that run as a signed-in user. Auth state is cached per persona as
Playwright JSON in `tests/e2e/.auth/{persona}.json`.

If your project has multi-role tests, define how each persona logs in. The simplest approach:

```python
# tests/e2e/conftest.py
def _authenticated_context(browser, persona: str):
    state_path = Path("tests/e2e/.auth") / f"{persona}.json"
    ctx = browser.new_context(storage_state=str(state_path) if state_path.exists() else None)
    if not state_path.exists():
        page = ctx.new_page()
        # your login logic here:
        page.goto(BASE_URL + "/login")
        page.get_by_placeholder("Email").fill(CREDENTIALS[persona]["email"])
        page.get_by_placeholder("Password").fill(CREDENTIALS[persona]["password"])
        page.get_by_role("button", name="Sign in").click()
        ctx.storage_state(path=str(state_path))
        page.close()
    return ctx
```

`custom_runner.py` also reads from `.auth/{persona}.json` automatically — the persona is set
in the custom test case definition (field: `"persona": "admin"`).

Delete stale auth files to force re-login:
```bash
rm tests/e2e/.auth/*.json
```

---

## File layout the portal expects

```
tests/e2e/
  portal.py
  custom_runner.py
  portal.json            ← optional config override
  .auth/
    player.json          ← cached Playwright auth state per persona
    admin.json
  reports/
    run_results.json     ← last pytest run (shared fallback)
    run_{uuid}.json      ← per-run result (written when PORTAL_RUN_ID is set)
    custom_tests.json    ← persisted custom use cases and groups
    fix_prompt.md        ← generated Claude Code prompt (written on "Copy & Save")
    history/
      {uuid}.json        ← one file per completed run (screenshots stripped)
  pages/                 ← page objects (optional, used by pytest tests)
  personas/              ← persona test files (optional)
  reporter/
    plugin.py            ← pytest plugin (writes per-run JSON)
    models.py
    step_logger.py
    html_generator.py
```

---

## Adapting `buildSug()` for your project

`buildSug()` in `portal.py` (search: `function buildSug`) generates the "Suggested Fix" text
shown per failing test. The default patterns are generic but you can add project-specific rules:

```javascript
// inside buildSug(), add before the final return:
if (/your-app-specific-error/i.test(err))
  return 'Your specific fix advice here.';
```

The function receives the full result object `r` with:
- `r.status` — PASS | FAIL | ERROR | SKIP
- `r.error_message` — last error line
- `r.steps` — array of step records, each with `.description`, `.error`, `.passed`
- `r.persona` — who the test ran as
- `r.uc_id` — use case ID

---

## CLI flags

```
py -3 portal.py [options]

  --port PORT          Portal port (default: 4000)
  --base-url URL       Override the test target URL (overrides PORTAL_CONFIG)
  --no-devserver       Skip starting a local dev server (default: True)
```

---

## API reference (for agent use)

All endpoints are relative to `http://localhost:{port}`.

| Method | Path | Body / Response |
|---|---|---|
| GET | `/api/groups` | List of builtin group objects |
| GET | `/api/custom/cases` | List of custom use case objects |
| POST | `/api/custom/cases` | `{id?, name, persona, criteria[], steps[]}` → saved case |
| DELETE | `/api/custom/cases/{id}` | Deletes the case |
| GET | `/api/custom/groups` | List of custom group objects |
| POST | `/api/custom/groups` | `{id?, name, description, case_ids[]}` → saved group |
| DELETE | `/api/custom/groups/{id}` | Deletes the group |
| POST | `/api/run` | `{group_id}` → `{run_id}` (202) — starts builtin pytest run |
| POST | `/api/custom/run` | `{group_id}` → `{run_id}` (202) — starts custom run |
| POST | `/api/run/single` | `{node_id}` → `{run_id}` (202) — re-runs one pytest node |
| GET | `/api/run/{run_id}` | Run status + results (poll at 1.5s) |
| GET | `/api/history` | Last 20 completed runs (from disk) |
| POST | `/api/save-prompt` | `{prompt}` → writes `reports/fix_prompt.md` |

---

## Custom test step types

Steps in custom use cases (built via the UI or posted to `/api/custom/cases`) support:

| `type` | Required fields | What it does |
|---|---|---|
| `navigate` | `url` (path, e.g. `/dashboard`) | `page.goto(base_url + url)` |
| `click_role` | `role`, `name` | `get_by_role(role, name=name).first.click()` |
| `click_text` | `text` | `get_by_text(text).first.click()` |
| `fill_placeholder` | `placeholder`, `value` | `get_by_placeholder(ph).fill(value)` |
| `fill_label` | `label`, `value` | `get_by_label(label).fill(value)` |
| `assert_text` | `text` | Asserts element with text is visible |
| `assert_url_contains` | `contains` | Asserts current URL contains string |
| `assert_not_url` | `not_contains` | Asserts current URL does NOT contain string |
| `wait_networkidle` | — | Waits for network to go idle |
| `screenshot` | — | Forces a screenshot capture (auto-captured after every step anyway) |

Add new step types by editing `_run_step()` in `custom_runner.py`.

---

## For AI agents adopting this in a new project

When Claude (or another agent) is asked to wire this portal into a new codebase, the minimal
required changes are:

1. **`PORTAL_CONFIG`** — set `app_name` and `base_url` (or create `portal.json`)
2. **`BUILTIN_GROUPS`** — replace with entries matching the project's test files/markers
3. **Auth login logic** — update `_authenticated_context()` in `conftest.py` to match the
   app's login form selectors
4. **Persona credentials** — update `.env.test` or equivalent with real test account values
5. **`buildSug()` patterns** — optionally add project-specific error pattern matching

Everything else (the server, UI, history, screenshots, custom builder, Claude prompt
generation) is generic and works without modification.

The agent should NOT need to touch:
- `custom_runner.py` step executor (unless adding new step types)
- The HTTP handler class `PortalHandler`
- The embedded CSS/HTML layout
- The `_save_history`, `_new_run`, `_save_custom`, or `_run_*` functions

---

## Known limitations

- Run state is in-memory; restoring a run from History works only if the portal hasn't
  restarted (the history panel shows metadata but full results with screenshots require the
  process to still be running).
- Concurrent runs to the same pytest file are safe (each writes `run_{id}.json`) but pytest
  session fixtures are process-scoped so running the same file twice simultaneously will share
  browser state.
- Auth state files are not validated for expiry — delete `.auth/*.json` if tests fail with
  authentication errors.
