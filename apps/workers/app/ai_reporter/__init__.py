"""AI Reporter — split-by-responsibility package.

Modules:
  - models: Pydantic wire models (strict, additive over v1)
  - writer_contract: persona rules, banned phrases, number discipline, craft rules
  - llm_gateway: provider-agnostic chat completions + JSON extract + coercion
  - outline: section-kind classification + per-kind outline slot templates
  - chart_suggester: deterministic chart heuristic
  - artifact_builder: deterministic indicator table / chart / delta from findings
  - grounding: number extraction + "no invented numbers" allowed-set
  - donor_voice: deterministic language-craft warnings
  - draft_writer: builds the user prompt, calls LLM, coerces to GeneratedSection
  - artifact_validators: deterministic validators (Python mirror of TS)
  - timeouts: per-call and per-section timeout policy
  - pipeline: draft -> attach artifacts -> validate -> one feedback retry
  - router: FastAPI routes

`critique_writer` / `refiner` are no longer part of the pipeline (not called
since it moved to a single draft call with a deterministic self-check); they
are left on disk only because they carry uncommitted edits, and are not
imported here.
"""
from __future__ import annotations

from . import (
    artifact_builder,
    artifact_validators,
    chart_suggester,
    donor_voice,
    draft_writer,
    grounding,
    llm_gateway,
    models,
    outline,
    pipeline,
    router,
    timeouts,
    writer_contract,
)
from .models import WRITER_CONTRACT_VERSION, GeneratedSection, SectionBrief, SectionDraftRequest
from .writer_contract import BANNED_PHRASES

__all__ = [
    "router",
    "pipeline",
    "artifact_builder",
    "artifact_validators",
    "chart_suggester",
    "donor_voice",
    "draft_writer",
    "grounding",
    "llm_gateway",
    "models",
    "outline",
    "timeouts",
    "writer_contract",
    "WRITER_CONTRACT_VERSION",
    "BANNED_PHRASES",
    "GeneratedSection",
    "SectionBrief",
    "SectionDraftRequest",
]
