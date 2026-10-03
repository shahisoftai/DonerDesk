"""LLM gateway — provider-agnostic chat completions + JSON extract.

Backwards-compatible with v1 internals: `_resolve_llm`, `_chat`, `_extract_json`,
`_coerce_section`. Behaviour preserved bit-for-bit so the existing
`/v1/ai-reporter/{section,rewrite,health}` routes behave identically for
v1 callers; v2 callers receive the additive `artifacts/qa/chartSpec/deltaFromPrior`
fields.
"""
from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from typing import Any

from pydantic import ValidationError

from .models import (
    Artifact,
    ChartPayload,
    Claim,
    DeltaPayload,
    GeneratedSection,
    ModelConfig,
    ProposedSource,
    QaPayload,
    SourceReference,
)

_TRANSIENT_STATUS_CODES = {429, 500, 502, 503, 504}


class TransientProviderError(RuntimeError):
    """A provider HTTP error that is worth retrying after a short delay.

    Distinguishes 429/5xx (rate limiting, transient overload) from permanent
    errors (401 unauthorized, 400 bad request) so callers can back off instead
    of retrying immediately into the same rate-limit window — an immediate
    retry with no delay against a 429 almost always fails again for nothing.
    """

    def __init__(self, status_code: int, retry_after: float | None, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.retry_after = retry_after


_DEFAULT_BASE_URLS: dict[str, str] = {
    "openai": "https://api.openai.com/v1",
    "deepseek": "https://api.deepseek.com",
    "minimax": "https://api.minimax.io/v1",
    "glm": "https://api.z.ai/api/paas/v4",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
}
# Providers whose OpenAI-compatible endpoint is not relied on for
# `response_format: json_object`; JSON comes from the prompt + extract_json.
_NO_JSON_MODE = {"gemini"}
# Default Claude model when the configuration leaves the model blank.
DEFAULT_CLAUDE_MODEL = "claude-opus-5"
# Models that support the server-side refusal fallback (`fallbacks: "default"`).
_CLAUDE_FALLBACK_MODELS = {"claude-opus-5", "claude-fable-5-1"}
# Adaptive thinking spends from max_tokens on current Claude models.
_CLAUDE_MIN_MAX_TOKENS = 16000


def _resolve_llm(model: ModelConfig) -> tuple[str, str, str, str]:
    """(provider, model, base_url, api_key) for this request.

    The request's own configuration (resolved by the api from SuperAdmin:
    tenant's own API, else the platform default) wins. The worker env is only
    a fallback, and env credentials are used ONLY for the same provider the env
    names — never send one provider's key to another provider.
    """
    env_provider = os.getenv("AI_REPORTER_PROVIDER", "openai") or "openai"
    provider: str = model.provider or env_provider
    same_as_env = provider == env_provider
    model_name: str = model.model or (os.getenv("AI_REPORTER_MODEL", "") if same_as_env else "") or ""
    if not model_name and provider == "anthropic":
        model_name = DEFAULT_CLAUDE_MODEL
    base_url = model.baseUrl or (os.getenv("AI_REPORTER_BASE_URL", "") if same_as_env else "") or ""
    api_key = model.apiKey or (
        os.getenv("AI_REPORTER_API_KEY", os.getenv("OPENAI_API_KEY", "")) if same_as_env else ""
    ) or ""
    if not base_url and provider not in {"anthropic"}:
        if provider == "ollama":
            base_url = (os.getenv("OLLAMA_BASE_URL", "http://localhost:11434") or "http://localhost:11434") + "/v1"
        else:
            base_url = _DEFAULT_BASE_URLS.get(provider, _DEFAULT_BASE_URLS["openai"])
    return provider, model_name, base_url.rstrip("/"), api_key


_THINK_BLOCK_RE = re.compile(r"<think>.*?</think>", re.DOTALL)
_THINK_UNCLOSED_RE = re.compile(r"<think>.*", re.DOTALL)


def strip_think_blocks(text: str) -> str:
    """Remove reasoning-model `<think>…</think>` blocks from a completion.

    Handles the matched case, an unclosed trailing `<think>…` (truncated
    generation), and stray whitespace left behind. Content outside the blocks
    is preserved verbatim.
    """
    if not text:
        return text or ""
    stripped = _THINK_BLOCK_RE.sub("", text)
    # An unclosed `<think>` means the model burned all tokens on reasoning
    # (truncated generation) — nothing after it is answer content.
    if "<think>" in stripped:
        stripped = _THINK_UNCLOSED_RE.sub("", stripped, count=1)
    return stripped.strip()


def _chat(
    system: str,
    user: str,
    *,
    model: ModelConfig,
    temperature: float = 0.3,
    max_tokens: int | None = None,
    json_mode: bool = True,
) -> tuple[str, dict[str, Any]]:
    provider, model_name, base_url, api_key = _resolve_llm(model)
    if not model_name:
        raise RuntimeError(f"AI Reporter model is not configured for provider {provider}")
    if max_tokens is None:
        # Reasoning models spend completion tokens on hidden `<think>` output
        # and the v4 contract JSON (prose + sources + artifacts) is long, so
        # 4096 truncated most DeepSeek sections and forced the deterministic
        # fallback (live 2026-09-26: 13 of 15 section calls failed after the
        # host's AI_REPORTER_MAX_TOKENS=16384 was lost in an env rewrite).
        # The env var still overrides.
        max_tokens = int(os.getenv("AI_REPORTER_MAX_TOKENS", "16384"))
    if provider == "anthropic":
        return _chat_anthropic(system, user, model_name=model_name, base_url=base_url, api_key=api_key,
                               max_tokens=max_tokens, effort=model.effort)
    return _chat_openai_compatible(
        system, user, provider=provider, model_name=model_name, base_url=base_url, api_key=api_key,
        temperature=temperature, max_tokens=max_tokens, json_mode=json_mode and provider not in _NO_JSON_MODE,
    )


def _chat_openai_compatible(
    system: str,
    user: str,
    *,
    provider: str,
    model_name: str,
    base_url: str,
    api_key: str,
    temperature: float,
    max_tokens: int,
    json_mode: bool,
) -> tuple[str, dict[str, Any]]:
    url = f"{base_url}/chat/completions"
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    body: dict[str, Any] = {
        "model": model_name,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}

    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST")
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=float(os.getenv("AI_REPORTER_TIMEOUT", "180"))) as resp:  # noqa: S310
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code in _TRANSIENT_STATUS_CODES:
            retry_after: float | None = None
            header_value = exc.headers.get("Retry-After") if exc.headers else None
            if header_value:
                try:
                    retry_after = float(header_value)
                except ValueError:
                    retry_after = None
            raise TransientProviderError(
                exc.code, retry_after, f"{provider} returned transient HTTP {exc.code}"
            ) from exc
        raise
    latency_ms = int((time.time() - start) * 1000)

    usage = data.get("usage", {}) or {}
    content = ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
    # Reasoning models (e.g. MiniMax-M3) wrap their answer in <think>…</think>
    # blocks. The thinking text routinely contains braces, which would defeat
    # the balanced-brace JSON scan downstream — strip the blocks up front.
    content = strip_think_blocks(content)
    telemetry = {
        "inputTokens": int(usage.get("prompt_tokens", 0) or 0),
        "outputTokens": int(usage.get("completion_tokens", 0) or 0),
        "latencyMs": latency_ms,
        "parseOutcome": "VALID",
    }
    return content, telemetry


