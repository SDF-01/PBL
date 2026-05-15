"""
Central configuration for PBL Arena E2E tests.
Reads from environment variables or .env.test file.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env.test")


class Config:
    # Application
    BASE_URL: str = os.getenv("BASE_URL", "http://localhost:3000")
    HEADLESS: bool = os.getenv("HEADLESS", "true").lower() == "true"
    SLOW_MO: int = int(os.getenv("SLOW_MO", "0"))
    BROWSER: str = os.getenv("BROWSER", "chromium")  # chromium | firefox | webkit

    # Default timeouts (ms)
    DEFAULT_TIMEOUT: int = int(os.getenv("DEFAULT_TIMEOUT", "10000"))
    NAVIGATION_TIMEOUT: int = int(os.getenv("NAV_TIMEOUT", "30000"))

    # Test user credentials — one account per persona
    # These must exist in Firebase Auth (real or emulator)
    PLAYER = {
        "email": os.getenv("TEST_PLAYER_EMAIL", "test.player@pbl-arena.test"),
        "password": os.getenv("TEST_PLAYER_PASSWORD", "TestPlayer123!"),
        "first_name": "Alex",
        "last_name": "Player",
        "display_name": "Alex Player",
    }

    COORDINATOR = {
        "email": os.getenv("TEST_COORDINATOR_EMAIL", "test.coordinator@pbl-arena.test"),
        "password": os.getenv("TEST_COORDINATOR_PASSWORD", "TestCoord123!"),
        "first_name": "Jordan",
        "last_name": "Coordinator",
        "display_name": "Jordan Coordinator",
    }

    DIRECTOR = {
        "email": os.getenv("TEST_DIRECTOR_EMAIL", "test.director@pbl-arena.test"),
        "password": os.getenv("TEST_DIRECTOR_PASSWORD", "TestDir123!"),
        "first_name": "Morgan",
        "last_name": "Director",
        "display_name": "Morgan Director",
    }

    ADMIN = {
        "email": os.getenv("TEST_ADMIN_EMAIL", "test.admin@pbl-arena.test"),
        "password": os.getenv("TEST_ADMIN_PASSWORD", "TestAdmin123!"),
        "first_name": "Sam",
        "last_name": "Admin",
        "display_name": "Sam Admin",
    }

    # Firebase emulator (optional)
    USE_EMULATOR: bool = os.getenv("USE_FIREBASE_EMULATOR", "false").lower() == "true"
    EMULATOR_AUTH_URL: str = os.getenv(
        "FIREBASE_AUTH_EMULATOR_URL", "http://localhost:9099"
    )

    # Screenshot / video artifacts
    SCREENSHOTS_DIR: Path = Path(__file__).parent / "reports" / "screenshots"
    VIDEOS_DIR: Path = Path(__file__).parent / "reports" / "videos"

    # Routes
    class Routes:
        HOME = "/"
        LOGIN = "/auth/login"
        SIGNUP = "/auth/signup"
        FORGOT_PASSWORD = "/auth/forgot-password"
        VERIFY_EMAIL = "/auth/verify-email"
        DASHBOARD = "/(authenticated)/dashboard"
        PLAYERS = "/players"
        PLAYER_VIEW = "/players/view"
        PLAYER_EDIT = "/players/edit"
        PLAYER_SEARCH = "/players/search"
        CLUBS = "/clubs"
        CLUB_CREATE = "/clubs/create"
        MY_CLUBS = "/clubs/my"
        LEAGUES = "/leagues"
        LADDER_SEASONS = "/ladder/seasons"
        LADDER_PLAY_DATES = "/ladder/play-dates"
        LADDER_SESSION = "/ladder/session"
        LADDER_STANDINGS = "/ladder/standings"
        LADDER_CHECKIN = "/ladder/check-in"
        TOURNAMENTS = "/tournaments"
        COURTS = "/courts"
        NOTIFICATIONS = "/notifications"
        ADMIN = "/admin"
        ADMIN_CLUBS = "/admin/clubs"
        ADMIN_USERS = "/admin/users"
        ADMIN_AUDIT = "/admin/audit"
