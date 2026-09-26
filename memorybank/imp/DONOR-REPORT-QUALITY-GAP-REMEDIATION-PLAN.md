# Donor-Report Quality Gap Remediation — Implementation Plan

> Source audit: donor-reporting quality gap analysis (conversation, 2026-09).
> Verdict: strong on assurance (anti-inflation, numeric integrity, gates); weak on
> craft/specificity — donor-*shaped* but not donor-*voiced*. Three structural
> gaps, all wiring-not-architecture: (1) `report-writing-skills/` never consumed,
> (2) requirement-pack `guidance`/`mandatoryQuestions`/`requirementKeys` never
> reach the planner or prompts, (3) visibility/branding and cross-cutting content
> have no data model or prompt strategy.

## 1. Ground rules (SOLID mapping)

| Principle | Concrete application in this plan |
|---|---|
| **SRP** | Each new capability is its own module with one reason to change: `requirement-mapping.ts` (match/stamp rules only), `visibility-statement.ts` (attribution catalog only), `donor-pack-blueprints.ts` (pack data only). Prompt assembly stays in the generators; matching logic never leaks into prompt text. |
| **OCP** | New requirement kinds or donor attributions are added as **data** (kind strategy map, `VISIBILITY_STATEMENTS` entries, blueprint entries), not as new conditionals in generation code. New prompt blocks append to arrays; existing blocks untouched. |
| **LSP** | `IReportPlanner.plan` and `GenerateReportDraftInput` grow only via **optional additive fields**; every existing implementation and caller remains a valid substitute. The writer-contract `system_prompt(version)` keeps its signature and stays deterministic per version. |
| **ISP** | Consumers see narrow slices: the planner reads only `ReportingRequirement[]`; the narrator prompt reads only the stamped section; the AI-Reporter brief carries `requirementGuidance` as its own optional field — no module is forced to depend on fields it does not use. |
| **DIP** | `GenerateReportDraftHandler` depends on the **existing `IRequirementResolver` port** (application-owned), container injects `DeterministicRequirementResolver`. Domain modules import nothing but domain. No new concrete adapter coupling anywhere. |

Zero-infra-deps invariant preserved: domain additions are pure TypeScript
(data + pure functions); application additions reference ports and domain only;
infrastructure additions implement/consume existing ports.

## 2. Workstreams implemented now

### WS1 — Requirement-pack → plan → prompt bridge (audit Rec 1, highest leverage)

**Gap.** `ResolvedReportingRequirements` ends at the gate: `InferredReportPlanner`
hardcodes `mandatoryQuestions: []` and never sets `requirementKeys`; neither draft
generator references requirement `guidance`.

**Design.**
- Domain: `stampPlanSectionsWithRequirements(sections, requirements)` — pure,
  deterministic matcher: token-overlap score between the requirement key topic
  (`"<KIND>:<topic>"`) and section `title` (+`evidenceNeeds`, `+relatedLogframeElement`),
  title tokens weighted 2×, ties broken by earliest section. Kind behaviour:
  - `SECTION` / `DECLARATION` → stamp `requirementKeys` + `requirementGuidance`
    (guidance only when present).
  - `QUESTION` → append question text (`guidance` when present, else prettified
    topic) to `mandatoryQuestions` + stamp `requirementKeys`. Unmatched QUESTION
    falls back to the **last** section (donor templates end with a catch-all);
    unmatched DECLARATION falls back to the **first** section; everything else
    requires a score > 0 match (no forced placement, no silent satisfaction).
- Domain: `ReportPlanSection.requirementGuidance?: string[]` (additive optional;
  sections persist as whole-JSON so no Prisma migration, no `REQUIRED_PRISMA_FIELDS`
  change).
- Application: `IReportPlanner.plan` input gains `requirements?: ReportingRequirement[]`;
  `InferredReportPlanner` stamps via the domain mapper.
- Application: `GenerateReportDraftHandler` gains an `IRequirementResolver`
  constructor dependency; resolves once per generation and passes the snapshot to
  the planner. Resolution failure degrades gracefully (plan stamps simply absent —
  gates run elsewhere exactly as before).
- Infrastructure: narrator prompt (`buildSectionNarratorUserPrompt`) renders a
  `# Donor Requirement Guidance` block; AI-Reporter brief carries
  `requirementGuidance` end-to-end (TS `AiReporterSectionBrief` → Python
  `SectionBrief` (extra="forbid", so both sides change together) →
  `draft_writer.build_user_prompt`).

**SOLID.** DIP (handler ↔ port, already existed); OCP (kind map is data); SRP
(matching isolated in domain, testable without LLM or DB); ISP (planner input
extended narrowly); LSP (optional fields only).

**Files.** domain/report-plan.ts, domain/requirement-mapping.ts (new), domain/index,
application/ports/reporting.ts, application/services/report-planner.ts,
application/use-cases/reporting/generate-report-draft.ts, infrastructure/container.ts,
infrastructure/llm/llm-report-draft-generator.ts, infrastructure/llm/ai-reporter-worker.ts,
infrastructure/llm/ai-reporter-draft-generator.ts, workers models.py / draft_writer.py.

**Acceptance.** Planner test stamps keys/questions/guidance deterministically;
without requirements behaviour is byte-identical to before; prompt-bridge test
asserts the narrator prompt contains the guidance block; resolver failure does not
fail generation.

### WS2 — Language-craft block (audit Rec 3)

**Gap.** Nothing in either narrator teaches voice: active voice, plain words,
front-loaded sentences, result-bearing headings.

