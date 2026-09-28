# Feature 21: Agent Memory (DonorDesk Version 2.0)

**Version:** 2.0 — this feature is the headline addition of the DonorDesk
Version 2.0 release, built on branch `0009-agent-memory`.
**Status:** Implemented on branch `0009-agent-memory` (not yet merged to
`master` — pending the user's review per the branch's stated purpose). See
[`../imp/Phase21-agent-memory.md`](../imp/Phase21-agent-memory.md) for the
phased implementation plan and its "Deviations from the original plan" note.
**Key files:** `packages/domain/src/contexts/memory/agent-memory.ts`,
`packages/application/src/ports/agent-memory.ts`,
`packages/application/src/use-cases/memory/`,
`packages/infrastructure/src/repositories/agent-memory-repository.ts`,
`packages/infrastructure/src/llm/ai-reporter-draft-generator.ts`
(`agentMemoryBriefFields`), `apps/api/src/routes/agent-memory.ts`,
`apps/api/src/routes/org.ts` (`PUT /v1/organization/agent-memory-settings`),
`apps/web/src/app/(portal)/settings/layout.tsx` (new "AI Writing Style" tab),
`apps/web/src/app/(portal)/settings/ai-style/`.

## 1. Objective

The AI Reporter drafts every section from scratch each time, guided only by
the donor template's own instructions and the fixed editorial rules in
`buildSectionSpecificGuidance`. It has no way to remember that a particular
tenant, or a particular donor, consistently prefers a different tone,
terminology, or structure than the default — a report manager has to make the
same correction every reporting period.

Agent Memory closes that gap for **style and structure only**. It watches
what report managers actually change when they edit an AI-drafted section,
proposes a small number of reusable style statements from repeated patterns,
and — only after a human approves a statement — feeds it into future
generations for that tenant/donor/section type.

It does **not** remember facts, figures, targets, or donor commitments. Those
remain the exclusive responsibility of the deterministic verified-findings
pipeline (Feature 20) and are never learned from prior narrative text.

## 2. Why now

DonorDesk already has the exact signal this feature needs, for free: every
manual edit to an AI-drafted section already creates a `ReportRevision` with
`changeOrigin: "MANUAL_EDIT"`, linked via `parentRevisionId` to the
`GENERATION`/`REWRITE` revision it replaced. This feature reads that existing
revision chain — it does not add a new capture mechanism to the editor.

## 3. User story

> As a report manager, when I correct the same kind of thing in AI-drafted
> reports for this donor — say, trimming the executive summary to be more
> terse, or always using "beneficiaries reached" instead of "people
> impacted" — I want DonorDesk to notice the pattern, ask me once whether to
> apply it going forward, and then stop making that mistake in future drafts
> for that donor.

## 4. Lifecycle

```text
Tenant turns on "AI Writing Style" in Settings (self-service, off by default)
        │
        ▼
Reviewer edits an AI-drafted section
        │
        ▼
   MANUAL_EDIT revision created (existing behaviour, unchanged)
        │
        ▼ (background, feature-flagged: AGENT_MEMORY_ENABLED)
   Diff between the AI-drafted and edited text is read
        │
        ▼
   Any hunk containing a number, date, currency, percentage, or indicator
   code is discarded — style-only patterns remain
        │
        ▼
   PROPOSED AgentMemory statement created (or an existing one's
   occurrence count is bumped, if the same pattern recurs)
        │
        ▼
   Report manager reviews the proposal, sees the exact before/after excerpt
   that produced it, and Approves or Rejects
        │
        ▼ (Approve)
   ACTIVE — included in sectionGuidance for future matching sections
        │
        ▼ (report manager, any time)
   DEACTIVATED — excluded again, fully reversible, history retained
```

## 5. Scope of what can be learned

| Category | Example statement | Learned from |
|---|---|---|
| TONE | "Prefer passive voice in the executive summary" | Consistent voice change across edits |
| STRUCTURE | "Keep the indicator highlights table to 4 rows, not 6" | Consistent table-size trimming |
| TERMINOLOGY | "Use 'beneficiaries reached' instead of 'people impacted'" | Consistent phrase substitution |
| FORMATTING | "Avoid bullet lists in the challenges section" | Consistent list-to-prose conversion |
| LENGTH | "Trim the activities section to ~150 words" | Consistent length reduction |

Explicitly out of scope, by design and by three independent enforcement
layers (extraction-time filtering, entity-level validation, and human
approval — see the implementation plan §7): any number, date, currency
value, percentage, or indicator code. A statement that would encode a fact
cannot be proposed, cannot be constructed, and cannot be approved.

## 5a. Settings and setup (tenant experience)

