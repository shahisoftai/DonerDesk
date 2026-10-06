"""Pipeline orchestration — draft, attach deterministic artifacts, validate, retry once.

Flow per section:
  1. `draft()` — one LLM call for prose/claims/Q&A (writer contract v4).
  2. `artifact_builder.attach()` — indicator table / chart / period delta built
     from verified findings (grounded by construction).
  3. `artifact_validators.run_all()` — number grounding, Q&A coverage, banned
     phrases, repetition, word limit, required tables, donor-voice warnings.
  4. On a *retryable* issue (an integrity issue, a missing mandatory answer or
     a missing required table): ONE retry through the same guarded `draft()`
     path with the previous draft + every issue and warning as feedback. The
     better of the two attempts is kept. Style-only issues (banned phrase,
     length, repetition) do not cost a second ~30s call: they are reported as
     `qualityIssues` for the reviewer (`AI_REPORTER_RETRY_ON_STYLE=1` restores
     the old retry).
  5. If the kept attempt still has an *integrity* issue (an ungrounded number),
     the response sets `usedFallback`/`fallbackReason=VALIDATOR_FAILED` so the
     API substitutes the deterministic section.

Provider errors: a transient error (429/5xx) is retried up to
`AI_REPORTER_TRANSIENT_RETRIES` times (default 3) with exponential backoff
honouring Retry-After, bounded by the section budget; these calls fail fast
and do not use up the feedback retry. Any other error (including a reply with
no JSON) gets one plain retry. Worst case is 2 completed LLM calls per section,
typical case 1.
"""
from __future__ import annotations

import hashlib
import os
import random
import time
from typing import Any

from . import artifact_builder
from .artifact_validators import ValidationResult, run_all
from .draft_writer import draft, pop_last_telemetry
from .llm_gateway import ProviderQuotaError, TransientProviderError
from .models import GeneratedSection, SectionDraftRequest, SectionDraftResponse
from .outline import section_kind
from .timeouts import SectionTimeoutError, TotalBudgetExceededError, TotalBudgetTracker
from .writer_contract import system_prompt

# Cap on any single backoff sleep, independent of a provider's Retry-After
# header — a provider misreporting a very long Retry-After must not stall a
# request far beyond what the operator configured.
_MAX_BACKOFF_S = 20.0
_BASE_BACKOFF_S = 2.0


def _env_int(name: str, default: int) -> int:
    try:
        return max(0, int(os.getenv(name, str(default))))
    except ValueError:
        return default


# Issues a feedback retry can fix in the prose. Missing deltas and artifact
# ordering come from the deterministic builder, so re-asking the writer cannot
# fix them.
_CONTENT_RETRY_PREFIXES: tuple[str, ...] = ("MISSING_QA", "MISSING_TABLE")

# A synthesis section (executive summary, conclusion) carries the donor's word limit as a hard requirement: running over
# it earns the one feedback retry ("shorten to N words"). Other sections report it as a style issue only.
_LENGTH_RETRY_PREFIX = "WORD_LIMIT: "


def _over_word_limit(result: ValidationResult) -> bool:
    return any(i.startswith(_LENGTH_RETRY_PREFIX) and " > maxWords=" in i for i in result.issues)


def _needs_retry(result: ValidationResult, synthesis: bool = False) -> bool:
    if result.ok:
        return False
    if os.getenv("AI_REPORTER_RETRY_ON_STYLE", "0") == "1":
        return True
    if synthesis and _over_word_limit(result):
        return True
    return bool(result.integrity_issues) or any(i.startswith(_CONTENT_RETRY_PREFIXES) for i in result.issues)


def _backoff_s(exc: TransientProviderError, retry_index: int) -> float:
    if exc.retry_after is not None:
        return float(exc.retry_after)
    return float(_BASE_BACKOFF_S * 2.0**retry_index * random.uniform(0.8, 1.2))


def _response_for(section: GeneratedSection, telemetry: dict[str, Any]) -> SectionDraftResponse:
    return SectionDraftResponse(
        sectionId=section.sectionId,
        title=section.title,
        content=section.content,
        claims=section.claims,
        sourceReferences=section.sourceReferences,
        artifacts=section.artifacts,
        qa=section.qa,
        chartSpec=section.chartSpec,
        deltaFromPrior=section.deltaFromPrior,
        telemetry=telemetry,
    )


