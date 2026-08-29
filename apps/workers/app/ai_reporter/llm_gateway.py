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
import urllib.request
from typing import Any

from .models import Claim, GeneratedSection, ModelConfig, ProposedSource, SourceReference


def _resolve_llm(model: ModelConfig) -> tuple[str, str, str, str]:
    provider: str = model.provider or os.getenv("AI_REPORTER_PROVIDER", "openai") or "openai"
    model_name: str = model.model or os.getenv("AI_REPORTER_MODEL", "") or ""
    base_url = os.getenv("AI_REPORTER_BASE_URL", "") or ""
    api_key = os.getenv("AI_REPORTER_API_KEY", os.getenv("OPENAI_API_KEY", "")) or ""
    if not base_url:
        defaults: dict[str, str] = {
            "openai": "https://api.openai.com/v1",
            "deepseek": "https://api.deepseek.com",
            "minimax": "https://api.minimax.io/v1",
            "ollama": (os.getenv("OLLAMA_BASE_URL", "http://localhost:11434") or "http://localhost:11434") + "/v1",
        }
        base_url = defaults.get(provider, "https://api.openai.com/v1")
    return provider, model_name, base_url.rstrip("/"), api_key


def _chat(
    system: str,
    user: str,
    *,
    model: ModelConfig,
    temperature: float = 0.3,
    max_tokens: int = 4096,
    json_mode: bool = True,
) -> tuple[str, dict[str, Any]]:
    provider, model_name, base_url, api_key = _resolve_llm(model)
    if not model_name:
        raise RuntimeError(f"AI Reporter model is not configured for provider {provider}")
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
    with urllib.request.urlopen(req, timeout=float(os.getenv("AI_REPORTER_TIMEOUT", "180"))) as resp:  # noqa: S310
        data = json.loads(resp.read().decode("utf-8"))
    latency_ms = int((time.time() - start) * 1000)

    usage = data.get("usage", {}) or {}
    content = ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
    telemetry = {
        "inputTokens": int(usage.get("prompt_tokens", 0) or 0),
        "outputTokens": int(usage.get("completion_tokens", 0) or 0),
        "latencyMs": latency_ms,
        "parseOutcome": "VALID",
    }
    return content, telemetry


def extract_json(text: str) -> Any:
    """Robustly parse a JSON object from an LLM response (fences / prose wrap).

    Public alias for the v1 `_extract_json` private function. Behaviour preserved.
    """
    cleaned = re.sub(r"```(?:json)?\s*\n?", "", text).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    start = cleaned.find("{")
    if start == -1:
        raise ValueError("no JSON object found in model output")
    depth = 0
    in_string = False
    escaped = False
    for i in range(start, len(cleaned)):
        ch = cleaned[i]
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
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(cleaned[start : i + 1])
                except json.JSONDecodeError:
                    break
    raise ValueError("could not extract valid JSON from model output")


def coerce_section(raw: dict[str, Any], fallback_title: str) -> GeneratedSection:
    """Tolerantly coerce a model output dict into a `GeneratedSection`.

    Preserves v1 fields verbatim and passes through v2 artifacts/qa/chartSpec/
    deltaFromPrior if present (raw dict → Pydantic handles validation).
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
    return GeneratedSection(
        sectionId=str(raw.get("sectionId") or f"section-{title}"),
        title=title,
        content=content,
        claims=claims,
        sourceReferences=refs,
    )
