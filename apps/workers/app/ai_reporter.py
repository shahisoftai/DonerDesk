"""AI Reporter — multi-step, evidence-grounded donor report writing.

Pipeline (draft -> critique -> refine), orchestrated with LangGraph when it is
installed, falling back to a plain sequential runner otherwise. The reporter
never invents facts: it only narrates the verified findings, indicator updates,
activity records and pre-retrieved evidence it is given, and returns a
GeneratedSection-shaped response that the deterministic assurance pipeline
verifies downstream.

Routes (protected by X-Internal-Token like all /v1/* worker routes):
  GET  /v1/ai-reporter/health
  POST /v1/ai-reporter/section
  POST /v1/ai-reporter/rewrite
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import time
import urllib.request
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/ai-reporter", tags=["ai-reporter"])

# --------------------------------------------------------------------------- #
# Writer contract (versioned, model-agnostic persona rules)
# --------------------------------------------------------------------------- #

WRITER_CONTRACT_VERSION = int(os.getenv("AI_REPORTER_CONTRACT_VERSION", "1"))

_WRITER_RULES = [
    "You are a precise donor report narrator.",
    (
        "MUST only describe data that appears verbatim in the provided verified "
        "findings, indicator updates, activity records, or evidence chunks."
    ),
    "MUST NOT compute, aggregate, extrapolate, or infer any numbers not present in the input.",
    (
        "MUST NOT invent causes, challenges, mitigations, lessons, future activities, "
        "targets, dates, partners, incidents, or outcomes."
    ),
    "A document title is only inventory metadata; it does not support claims about the document's contents.",
    "A null value with valueStatus NOT_CALCULABLE means unknown, never zero.",
    (
        "MUST NOT use evaluative language (positive/negative) unless the finding's "
        "performanceEvaluation permits it."
    ),
    "MUST distinguish achievement from explanation, and evidence from interpretation.",
    "MUST identify gaps rather than fill them; state clearly when no verified information was recorded.",
    "MUST avoid generic humanitarian clichés and inflated impact language.",
    "MUST NOT repeat the same information across sections.",
    (
        "MUST remain consistent with the provided prior approved narrative, describing "
        "what changed and why when the evidence supports it."
    ),
    "MUST cite evidence by evidenceId and chunkId only from the provided evidence chunks.",
    "MUST preserve every caveat, limitation, and 'needs verification' marker.",
    "MUST keep all verified numbers and units exactly as provided.",
    (
        "Honour the per-section input type: INDICATOR_TABLE sections must be tables; "
        "ANNEX sections must list annexed files; COMPLIANCE sections must state compliance status."
    ),
]


def _system_prompt(version: int) -> str:
    base = "\n".join(f"- {r}" for r in _WRITER_RULES)
    return (
        "You are a precise, evidence-proportionate donor report writer "
        f"(writer contract v{version}).\nRules:\n{base}\n\n"
        "Output STRICT JSON matching the requested schema. No markdown fences, no preamble."
    )


# --------------------------------------------------------------------------- #
# Wire contracts (mirror the TypeScript AiReporterSectionRequest/Response)
# --------------------------------------------------------------------------- #


class SectionBrief(BaseModel):
    title: str
    inputType: str | None = None
    minWords: int | None = None
    maxWords: int | None = None
    mandatoryQuestions: list[str] = Field(default_factory=list)
    evidenceNeeds: list[str] = Field(default_factory=list)
    relatedLogframeElement: str | None = None


class ContextProject(BaseModel):
    title: str | None = None
    projectCode: str | None = None
    donorName: str | None = None
    implementingOrganization: str | None = None
    partnerOrganization: str | None = None
    country: str | None = None
    location: str | None = None
    sector: str | None = None
    description: str | None = None
    budget: str | None = None
    reportingFrequency: str | None = None


class ContextPeriod(BaseModel):
    reportType: str | None = None
    startDate: str | None = None
    endDate: str | None = None
    deadline: str | None = None
    readinessScore: int | None = None


class ContextTemplate(BaseModel):
    templateName: str | None = None
    donorName: str | None = None
    language: str | None = None
    requiredAnnexes: list[str] = Field(default_factory=list)
    notes: str | None = None
    version: int | None = None


class ContextProfile(BaseModel):
    tone: str = "FORMAL"
    language: str = "en"
    formattingRules: list[str] = Field(default_factory=list)


class Context(BaseModel):
    project: ContextProject | None = None
    period: ContextPeriod | None = None
    template: ContextTemplate | None = None
    profile: ContextProfile = ContextProfile()


class Finding(BaseModel):
    indicatorCode: str
    indicatorName: str | None = None
    baseline: str | int | float | None = None
    target: str | int | float | None = None
    value: str | int | float | None = None
    valueStatus: str | None = None
    unit: str | None = None
    performanceEvaluation: dict[str, Any] | None = None
    qualityFlags: list[str] = Field(default_factory=list)
    comparisonValue: str | int | float | None = None


class IndicatorUpdate(BaseModel):
    indicatorCode: str
    periodAchievement: str | None = None
    cumulativeAchievement: str | None = None
    comments: str | None = None
    dataSource: str | None = None


class Activity(BaseModel):
    title: str
    date: str | None = None
    location: str | None = None
    participantsTotal: int | None = None
    participantsMale: int | None = None
    participantsFemale: int | None = None
    participantsChildren: int | None = None
    participantsDisability: int | None = None
    summary: str | None = None
    achievements: str | None = None
    challenges: str | None = None
    lessonsLearned: str | None = None
    nextSteps: str | None = None


class EvidenceChunk(BaseModel):
    chunkId: str
    text: str


class Evidence(BaseModel):
    evidenceId: str
    title: str | None = None
    evidenceType: str | None = None
    verificationStatus: str | None = None
    confidentialityLevel: str | None = None
    chunks: list[EvidenceChunk] = Field(default_factory=list)


class PriorNarrative(BaseModel):
    periodLabel: str
    content: str
    sourceSectionTitle: str


class ModelConfig(BaseModel):
    provider: str = "openai"
    model: str | None = None


class SectionDraftRequest(BaseModel):
    section: SectionBrief
    context: Context = Context()
    verifiedFindings: list[Finding] = Field(default_factory=list)
    indicatorUpdates: list[IndicatorUpdate] = Field(default_factory=list)
    activities: list[Activity] = Field(default_factory=list)
    retrievedEvidence: list[Evidence] = Field(default_factory=list)
    priorNarrative: list[PriorNarrative] = Field(default_factory=list)
    writerContractVersion: int = WRITER_CONTRACT_VERSION
    model: ModelConfig = ModelConfig()


class ProposedSource(BaseModel):
    evidenceId: str
    chunkId: str
    sourceText: str


class Claim(BaseModel):
    text: str
    type: str = "FACTUAL"
    proposedSources: list[ProposedSource] = Field(default_factory=list)


class SourceReference(BaseModel):
    type: str = "indicator"
    id: str
    label: str | None = None


class GeneratedSection(BaseModel):
    sectionId: str
    title: str
    content: str
    claims: list[Claim] = Field(default_factory=list)
    sourceReferences: list[SourceReference] = Field(default_factory=list)


class SectionDraftResponse(BaseModel):
    sectionId: str
    title: str
    content: str
    claims: list[Claim] = Field(default_factory=list)
    sourceReferences: list[SourceReference] = Field(default_factory=list)
    telemetry: dict[str, Any] = Field(default_factory=dict)


class RewriteRequest(BaseModel):
    sectionTitle: str
    content: str
    mode: str = "REWRITE"
    audience: str = "DONOR"
    instructions: str | None = None
    sourceReferences: list[SourceReference] = Field(default_factory=list)
    writerContractVersion: int = WRITER_CONTRACT_VERSION
    model: ModelConfig = ModelConfig()


class RewriteResponse(BaseModel):
    content: str
    promptHash: str | None = None
    responseHash: str | None = None


# --------------------------------------------------------------------------- #
# LLM gateway (OpenAI-compatible; works with OpenAI, DeepSeek, MiniMax, Ollama)
# --------------------------------------------------------------------------- #


def _resolve_llm(model: ModelConfig) -> tuple[str, str | None, str, str]:
    provider = model.provider or os.getenv("AI_REPORTER_PROVIDER", "openai")
    model_name = model.model or os.getenv("AI_REPORTER_MODEL", "")
    base_url = os.getenv("AI_REPORTER_BASE_URL", "")
    api_key = os.getenv("AI_REPORTER_API_KEY", os.getenv("OPENAI_API_KEY", ""))
    if not base_url:
        base_url = {
            "openai": "https://api.openai.com/v1",
            "deepseek": "https://api.deepseek.com",
            "minimax": "https://api.minimax.io/v1",
            "ollama": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434") + "/v1",
        }.get(provider, "https://api.openai.com/v1")
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
    with urllib.request.urlopen(req, timeout=float(os.getenv("AI_REPORTER_TIMEOUT", "180"))) as resp:  # noqa: S310 (internal service call)
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


def _extract_json(text: str) -> Any:
    """Robustly parse a JSON object from an LLM response (fences / prose wrap)."""
    cleaned = re.sub(r"```(?:json)?\s*\n?", "", text).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    # Locate the outermost balanced JSON object.
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


def _coerce_section(raw: dict[str, Any], fallback_title: str) -> GeneratedSection:
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


# --------------------------------------------------------------------------- #
# Pipeline steps (draft -> critique -> refine)
# --------------------------------------------------------------------------- #


def _build_user_prompt(req: SectionDraftRequest) -> str:
    parts: list[str] = [
        f"# Section to draft: {req.section.title}",
        f"# Input type: {req.section.inputType or 'NARRATIVE'}",
    ]
    if req.section.minWords is not None:
        parts.append(f"# Minimum words: {req.section.minWords}")
    if req.section.maxWords is not None:
        parts.append(f"# Maximum words: {req.section.maxWords}")
    if req.section.mandatoryQuestions:
        parts.append("# Mandatory questions:\n" + "\n".join(f"- {q}" for q in req.section.mandatoryQuestions))
    if req.section.evidenceNeeds:
        parts.append("# Evidence needs:\n" + "\n".join(f"- {n}" for n in req.section.evidenceNeeds))
    if req.section.relatedLogframeElement:
        parts.append(f"# Related logframe element: {req.section.relatedLogframeElement}")
    ctx = req.context
    if ctx.project:
        parts.append(
            "# Project context:\n"
            + "\n".join(f"- {k}: {v}" for k, v in ctx.project.model_dump(exclude_none=True).items())
        )
    if ctx.period:
        parts.append(
            "# Reporting period:\n"
            + "\n".join(f"- {k}: {v}" for k, v in ctx.period.model_dump(exclude_none=True).items())
        )
    if ctx.template:
        parts.append(
            "# Donor template:\n"
            + "\n".join(f"- {k}: {v}" for k, v in ctx.template.model_dump(exclude_none=True).items())
        )
    if ctx.profile and ctx.profile.language:
        parts.append(f"# Language: {ctx.profile.language}")
    if ctx.profile and ctx.profile.formattingRules:
        parts.append("# Formatting rules:\n" + "\n".join(f"- {r}" for r in ctx.profile.formattingRules))
    parts.append(
        "# Verified findings (JSON):\n"
        + json.dumps([f.model_dump(exclude_none=True) for f in req.verifiedFindings], ensure_ascii=False)
    )
    parts.append(
        "# Indicator updates (JSON):\n"
        + json.dumps([u.model_dump(exclude_none=True) for u in req.indicatorUpdates], ensure_ascii=False)
    )
    parts.append(
        "# Activity records (JSON):\n"
        + json.dumps([a.model_dump(exclude_none=True) for a in req.activities], ensure_ascii=False)
    )
    parts.append(
        "# Evidence chunks (JSON):\n"
        + json.dumps([e.model_dump(exclude_none=True) for e in req.retrievedEvidence], ensure_ascii=False)
    )
    if req.priorNarrative:
        parts.append(
            "# Prior approved narrative (for consistency):\n"
            + json.dumps([p.model_dump(exclude_none=True) for p in req.priorNarrative], ensure_ascii=False)
        )
    parts.append(
        "# Output schema (STRICT JSON, exactly one section):\n"
        '{"sectionId":"string","title":"string","content":"string","claims":['
        '{"text":"string","type":"NUMERIC|FACTUAL|CAUSAL|QUALITATIVE","proposedSources":[{"evidenceId":"string","chunkId":"string","sourceText":"string"}]}],'
        '"sourceReferences":[{"type":"indicator|evidence|activity|template","id":"string","label":"string"}]}'
    )
    parts.append("Draft ONLY the requested section. Do not invent numbers or records. Return only JSON.")
    return "\n\n".join(parts)


_CRITIQUE_PROMPT = (
    "You are a precise report reviewer. Critique the drafted section against the provided evidence manifest. "
    "Focus ONLY on evidence-conformance and factual integrity, NOT style. Identify: (1) any number that is not "
    "exactly present in the findings/evidence, (2) any claim about causes, outcomes, targets, dates, partners, "
    "incidents, or future plans not supported by the inputs, (3) any caveat/limitation that was dropped, "
    "(4) any cross-section repetition that should be removed, (5) any missing caveat required by quality flags. "
    'Return STRICT JSON: {"issues":["..."]}. Return {"issues":[]} if the draft is fully grounded.'
)

_REFINE_PROMPT = (
    "You are a precise report editor. Fix the drafted section according to the reviewer's issues. "
    "Preserve every fact, number, caveat, and source reference that is already correct. Do NOT add new facts "
    "beyond what the inputs support. Return STRICT JSON matching the section schema."
)


def _draft(req: SectionDraftRequest) -> GeneratedSection:
    system = _system_prompt(req.writerContractVersion)
    user = _build_user_prompt(req)
    content, _telemetry = _chat(system, user, model=req.model)
    raw = _extract_json(content)
    sections = raw.get("sections") if isinstance(raw, dict) and isinstance(raw.get("sections"), list) else None
    obj = sections[0] if sections else raw
    if not isinstance(obj, dict):
        raise ValueError("model returned a non-object section")
    return _coerce_section(obj, req.section.title)


def _critique(req: SectionDraftRequest, draft: GeneratedSection) -> list[str]:
    system = _system_prompt(req.writerContractVersion) + "\n" + _CRITIQUE_PROMPT
    user = _build_user_prompt(req) + "\n\n# Draft to critique:\n" + draft.content
    content, _ = _chat(system, user, model=req.model, temperature=0.1, max_tokens=1024)
    raw = _extract_json(content)
    issues = raw.get("issues") if isinstance(raw, dict) else None
    if not isinstance(issues, list):
        return []
    return [str(i) for i in issues if str(i).strip()]


def _refine(req: SectionDraftRequest, draft: GeneratedSection, issues: list[str]) -> GeneratedSection:
    if not issues:
        return draft
    system = _system_prompt(req.writerContractVersion) + "\n" + _REFINE_PROMPT
    issues_text = "\n".join(f"- {i}" for i in issues)
    user = (
        _build_user_prompt(req)
        + "\n\n# Draft to refine:\n"
        + draft.content
        + "\n\n# Reviewer issues:\n"
        + issues_text
    )
    content, _ = _chat(system, user, model=req.model)
    raw = _extract_json(content)
    obj = raw.get("sections", [raw])[0] if isinstance(raw, dict) and raw.get("sections") else raw
    refined = _coerce_section(obj, req.section.title)
    return refined


def _run_pipeline(req: SectionDraftRequest, section_id: str) -> tuple[GeneratedSection, dict[str, Any]]:
    """Run draft -> critique -> refine. Uses LangGraph when available."""
    prompt_hash = hashlib.sha256(_system_prompt(req.writerContractVersion).encode("utf-8")).hexdigest()[:16]

    try:
        from langgraph.graph import END, START, StateGraph
    except ImportError:  # pragma: no cover - plain sequential fallback
        draft = _draft(req)
        issues = _critique(req, draft)
        refined = _refine(req, draft, issues)
        telemetry = {"promptHash": prompt_hash, "parseOutcome": "VALID", "critiqueIssues": len(issues)}
        return refined, telemetry

    def node_draft(state: dict[str, Any]) -> dict[str, Any]:
        return {"draft": _draft(req)}

    def node_critique(state: dict[str, Any]) -> dict[str, Any]:
        return {"issues": _critique(req, state["draft"])}

    def node_refine(state: dict[str, Any]) -> dict[str, Any]:
        return {"refined": _refine(req, state["draft"], state["issues"])}

    graph = StateGraph(dict)
    graph.add_node("draft", node_draft)
    graph.add_node("critique", node_critique)
    graph.add_node("refine", node_refine)
    graph.add_edge(START, "draft")
    graph.add_edge("draft", "critique")
    graph.add_edge("critique", "refine")
    graph.add_edge("refine", END)
    compiled = graph.compile()
    state = compiled.invoke({})
    telemetry = {"promptHash": prompt_hash, "parseOutcome": "VALID", "critiqueIssues": len(state.get("issues", []))}
    return state["refined"], telemetry


def _response_for(section: GeneratedSection, telemetry: dict[str, Any]) -> SectionDraftResponse:
    return SectionDraftResponse(
        sectionId=section.sectionId,
        title=section.title,
        content=section.content,
        claims=section.claims,
        sourceReferences=section.sourceReferences,
        telemetry=telemetry,
    )


# --------------------------------------------------------------------------- #
# Routes
# --------------------------------------------------------------------------- #


@router.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok"}


@router.post("/section")
def draft_section(req: SectionDraftRequest) -> SectionDraftResponse:
    section, telemetry = _run_pipeline(req, "section")
    return _response_for(section, telemetry)


@router.post("/rewrite")
def rewrite_section(req: RewriteRequest) -> RewriteResponse:
    system = _system_prompt(req.writerContractVersion)
    audience = (
        "formal, neutral, evidence-proportionate. Do not inflate results or soften caveats."
        if req.audience == "DONOR"
        else "concise, operational"
        if req.audience == "INTERNAL"
        else "plain, accessible"
    )
    instructions = f"Editor note: {req.instructions}" if req.instructions else ""
    user = (
        f"# Section rewrite request\nSection title: {req.sectionTitle}\nMode: {req.mode}\n"
        f"Audience: {audience}\n{instructions}\n\n"
        f"# Existing content:\n{req.content}\n\n"
        "Rules: preserve every fact, number, and caveat exactly; never remove a caveat or limitation; "
        "do not add outcomes, impact, or evaluative language not already stated; keep lists and tables intact.\n"
        'Return STRICT JSON: {"content":"rewritten text"}'
    )
    prompt_text = f"{system}\n\n{user}"
    prompt_hash = hashlib.sha256(prompt_text.encode("utf-8")).hexdigest()
    temperature = 0.1 if req.mode == "SHORTEN" else 0.3
    content, _ = _chat(system, user, model=req.model, temperature=temperature, max_tokens=2048)
    raw = _extract_json(content)
    rewritten = str(raw.get("content") or "").strip() if isinstance(raw, dict) else ""
    if not rewritten:
        raise ValueError("rewrite produced empty content")
    return RewriteResponse(
        content=rewritten,
        promptHash=prompt_hash,
        responseHash=hashlib.sha256(content.encode("utf-8")).hexdigest(),
    )
