# Phase 46 — Sector Library: comprehensive indicators and sector packs (plan, 2026-11-07)

Status: BUILT 2026-11-08 (see AGENTS.md "Phase 46 invariants"). Decisions taken while building: no `Project.sectorsJson` (the draft keeps `start.sectors`; the project stores the main sector's older word); the review decision is per organisation (`OrganisationLibraryEntry` kind REVIEW) rather than a separate table; the older `SectorTemplatePack` was left in place, not migrated. Owner decisions are in §2. Companion content notes: `sphere.md` (repo root; Sphere 2018 draft figures, many marked ◐ = not yet verified).
Sources read for this plan: `AGENTS.md` (Phase 38 wizard and packs, Phase 28 logframe, Phase 33 formula/entry, Phase 34 templates, Phase 45 canvas), `packages/domain/src/contexts/project-setup/pcw/packs-built-in.ts`, `…/templates/sector-template-pack.ts`, `…/identity/role.ts` (`SECTORS`), `…/dashboards/dashboard-templates.ts` (`TEMPLATE_SECTORS`).

---

## 1. Audit — what exists

| Area | Today | Gap |
|---|---|---|
| Wizard packs (`BUILT_IN_PACKS`) | 4 packs: generic, Health, WASH, Nutrition. Hold cadence, report rules, review mode, entry window, risks, one dashboard template id | **No indicators, no logframe, no forms, no evidence types, no compliance, no assessment questions** |
| Sector template pack (`sector-template-pack.ts`, `SectorTemplatePackRepository`) | Entity with `IndicatorTemplate` (baseline/target guidance, means of verification, disaggregation), `LogframeNodeTemplate`, `ComplianceChecklistTemplate`; guidance text cites SPHERE | Older, separate from the wizard; no definition fields, no reference standard, no versioning of what a project adopted, not offered in the wizard or Logframe tab |
| Sector vocabularies | **Three**: `Sector` (`role.ts`, 10 values), `SectorKey` (`dashboard-templates.ts`, 12 values), wizard pack sectors (string) | One word means three lists. Must become one registry |
| Indicator entry | Manual, import (text/sheet), copy from a project, AI proposal from a document | No library to choose from |
| Reference thresholds | Only free text in `targetGuidance` | No structured "standard" an indicator can be compared with |
| Dashboards, forms, canvases | Role-based dashboard templates, `formFromIndicator`, 8 canvas starters | Not tied to a sector's indicators by a shared key |

---

## 2. Owner decisions (2026-11-07)

1. **The library is comprehensive: all sectors, all sources**, not only Sphere.
2. **Choosing a sector offers the library**; the person selects indicators. Nothing is applied automatically.
3. **Everything is reviewed by people** before it counts as reviewed. Unreviewed content is shown with a badge, never hidden and never presented as verified.
4. The library plugs in at the **wizard** and the project **Logframe tab**, and also feeds forms, evidence, checklists, dashboards, infographics and report blueprints.
5. Design follows **SOLID**. "100%" is made checkable: every principle gets an architecture test (§4.8), not a claim.

---

## 3. Scope — what "comprehensive" covers

### 3.1 Sectors (one registry, replaces the three lists)
**Humanitarian clusters and areas:** WASH; Health; Nutrition; Food security; Shelter and NFI; CCCM (camp coordination and management); Protection (general); Child protection; GBV; Housing, land and property; Mine action; Education (incl. education in emergencies); Early recovery and livelihoods; Logistics; Emergency telecommunications; Coordination and information management; Multi-purpose cash.

**Development and cross-sector:** Agriculture and livestock; Livelihoods and economic development; Social protection; Governance and civil society; Peacebuilding and social cohesion; Climate, resilience and DRR; Environment and energy; Gender equality; Disability inclusion; Migration, refugees and displacement; Mental health and psychosocial support (MHPSS); Infrastructure; Localisation and capacity strengthening.

**Always-attached packs:** Protection principles and accountability (AAP, PSEA, CHS), MEAL (monitoring, evaluation, accountability, learning), Finance and grants management, Safeguarding.

A project may carry **several sectors** (primary plus others). Existing `Sector`/`SectorKey` values are mapped, not removed (`SECTOR_ALIASES`).

### 3.2 Sources (one registry; every entry records source, edition, licence, retrieval date)
Humanitarian standards: Sphere Handbook (2018, current), Core Humanitarian Standard, CPMS (child protection), INEE minimum standards, LEGS (livestock), MERS and Minimum Economic Recovery Standards, CCCM standards, GBV in Emergencies minimum standards, IASC guidelines, MISP (reproductive health), IMAS (mine action), CaLP cash standards.
Health and nutrition: WHO indicator sets, SMART methods, IPC, DHIS2 HMIS metadata, IYCF operational guidance.
Frameworks and registries: Global cluster indicator registries, OCHA HRP indicator sets, SDG global indicators, UNHCR results framework, UNICEF Core Commitments, WFP corporate results framework, FAO (FIES and others), IFRC indicator guide, IATI, donor standard sets (EU Global Europe results framework, FCDO, and others as the owner names them). Status of each donor set (for example whether a set is still maintained) is checked at ingestion.

Rule: an entry is **our own concise wording with a citation** (source, edition, standard number or code). Long source text is never copied. The licence of each source is checked before anything is bundled (§9 risk R1).

### 3.3 What a sector pack contains (11 parts, each provided by a separate provider, §4.3)
1. Indicator library 2. Logframe skeleton 3. Assessment questions 4. Entry forms and sheet column sets 5. Evidence types 6. Checklist and compliance items 7. Dashboard templates 8. Infographic / Canvas templates 9. Report blueprint and section guidance 10. Risks 11. Glossary and help text

### 3.4 Coverage matrix (the definition of "comprehensive")
For every sector × result level (impact, outcome, output, activity) × indicator kind (count, rate, ratio, index/score, binary, qualitative) × source where one exists, the library records either an entry or a stated reason for none. A coverage test (§4.8) reads the matrix and fails on an unexplained gap.

---

## 4. Architecture and SOLID

### 4.1 Layers (existing rule: domain pure → application ports → infrastructure adapters → web)
```
packages/domain/src/contexts/sector-library/        pure TypeScript, no I/O
  registry/sectors.ts, sources.ts, sector-aliases.ts
  model/ (types only)
  rules/ (validators, evaluators, diff, matching)
  data/<source>/<sector>.ts                          content as typed const arrays
packages/application/src/ports/sector-library.ts     narrow interfaces
packages/application/src/use-cases/sector-library/   one handler per file
packages/infrastructure/src/sector-library/          adapters (built-in data, organisation DB, export/import)
apps/api/src/routes/sector-library.ts                thin routes
apps/web/src/features/sector-library/                domain, ports, adapters, presentation, composition.ts
```

### 4.2 Core model (domain, `model/`)
- `LibrarySource { id, name, publisher, edition, licence, url, retrievedOn }`
- `LibraryIndicator { id (stable), code, sectorIds[], sourceRef { sourceId, standardRef, page? }, name, definition, numerator?, denominator?, kind, unit, direction, aggregation, frequency, disaggregations[], referenceStandard?, meansOfVerification[], dataSources[], level, roles[], tags[], review, version, deprecatedBy? }`
- `ReferenceStandard { comparator: GTE | LTE | BETWEEN | EQ, value | range, unit, appliesTo, sourceRef, note }`
- `ReviewState { status: UNREVIEWED | IN_REVIEW | REVIEWED | DEPRECATED, reviewer?, reviewedOn?, note? }`
- `LibraryPack { sectorId, parts: Record<PackPartKey, PackPart> }`
- `Adoption { libraryId, libraryVersion, adoptedOn, localChanges[] }` (stored on the project's indicator, §5)

`kind` is a discriminated union (`COUNT | RATE | RATIO | INDEX | BINARY | QUALITATIVE`). Each kind has its own rules (a rate is never summed or shown as "% of target"; a binary has no aggregate; an index declares its scale).

### 4.3 SOLID mapping

| Principle | How it is applied | Where enforced |
|---|---|---|
| **S** Single responsibility | One reason to change per file: `validate-entry`, `reference-verdict`, `match-for-sector`, `diff-versions`, `to-indicator-draft`, `coverage-matrix`, `review-state` each live in their own module (≤300 lines, ≤1 class) | architecture test (existing size/class limits extended to the new paths) |
| **O** Open/closed | Adding a sector, source, indicator kind or pack part is **a row in a registry or a new provider file**, never an edit to a switch. `SECTOR_REGISTRY`, `SOURCE_REGISTRY`, `INDICATOR_KIND_RULES`, `PACK_PART_PROVIDERS` are exhaustive tables checked with `assertExhaustive` | test fails on any `if/switch` on a sector id or source id outside the registries (grep-pinned, as for setup areas) |
| **L** Liskov | Every `PackPartProvider` and every `IndicatorKindRule` honours one contract and can replace another: same inputs, same result shape, no provider throws for "unsupported sector" (it returns an empty part with a reason). A shared contract test runs every provider (like `assignment-source-contract.mjs`) | contract test over all registered providers and kind rules |
| **I** Interface segregation | Small ports: `ILibraryReader` (browse/search), `ILibraryAdopter` (apply to a project), `IOrganisationLibraryWriter` (org additions and overrides), `ILibraryUpdateChecker` (compare adopted version), `ILibraryReviewStore` (review state), `ILibraryExporter` (review sheets). A screen or handler depends on only the ones it uses (picker needs reader + adopter; Settings needs the writer) | architecture test: no consumer imports a port it does not call |
| **D** Dependency inversion | Domain defines rules; application handlers depend on ports; adapters implement them (built-in data adapter, organisation DB adapter, composite). Web depends on `ports/` and is wired only in `composition.ts` | existing `architecture-boundaries.test.mjs` extended: domain imports nothing outside itself, application imports no infrastructure, web `presentation` imports no adapters |

**Composite content source:** `CompositeLibrarySource` implements `ILibraryReader` over `[BuiltInSource, OrganisationSource]` — callers cannot tell them apart (Liskov), and a new source (for example an external registry) is one more adapter (Open/closed).

### 4.4 Plug-in points (all consume the library through ports; none re-implement a rule)

| Surface | Behaviour | Existing code it reuses |
|---|---|---|
| Wizard · Start step | Sector chooser becomes **multi-select** (primary + others). Shows what each sector offers (counts). No auto-fill | existing `startSuggestions` (offers, never fills) |
| Wizard · Results slide | **"Choose from the library"** panel: sector tabs → standard/theme groups → indicators; search; filters (source, level, kind, review status); "select recommended" (marked ones only); duplicates across sectors merged; selected items enter the draft as proposals with `source: LIBRARY` | `RESULT_OPERATIONS`, accept/reject model, `ApplySetupProposalHandler`, `proposeCodes` |
| Wizard · other slides | Assessment questions appear on the Start/Context slides as answers; entry forms (draft), evidence types and compliance items are **offered** on their slides | `SETUP_SLIDES`, `extras` answers, `CreateFormFromIndicatorHandler` |
| Project Logframe tab | **"Add from library"** drawer (same picker component), "library" badge on adopted indicators, **"update available"** marker, bulk add under the right output | existing create-indicator handlers |
| Indicator editor / Entry Sheet / Enter data | Reference standard shown beside the target; **"Meets standard"** tag (separate from the target stoplight); chart reference line | `entryStoplight`, `indicatorValueProblem`, chart role `reference` |
| Dashboards / Canvas | Sector dashboard and canvas templates use **role keys carried by library indicators** (`roles[]`) so `suggestRoleMapping` maps with certainty instead of word matching | `suggestRoleMapping`, `BUILT_IN_CANVAS_TEMPLATES`, `DashboardTemplate` |
| Forms and offline | Forms generated from adopted indicators; offline pack carries the form, not the library | `formFromIndicator`, offline pack v2 |
| Reports | Sector report blueprint and section guidance; reference standards available to the writer only as record chunks, never as findings | `report-type-blueprints.ts`, `RecordChunkBuilder` |
| Checklist / compliance | Protection and CHS statements, sector evidence needs | `ChecklistReconciler`, attestations |
| Settings → Sector library | Organisation adds entries, hides entries, overrides wording and reference standards; sees review status and updates | `SetupDefaultPack` pattern |

### 4.5 Honesty rules (carried from the product)
- **A standard is a reference, not a target.** The user confirms it as a target; until then it is shown as "Sphere minimum: 15 l/p/d", never judged as the target.
- **A rate or ratio is never summed or read as "% of target"**; a reference verdict applies to the recorded value only.
- **A missing value is never 0**; "not applicable" and "not measured" stay distinct.
- **A library entry the user changed is theirs** (`localChanges`); updating never overwrites it.
- **Suggestions carry the reason** (sector, standard, source); nothing is applied until accepted.
- **Unreviewed content is labelled** and its source is shown. Verified content is never described as more than the source says.
- **Library content never reaches a report writer as a finding.** A standard may appear in a report only as a cited reference in the sector's section guidance.

### 4.6 Adoption: one writer
Choosing an entry produces an **indicator draft** through `toIndicatorDraft` (pure) and is saved by the **existing** indicator handlers (wizard: `ApplySetupProposalHandler` indicator applier; Logframe tab: `CreateIndicatorHandler`). No new writer. The adopted indicator is a **snapshot** (definition copied) plus `libraryId`, `libraryVersion`, `referenceStandardJson`. Later versions are compared by `diffVersions`; the person sees a plain list of what changed and applies it field by field or keeps theirs.

### 4.7 Review workflow (owner decision 3)
- Every entry starts `UNREVIEWED`. A reviewer sheet round trip: `ILibraryExporter` writes a CSV/XLSX per sector (id, wording, reference standard, source ref, status, reviewer note); import reads decisions back; any bad row blocks the whole import and is named (existing import rule).
- Status lives in the data files (`review` field) and is changed only by the import handler, audited.
- UI shows a badge; a filter "reviewed only" is available; a project may require reviewed-only content (organisation setting, default off).
- A dashboard in Settings shows review progress per sector and source.

### 4.8 Tests that make SOLID checkable
1. **Registry exhaustiveness**: every sector has a pack with all 11 parts or a stated reason; every source is cited by at least one entry or marked reserved.
2. **Entry validation** over all data files: required fields, unit, direction, kind-specific rules, valid reference standard, unique stable ids, no duplicate codes in a sector.
3. **Coverage matrix** test (§3.4).
4. **Provider and kind-rule contract tests** (Liskov).
5. **Architecture tests**: size/class limits on new paths; domain imports only itself; application imports no infrastructure; web presentation imports no adapters; no branching on a sector or source id outside registries; no consumer imports an unused port.
6. **Round-trip tests**: review export → import; adoption → diff → update.
7. **Honesty tests**: rate never summed, standard never judged as target, missing is never 0, local change survives an update.
8. **Copy lint** on every user-visible label (existing `findRawTokens`).
9. **Content spot-check test** for the figures verified in `sphere.md` (the three confirmed ones; the rest join as they are verified).

---

## 5. Data and schema (additive; audit existing columns in 46.0 before adding)

| Item | Detail |
|---|---|
| `Indicator.libraryId`, `libraryVersion`, `referenceStandardJson` | nullable; written by the indicator repository (`?? null` where clearable; pinned by a persistence test) |
| `Project` sectors | audit whether a multi-sector field exists; add `sectorsJson` (list of sector ids, primary first) only if missing; keep `Project.sector` as primary |
| `OrganisationLibraryEntry` | tenant table, RLS forced: added entries, hidden flags, overrides (entry id, patch JSON, updatedBy) |
| `LibraryReviewDecision` (optional) | only if review status must persist outside the data files (decide in 46.7) |
| Setup draft `extras` | records the sectors chosen and the library items accepted, so Launch re-applies from the stored draft |
| `/ready` | require the new `Indicator` columns |
| Organisation export | include `OrganisationLibraryEntry`; no secrets in it |

Deploy order (as always): fresh backup → migration (additive, before code) → re-run `rls.sql` per table and check `rowsecurity` for new tables → `deploy-fast.sh SCOPE=both`.

---

## 6. Content programme (the bulk of the work)

### 6.1 Authoring pipeline
1. **Source register**: fill `SOURCE_REGISTRY` (edition, licence, retrieval date).
2. **Extraction worksheet per source and sector**: indicator, definition, unit, direction, reference standard, standard number. Done by hand or with a model-assisted draft, **always marked UNREVIEWED**; a model draft is never trusted without a person's check against the source.
3. **Normalise**: map to the common model; assign stable ids; set `roles[]` so dashboard and canvas templates can bind.
4. **Review**: reviewer sheets round trip (§4.7); the status changes only by import.
5. **Freeze**: a content version (`libraryVersion`, hash) is published; adopted indicators remember it.

### 6.2 Content volume targets (planning, not promises)
Per sector: about 40–150 indicators across levels, 10–30 assessment questions, 3–10 forms, 5–20 evidence types, 5–15 checklist items, 2–4 dashboard and 2–3 canvas templates, a blueprint and 5–10 risks. Quality gates (coverage and review) matter more than the count.

### 6.3 Order of content
1. Sphere 2018 sectors (WASH, Nutrition, Food security, Shelter, Health) from `sphere.md`, **after its ◐ figures are checked**
2. Protection and accountability (CHS, Protection Principles), child protection, GBV
3. Education, livelihoods, agriculture, early recovery, CCCM, HLP, mine action, MHPSS
4. Governance, peacebuilding, climate and DRR, environment and energy, social protection, gender, disability, migration, localisation
5. Donor and registry sets (SDG, cluster registries, UNHCR, WFP, UNICEF, EU and others)

---

## 7. Phases

| Phase | Deliverable | Tests / acceptance | Deploy |
|---|---|---|---|
| **46.0 Foundations** | Audit of existing indicator columns, `Project.sector(s)`, `SectorTemplatePack` use. `sector-library` domain context: model, registries (sectors with aliases, sources), kind rules, validators, `toIndicatorDraft`, `referenceVerdict`, `diffVersions`. Architecture tests added. No content yet beyond a 10-entry fixture | validation, contract and architecture tests green | none |
| **46.1 Content format and first content** | Typed data files; reviewer export/import; `sphere-2018` WASH pack (reference standards confirmed in `sphere.md` ✔ items only until the rest are verified) | coverage test reports the matrix; round trip passes | none |
| **46.2 Schema and ports** | Migration (indicator library fields, org entries, sectors), repositories, ports (`ILibraryReader`, `ILibraryAdopter`, …), built-in and organisation adapters, composite source, handlers (browse, search, adopt, check updates), routes in `RULES` | persistence tests on a scratch Postgres; authorization-coverage test; RLS coverage test | migration + api |
| **46.3 Logframe tab** | "Add from library" drawer (picker component shared with the wizard), badges, "update available", diff dialog | picker harness; unit tests for the view rules | web + api |
| **46.4 Wizard** | Multi-sector Start step; Results-slide library panel; assessment questions; draft items from the library; Launch applies through the existing applier; four-language labels (drafts) | `test:pcw` extended; launch journey on a scratch DB | web + api |
| **46.5 Reference standards** | Entry sheet, Enter data, indicator editor and charts show the standard and "Meets standard"; never judged as target | stoplight tests untouched; new verdict table tests | web |
| **46.6 Pack parts** | Providers for forms, evidence types, checklist/compliance, dashboard and canvas templates (role-bound), report blueprints, risks, glossary; wizard and project offers for each | provider contract test; template apply tests; copy lint | web + api |
| **46.7 Governance** | Settings → Sector library (add, hide, override, review progress), reviewed-only option, audit events, update flow, import of reviewer sheets | round-trip and honesty tests | web + api |
| **46.8 Content waves** (parallel from 46.1) | Waves per §6.3, each ending with a review round | coverage matrix with no unexplained gaps for the wave | data only (api + web) |
| **46.9 Verification** | Signed-in browser check of the picker, wizard, Logframe tab, reference tags; reviewer walk-through; documentation (`AGENTS.md` invariants, support article draft, memory bank) | all harnesses green | — |

Content waves in 46.8 can ship independently once 46.2–46.4 are in, because a new sector is a data file plus a registry row (Open/closed).

---

## 8. Risks and open points

| # | Risk / question | Handling |
|---|---|---|
| R1 | **Licence of source material** (Sphere, INEE, CPMS, WHO, donor sets differ) | Check each licence in the source register before bundling; store our own concise wording with a citation; no long copied text; legal read before publishing |
| R2 | **Wrong or outdated figure shipped as a default** | UNREVIEWED badge; reviewer sheet; `libraryVersion`; ✔/◐ figures in `sphere.md` verified first; spot-check test |
| R3 | **Volume and review effort** | Waves; coverage matrix shows what is left; review progress dashboard |
| R4 | **Standards revised** (Sphere 5th edition expected Q4 2028) | Editions are explicit; a new edition is a new source row; `diffVersions` shows the change |
| R5 | **Indicator semantics differ by donor** | Definitions are explicit (numerator/denominator, unit); a user's local change is kept |
| R6 | **Picker overload** (hundreds of indicators) | Grouping by standard and level, search, filters, "recommended" subset, counts |
| R7 | **Three sector vocabularies drift** | One registry with aliases; test fails on a sector id outside it |
| R8 | **Translation** of definitions into fr/es/ar | English first; ids stable; translations are drafts until a native reviewer reads them (as for the wizard) |
| Q1 | Which donor frameworks are in the first release (named by the owner)? | Owner decision before 46.8 wave 5 |
| Q2 | Reviewed-only by default, or show everything with badges? | Plan assumes badges, reviewed-only optional |
| Q3 | Should the older `SectorTemplatePack` entity be migrated into the library or retired? | Decide in 46.0 audit (leaning: migrate its content, then retire) |
| Q4 | Where does a sector's primary pack apply when a project has several sectors (risks, cadence, review mode)? | Primary sector's pack decides project settings; all chosen sectors offer indicators |

---

## 9. What this does not do
- It does not apply any indicator by itself.
- It does not turn a Sphere figure into a target.
- It does not send library content to a report writer as findings.
- It does not claim a standard is met where the indicator's semantics are unconfirmed (`describeSemantics` rule).
- It does not claim "SOLID" by assertion: §4.8 turns each principle into a failing test if broken.