**Design.** Six mandatory craft rules appended to `buildSystemPrompt()` (TS path;
`promptVersion` 3 → 4 so `llm_runs` records the change) and to the versioned
writer contract as `LANGUAGE_CRAFT_RULES`, appended by `system_prompt(version)`
for `version >= 3` (Python SSOT + TS mirror kept string-identical; default
`AI_REPORTER_CONTRACT_VERSION` bumped to 3 on both sides, parity test updated).

**Acceptance.** Both `systemPrompt(3)` outputs contain the craft rules;
`systemPrompt(2)` output is unchanged; versions agree across languages.

### WS3 — Visibility / attribution catalog (audit Rec 4, prompt strategy first)

**Gap.** Zero "Funded by" hits in src; attribution wording risks paraphrase.

**Design.** Domain `visibility-statement.ts`: donor-keyed catalog (EU, USAID,
FCDO, Global Fund, GCF + generic fallback) with **exact** sentences and usage
rules; `resolveVisibilityStatement(donorName)` normalizes aliases; pure
`visibilityPromptBlock()` renders an "Attribution and visibility (mandatory)"
block with do-not-reword / do-not-imply-endorsement rules. Generators inject it
whenever a donor name is known. Export-builder cover rendering is deferred (§3).

### WS4 — Cross-cutting + financial-narrative guidance (audit Rec 5, Rec 7-lite)

**Design.** `buildSectionSpecificGuidance` extended with two deterministic blocks:
- Cross-cutting sections (protection/gender/environment/AAP/safeguarding…):
  synthesize by theme; quote per-activity recorded disaggregation **verbatim**;
  never total or re-aggregate (totals would fail the numeric-verbatim gate);
  state where disaggregated data was not recorded.
- Financial sections: quote `varianceExplanations` from the story context
  verbatim; never compute new variance figures; state absence honestly.

No new numbers are ever computed into the prompt, keeping the existing
consistency gate sound.

### WS5 — Golden corpus cases (audit Rec 6 partial)

Three adversarial/conforming cases: `eu-echo-visibility` (attribution present →
pass), `cross-cutting-disaggregation` (per-activity breakdown present, sum "75"
absent → pass), `usaid-qpr-missing-attribution` (required attribution missing →
fail). Schema untouched; existing evaluator consumes them unchanged.

**Eval-harness extension (shipped with WS5):** the corpus exposed that no
metric could catch a missing attribution — the USAID case initially passed at
0.75 aggregate. Added an additive `donor-visibility` metric to
`ReportDraftEvaluator` (`reporting-eval.ts`): optional `ReportGoldenCase.requiredAttribution`
declares the sentence that must survive the draft (sentence-key normalized);
when declared and missing it is a critical failure (never averaged away), and
when undeclared no metric is emitted (legacy cases keep their exact metric
surface). Pinned by `test/reporting-eval.test.mjs`; corpus is 28/28 correct
(`reporting:eval` exit 0).

### WS6 — First-party donor pack blueprints (audit Rec 2, data layer)

**Design.** Domain `donor-pack-blueprints.ts`: pure data blueprints
(`echo-hip`, `usaid-qpr`, `unhcr-ppa`) — requirement lists with guidance,
QUESTION interrogatives, DECLARATION visibility, SAFEGUARD; plus
`instantiateDonorPackBlueprint(key, { id, status? })` producing a valid
`ReportingRequirementPack` via `createRequirementPack`. OCP: a new donor pack is
a data entry. Runtime seeding per tenant stays a script/onboarding concern
(ADR: packs are tenant-authored); the catalog is the first-party source.

## 3. Deferred (documented, not forgotten)

| Item | Why deferred |
|---|---|
| Export-builder visibility rendering (cover page) | Needs `ExportMarkdownRenderer` + export package surface change; catalog + prompt strategy land first, renderer consumes the same domain catalog next. |
| `recordedValues` indicator-level disaggregation as generation input | Requires verified-finding schema extension; cross-cutting guidance already enforces verbatim per-activity disaggregation meanwhile. |
| `quoteConsent` evidence flag | Schema + evidence pipeline change; current guidance already restricts quotes to verbatim evidence text with citations. |
| Non-English golden cases | Evaluator limitation markers are English-keyed; needs marker localization before cases are meaningful. |
| Financial period-budget-line data model | Real variance figures require schema; WS4 guidance covers narrative discipline without inventing numbers. |

## 4. Versioning & compatibility

- Writer contract v2 → **v3** (additive rules; `system_prompt(2)` output unchanged).
- `LlmReportDraftGenerator.promptVersion` 3 → **4**.
- All request/response schema changes are additive optional fields; `SectionBrief`
  uses `extra="forbid"`, so TS and Python sides change in the same commit.
- No Prisma schema change; no `REQUIRED_PRISMA_FIELDS` change; no feature flag
  (prompt content is additive and degrades to prior behaviour when no
  requirements/resolved context exist).

## 5. Verification matrix

| Surface | Command |
|---|---|
| Types (all packages) | `pnpm -r typecheck` |
| Build (tests import dist) | `pnpm -r build` |
| Domain tests | `node --test` on the three new domain test files |
| Application tests | `node --test packages/application/test/requirement-bridge.test.mjs` |
| Infrastructure tests | `node --test` on requirement-prompt-bridge, llm-report-draft-generator, artifact-validators, p0-report-quality suites |
| AI Reporter worker tests | `cd apps/workers && .venv/bin/python -m pytest tests` |


