"""Generation-speed controls: provider slot/cooldown handling, the capped HTTP
timeout, reasoning switched off for GLM, the cacheable prompt prefix, and the
pipeline's retry policy. No network: HTTP is faked."""
from __future__ import annotations

import json
import threading
import time

import pytest

from app.ai_reporter import draft_writer, llm_gateway, pipeline, provider_limiter, timeouts
from app.ai_reporter.draft_writer import build_user_prompt, build_user_prompt_parts
from app.ai_reporter.llm_gateway import TransientProviderError, _chat, _claude_user_content
from app.ai_reporter.models import (
    Activity,
    Context,
    ContextProfile,
    GeneratedSection,
    ModelConfig,
    SectionBrief,
    SectionDraftRequest,
)


@pytest.fixture(autouse=True)
def _reset_limiter():
    provider_limiter._resume_at = 0.0
    provider_limiter._next_start = 0.0
    yield
    provider_limiter._resume_at = 0.0
    provider_limiter._next_start = 0.0


def _req(title: str = "Results and progress", **brief: object) -> SectionDraftRequest:
    return SectionDraftRequest(
        section=SectionBrief(title=title, **brief),
        context=Context(profile=ContextProfile(tone="FORMAL", language="English")),
        activities=[
            Activity(title="IYCF counselling", activityId="act-14", participantsTotal=142, participantsFemale=97)
        ],
    )


# --------------------------------------------------------------------------- #
# provider slots, cooldown, timeouts
# --------------------------------------------------------------------------- #


def test_abandoned_call_releases_its_slot_when_it_ends(monkeypatch) -> None:
    """Regression: the slot used to be held by the abandoned thread for the full
    provider timeout, so with one slot every queued section timed out too."""
    monkeypatch.setattr(timeouts, "DRAFT_TIMEOUT_MS", 50)
    finish = threading.Event()

    def slow():
        finish.wait(2)
        return "{}", {}

    with pytest.raises(timeouts.SectionTimeoutError):
        timeouts.run_with_section_timeout(slow)
    finish.set()
    # The slot comes back as soon as the abandoned call returns.
    content, _ = timeouts.run_with_section_timeout(lambda: ("ok", {}), max_wait_s=1)
    assert content == "ok"


def test_queueing_for_a_slot_does_not_count_against_the_call_deadline(monkeypatch) -> None:
    monkeypatch.setattr(timeouts, "DRAFT_TIMEOUT_MS", 1000)
    monkeypatch.setattr(provider_limiter, "_slots", threading.BoundedSemaphore(1))
    release_first = threading.Event()
    results: list[str] = []

    def first():
        release_first.wait(2)
        return "first", {}

    def second():
        time.sleep(0.7)  # inside its own 1s, but not after a ~0.5s queue
        return "second", {}

    t = threading.Thread(target=lambda: results.append(timeouts.run_with_section_timeout(first)[0]))
    t.start()
    time.sleep(0.05)
    threading.Timer(0.5, release_first.set).start()
    results.append(timeouts.run_with_section_timeout(second, max_wait_s=2)[0])
    t.join(3)
    assert sorted(results) == ["first", "second"]


def test_no_free_slot_within_the_budget_raises_a_section_timeout(monkeypatch) -> None:
    monkeypatch.setattr(provider_limiter, "_slots", threading.BoundedSemaphore(1))
    assert provider_limiter.acquire(0)
    try:
        with pytest.raises(timeouts.SectionTimeoutError, match="no provider slot"):
            timeouts.run_with_section_timeout(lambda: ("x", {}), max_wait_s=0.05)
    finally:
        provider_limiter.release()


def test_a_429_cooldown_holds_new_calls_and_respects_the_wait_budget() -> None:
    provider_limiter.note_rate_limited(0.2)
    assert provider_limiter.cooldown_remaining_s() > 0
    assert provider_limiter.acquire(0.05) is False  # cannot start before the cooldown ends
    started = time.monotonic()
    assert provider_limiter.acquire(1) is True
    provider_limiter.release()
    assert time.monotonic() - started >= 0.1


def test_http_timeout_never_exceeds_the_draft_deadline(monkeypatch) -> None:
    monkeypatch.setattr(timeouts, "DRAFT_TIMEOUT_MS", 90_000)
    monkeypatch.setenv("AI_REPORTER_TIMEOUT", "180")
    assert timeouts.http_timeout_s() == 95.0
    monkeypatch.setenv("AI_REPORTER_TIMEOUT", "30")
    assert timeouts.http_timeout_s() == 30.0


# --------------------------------------------------------------------------- #
# gateway: GLM thinking off, 429 cooldown, Claude cache breakpoint
# --------------------------------------------------------------------------- #


class _FakeResp:
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self):
        return json.dumps({"choices": [{"message": {"content": "{}"}}], "usage": {}}).encode()


def _capture(monkeypatch) -> dict:
    captured: dict = {}

    def fake_urlopen(req, timeout):
        captured["body"] = json.loads(req.data)
        captured["timeout"] = timeout
        return _FakeResp()

    monkeypatch.setattr(llm_gateway.urllib.request, "urlopen", fake_urlopen)
    return captured


