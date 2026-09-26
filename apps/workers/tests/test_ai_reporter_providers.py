"""Per-request provider selection (SuperAdmin default / tenant's own API) and
the Gemini + Claude gateways. No network: HTTP and the Anthropic SDK client are
replaced with fakes."""
from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from app.ai_reporter import llm_gateway
from app.ai_reporter.llm_gateway import TransientProviderError, _chat, _resolve_llm
from app.ai_reporter.models import ModelConfig


@pytest.fixture
def worker_env(monkeypatch):
    monkeypatch.setenv("AI_REPORTER_PROVIDER", "minimax")
    monkeypatch.setenv("AI_REPORTER_MODEL", "MiniMax-M3")
    monkeypatch.setenv("AI_REPORTER_API_KEY", "env-minimax-key")
    monkeypatch.delenv("AI_REPORTER_BASE_URL", raising=False)


def test_request_config_wins_over_worker_env(worker_env) -> None:
    provider, model, base, key = _resolve_llm(ModelConfig(provider="deepseek", model="deepseek-v4-flash", apiKey="tenant-key"))
    assert (provider, model, base, key) == ("deepseek", "deepseek-v4-flash", "https://api.deepseek.com", "tenant-key")


def test_env_credentials_are_never_sent_to_a_different_provider(worker_env) -> None:
    _, model, _, key = _resolve_llm(ModelConfig(provider="gemini", model="gemini-x"))
    assert key == "" and model == "gemini-x"


def test_env_fallback_applies_for_the_same_provider(worker_env) -> None:
    assert _resolve_llm(ModelConfig()) == ("minimax", "MiniMax-M3", "https://api.minimax.io/v1", "env-minimax-key")


def test_gemini_uses_openai_compatible_endpoint_without_json_mode(worker_env, monkeypatch) -> None:
    captured: dict = {}

    class FakeResp:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return json.dumps({"choices": [{"message": {"content": '{"content":"ok"}'}}], "usage": {"prompt_tokens": 5, "completion_tokens": 2}}).encode()

    def fake_urlopen(req, timeout):
        captured["url"] = req.full_url
        captured["auth"] = req.headers.get("Authorization")
        captured["body"] = json.loads(req.data)
        return FakeResp()

    monkeypatch.setattr(llm_gateway.urllib.request, "urlopen", fake_urlopen)
    content, telemetry = _chat("sys", "user", model=ModelConfig(provider="gemini", model="gemini-x", apiKey="g-key"))
    assert captured["url"] == "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    assert captured["auth"] == "Bearer g-key"
    assert "response_format" not in captured["body"]
    assert content == '{"content":"ok"}' and telemetry["inputTokens"] == 5


class _FakeAnthropic:
    last_kwargs: dict = {}
    response: object = None
    raise_exc: Exception | None = None

    def __init__(self, **client_kwargs):
        _FakeAnthropic.client_kwargs = client_kwargs
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        _FakeAnthropic.last_kwargs = kwargs
        if _FakeAnthropic.raise_exc:
            raise _FakeAnthropic.raise_exc
        return _FakeAnthropic.response


def _claude_response(stop_reason="end_turn", text='{"content":"Claude text"}'):
    return SimpleNamespace(
        stop_reason=stop_reason,
        stop_details=SimpleNamespace(category="cyber") if stop_reason == "refusal" else None,
        content=[SimpleNamespace(type="thinking", thinking=""), SimpleNamespace(type="text", text=text)],
        usage=SimpleNamespace(input_tokens=100, output_tokens=40),
    )


@pytest.fixture
def fake_anthropic(monkeypatch):
    import anthropic

    monkeypatch.setattr(anthropic, "Anthropic", _FakeAnthropic)
    _FakeAnthropic.raise_exc = None
    _FakeAnthropic.response = _claude_response()
    return _FakeAnthropic


def test_claude_request_shape(worker_env, fake_anthropic) -> None:
    content, telemetry = _chat("sys", "user", model=ModelConfig(provider="anthropic", apiKey="sk-ant", effort="medium"), temperature=0.2, max_tokens=4096)
    kw = fake_anthropic.last_kwargs
    assert kw["model"] == "claude-opus-5"  # default when the configuration leaves it blank
    assert "temperature" not in kw  # rejected by current Claude models
    assert kw["max_tokens"] >= 16000  # adaptive thinking spends from max_tokens
    assert kw["system"] == "sys" and kw["messages"] == [{"role": "user", "content": "user"}]
    assert kw["output_config"] == {"effort": "medium"}
    assert kw["fallbacks"] == "default" and kw["betas"] == ["server-side-fallback-2026-07-01"]
    assert fake_anthropic.client_kwargs["api_key"] == "sk-ant" and fake_anthropic.client_kwargs["max_retries"] == 0
    assert content == '{"content":"Claude text"}'  # text blocks only; thinking ignored
    assert telemetry["inputTokens"] == 100 and telemetry["outputTokens"] == 40


def test_claude_haiku_has_no_fallback_and_no_effort_unless_configured(worker_env, fake_anthropic) -> None:
    _chat("s", "u", model=ModelConfig(provider="anthropic", model="claude-haiku-4-5", apiKey="k"))
    kw = fake_anthropic.last_kwargs
    assert "fallbacks" not in kw and "betas" not in kw and "output_config" not in kw


def test_claude_refusal_raises_so_the_section_falls_back(worker_env, fake_anthropic) -> None:
    fake_anthropic.response = _claude_response(stop_reason="refusal", text="")
    with pytest.raises(RuntimeError, match="refusal"):
        _chat("s", "u", model=ModelConfig(provider="anthropic", apiKey="k"))


def test_claude_overload_is_transient(worker_env, fake_anthropic) -> None:
    import anthropic
    import httpx2

    request = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    fake_anthropic.raise_exc = anthropic.APIStatusError(
        "overloaded", response=httpx2.Response(529, request=request), body=None
    )
    with pytest.raises(TransientProviderError):
        _chat("s", "u", model=ModelConfig(provider="anthropic", apiKey="k"))


def test_claude_without_key_fails_fast(worker_env, fake_anthropic) -> None:
    with pytest.raises(RuntimeError, match="API key"):
        _chat("s", "u", model=ModelConfig(provider="anthropic"))
