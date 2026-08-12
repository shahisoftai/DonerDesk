# Phase 3 Completion Report

**Project**: DonorDesk
**Phase**: Phase 3 — AI-Native Features
**Completion Date**: 2026-08-11
**Status**: ⚠️ AUDIT REOPENED — NOT COMPLETE

> The 2026-08-12 implementation audit found that most Phase 3 deliverables were
> disconnected domain/schema primitives rather than end-to-end AI capabilities.
> See `PHASE3-AUDIT.md` for verified fixes, remaining gaps, and completion criteria.

---

## Executive Summary

Phase 3 implemented the AI-native infrastructure layer for DonorDesk, establishing model registry, prompt registry, evaluation harness, feedback loop, vector store support, PII firewall, and self-host capability via Ollama.

---

## Deliverables

### 1. Model Registry ✅

**Prisma Schema** (`packages/infrastructure/prisma/schema.prisma`):
```prisma
model LlmModel {
  id          String   @id
  name        String
  provider    String   // openai | anthropic | bedrock | ollama
  version     String
  capabilities String  // JSON array: ["chat", "embedding", "vision"]
  costPer1kTokens Float @default(0)
  maxTokens   Int     @default(4096)
  jurisdiction String  @default("US") // US | EU | AFRICA | ASIA
  isActive    Boolean @default(true)
  createdAt   DateTime @default(now())
}
```

**Domain Model** (`packages/domain/src/contexts/ai/llm-model.ts`):
- `LlmModel` entity with provider, version, capabilities, cost tracking
- Supports: OpenAI, Anthropic, Bedrock, Ollama
- Jurisdiction-aware for data residency compliance
- Active/inactive toggle for model versioning

---

### 2. Prompt Registry ✅

**Prisma Schema**:
```prisma
model LlmPrompt {
  id          String   @id
  name        String   // e.g., "evidence-tagger", "report-drafter"
  version     Int      @default(1)
  promptText  String   @db.Text
  variables   String   // JSON array of variable names
  modelId     String?
  isActive    Boolean @default(true)
  @@unique([name, version])
}
```

**Domain Model** (`packages/domain/src/contexts/ai/llm-prompt.ts`):
- `LlmPrompt` entity with version tracking
- `render()` method for variable substitution
- `incrementVersion()` for prompt iteration
- Unique constraint on (name, version) pairs

---

### 3. LLM Runs Tracking ✅

**Prisma Schema**:
```prisma
model LlmRun {
  id              String   @id
  modelId         String
  promptId       String
  tenantId       String
  inputTokens     Int      @default(0)
  outputTokens    Int      @default(0)
  totalTokens     Int      @default(0)
  costUsd         Float    @default(0)
  latencyMs       Int      @default(0)
  status          String   // success | error | timeout
  errorMessage    String?
  responseText    String?  @db.Text
  promptVersion   Int
  modelVersion    String
  createdAt       DateTime @default(now())
}
```

**Domain Model** (`packages/domain/src/contexts/ai/llm-run.ts`):
- Tracks input/output tokens and cost
- Records latency for performance monitoring
- Status tracking (success/error/timeout)
- `isSuccess()` helper method

---

### 4. Evaluation Harness ✅

**Location**: `packages/infrastructure/src/ai/eval.ts`

| Component | Description |
|-----------|-------------|
| `RougeEvaluator` | ROUGE-1, ROUGE-2, ROUGE-L scoring |
| `BleuEvaluator` | BLEU score with brevity penalty |
| `EvaluationHarness` | Combined evaluation with threshold gating |
| `aggregateFeedbackSignals()` | Aggregates feedback by task type |

**Features**:
- ROUGE-LCS implementation with dynamic programming
- BLEU with n-gram precision and brevity penalty
- Threshold-based pass/fail
- Feedback signal aggregation by task type

---

### 5. Feedback Loop ✅

**Prisma Schema**:
```prisma
model LlmFeedback {
  id          String   @id
  promptId    String
  tenantId    String
  runId       String?
  taskType    String   // evidence_tagging | report_draft | activity_polish
  entityType  String?
  entityId    String?
  accepted    Boolean
  rating      Int?     // 1-5 optional rating
  comment     String?
  modelId     String?
  promptVersion Int?
}
```

**Domain Model** (`packages/domain/src/contexts/ai/llm-feedback.ts`):
- Accept/reject tracking per task
- Optional 1-5 rating
- Links to entity for context
- `isAccepted()` and `isRejected()` helpers

**Integration**:
- `EvaluationHarness.aggregateFeedbackSignals()` computes:
  - Overall acceptance rate
  - Average rating
  - Per-task-type breakdown

---

### 6. Vector Store / Embeddings ✅

**Prisma Schema**:
```prisma
model EvidenceChunk {
  id          String   @id
  evidenceId  String
  tenantId    String
  chunkIndex  Int
  text        String   @db.Text
  tokenCount  Int      @default(0)
  createdAt   DateTime @default(now())
}

model EvidenceEmbedding {
  id          String   @id
  chunkId     String
  tenantId    String
  modelId     String
  provider    String
  vector      String   // JSON array of floats
  dimensions  Int
  createdAt   DateTime @default(now())
}
```

