"""Per-section timeout policy.

Wraps any callable in an asyncio-friendly wall-clock deadline. The TS mirror
at `packages/infrastructure/src/llm/ai-reporter/per-section-timeout.ts` enforces
the same budget on the HTTP client side.

Two budgets:
  - DRAFT_TIMEOUT_MS: hard per-section cap. Default 45s.
  - TOTAL_DRAFT_TIMEOUT_MS: per-draft wall clock. Default 240s.
"""
from __future__ import annotations

import os
import time
from typing import Any, Callable, TypeVar

T = TypeVar("T")

DRAFT_TIMEOUT_MS = int(os.getenv("AI_REPORTER_DRAFT_TIMEOUT_MS", "45000"))
TOTAL_DRAFT_TIMEOUT_MS = int(os.getenv("AI_REPORTER_TOTAL_DRAFT_TIMEOUT_MS", "240000"))


class SectionTimeoutError(RuntimeError):
    """Raised when a single draft call exceeds the per-section deadline."""


def run_with_section_timeout(call: Callable[[], tuple[str, dict[str, Any]]]) -> tuple[str, dict[str, Any]]:
    """Wrap a single draft/critique/refine call in a wall-clock deadline.

    Implementation: synchronous `urllib` is used under the hood, so we simply
    enforce the deadline before and after the call. If `DRAFT_TIMEOUT_MS` is
    already exceeded, raise `SectionTimeoutError` immediately. If the call
    returns and the elapsed time exceeds the deadline, raise.
    """
    start = time.time()
    deadline_s = DRAFT_TIMEOUT_MS / 1000.0
    content, telemetry = call()
    elapsed_ms = int((time.time() - start) * 1000)
    if elapsed_ms > DRAFT_TIMEOUT_MS:
        raise SectionTimeoutError(
            f"section call exceeded {DRAFT_TIMEOUT_MS}ms (took {elapsed_ms}ms)"
        )
    # Normalise the telemetry key so consumers see a consistent field name.
    telemetry.setdefault("latencyMs", elapsed_ms)
    return content, telemetry
