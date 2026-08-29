"""AI Reporter 2 — split-by-responsibility package.

Modules:
  - models: Pydantic wire models (strict, additive over v1)
  - writer_contract: persona rules, banned phrases, numeric verbatim rule
  - llm_gateway: provider-agnostic chat completions + JSON extract
  - outline: per-inputType outline slot templates
  - chart_suggester: deterministic chart heuristic
  - draft_writer: builds the user prompt, calls LLM, coerces to GeneratedSection
  - critique_writer: typed CritiqueIssue enumeration
  - refiner: applies critique (single pass, same retrieval manifest)
  - artifact_validators: deterministic validators (Python mirror of TS)
  - timeouts: per-section timeout policy
  - pipeline: LangGraph wiring (START -> draft -> critique -> refine -> END)
  - router: FastAPI routes
"""
from __future__ import annotations

from . import (
    artifact_validators,
    chart_suggester,
    critique_writer,
    draft_writer,
    llm_gateway,
    models,
    outline,
    pipeline,
    refiner,
    router,
    timeouts,
    writer_contract,
)
from .models import WRITER_CONTRACT_VERSION, GeneratedSection, SectionBrief, SectionDraftRequest
from .writer_contract import BANNED_PHRASES

__all__ = [
    "router",
    "pipeline",
    "artifact_validators",
    "chart_suggester",
    "critique_writer",
    "draft_writer",
    "llm_gateway",
    "models",
    "outline",
    "refiner",
    "timeouts",
    "writer_contract",
    "WRITER_CONTRACT_VERSION",
    "BANNED_PHRASES",
    "GeneratedSection",
    "SectionBrief",
    "SectionDraftRequest",
]