**Domain Models** (`packages/domain/src/contexts/ai/evidence-chunk.ts`):
- `EvidenceChunk` - chunked evidence for RAG
- `EvidenceEmbedding` - vector storage
- `cosineSimilarity()` method for similarity search

**Chunker** (`packages/infrastructure/src/ai/chunker.ts`):
- 512 tokens per chunk, 50 token overlap
- Sliding window chunking
- Token count estimation

---

### 7. PII Firewall ✅

**Location**: `packages/infrastructure/src/ai/pii-firewall.ts`

| Entity Type | Patterns | Score |
|-------------|----------|-------|
| EMAIL | `[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}` | 0.95 |
| PHONE | `\+?\d[\d\s().-]{7,}\d` | 0.80 |
| NATIONAL_ID | `\d{5}-?\d{7}-?\d` | 0.75 |
| CREDIT_CARD | `\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}` | 0.90 |
| DATE_OF_BIRTH | Multiple formats | 0.70 |
| ADDRESS | Street patterns | 0.65 |
| PASSPORT | `[A-Z]{1,2}\d{6,9}` | 0.70 |

**Policies**:
- `reject` - Block text with PII
- `redact` - Replace PII with `[REDACTED]`
- `transform` - Replace with type-specific mask
- `allow` - Pass through (flagged)

---

### 8. Self-Host Ollama Provider ✅

**Location**: `packages/infrastructure/src/ai/ollama.ts`

| Method | Description |
|--------|-------------|
| `complete()` | Text generation |
| `embed()` | Generate embeddings |
| `listModels()` | List available models |
| `isHealthy()` | Health check |

**Configuration**:
```typescript
const provider = new OllamaProvider({
  baseUrl: "http://localhost:11434",
  model: "llama3.2",
  timeoutMs: 60000,
});
```

---

### 9. LLM Provider Factory ✅

**Location**: `packages/infrastructure/src/llm/factory.ts`

**Supported Providers**:
| Provider | Environment Variables |
|----------|---------------------|
| stub | `LLM_PROVIDER=stub` |
| openai | `LLM_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL` |
| anthropic | `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| ollama | `LLM_PROVIDER=ollama`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL` |

---

### 10. Source-Linked RAG Provenance ✅

**Location**: `packages/infrastructure/src/ai/provenance.ts`

**Features**:
- `ProvenanceTracker.buildParagraph()` - builds paragraphs with citations
- `formatInlineProvenance()` - formats claims with `[evidenceId,chunkId,score]`
- `formatSourceReference()` - human-readable source attribution
- Threshold-based "Needs Verification" flagging

**Citation Format**:
```
The project achieved 95% vaccination coverage [ev-001:3:0.85]
```

---

## Phase 3 Definition of Done Status

| Criterion | Status |
|-----------|--------|
| AI eval harness gates merges | ⚠️ Baseline gate now wired; representative golden corpus still missing |
| 100% of generated claims have provenance or are flagged | ❌ Tracker exists but report generation is not wired to chunk-level provenance |
| Tenant can disable AI features and still produce manual report | ⚠️ Organization opt-out and manual draft fallback added; remaining AI endpoints/settings UI need coverage |

---

## Quality Metrics

| Metric | Result |
|--------|--------|
| TypeScript Compilation | ✅ All packages compile without errors |
| Lint | ✅ All packages pass |
| Unit Tests | ⚠️ Current suites pass; original count was not reproducible and end-to-end AI coverage is absent |
| Build | ✅ All packages build successfully |

---

## Limitations & Caveats

1. **pgvector not integrated** - Embeddings stored as JSON strings; actual pgvector extension requires PostgreSQL with vector support
2. **Real LLM providers need API keys** - Ollama/OpenAI/Anthropic adapters need actual credentials
3. **Evaluation harness is local** - BLEU/ROUGE computed locally; LLM-as-judge placeholder
4. **Provenance tracker doesn't auto-wire** - Needs integration into report draft generation flow
5. **Chunker is basic** - No semantic chunking; fixed 512-token window
6. **PII firewall is regex-based** - No ML-based entity recognition like Presidio

---

## What Was Built

Phase 3 established the AI-native infrastructure:
1. Model registry for tracking AI providers and versions
2. Prompt registry for versioned, testable prompts
3. LLM runs tracking for cost and performance monitoring
4. Evaluation harness with ROUGE/BLEU metrics
5. Feedback loop for accept/reject signal collection
6. Evidence chunking and embedding storage for RAG
7. PII firewall with multiple policy options
8. Ollama provider for self-hosted AI
9. LLM factory with multi-provider support
10. Provenance tracking for source-linked claims

### Next: Phase 4 builds Integrations & Ecosystem

Phase 4 will implement:
- Inbound file integrations (Google Drive, S3, Dropbox)
- Field data integrations (KoboToolbox, ODK, CommCare)
- HMIS integration (DHIS2)
- Identity integrations (SCIM, SSO)
- Communications (Slack, Teams, WhatsApp)
- Analytics exports (Power BI, Metabase)
- Public API + Webhooks
- Donor portal
