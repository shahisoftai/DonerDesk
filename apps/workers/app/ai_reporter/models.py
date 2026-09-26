"""Pydantic v2 wire models for AI Reporter 2.

Strict, additive over the v1 wire format. v1 models (`SectionDraftRequest`,
`GeneratedSection`, `SectionDraftResponse`, `RewriteRequest`, `RewriteResponse`)
are preserved verbatim; v2 adds the optional `artifacts`, `qa`, `chartSpec`,
`deltaFromPrior` fields plus their typed payloads.
"""
from __future__ import annotations

import os
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Writer contract version (mirrors `packages/infrastructure/.../contract.ts`)
# --------------------------------------------------------------------------- #

WRITER_CONTRACT_VERSION = int(os.getenv("AI_REPORTER_CONTRACT_VERSION", "4"))



# --------------------------------------------------------------------------- #
# v1-compatible models (preserved verbatim)
# --------------------------------------------------------------------------- #


class SectionBrief(BaseModel):
    """Strict mirror of `AiReporterSectionBrief` (TS)."""

    model_config = ConfigDict(extra="forbid")

    title: str
    inputType: str | None = None
    minWords: int | None = None
    maxWords: int | None = None
    mandatoryQuestions: list[str] = Field(default_factory=list)
    evidenceNeeds: list[str] = Field(default_factory=list)
    relatedLogframeElement: str | None = None
    # AI Reporter 2 additions (optional, ignored by v1 consumers)
    numericTable: list["NumericRow"] | None = None
    priorSectionsSummary: list[str] | None = None
    chartSuggestion: "ChartPayload | None" = None
    outlineSlots: list["OutlineSlot"] | None = None
    mandatesTable: bool | None = None
    mandatesChart: bool | None = None
    # Quality remediation WS1 — donor requirement guidance from the resolved
    # requirement snapshot. Must stay in lockstep with the TS
    # `AiReporterSectionBrief` mirror.
    requirementGuidance: list[str] = Field(default_factory=list)
    # Quality v4 — section-specific editorial guidance rendered by the TS
    # `buildSectionSpecificGuidance` (exec-summary structure, annex tables,
    # cross-cutting disaggregation, financial discipline). One SSOT, sent as data.
    sectionGuidance: list[str] = Field(default_factory=list)
    # Quality v4 — the section synthesises the already-drafted report (executive
    # summary / conclusion). `priorSectionsSummary` then carries the drafted
    # sections to summarise, and the repetition guard does not apply.
    synthesis: bool = False


class ContextProject(BaseModel):
    model_config = ConfigDict(extra="forbid")
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
    model_config = ConfigDict(extra="forbid")
    reportType: str | None = None
    startDate: str | None = None
    endDate: str | None = None
    deadline: str | None = None
    readinessScore: float | None = None


class ContextTemplate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    templateName: str | None = None
    donorName: str | None = None
    language: str | None = None
    requiredAnnexes: list[str] = Field(default_factory=list)
    notes: str | None = None
    version: int | None = None


class ContextProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tone: str | None = None
    language: str | None = None
    formattingRules: list[str] = Field(default_factory=list)


class ContextStory(BaseModel):
    """"Tell the Story" narrative context recorded by the reporting officer."""

    model_config = ConfigDict(extra="forbid")
    achievements: str | None = None
    challenges: str | None = None
    varianceExplanations: str | None = None
    adaptations: str | None = None
    lessons: str | None = None


class Context(BaseModel):
    project: ContextProject | None = None
    period: ContextPeriod | None = None
    template: ContextTemplate | None = None
    profile: ContextProfile | None = None
    # Quality v4 — officer narrative context + exact donor attribution lines
    # (rendered from the domain visibility catalog on the TS side).
    story: ContextStory | None = None
    visibility: list[str] = Field(default_factory=list)


class Finding(BaseModel):
    model_config = ConfigDict(extra="forbid")
    indicatorCode: str
    indicatorId: str | None = None
    indicatorName: str | None = None
    indicatorType: str | None = None
    calculationMethod: str | None = None
    baseline: str | float | None = None
    target: str | float | None = None
    value: str | float | None = None
    valueStatus: str | None = None
    unit: str | None = None
    performanceEvaluation: dict[str, Any] | None = None
    qualityFlags: list[str] = Field(default_factory=list)
    comparisonValue: str | float | None = None


class IndicatorUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    indicatorCode: str
    indicatorId: str | None = None
    periodAchievement: str | None = None
    cumulativeAchievement: str | None = None
    comments: str | None = None
    dataSource: str | None = None


