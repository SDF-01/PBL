# PBL Arena — E2E Test Suite

Python + Playwright tests organised by **user persona** with an automated dev-server
launcher and a rich self-contained HTML validation report.

---

## Quick Start

```bash
# 1. Install Python deps
pip install -r tests/e2e/requirements.txt
playwright install chromium          # or: playwright install --with-deps

# 2. Configure credentials
cp tests/e2e/.env.test.example tests/e2e/.env.test
#   ↑ edit .env.test with real Firebase account credentials

# 3. Run everything (starts the dev server automatically)
python tests/e2e/run_e2e.py

# 4. Open the report
#   tests/e2e/reports/e2e_report.html
```

---

## Dev Server Launcher — `run_e2e.py`

`run_e2e.py` handles the full lifecycle:

1. **Starts** the Next.js dev server (`npm run dev`)
2. **Polls** `http://localhost:3000` until it responds
3. **Runs** pytest with the rich reporter plugin activated
4. **Stops** the server on exit (even on Ctrl-C or test failure)
5. **Prints** the report path and optionally opens it in a browser

### CLI options

```
python tests/e2e/run_e2e.py [OPTIONS] [PYTEST_ARGS...]

  --no-server         Skip startup — assume app is already running
  --mode dev|static   dev = npm run dev (default)
                      static = npm start (serves pre-built out/)
  --open-report       Open the HTML report in your default browser after tests
  --base-url URL      URL to poll for readiness (default: http://localhost:3000)
  --timeout N         Seconds to wait for the server (default: 90)

  Any extra arguments are passed directly to pytest:
    python tests/e2e/run_e2e.py -m player -v
    python tests/e2e/run_e2e.py -m "not slow" --open-report
    python tests/e2e/run_e2e.py -k test_login
    python tests/e2e/run_e2e.py --no-server -m admin
```

---

## HTML Validation Report

After every run a **self-contained HTML file** is generated at:

```
tests/e2e/reports/e2e_report.html
```

Open it in any browser — no server or internet connection needed.

### Report columns

| Column | Contents |
|---|---|
| **Use Case** | ID (e.g. UC-P-001), name, persona badge, duration |
| **Acceptance Criteria** | Bullet list — green ✓ on PASS, red ✗ on FAIL |
| **Steps & Evidence** | Numbered steps with pass/fail icon + embedded screenshot thumbnail (click to enlarge) |
| **Status** | PASS / FAIL / SKIP badge + expandable error traceback on failure |
| **Human Validation ✓** | Checkbox, validator name field, notes textarea — **persists in localStorage** across page reloads |

### Report features

- **Filter** by status (All / Pass / Fail / Skip) and by persona
- **Expand / Collapse All** steps
- **Lightbox** — click any screenshot thumbnail to see full size
- **Export Validation CSV** — downloads all human validation data (who validated, notes, timestamp) as a `.csv` file
- **Print / PDF** — browser print dialog (steps auto-expand for print)
- **localStorage persistence** — validation state survives page refresh

---

## Persona test files

| Persona | File | Mark | Use Case IDs |
|---|---|---|---|
| Player | `personas/test_player.py` | `@pytest.mark.player` | UC-P-001 → UC-P-022 |
| League Coordinator | `personas/test_league_coordinator.py` | `@pytest.mark.coordinator` | UC-CO-001 → UC-CO-015 |
| Club Director | `personas/test_club_director.py` | `@pytest.mark.director` | UC-DIR-001 → UC-DIR-013 |
| Site Admin | `personas/test_site_admin.py` | `@pytest.mark.admin` | UC-ADM-001 → UC-ADM-016 |
| Auth flows | `test_auth.py` | `@pytest.mark.auth` | UC-AUTH-001 → UC-AUTH-012 |
| RBAC | `test_rbac.py` | `@pytest.mark.rbac` | UC-RBAC-001 → UC-RBAC-011 |

---

## Running specific subsets

```bash
# By persona
python tests/e2e/run_e2e.py -m player
python tests/e2e/run_e2e.py -m coordinator
python tests/e2e/run_e2e.py -m director
python tests/e2e/run_e2e.py -m admin
python tests/e2e/run_e2e.py -m auth
python tests/e2e/run_e2e.py -m rbac

# Skip write-heavy tests
python tests/e2e/run_e2e.py -m "not slow"

# Specific test ID
python tests/e2e/run_e2e.py -k test_valid_credentials_redirect_to_app

# Headed browser (watch tests run)
HEADLESS=false python tests/e2e/run_e2e.py --no-server -m player

# Already-running server
python tests/e2e/run_e2e.py --no-server -m "auth and not slow"
```

---

## Architecture

```
tests/e2e/
├── run_e2e.py              ← Dev-server launcher + pytest orchestrator
├── config.py               ← Base URL, credentials, routes, timeouts
├── conftest.py             ← Pytest fixtures (browser, auth caching, page objects, steps)
├── requirements.txt
├── pytest.ini
├── .env.test.example       ← Copy to .env.test with real credentials
│
├── reporter/               ← Rich HTML report system
│   ├── models.py           ← StepRecord, UseCaseResult dataclasses
│   ├── step_logger.py      ← StepLogger context-manager (captures screenshots)
│   ├── html_generator.py   ← Generates the self-contained HTML report
│   └── plugin.py           ← Pytest plugin (collects results, fires html_generator)
│
├── pages/                  ← Page Object Models (no test logic)
│   ├── base_page.py
│   ├── auth_page.py
│   ├── dashboard_page.py
│   ├── player_page.py
│   ├── ladder_page.py
│   ├── club_page.py
│   ├── league_page.py
│   └── admin_page.py
│
├── personas/               ← Persona test suites
│   ├── test_player.py
│   ├── test_league_coordinator.py
│   ├── test_club_director.py
│   └── test_site_admin.py
│
├── test_auth.py            ← Authentication flows
├── test_rbac.py            ← Role-based access control
│
└── reports/                ← Generated artifacts (gitignored)
    ├── e2e_report.html
    └── screenshots/
```

---

## Auth state caching

On the **first run** each persona logs in and saves browser storage state to
`tests/e2e/.auth/<persona>.json`. Subsequent runs skip the login step entirely.

Delete `.auth/` to force a fresh login (e.g., after changing test credentials):

```bash
rm -rf tests/e2e/.auth
```

---

## Adding new tests

1. Pick the right `personas/test_*.py` file for the persona.
2. Add a test method — apply the `@pytest.mark.use_case(...)` decorator:

```python
@pytest.mark.use_case(
    id="UC-P-023",
    name="Player can do something new",
    persona="Player",
    criteria=[
        "First acceptance criterion",
        "Second acceptance criterion",
    ],
)
def test_something_new(self, player: PlayerPage, steps: StepLogger):
    steps.page = player.page                  # bind for screenshots
    with steps.step("Navigate to the page"):
        player.navigate_to_own_profile()
    with steps.step("Assert the thing"):
        player.assert_profile_loaded()
```

3. Use page-object methods inside `with steps.step(...)` blocks.
4. Screenshots are captured automatically at the end of each step.
5. Rerun — the step + screenshot appear in the HTML report under the Use Case row.