def _retry_after_seconds(value: str | None) -> float | None:
    try:
        return float(value) if value else None
    except ValueError:
        return None


def _chat_anthropic(
    system: str,
    user: str,
    *,
    model_name: str,
    base_url: str,
    api_key: str,
    max_tokens: int,
    effort: str | None,
) -> tuple[str, dict[str, Any]]:
    """Claude via the official Anthropic SDK.

    Current Claude models reject `temperature` and assistant prefill, so the
    JSON shape comes from the prompt (parsed by `extract_json`). Adaptive
    thinking spends from `max_tokens`, so it is never set below 16000. A
    `refusal` stop reason raises, so the section falls back deterministically.
    """
    import anthropic  # local import: only needed when Claude is configured

    if not api_key:
        raise RuntimeError("Anthropic API key is not configured")
    client = anthropic.Anthropic(
        api_key=api_key,
        base_url=base_url or None,
        timeout=float(os.getenv("AI_REPORTER_TIMEOUT", "180")),
        max_retries=0,  # the pipeline owns retry/backoff and the time budget
    )
    kwargs: dict[str, Any] = {
        "model": model_name,
        "max_tokens": max(max_tokens, _CLAUDE_MIN_MAX_TOKENS),
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    if effort:
        kwargs["output_config"] = {"effort": effort}
    if model_name in _CLAUDE_FALLBACK_MODELS:
        kwargs["betas"] = ["server-side-fallback-2026-07-01"]
        kwargs["fallbacks"] = "default"
    start = time.time()
    try:
        response = client.beta.messages.create(**kwargs)
    except anthropic.RateLimitError as exc:
        raise TransientProviderError(429, _retry_after_seconds(exc.response.headers.get("retry-after")), "anthropic rate limited") from exc
    except anthropic.APIStatusError as exc:
        if exc.status_code >= 500:  # includes 529 overloaded
            raise TransientProviderError(exc.status_code, None, f"anthropic returned transient HTTP {exc.status_code}") from exc
        raise
    except anthropic.APIConnectionError as exc:  # includes APITimeoutError
        raise TransientProviderError(503, None, "anthropic connection error") from exc
    if response.stop_reason == "refusal":
        category = getattr(response.stop_details, "category", None) if response.stop_details else None
        raise RuntimeError(f"anthropic refusal{f' ({category})' if category else ''}")
    content = "".join(block.text for block in response.content if block.type == "text")
    telemetry = {
        "inputTokens": int(response.usage.input_tokens or 0),
        "outputTokens": int(response.usage.output_tokens or 0),
        "latencyMs": int((time.time() - start) * 1000),
        "parseOutcome": "VALID",
    }
    return content, telemetry


def extract_json(text: str) -> Any:
    """Robustly parse a JSON object from an LLM response (fences / prose wrap).

    Layered strategy, most-strict first:
      1. the whole (fence-stripped) text is one JSON document;
      2. each balanced `{…}` block is tried with strict `json.loads`;
      3. each block retried leniently (`strict=False` accepts raw control
         characters/newlines inside strings — the most common reasoning-model
         output defect) and with trailing commas removed.

    Raises ValueError only when no layer yields an object, so the pipeline's
    deterministic fallback remains the safety net.
    """
    cleaned = re.sub(r"```(?:json)?\s*\n?", "", text).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    if "{" not in cleaned:
        raise ValueError("no JSON object found in model output")

    blocks = _balanced_json_blocks(cleaned)
    for block in blocks:
        try:
            return json.loads(block)
        except json.JSONDecodeError:
            pass
        try:
            return json.loads(block, strict=False)
        except json.JSONDecodeError:
            pass
        lenient = re.sub(r",\s*([}\]])", r"\1", block)
        try:
            return json.loads(lenient, strict=False)
        except json.JSONDecodeError:
            continue
    # Last resort: the provider hit its output cap mid-way through the trailing
    # lists (proposedSources, artifacts…). The prose is complete, so keep the
    # section and drop only the cut-off tail instead of discarding all of it.
    repaired = _repair_truncated_json(cleaned)
    if repaired is not None:
        import sys as _sys

        _sys.stderr.write(f"[llm_gateway] repaired truncated model JSON; len={len(cleaned)}\n")
        return repaired
    if os.getenv("AI_REPORTER_DEBUG_DUMP", "") == "1":
        # Ground-truth diagnostics for provider format drift (stderr → journald).
        import sys as _sys

        _sys.stderr.write(
            f"[llm_gateway] extraction failed; len={len(cleaned)} "
            f"head={cleaned[:160]!r} tail={cleaned[-160:]!r}\n"
        )
    raise ValueError("could not extract valid JSON from model output")


def _repair_truncated_json(text: str) -> dict[str, Any] | None:
    """Salvage a JSON object cut off by an output-token cap.

    Cuts at the last point where an inner array/object was completely closed
    and closes the still-open containers. Only a result that is an object with
    non-empty string `content` is accepted: a section whose prose itself was
    truncated is not usable and must fall back deterministically.
    """
    start = text.find("{")
    if start < 0:
        return None
    stack: list[str] = []
    in_string = False
    escaped = False
    best: tuple[int, list[str]] | None = None
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch in "{[":
            stack.append("}" if ch == "{" else "]")
        elif ch in "}]":
            if not stack:
                return None
            stack.pop()
            if stack:
                best = (i, list(stack))
    if not stack or best is None:
        return None  # already balanced (handled earlier) or nothing to cut back to
    cut, open_containers = best
    candidate = text[start : cut + 1] + "".join(reversed(open_containers))
    try:
        data = json.loads(candidate, strict=False)
    except json.JSONDecodeError:
        return None
    if isinstance(data, dict) and isinstance(data.get("content"), str) and data["content"].strip():
        return data
    return None


def _balanced_json_blocks(text: str) -> list[str]:
    """Return every balanced top-level-ish `{…}` block, outermost first."""
    blocks: list[str] = []
    depth = 0
    in_string = False
    escaped = False
    start = -1
    for i, ch in enumerate(text):
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start >= 0:
                blocks.append(text[start : i + 1])
                start = -1
    return blocks


def _valid_items(model: type[Any], items: Any) -> list[Any]:
    """Validate each item independently; drop the malformed ones instead of
    failing the whole section (one bad Q&A entry must not discard the prose)."""
    out: list[Any] = []
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict):
            continue
        try:
            out.append(model.model_validate(item))
        except ValidationError:
            continue
    return out