class Activity(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str
    activityId: str | None = None
    attachedEvidenceIds: list[str] = Field(default_factory=list)
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
    model_config = ConfigDict(extra="forbid")
    evidenceId: str
    title: str | None = None
    evidenceType: str | None = None
    verificationStatus: str | None = None
    confidentialityLevel: str | None = None
    chunks: list[EvidenceChunk] = Field(default_factory=list)


class PriorNarrative(BaseModel):
    model_config = ConfigDict(extra="forbid")
    periodLabel: str
    content: str
    sourceSectionTitle: str


class ModelConfig(BaseModel):
    """The LLM for this request, resolved by the api per generation (the
    tenant's own configuration or the SuperAdmin default). `apiKey` arrives only
    over the internal-token-protected hop and is never logged or echoed."""

    model_config = ConfigDict(extra="forbid")
    provider: str | None = None
    model: str | None = None
    baseUrl: str | None = None
    apiKey: str | None = Field(default=None, repr=False)
    # Claude only: output_config.effort.
    effort: str | None = None


class SectionDraftRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    section: SectionBrief
    context: Context = Field(default_factory=Context)
    verifiedFindings: list[Finding] = Field(default_factory=list)
    indicatorUpdates: list[IndicatorUpdate] = Field(default_factory=list)
    activities: list[Activity] = Field(default_factory=list)
    retrievedEvidence: list[Evidence] = Field(default_factory=list)
    priorNarrative: list[PriorNarrative] = Field(default_factory=list)
    writerContractVersion: int = WRITER_CONTRACT_VERSION
    model: ModelConfig = Field(default_factory=ModelConfig)


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
    # AI Reporter 2 additions
    artifacts: list["Artifact"] = Field(default_factory=list)
    qa: list["QaPayload"] = Field(default_factory=list)
    chartSpec: "ChartPayload | None" = None
    deltaFromPrior: "DeltaPayload | None" = None


class SectionDraftResponse(BaseModel):
    sectionId: str
    title: str
    content: str
    claims: list[Claim] = Field(default_factory=list)
    sourceReferences: list[SourceReference] = Field(default_factory=list)
    artifacts: list["Artifact"] = Field(default_factory=list)
    qa: list["QaPayload"] = Field(default_factory=list)
    chartSpec: "ChartPayload | None" = None
    deltaFromPrior: "DeltaPayload | None" = None
    telemetry: dict[str, Any] = Field(default_factory=dict)


class RewriteRequest(BaseModel):
    sectionTitle: str
    content: str
    mode: str = "REWRITE"
    audience: str = "DONOR"
    instructions: str | None = None
    sourceReferences: list[SourceReference] = Field(default_factory=list)
    writerContractVersion: int = WRITER_CONTRACT_VERSION
    model: ModelConfig = Field(default_factory=ModelConfig)


class RewriteResponse(BaseModel):
    content: str
    promptHash: str | None = None
    responseHash: str | None = None


# --------------------------------------------------------------------------- #
# AI Reporter 2 — typed artifact payloads
# --------------------------------------------------------------------------- #


class NumericRow(BaseModel):
    indicatorId: str
    indicatorName: str | None = None
    period: str | None = None
    value: str
    unit: str | None = None
    evidenceId: str


class OutlineSlot(BaseModel):
    id: str
    intent: str
    required: bool = True
    hint: str | None = None


class SourceRef(BaseModel):
    type: str = "indicator"
    id: str
    label: str | None = None


class TableColumn(BaseModel):
    key: str
    label: str
    unit: str | None = None


class TableRow(BaseModel):
    cells: list[str | float | None]
    sourceReferences: list[SourceRef] = Field(default_factory=list)


class TablePayload(BaseModel):
    columns: list[TableColumn]
    rows: list[TableRow]


class ChartSeries(BaseModel):
    name: str
    data: list[str | float | None]
    sourceReferences: list[SourceRef] = Field(default_factory=list)


class ChartPayload(BaseModel):
    type: str  # "BAR" | "LINE" | "PIE" | "AREA" | "RADAR" | "GAUGE"
    dataBinding: str  # "INDICATOR_COMPARISON" | "INDICATOR_ACHIEVEMENT" | "STATUS_DISTRIBUTION"
    unit: str | None = None
    title: str
    caption: str
    categories: list[str]
    series: list[ChartSeries]
    sourceReferences: list[SourceRef] = Field(default_factory=list)


class ListPayload(BaseModel):
    ordered: bool = False
    items: list[dict[str, Any]]  # {text, sourceReferences}


class KeyValuePayload(BaseModel):
    entries: list[dict[str, Any]]  # {key, value, sourceReferences}


class QaPayload(BaseModel):
    question: str
    answer: str
    sourceReferences: list[SourceRef]


class DeltaPayload(BaseModel):
    metric: str
    fromValue: str
    toValue: str
    direction: str  # "UP" | "DOWN" | "FLAT"
    evidenceSummary: str
    sourceReferences: list[SourceRef]


class Artifact(BaseModel):
    kind: str  # "TABLE" | "CHART" | "LIST" | "KEY_VALUE" | "QA" | "DELTA"
    caption: str | None = None
    ordinal: int = 0
    payload: dict[str, Any]
    sourceReferences: list[SourceRef] = Field(default_factory=list)


# Resolve forward references for nested Pydantic models.
SectionBrief.model_rebuild()
Context.model_rebuild()
ContextStory.model_rebuild()
ContextProject.model_rebuild()
ContextPeriod.model_rebuild()
ContextTemplate.model_rebuild()
ContextProfile.model_rebuild()
Finding.model_rebuild()
IndicatorUpdate.model_rebuild()
Activity.model_rebuild()
Evidence.model_rebuild()
PriorNarrative.model_rebuild()
SectionDraftRequest.model_rebuild()
GeneratedSection.model_rebuild()
SectionDraftResponse.model_rebuild()
Artifact.model_rebuild()
