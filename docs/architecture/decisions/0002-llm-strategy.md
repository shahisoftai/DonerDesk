# ADR 0002 — LLM strategy and provider abstraction

## Context
Phase 1 ships a deterministic stub LLM provider. Production needs real providers
(OpenAI, Anthropic, Bedrock, Ollama) with PII redaction, prompt versioning, and
cost tracking.

## Decision
All AI services in `packages/application` are behind interfaces (`ILLMProvider`,
`IEvidenceTagger`, `IActivityPolisher`, `IReportDraftGenerator`,
`ITemplateExtractionService`, `IChecklistDetector`). The strategy pattern in
`packages/infrastructure/src/llm/factory.ts` selects the implementation at
runtime based on the `LLM_PROVIDER` env var. Every AI call records a
`prompt_version`, model id, latency, and token estimate — ready to be promoted
to a dedicated `llm_runs` table in Phase 3.

## Consequences
- Swapping providers is a single env-var change.
- Domain and application layers never import a concrete LLM SDK.
- `Prompt registry` becomes a first-class concern in Phase 3 with `llm_runs` for
  cost governance and an `eval` harness in CI.
