"""Data models for the E2E rich report."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class StepRecord:
    index: int
    description: str
    passed: bool = True
    error: str | None = None
    screenshot_b64: str | None = None  # base64-encoded PNG, no header


@dataclass
class UseCaseResult:
    node_id: str           # pytest node id (unique key)
    uc_id: str             # e.g. "UC-P-001"
    name: str              # human-readable use case name
    persona: str           # Player | Coordinator | Director | Admin | Auth | RBAC
    criteria: list[str] = field(default_factory=list)
    steps: list[StepRecord] = field(default_factory=list)
    status: str = "PENDING"      # PASS | FAIL | SKIP | ERROR
    duration_s: float = 0.0
    error_message: str | None = None
    error_traceback: str | None = None
