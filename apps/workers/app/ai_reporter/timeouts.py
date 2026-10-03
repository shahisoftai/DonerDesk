"""Per-section timeout policy.

Wraps any callable in an asyncio-friendly wall-clock deadline. The TS mirror
at `packages/infrastructure/src/llm/ai-reporter/per-section-timeout.ts` enforces
the same budget on the HTTP client side.

Two budgets:
  - DRAFT_TIMEOUT_MS: hard cap per LLM call. Default 90s — measured MiniMax
    section latency is ~38s at 4096 output tokens, so the old 45s cap timed out
    slow-but-healthy sections into the deterministic fallback.
  - TOTAL_DRAFT_TIMEOUT_MS: per-section wall clock across both attempts.
    Default 200s (2 x 90s + backoff). The API's HTTP timeout is derived from
    these (`HttpWorkerClient`), so the worker always answers first.
"""
from __future__ import annotations

import os
import threading
import time
from typing import Any, Callable, TypeVar

T = TypeVar("T")

DRAFT_TIMEOUT_MS = int(os.getenv("AI_REPORTER_DRAFT_TIMEOUT_MS", "90000"))
TOTAL_DRAFT_TIMEOUT_MS = int(os.getenv("AI_REPORTER_TOTAL_DRAFT_TIMEOUT_MS", "200000"))


class SectionTimeoutError(RuntimeError):
    """Raised when a single draft call exceeds the per-section deadline."""


class TotalBudgetExceededError(RuntimeError):
    """Raised when the whole draft->critique->refine->retry pipeline for one
    section has exhausted its total wall-clock budget (`TOTAL_DRAFT_TIMEOUT_MS`,
    previously defined but never enforced anywhere — this class is what makes
    it a real control instead of dead configuration)."""


class TotalBudgetTracker:
    """Tracks elapsed wall-clock time across a whole `run_pipeline` call so a
    stuck retry/backoff loop cannot run indefinitely beyond the documented
    total-draft budget. Call `check()` before starting any further LLM call;
    call `remaining_s()` to cap a backoff sleep so it never itself blows the
    budget.
    """

    def __init__(self, total_ms: int | None = None) -> None:
        self._start = time.time()
        self._total_ms = TOTAL_DRAFT_TIMEOUT_MS if total_ms is None else total_ms

    def elapsed_ms(self) -> int:
        return int((time.time() - self._start) * 1000)

    def remaining_s(self) -> float:
        return max(0.0, (self._total_ms - self.elapsed_ms()) / 1000.0)

    def check(self) -> None:
        if self.elapsed_ms() >= self._total_ms:
            raise TotalBudgetExceededError(
                f"section pipeline exceeded total budget of {self._total_ms}ms"
            )


def run_with_section_timeout(
    call: Callable[[], tuple[str, dict[str, Any]]],
    *,
    max_wait_s: float | None = None,
) -> tuple[str, dict[str, Any]]:
    """Run a single provider call under an enforced wall-clock deadline.

    `call()` performs a blocking request that cannot be interrupted mid-flight,
    so it is run on a daemon thread. The caller's thread only waits up to
    `DRAFT_TIMEOUT_MS`: if the deadline passes first, this raises
    `SectionTimeoutError` immediately and abandons the still-running call.

    A provider slot (`provider_limiter`) is taken *before* the deadline starts,
    so time spent queueing behind other sections never counts against this
    call, and it is released by the call's own thread when the request really
    ends. The HTTP timeout is capped at the draft timeout (`http_timeout_s`),
    so an abandoned call frees its slot soon after its deadline instead of
    holding it for the full provider timeout. `max_wait_s` bounds the queueing
    (the pipeline passes its remaining section budget).
    """
    from . import provider_limiter  # late import: limiter reads env at import

    deadline_s = DRAFT_TIMEOUT_MS / 1000.0
    wait_s = deadline_s if max_wait_s is None else max(0.0, min(deadline_s, max_wait_s))
    if not provider_limiter.acquire(wait_s):
        raise SectionTimeoutError(f"no provider slot free within {int(wait_s * 1000)}ms")

    result: dict[str, Any] = {}
    error: dict[str, BaseException] = {}

    def _run() -> None:
        try:
            result["value"] = call()
        except BaseException as exc:  # noqa: BLE001
            error["value"] = exc
        finally:
            provider_limiter.release()

    start = time.time()
    try:
        thread = threading.Thread(target=_run, daemon=True)
        thread.start()
    except BaseException:
        provider_limiter.release()
        raise
    thread.join(deadline_s)
    elapsed_ms = int((time.time() - start) * 1000)
    if thread.is_alive():
        raise SectionTimeoutError(
            f"section call exceeded {DRAFT_TIMEOUT_MS}ms (abandoned in-flight)"
        )
    if "value" in error:
        raise error["value"]
    content, telemetry = result["value"]
    telemetry.setdefault("latencyMs", elapsed_ms)
    return content, telemetry


def http_timeout_s() -> float:
    """Socket timeout for one provider request: `AI_REPORTER_TIMEOUT`, never
    longer than the per-call draft deadline (plus a small grace), so a call the
    deadline abandoned cannot keep its provider slot for minutes."""
    try:
        configured = float(os.getenv("AI_REPORTER_TIMEOUT", "180"))
    except ValueError:
        configured = 180.0
    return max(1.0, min(configured, DRAFT_TIMEOUT_MS / 1000.0 + 5.0))