def test_glm_requests_disable_thinking_by_default(monkeypatch) -> None:
    monkeypatch.delenv("AI_REPORTER_THINKING", raising=False)
    captured = _capture(monkeypatch)
    _chat("s", "u", model=ModelConfig(provider="glm", model="glm-5.3-flash", apiKey="k"))
    assert captured["body"]["thinking"] == {"type": "disabled"}
    assert captured["timeout"] <= timeouts.DRAFT_TIMEOUT_MS / 1000 + 5


def test_glm_thinking_can_be_turned_back_on(monkeypatch) -> None:
    monkeypatch.setenv("AI_REPORTER_THINKING", "enabled")
    captured = _capture(monkeypatch)
    _chat("s", "u", model=ModelConfig(provider="glm", model="glm-5.3-flash", apiKey="k"))
    assert "thinking" not in captured["body"]


def test_other_providers_get_no_thinking_field(monkeypatch) -> None:
    captured = _capture(monkeypatch)
    _chat("s", "u", model=ModelConfig(provider="deepseek", model="deepseek-chat", apiKey="k"))
    assert "thinking" not in captured["body"]


def test_a_429_starts_the_shared_cooldown(monkeypatch) -> None:
    import urllib.error
    from email.message import Message

    headers = Message()
    headers["Retry-After"] = "3"

    def fake_urlopen(req, timeout):
        raise urllib.error.HTTPError(req.full_url, 429, "Too Many Requests", headers, None)

    monkeypatch.setattr(llm_gateway.urllib.request, "urlopen", fake_urlopen)
    with pytest.raises(TransientProviderError) as info:
        _chat("s", "u", model=ModelConfig(provider="glm", model="glm-5.3-flash", apiKey="k"))
    assert info.value.retry_after == 3.0
    assert 2.0 < provider_limiter.cooldown_remaining_s() <= 3.0


def test_claude_cache_breakpoint_follows_the_shared_prefix() -> None:
    blocks = _claude_user_content("SHARED\n\nSECTION", "SHARED")
    assert blocks[0] == {"type": "text", "text": "SHARED", "cache_control": {"type": "ephemeral"}}
    assert blocks[1] == {"type": "text", "text": "\n\nSECTION"}
    assert _claude_user_content("user", None) == "user"
    assert _claude_user_content("user", "other") == "user"  # prefix must actually match


# --------------------------------------------------------------------------- #
# prompt: report-wide prefix first, identical across sections
# --------------------------------------------------------------------------- #


def test_shared_prefix_is_identical_across_sections_and_leads_the_prompt() -> None:
    a_shared, a_specific = build_user_prompt_parts(_req("Results and progress", mandatoryQuestions=["How many?"]))
    b_shared, b_specific = build_user_prompt_parts(_req("Lessons learned"))
    assert a_shared == b_shared and a_shared
    assert "Lessons learned" not in b_shared and "Lessons learned" in b_specific
    assert '"activityId": "act-14"' in a_shared  # report-wide inputs are in the cached part
    assert build_user_prompt(_req("Lessons learned")) == b_shared + "\n\n" + b_specific
    assert b_specific.rstrip().endswith("Return only JSON.")


def test_draft_passes_the_shared_prefix_as_cache_prefix(monkeypatch) -> None:
    seen: dict = {}

    def fake_chat(system, user, **kw):
        seen.update(kw, user=user)
        return '{"title":"R","content":"Ok."}', {"inputTokens": 1, "outputTokens": 1}

    monkeypatch.setattr(draft_writer, "_chat", fake_chat)
    draft_writer.draft(_req())
    assert seen["cache_prefix"] and seen["user"].startswith(seen["cache_prefix"])


# --------------------------------------------------------------------------- #
# pipeline retry policy
# --------------------------------------------------------------------------- #

_STYLE_ONLY = "The project delivered remarkable results for 142 people."  # banned phrase, grounded number


def test_style_only_issues_do_not_trigger_a_second_call(monkeypatch) -> None:
    monkeypatch.delenv("AI_REPORTER_RETRY_ON_STYLE", raising=False)
    calls: list[dict] = []

    def fake_draft(req, **kw):
        calls.append(kw)
        return GeneratedSection(sectionId="s", title="R", content=_STYLE_ONLY)

    monkeypatch.setattr(pipeline, "draft", fake_draft)
    _, telemetry = pipeline.run_pipeline(_req())
    assert len(calls) == 1
    assert telemetry["parseOutcome"] == "VALID_WITH_ISSUES"
    assert any("BANNED_PHRASE" in i for i in telemetry["validatorIssues"])


def test_style_retry_can_be_restored_by_env(monkeypatch) -> None:
    monkeypatch.setenv("AI_REPORTER_RETRY_ON_STYLE", "1")
    calls: list[dict] = []

    def fake_draft(req, **kw):
        calls.append(kw)
        return GeneratedSection(sectionId="s", title="R", content=_STYLE_ONLY)

    monkeypatch.setattr(pipeline, "draft", fake_draft)
    pipeline.run_pipeline(_req())
    assert len(calls) == 2 and "feedback" in calls[1]