A new **"AI Writing Style"** tab in Settings (`/settings/ai-style`, visible
only to users with the `reporting.manage-agent-memory` capability, and only
once DonorDesk's platform-wide rollout flag is on) is the tenant's entire
interface to this feature. It is designed so a report manager can understand
and use it in under a minute, with no documentation required:

1. **One toggle, one sentence.** "Learn from my team's edits" — on/off,
   self-service, no SuperAdmin ticket required. Off by default for every
   tenant. When off, the rest of the page is replaced by the same one-line
   explanation — nothing else to configure.
2. **Suggestions waiting for you.** Each pending suggestion is shown as the
   real before/after excerpt that produced it ("AI wrote: '...people
   impacted...' → Your team edits it to: '...beneficiaries reached...'"),
   how many times the pattern recurred, and an "Applies to" choice (all
   reports / this donor / this section type) made at the moment of approval
   — not a separate scope-management screen to learn upfront. A "Why was
   this suggested?" link expands the full history of edits behind the
   suggestion, linked back to the actual report/section, for a reviewer who
   wants to verify before approving.
3. **Active style preferences.** Everything currently applied, in plain
   language, each with **Pause** (reversible, stops applying it without
   losing the history) and **Remove**.
4. **A collapsible "How does this work?" explainer**, closed by default,
   ending with an explicit reassurance: *"DonorDesk never learns numbers,
   dates, or facts this way — only writing style and wording."* This answers
   the first question a donor-compliance-conscious admin will have, right on
   the page, rather than requiring a support conversation.
5. **A badge on the Settings tab itself** ("AI Writing Style • 3") when
   suggestions are waiting, so report managers notice new proposals during
   their normal workflow instead of having to remember to check.

Nothing on this page can change what a report *claims* — only Approve,
Reject, Pause, and the on/off toggle exist as actions, and none of them touch
`ReportRevision`, `ReportClaim`, or any verified-findings data.

## 6. Scope hierarchy

A memory statement applies at one of four scopes, matched broadest-to-narrowest
at generation time:

1. **SECTION_TYPE** — applies to this exact section title/type for the
   tenant, regardless of donor.
2. **DONOR / TEMPLATE** — applies whenever generating for this donor
   template.
3. **ORGANIZATION** — applies tenant-wide, to every report.

At most a handful of active statements are surfaced per generated section
(capped, broadest-match-first), keeping the effect legible and bounded — the
same discipline `buildSectionSpecificGuidance` already applies to its own
built-in rules.

## 7. Multitenancy

Every `AgentMemory` row carries `tenantId`, is RLS-forced like every other
DonorDesk aggregate, and is additionally filtered by `tenantId` in the
repository layer (defense in depth). There is no cross-tenant memory sharing,
aggregation, or pattern-mining anywhere in this feature — one tenant's
learned style is invisible to every other tenant, with no exception.

The feature is gated at two independent levels: a platform-wide rollout flag
DonorDesk ops controls, and a per-tenant `agentMemoryEnabled` setting each
organization controls for itself from the Settings page (§5a) — both must be
on for anything to be learned or applied. A tenant enabling it has zero
effect on any other tenant, and disabling it (at either level) instantly
reverts generation to today's behaviour with no data loss — paused/removed
preferences and their history remain visible, just inactive.

## 8. Governance and reversibility

Nothing a reviewer edits changes future output automatically. Every proposal
sits in a `PROPOSED` state, visible with its provenance (which edit produced
it, how many times the pattern recurred), until a user holding the
`reporting.manage-agent-memory` capability explicitly approves it. Approval
can be undone at any time via deactivation, and every transition is recorded
as an audit event — the same governance shape DonorDesk already uses for
donor template review (`EXTRACTING → NEEDS_REVIEW → REVIEWED`) and reporting
requirement pack activation.

## 9. Relationship to other features

- **Feature 11 (AI Report Draft Generator):** Agent Memory's only integration
  point is `sectionGuidance`, the existing single source of truth for
  editorial guidance already consumed by both the AI Reporter worker and the
  legacy generator. No new prompt channel is introduced.
- **Feature 13 (Review and Approval Workflow):** the extraction signal is the
  existing manual-edit revision chain; Agent Memory adds no new editor
  behaviour, only a background observer of edits that already happen.
- **Feature 20 (Report Intelligence Engine):** the deterministic
  verified-findings/assertion/gate pipeline is entirely unaffected. Agent
  Memory cannot influence what a section claims, only how it is worded — the
  numeric-grounding boundary that makes Feature 20 trustworthy is the same
  boundary Agent Memory is built not to cross.
- **Feature 05 (Donor Template Manager):** `authorInstructions` and
  `donorInstructions` are the org's *typed-in* guidance; Agent Memory is the
  *learned* counterpart, using the same delivery mechanism but a different,
  reviewer-driven source.

## 10. Non-goals

- No memory of facts, figures, targets, dates, or donor commitments.
- No conversational memory (DonorDesk's AI Reporter has no chat turns to
  remember across).
- No cross-tenant learning or shared pattern library.
- No automatic (unapproved) behaviour change — every statement is opt-in via
  human review, on top of the tenant's own opt-in via the Settings toggle.
- No adoption of a general-purpose memory framework (Mem0, Letta, Cognee,
  Graphiti) as a runtime dependency — see the implementation plan §1 for the
  detailed reasoning against each.
- Prompt/writer-contract optimization against the golden-corpus eval (a DSPy
  based technique) is a related but separate, offline-only, out-of-scope
  idea documented in the implementation plan §9 for future consideration —
  it edits the versioned global writer contract, not tenant-specific memory.

## 11. Open questions for implementation

- Minimum `occurrenceCount` before a PROPOSED statement is surfaced for
  review (avoid proposing from a single one-off edit) — recommend 2.
- Whether `DeterministicMemoryExtractor`'s initial rule set (tense/voice,
  heading style, phrase substitution, length trimming) is sufficient for a
  useful first release, or whether an opt-in LLM-assisted extractor is needed
  from day one — the plan recommends shipping deterministic-only first and
  measuring proposal quality before adding an LLM-assisted path.