def _rank(result: ValidationResult) -> tuple[int, int, int]:
    """Lower is better: integrity issues first, then hard issues, then warnings."""
    return (len(result.integrity_issues), len(result.issues), len(result.warnings))


def run_pipeline(req: SectionDraftRequest) -> tuple[GeneratedSection, dict[str, Any]]:
    """Draft one section with deterministic artifacts, validation, and one feedback retry."""
    prompt_hash = hashlib.sha256(system_prompt(req.writerContractVersion).encode("utf-8")).hexdigest()[:16]
    budget = TotalBudgetTracker()
    kind = section_kind(req.section)
    prior_present = bool(req.priorNarrative)

    attempts: list[tuple[GeneratedSection, ValidationResult]] = []
    tokens = {"inputTokens": 0, "outputTokens": 0}
    feedback: list[str] | None = None
    previous: str | None = None
    last_err: Exception | None = None
    transient_retries = 0
    max_transient_retries = _env_int("AI_REPORTER_TRANSIENT_RETRIES", 3)
    error_retry_used = False

    while True:
        if attempts and budget.remaining_s() <= 0:
            break  # no time for the feedback retry; keep the first attempt
        budget.check()
        try:
            if feedback is None:
                written = draft(req, max_wait_s=budget.remaining_s())
            else:
                written = draft(req, feedback=feedback, previous_content=previous, max_wait_s=budget.remaining_s())
        except (TotalBudgetExceededError, SectionTimeoutError):
            # Never retry once the total budget is gone, and never re-run the
            # same slow call into the same deadline. A slow feedback retry
            # keeps the first attempt; a slow first attempt hands over to the
            # caller's deterministic fallback immediately.
            if attempts:
                break
            raise
        except TransientProviderError as exc:
            last_err = exc
            if attempts or transient_retries >= max_transient_retries:
                break  # keep the attempt we already have / give up
            # An immediate retry into the same rate-limit window almost
            # always fails again for nothing. Back off exponentially — but
            # never past the remaining total budget.
            delay = min(_backoff_s(exc, transient_retries), _MAX_BACKOFF_S, budget.remaining_s())
            transient_retries += 1
            if delay > 0:
                time.sleep(delay)
            continue
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            if attempts or error_retry_used or isinstance(exc, ProviderQuotaError):
                break  # keep the attempt we already have
            error_retry_used = True  # e.g. a reply with no JSON: one plain retry
            continue
        finally:
            call_telemetry = pop_last_telemetry()
            tokens["inputTokens"] += int(call_telemetry.get("inputTokens", 0) or 0)
            tokens["outputTokens"] += int(call_telemetry.get("outputTokens", 0) or 0)

        section = artifact_builder.attach(written, req, kind)
        result = run_all(section, req, prior_narrative_present=prior_present)
        attempts.append((section, result))
        # One feedback retry at most, and none after an error retry (keeps the
        # worst case at two completed calls per section).
        if len(attempts) >= 2 or error_retry_used or not _needs_retry(result, bool(req.section.synthesis)):
            break
        feedback = list(result.issues) + list(result.warnings)
        previous = written.content

    if not attempts:
        if last_err is not None:
            raise last_err
        raise RuntimeError("pipeline exhausted without result")

    best_index = min(range(len(attempts)), key=lambda i: (_rank(attempts[i][1]), -i))
    section, result = attempts[best_index]
    telemetry: dict[str, Any] = {
        **tokens,
        "promptHash": prompt_hash,
        "sectionKind": kind,
        "attempts": len(attempts),
        "validatorIssues": list(result.issues),
        "qualityWarnings": list(result.warnings),
        "parseOutcome": "VALID" if result.ok else ("VALIDATOR_FAILED" if result.integrity_issues else "VALID_WITH_ISSUES"),
    }
    if result.integrity_issues:
        telemetry["usedFallback"] = True
        telemetry["fallbackReason"] = "VALIDATOR_FAILED"
    return section, telemetry
