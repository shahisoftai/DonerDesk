"""Process-wide pacing of provider calls.

Three controls, shared by every section of every report this worker drafts:
  - a concurrency cap (`AI_REPORTER_MAX_CONCURRENCY`, default 4) on in-flight
    provider requests;
  - an optional request-rate cap (`AI_REPORTER_RPM`, default 0 = off) that
    spaces request starts evenly;
  - a shared cooldown: when the provider answers 429, every caller waits out
    the Retry-After (or `AI_REPORTER_429_COOLDOWN_S`, default 5s) before its
    next request, instead of each one hitting the same rate-limit window.

`acquire()` waits for all three and is bounded by the caller's own budget.
"""
from __future__ import annotations

import os
import threading
import time


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


_MAX_CONCURRENCY = max(1, int(_env_float("AI_REPORTER_MAX_CONCURRENCY", 4)))
_RPM = max(0.0, _env_float("AI_REPORTER_RPM", 0))
_COOLDOWN_S = max(0.0, _env_float("AI_REPORTER_429_COOLDOWN_S", 5))
# A provider misreporting a very long Retry-After must not stall the worker.
_MAX_COOLDOWN_S = 60.0

_slots = threading.BoundedSemaphore(_MAX_CONCURRENCY)
_lock = threading.Lock()
_resume_at = 0.0  # monotonic time before which no request may start
_next_start = 0.0  # monotonic time of the next free RPM start slot


def note_rate_limited(retry_after: float | None) -> None:
    """Record a 429 so every caller backs off together."""
    global _resume_at
    delay = _COOLDOWN_S if retry_after is None else retry_after
    delay = max(0.0, min(delay, _MAX_COOLDOWN_S))
    with _lock:
        _resume_at = max(_resume_at, time.monotonic() + delay)


def cooldown_remaining_s() -> float:
    with _lock:
        return max(0.0, _resume_at - time.monotonic())


def acquire(max_wait_s: float) -> bool:
    """Take a provider slot, waiting for the cooldown and RPM pacing.

    Returns False (holding nothing) when that cannot happen within `max_wait_s`.
    """
    global _next_start
    deadline = time.monotonic() + max(0.0, max_wait_s)
    if not _slots.acquire(timeout=max(0.0, max_wait_s)):
        return False
    try:
        while True:
            with _lock:
                now = time.monotonic()
                start_at = max(now, _resume_at, _next_start if _RPM > 0 else now)
                if start_at <= now:
                    if _RPM > 0:
                        _next_start = now + 60.0 / _RPM
                    return True
            if start_at > deadline:
                _slots.release()
                return False
            time.sleep(min(start_at - now, 1.0))
    except BaseException:
        _slots.release()
        raise


def release() -> None:
    _slots.release()