def _valid_one(model: type[Any], item: Any) -> Any:
    if not isinstance(item, dict):
        return None
    try:
        return model.model_validate(item)
    except ValidationError:
        return None


def coerce_section(raw: dict[str, Any], fallback_title: str) -> GeneratedSection:
    """Tolerantly coerce a model output dict into a `GeneratedSection`.

    Preserves v1 fields and passes through the v2 `qa`, `artifacts`,
    `chartSpec`, and `deltaFromPrior` fields. (Previously the docstring claimed
    this pass-through but the fields were silently dropped, which made every
    section with mandatory questions or a prior period fail validation.)
    """
    title = str(raw.get("title") or fallback_title)
    content = str(raw.get("content") or "").strip()
    claims = [
        Claim(
            text=str(c.get("text", "")).strip(),
            type=c.get("type", "FACTUAL"),
            proposedSources=[
                ProposedSource(
                    evidenceId=s.get("evidenceId", ""),
                    chunkId=s.get("chunkId", ""),
                    sourceText=str(s.get("sourceText", "")),
                )
                for s in (c.get("proposedSources") or [])
                if isinstance(s, dict) and s.get("evidenceId") and s.get("chunkId")
            ],
        )
        for c in (raw.get("claims") or [])
        if isinstance(c, dict) and str(c.get("text", "")).strip()
    ]
    refs = [
        SourceReference(type=r.get("type", "indicator"), id=str(r.get("id", "")), label=r.get("label"))
        for r in (raw.get("sourceReferences") or [])
        if isinstance(r, dict) and r.get("id")
    ]
    qa_items = []
    for item in raw.get("qa") or []:
        if isinstance(item, dict):
            # A missing sourceReferences list is tolerated (honest "not
            # recorded" answers have no source); the validator decides.
            qa_items.append({**item, "sourceReferences": item.get("sourceReferences") or []})
    return GeneratedSection(
        sectionId=str(raw.get("sectionId") or f"section-{title}"),
        title=title,
        content=content,
        claims=claims,
        sourceReferences=refs,
        qa=_valid_items(QaPayload, qa_items),
        artifacts=_valid_items(Artifact, raw.get("artifacts")),
        chartSpec=_valid_one(ChartPayload, raw.get("chartSpec")),
        deltaFromPrior=_valid_one(DeltaPayload, raw.get("deltaFromPrior")),
    )