def test_missing_mandatory_answer_still_gets_a_feedback_retry(monkeypatch) -> None:
    calls: list[dict] = []

    def fake_draft(req, **kw):
        calls.append(kw)
        return GeneratedSection(sectionId="s", title="R", content="The project counselled 142 caregivers.")

    monkeypatch.setattr(pipeline, "draft", fake_draft)
    pipeline.run_pipeline(_req(mandatoryQuestions=["How were caregivers selected?"]))
    assert len(calls) == 2
    assert any("MISSING_QA" in f for f in calls[1]["feedback"])


def test_repeated_429s_are_retried_with_growing_backoff(monkeypatch) -> None:
    calls = {"n": 0}
    sleeps: list[float] = []

    def fake_draft(req, **kw):
        calls["n"] += 1
        if calls["n"] <= 3:
            raise TransientProviderError(429, None, "rate limited")
        return GeneratedSection(sectionId="s", title="R", content="Done.")

    monkeypatch.setattr(pipeline, "draft", fake_draft)
    monkeypatch.setattr(pipeline.time, "sleep", lambda s: sleeps.append(s))
    monkeypatch.delenv("AI_REPORTER_TRANSIENT_RETRIES", raising=False)
    section, _ = pipeline.run_pipeline(_req())
    assert section.content == "Done." and calls["n"] == 4
    assert len(sleeps) == 3 and sleeps[0] < sleeps[1] < sleeps[2]


def test_transient_retries_are_capped(monkeypatch) -> None:
    calls = {"n": 0}

    def fake_draft(req, **kw):
        calls["n"] += 1
        raise TransientProviderError(503, 0, "overloaded")

    monkeypatch.setattr(pipeline, "draft", fake_draft)
    monkeypatch.setattr(pipeline.time, "sleep", lambda s: None)
    monkeypatch.setenv("AI_REPORTER_TRANSIENT_RETRIES", "2")
    with pytest.raises(TransientProviderError):
        pipeline.run_pipeline(_req())
    assert calls["n"] == 3


def test_pipeline_passes_its_remaining_budget_as_the_slot_wait(monkeypatch) -> None:
    seen: list[float] = []

    def fake_draft(req, **kw):
        seen.append(kw["max_wait_s"])
        return GeneratedSection(sectionId="s", title="R", content="Done.")

    monkeypatch.setattr(pipeline, "draft", fake_draft)
    pipeline.run_pipeline(_req())
    assert 0 < seen[0] <= timeouts.TOTAL_DRAFT_TIMEOUT_MS / 1000


# --------------------------------------------------------------------------- #
# provider error bodies
# --------------------------------------------------------------------------- #


def _http_error(code: int, body: str):
    import io
    import urllib.error
    from email.message import Message

    return urllib.error.HTTPError("https://x", code, "err", Message(), io.BytesIO(body.encode()))


def test_429_rate_limit_body_is_surfaced_in_the_error_message(monkeypatch) -> None:
    def fake_urlopen(req, timeout):
        raise _http_error(429, '{"error":{"code":"1302","message":"Rate limit reached for requests"}}')

    monkeypatch.setattr(llm_gateway.urllib.request, "urlopen", fake_urlopen)
    with pytest.raises(TransientProviderError, match="1302.*Rate limit reached"):
        _chat("s", "u", model=ModelConfig(provider="glm", model="glm-5.3-flash", apiKey="k"))


def test_quota_codes_are_not_treated_as_pacing(monkeypatch) -> None:
    from app.ai_reporter.llm_gateway import ProviderQuotaError

    def fake_urlopen(req, timeout):
        raise _http_error(429, '{"error":{"code":"1310","message":"Weekly/Monthly Limit Exhausted"}}')

    monkeypatch.setattr(llm_gateway.urllib.request, "urlopen", fake_urlopen)
    with pytest.raises(ProviderQuotaError, match="1310"):
        _chat("s", "u", model=ModelConfig(provider="glm", model="glm-5.3-flash", apiKey="k"))
    assert provider_limiter.cooldown_remaining_s() == 0  # no pointless shared cooldown


def test_pipeline_does_not_retry_a_quota_error(monkeypatch) -> None:
    from app.ai_reporter.llm_gateway import ProviderQuotaError

    calls = {"n": 0}

    def fake_draft(req, **kw):
        calls["n"] += 1
        raise ProviderQuotaError("glm refused the request (code 1310)")

    monkeypatch.setattr(pipeline, "draft", fake_draft)
    with pytest.raises(ProviderQuotaError):
        pipeline.run_pipeline(_req())
    assert calls["n"] == 1


def test_unreadable_error_body_still_raises_the_original_error(monkeypatch) -> None:
    def fake_urlopen(req, timeout):
        raise _http_error(400, "not json")

    monkeypatch.setattr(llm_gateway.urllib.request, "urlopen", fake_urlopen)
    import urllib.error

    with pytest.raises(urllib.error.HTTPError):
        _chat("s", "u", model=ModelConfig(provider="glm", model="glm-5.3-flash", apiKey="k"))
