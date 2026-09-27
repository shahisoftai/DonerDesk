# Report Editor v2 — Document-First Workspace — Implementation Plan

> **Status:** APPROVED FOR IMPLEMENTATION (2026-09-26). **P0–P6 code complete (2026-09-27, not deployed; v2 behind `REPORT_EDITOR_V2`). P7 = rollout (flag on → pilot → all) and deletion of the classic workspace after one release.**
> **Decision:** Option C ("document-first editor") from the Report Workspace UX
> audit, chosen over A (declutter in place) and B (step screens).
> **Scope decisions (2026-09-26):**
> - Full-featured **rich-text editing** is IN scope (Phase P2).
> - **Regenerate a single section** is IN scope — confirmed *not implemented*
>   (only `POST /v1/reporting-periods/:id/generate-draft` exists); built in P4 (B7).
> **Visual reference:** clickable mock — https://claude.ai/artifact/RNZwFcQWN9xk3GXJeuE1pN
> (private to the owner; sample data).
> **Replaces:** `/projects/[id]/reports/[periodId]` (current `ReportWorkspace.tsx`,
> 988 lines, ~12 cards, 40+ controls visible at once).

---

## 1. Why this change

### 1.1 Audit findings this plan must close

| # | Finding (current workspace) | Where | Closed in |
|---|---|---|---|
| F1 | Readiness/issues shown **4 ways** (sidebar gauge, Report Check areas, Smart Review, bottom `ReviewAndApproval` pre-approval list) with different vocab and sources | `ReportWorkspace.tsx`, `ReportCheckPanel.tsx`, `SmartReviewPanel.tsx`, `ReviewAndApproval.tsx` | P1 (one `ReportChecks` model) |
| F2 | "Review" and "Report Check" tabs both render Smart Review; Check tab shows **two cards titled "Report Check"** | `ReportWorkspace.tsx:747-789` | P0 (rename) + P1 |
| F3 | Three competing "what next" systems (step guide, "What to do next", readiness rows) | `ReportingStepGuide.tsx`, `ReportWorkspace.tsx:228-257` | P1 (single primary action) |
| F4 | Step guide state is hard-coded (step 1 always done, 2 always next); steps 2-4 link to the same page | `ReportingStepGuide.tsx:26-55` | P0 (honest state) + P1 (removed) |
| F5 | Approval in 3 places; bottom approval card disappears on the Check tab | `ReportWorkspace.tsx:954` | P4 |
| F6 | Five entry points to indicator entry, four to compliance, two to export | header, step guide, next-steps, readiness rows, Flexible inputs | P1 menu + P5 inputs page |
| F7 | Pre-draft inputs (Story 5 textareas, Flexible inputs) crammed in a 260px column and kept after the draft exists; Story needs manual save | `StoryPanel.tsx`, `FlexibleInputsPanel.tsx` | P5 |
| F8 | Broken/misleading links: readiness "Sections" → reports list, "Approval" → self; Smart Review deep-links ignore `sectionId`; "Approve the report" next-step opens the Edit tab | `ReportWorkspace.tsx:255,925-929`, `SmartReviewPanel.tsx:7-22` | P0 |
| F9 | Ops jargon shown to NGO users (`AI_REPORTER_ENABLED`, `INTERNAL_TOKEN`, "api host", raw `FAILED`, 8-char evidence ids, generator model ids) | `ReportWorkspace.tsx:275-296,314-317,826-849` | P0 copy module |
| F10 | Chart panel only appears if section title contains "indicator" | `ReportWorkspace.tsx:806` | P1 (Chart tab on every section) |
| F11 | Section rows cram drag handle, number, title, badge, ↑, ↓, × into 220px; destructive × beside ↓; `window.confirm` for delete | `ReportWorkspace.tsx:624-718` | P1 (Reorder mode) + P6 (undo) |
| F12 | **Bug:** progress reads "Generating sections… 3/" (operator precedence always yields `""`) | `ReportWorkspace.tsx:568` | P0 |
| F13 | Editing happens in a detached plain-textarea card showing raw markdown (`**`, `|`); preview is a separate tab — the user never sees the report as the donor will | `SectionEditor.tsx`, `ReportPreviewPanel.tsx` | P1 (document view) + P2 (rich text) |
| F14 | Unsupported statements are listed away from the text they belong to; there's no way to see *where* in the section a flag is | `ReportWorkspace.tsx:824-866` | P3 (inline highlights) |
| F15 | Donor-template (docxtpl) exports receive raw section markdown, so formatting renders as literal `**bold**` / pipe tables in the donor's own template | `exports/builder.ts:276-278`, `workers/app/donor_template/renderer.py` | P2 (B8) |
| F16 | No way to redo one weak section — the only option is regenerating the whole draft (new version, all edits lost from the working draft) | `reporting.ts` routes | P4 (B7) |

### 1.2 Design principles (apply to every PR in this phase)

1. **The document is the workspace.** What the user reads is what the donor gets.
   No separate "Preview" mode; editing is WYSIWYG, never raw markdown.
2. **One next step.** Exactly one primary button, whose label follows the workflow.
   Everything else is secondary (inspector, outline, "⋯" menu).
3. **Context, not dashboards.** The right panel shows only the *selected section*,
   except when the user opens Report checks.
4. **Problems live where they are.** A flagged statement is highlighted in the
   text; clicking it opens the decision.
5. **Plain language only.** No enum values, env var names, ids or model names in
   end-user copy. All reporting copy comes from one module (`lib/reporting-copy.ts`).
6. **Nothing is lost.** Autosave everywhere, undo instead of confirm dialogs for
   reversible actions, versions/revisions kept on every regenerate.
7. **Reuse before rebuild.** Server logic (assurance, gates, smart review,
   approval, exports) is untouched except for the additive changes in §5.
8. **Markdown stays the storage format.** The AI writer, verifier offsets,
   grounding and exports all work on markdown; the rich-text editor is a view over
   it, restricted to what exports can render.

---

## 2. UX ideas beyond the approved mock

Tagged **[Core]** (in scope) or **[Later]** (backlog, §10).

### Writing & reading
- **U1 Click-to-edit sections [Core].** A section renders as formatted prose;
  clicking into it (or Enter on the heading) makes that section editable *in
  place*, same typography — no layout jump. Escape / click-away returns to read
  view. Autosave status lives in the top bar ("Saving…", "All changes saved").
- **U2 Evidence peek [Core].** Hover/focus a checked statement → popover with the
  evidence file name, the matched excerpt and "Open evidence". View menu toggle
  "Show evidence marks" underlines every verified statement (off by default).
- **U3 Section length hint [Later].** "320 words" in the section toolbar, with the
  donor limit when a requirement pack defines one.
- **U4 Find in report [Core, free].** Continuous document → browser Ctrl/Cmd+F
  works across the whole report (static render keeps text in the DOM).

### Rich-text editing (full-featured) — see §4.5
- **U23 Formatting [Core].** Bold, italic, headings (H3/H4 inside a section),
  bullet and numbered lists (nested, indent/outdent with Tab), block quotes,
  links (Cmd/Ctrl+K), inline code; clear formatting.
- **U24 Tables [Core].** Insert table, add/remove rows and columns, header row,
  Tab to move between cells. AI/verified tables stay editable as text but show a
  "Built from verified data" lock icon; editing numbers there marks the section for
  re-check.
- **U25 Toolbars [Core].** Selection **bubble menu** (B, I, link, H, list, "Ask AI…")
  plus a compact fixed toolbar in the section toolbar while editing; markdown input
  rules (typing `- `, `1. `, `## `, `**x**` converts live).
- **U26 Paste cleanup [Core].** Paste from Word/Google Docs keeps only supported
  structure (headings, lists, tables, bold/italic, links); strips fonts, colours,
  images and HTML.
- **U27 Undo/redo [Core].** Per-section history (Cmd/Ctrl+Z / Shift+Z) inside the
  editor; section-level undo after AI actions via revision restore.
- **U28 Ask AI on a selection [Core].** Rewrite / Shorten / Make donor-friendly /
  Expand the *selected text only*, shown as a suggestion (accept / discard), never
  applied silently; reuses the rewrite pipeline with a `selection` range.
- **U29 Word count [Core].** Live count in the section toolbar while editing.
- **U30 Footnotes, comment-on-selection, track changes [Later].**

### Fixing problems
- **U5 Issue navigator [Core].** Top bar: "‹ 2 of 5 issues ›" — steps through
  flagged statements and blocked sections in document order. Keyboard `n` / `N`.
- **U6 One-click correction from evidence [Core].** For number mismatches where
  the evidence holds a single matching value, offer "Use 11,860 from evidence";
  applies the replacement in the editor, saves, and re-verifies the section.
- **U7 Plain resolution verbs [Core].** "Use evidence value" (correction),
  "Keep with a note" (`ACCEPTED_WITH_LIMITATION`), "Leave out" (`EXCLUDED`) — each
  undoable for 10s via toast; resolved items keep an "Undo" link.
- **U8 Approve & next [Core].** After approving a section, focus jumps to the next
  unapproved section. Plus "Approve all clean sections (4)" in the outline header.

### Generation
- **U9 Launch card when there is no draft [Core].** Document area shows inputs
  summary — indicators *x of y verified*, story *x of 5 answered*, evidence *n files*
  — with gaps called out and one **Generate report** button.
- **U10 Live fill [Core].** During generation, sections appear as skeletons and fill
  in as they finish; completed sections are readable/editable immediately.
  Progress and "Stop" sit in the top bar.
- **U11 Regenerate this section [Core] (B7).** Section toolbar → "Regenerate" opens
  a small popover: optional instruction ("Focus more on the flood response",
  max 500 chars) + **Regenerate**. The current text stays visible with a
  "Regenerating…" overlay; the new text replaces it when ready, and the previous
  text is kept as a revision ("Restore previous version" in the toast for 30s and
  in the section's history). Also used by the fallback notice ("Try AI again").
- **U31 Summary freshness [Core].** After regenerating or heavily editing a
  non-summary section, synthesis sections (executive summary, conclusion) show
  "May be out of date · Regenerate summary".
- **U12 Regenerate draft safety [Core].** "Regenerate whole draft" (menu) confirms:
  "Creates version 4. Your current version and its edits stay in Version history."
- **U13 Inputs changed banner [Core].** If indicator values or period evidence
  changed after the draft was generated: "2 indicator values changed since this
  draft · Re-check affected sections" (reassess, does not rewrite text).

### Review & sign-off
- **U14 Reviewer view [Core].** Users who can approve but not edit — or anyone once
  the draft is `UNDER_REVIEW` — get the document read-only with **Request changes**
  (existing `POST /v1/report-drafts/:id/reject`, comment required) and
  **Approve report** as the primary action.
- **U15 Comments count in checks [Core].** Unresolved section comments appear as a
  non-blocking check item and a count badge on the outline row.
- **U16 Export from the primary action [Core].** After approval the primary button
  becomes **Export report** → existing `ExportWizard` in a dialog.
- **U17 Version compare [Later].** Diff between two versions; restore one section.

### Navigation, access & learnability
- **U18 Deep links [Core].** `?section=<id>&panel=statements|sources|chart|comments|checks&claim=<id>`.
  Smart Review, checklist, notifications and emails link straight to the spot.
- **U19 Keyboard shortcuts [Core].** `j`/`k` sections, `n`/`N` issues, `e` edit,
  `a` approve, `?` shortcut sheet — disabled while typing.
- **U20 First-run tour [Later].** Three dismissible coach marks.
- **U21 Responsive [Core].** ≥1280px three columns; 1024–1279px inspector becomes a
  slide-over; <1024px outline becomes a dropdown, inspector a bottom sheet. Mobile
  targets reading, resolving and approving; the rich-text toolbar collapses to the
  bubble menu.
- **U22 Dark mode [Core].** Every new surface ships light and dark tokens.

---

## 3. Target experience

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ← │ Project · Period Jul–Sep 2026      [Draft] v3 · All changes saved             │
│   │ Quarterly progress report          ( ◔ 72% ready · 3 to do ) ‹ 1/3 › [⋯] [Primary]│
├───────────────┬───────────────────────────────────────────┬──────────────────────┤
│ OUTLINE  2/7 ✓│  ┌──────────── document (720px) ─────────┐│ Section 1            │
│ 1 Exec sum  ①│  │ [Needs a decision] B I H • 1. ⊞ 🔗 ✦ ↻ ││ Executive summary    │
│ 2 Context   ✓│  │ 1. Executive summary                   ││ Statements·1 Sources │
│ 3 Indicators ○│  │ …restored access, ▒reaching 12,400▒…  ││ Chart  Comments·1    │
│ …             │  │ 2. Project context …                   ││ ┌──────────────────┐ │
│ + Add  Reorder│  │ 3. Progress … [Figure 1]               ││ │Number doesn't …  │ │
│ ─────────────│  │                                        ││ │[Use 11,860] Keep │ │
│ Report inputs │  └────────────────────────────────────────┘│ └──────────────────┘ │
└───────────────┴───────────────────────────────────────────┴──────────────────────┘
   ✦ = Ask AI on selection   ↻ = Regenerate this section
```

### 3.1 Primary action state machine

Pure function `nextPrimaryAction(model)`; first match wins:

| Condition | Label | Action |
|---|---|---|
| generating | *(hidden; top bar shows progress + Stop)* | — |
| no draft, can generate | **Generate report** | `generateDraftAction` |
| no draft, cannot generate | *(none; launch card explains who can)* | — |
| DRAFT, open material flags > 0 | **Review n flagged statements** | jump to first flag |
| DRAFT, unapproved sections > 0 | **Approve n remaining sections** | jump to first unapproved clean section |
| DRAFT, blocking checks > 0 | **Finish n remaining checks** | open Checks panel |
| DRAFT, all clear, can edit | **Submit for review** | `submitReportForReviewAction` |
| UNDER_REVIEW, can approve | **Approve report** (secondary: Request changes) | confirm → `approveReportAction` |
| UNDER_REVIEW, cannot approve | "Waiting for review" (disabled) | — |
| APPROVED, can export | **Export report** | `ExportWizard` dialog |

Warnings never block; blocking items mirror the server gates in
`approve-report-section.ts` / `approve-report.ts`. The server remains authoritative.

### 3.2 "⋯" menu

Regenerate whole draft (U12) · Edit data & story (→ P5) · Scan for missing items
(`detectMissingAction`) · Version history (drawer) · Export center · Keyboard
shortcuts. Items hidden when the capability is absent.

---

## 4. Frontend architecture

Follows `frontend-imp-plan.md`: pure `application/`, thin `presentation/`, server
actions in `lib/actions`, Zod schemas in `lib/server/schemas.ts`.

### 4.1 Feature folder `apps/web/src/features/report-editor/`

```
report-editor/
  application/                     # pure TS, unit-tested, no React
    editor-model.ts                # buildEditorModel(props) -> EditorModel
    report-checks.ts               # merges readiness + smart review + preapproval + checklist + comments
    primary-action.ts              # §3.1 state machine
    claim-anchors.ts               # claim -> text range (offsets, search fallback, stale detection)
    issue-order.ts                 # navigator order
    url-state.ts                   # ?section&panel&claim
    shortcuts.ts                   # key map + typing guard
    markdown-schema.ts             # the supported markdown subset (shared with export parser tests)
  presentation/
    ReportEditor.tsx               # shell (replaces ReportWorkspace)
    top-bar/{EditorTopBar,ReadinessButton,IssueNavigator,PrimaryActionButton,MoreActionsMenu,GenerationProgress}.tsx
    outline/{OutlineNav,ReorderMode,ReportInputsCard}.tsx
    document/{DocumentCanvas,DocumentSection,SectionToolbar,StaticSectionView,EvidencePeek,FallbackNotice,GenerateLaunchCard,InputsChangedBanner,RegeneratePopover}.tsx
    rich-text/                     # §4.5 — lazy-loaded chunk
      RichSectionEditor.tsx        # TipTap instance bound to one section, autosave
      extensions/{claimHighlights,lockedTable,pasteCleanup,aiSuggestion}.ts
      {BubbleMenu,FormattingToolbar,TableMenu,LinkDialog,AskAiMenu}.tsx
    inspector/{Inspector,StatementsTab,SourcesTab,ChartTab,CommentsTab,ChecksPanel}.tsx
    dialogs/{ExportDialog,VersionsDrawer,RegenerateDraftConfirm,RequestChangesDialog,ShortcutSheet}.tsx
    feedback/ToastProvider.tsx
```

**Moved / shared:** `splitBlocks` + `PreviewTable` + `SectionArtifacts` →
`features/reporting/presentation/document-blocks.tsx`; `ReportPreviewPanel`
removed in P7. Copy lives in `apps/web/src/lib/reporting-copy.ts` (P0).

**Reused unchanged:** `autosave-reducer.ts` (drives rich-text saves too),
`ReportChartPanel`, `CommentsThread`, `ExportWizard`, `DraftVersionsPanel`,
server actions in `lib/actions/reporting.ts`.

### 4.2 Single view model

`page.tsx` keeps its parallel server fetches, adds `smart-review` server-side, and
passes raw data to `ReportEditor`. `buildEditorModel()` derives everything once:

```ts
type EditorModel = {
  phase: "EMPTY" | "GENERATING" | "DRAFT" | "UNDER_REVIEW" | "APPROVED";
  mode: "author" | "reviewer" | "readonly";
  sections: SectionVM[];   // status, openFlags, canApprove, approveBlockedReason, regenerating, summaryStale
  checks: ReportCheck[];   // severity BLOCKING | WARNING | INFO; target {sectionId?, claimId?, href?}
  readiness: { percent: number; todo: number }; // percent = server readiness.overall
  issues: IssueRef[];
  primary: PrimaryAction;
};
```

### 4.3 Inline claim anchoring (`claim-anchors.ts`)

Claims are anchored on the **markdown string** (the verifier's coordinate space),
then mapped to editor positions (§4.5):

1. Use `charStart`/`charEnd` when present **and** the slice equals
   (whitespace-normalised) `claim.text`.
2. Else exact, then case/whitespace-insensitive search; first unused match.
3. Else **unanchored**: shown only in the Statements tab — "This wording has
   changed since it was checked · Re-check section".
4. Only `MATERIAL` + `FAILED` + unresolved claims get the amber highlight.
   `ACCEPTED_WITH_LIMITATION` → dotted underline; `EXCLUDED` → struck through.
5. Anchors never span table cells or block boundaries.

### 4.4 Editing lifecycle

- One section editable at a time; switching flushes the pending autosave
  (`saveNow`). The conflict/recovery UI from `SectionEditor` is preserved inside
  `RichSectionEditor` (recovery copy shown as markdown text).
- Saves go through the existing `updateReportSectionAction` with
  `expectedVersion`; only **user-originated** transactions schedule a save
  (loading/normalising content must never create a revision).
- After a save that changes text overlapping a claim, the toolbar shows
  "Re-check this section" (reassess) — no auto-reassess per keystroke.

### 4.5 Rich-text editor design

**Library:** TipTap v3 (ProseMirror; MIT core + open-source extensions only — no
Pro extensions): StarterKit, Link, Table (+row/cell/header), Placeholder,
CharacterCount, BubbleMenu, and the official markdown extension (fallback:
`prosemirror-markdown` serializer). Loaded with `next/dynamic` so the editor chunk
only downloads when a user starts editing.

**Storage contract — markdown subset (`markdown-schema.ts`):** exactly what
`packages/infrastructure/src/exports/markdown-renderer.ts` renders:
paragraphs, `###`/`####` headings, `-`/`1.` lists (2 nesting levels), `>` quotes,
GFM pipe tables, `**bold**`, `*italic*`, `` `code` ``, `[label](url)`. Nothing else
is producible from the editor (no underline/colour/images/raw HTML). Any feature
added to the editor must first be added to the export renderer (and donor-template
path, B8) — guarded by a shared test.

**Rendering modes:**
- *Static view* (default, all sections): `react-markdown` + `remark-gfm` (already
  dependencies), **no** `rehype-raw`, with a rehype plugin that wraps anchored
  claim ranges in `<button>` highlights. Cheap, and keeps the whole report in the
  DOM for Find and screen readers.
- *Edit view* (one section): TipTap mounted on click with the same CSS
  (`.report-prose` shared class) so nothing shifts.
- Claim highlights in edit view are ProseMirror **decorations** (plugin
  `claimHighlights`) mapped from markdown offsets via a position map built while
  parsing; decorations follow edits and disappear when their text is changed.

**Round-trip safety:**
- Normalise once per section (`serialize(parse(md))`) and compare with the stored
  content; if they differ only in whitespace/escaping, do **not** save.
- Golden round-trip test over the reporting eval corpus and 20 recorded
  production sections: parse → serialize must be semantically identical
  (normalised) — CI gate.
- Server-side `normalizeSectionMarkdown()` (pure, `packages/domain`) on
  `PUT /v1/report-sections/:id`: strip raw HTML, collapse unsupported syntax to
  text, enforce max length. Keeps the stored format trustworthy regardless of
  client (B9).

**Ask AI on selection (U28):** sends `{ mode, audience, selection: { from, to } }`
(markdown offsets) to the rewrite endpoint (B10); response shown as an inline
suggestion (strike + insert) with Accept / Discard; accept commits via the normal
save path with `changeOrigin: "AI_REWRITE"` so the revision history records it.

**Locked verified tables (U24):** tables that match a `TABLE` artifact render with
a lock badge; edits are allowed but any change to numeric cells adds a
"Re-check this section" prompt and a WARNING check until reassessed.

**Accessibility:** toolbar is a `role="toolbar"` with roving tabindex, all buttons
labelled with shortcut hints; editor has `aria-label="Edit section: <title>"`;
bubble menu reachable with Alt+F10; table navigation announced.

---

## 5. Backend changes

Additive and backward compatible. Every mutation writes `audit_events`. No schema
migration except where noted.

| # | Change | Files | Notes |
|---|---|---|---|
| B1 | Expose `charStart`, `charEnd`, `materiality`, `verificationReasonCode` on draft claims | `get-report-draft.ts` (claims map), web `ReportClaimSchema` (optional) | Columns exist on `ReportClaim`. If a Prisma `select` changes, update `REQUIRED_PRISMA_FIELDS`. |
| B2 | `evidenceTitle` on claim sources and `sourceReferences` | `get-report-draft.ts` (one batched, tenant-scoped lookup) | Restricted evidence → "Restricted evidence" unless caller may see it. |
| B3 | `suggestedReplacement {from,to,evidenceId}` for numeric mismatches with exactly one matching evidence value | pure helper in domain (`numeric-atom.ts`/`verified-finding.ts`) + `report-assurance-service.ts` | Only when unambiguous; value must come from evidence (grounding rules). |
| B4 | Web actions: `reassessSectionAction` → `POST /v1/report-sections/:id/reassess`; `requestChangesAction` → `POST /v1/report-drafts/:id/reject` | `apps/web/src/lib/actions/reporting.ts` | Routes exist and are audited. |
| B5 | "Correct from evidence" = editor replacement + save + reassess | web only | Conflict → standard recovery UI. |
| B6 | `inputsChangedSince { indicators, evidence, sectionIds }` on `GET …/draft` | `get-report-draft.ts` + pure helper | Read-only counts vs draft `createdAt`. |
| **B7** | **Regenerate a single section** — see §5.1 | new handler + route + web action | Confirmed not implemented. |
| **B8** | **Donor-template export renders markdown**: convert section markdown to docxtpl `RichText`/`Subdoc` (headings, lists, tables, bold/italic, links) instead of passing the raw string | `apps/workers/app/donor_template/renderer.py` (+ markdown→docx helper mirroring `markdown-renderer.ts`), `exports/builder.ts:276-278` | Fixes F15; required before rich text ships. Python tests with the same fixtures as the TS renderer. |
| **B9** | `normalizeSectionMarkdown()` on section update (strip HTML, enforce subset, length cap) | `packages/domain` pure fn, `update-report-section.ts` | Idempotent; unit-tested with the round-trip corpus. |
| **B10** | Rewrite endpoint accepts optional `selection {from,to}` and returns a suggestion without committing when `preview: true` | `rewrite-report-section.ts`, `reporting.ts` route, contracts | Additive; existing whole-section rewrite unchanged. |

### 5.1 B7 — Regenerate a single section (spec)

**Route:** `POST /v1/report-sections/:id/regenerate` — body
`{ instruction?: string (≤500) }` — capability `report.generate` — returns
`202 { sectionId, runId }`.

**Handler:** `RegenerateReportSectionHandler` in
`packages/application/src/use-cases/reporting/regenerate-report-section.ts`.
1. Refactor `GenerateReportDraftHandler`: extract the context assembly
   (period/project/org/template, verified findings, evidence packages, activities,
   indicator updates, reporting profile snapshot, report context, generator
   resolution, entitlement/credit logic) into `ReportGenerationContextBuilder`
   (application service) and `generateOneSection` into
   `SectionGenerationService.generate(...)`. Both handlers use them — **no behaviour
   change** for full drafts (existing tests must pass unchanged).
2. Guards: draft status `DRAFT`, not superseded, no full generation in progress,
   section not already regenerating (409 otherwise). An `APPROVED` section is
   reopened to `DRAFTED` (audited as `report.section.reopened`).
3. Plan section: latest `ReportPlan` for the draft, matched by `templateSectionId`
   then title; a user-added section (no plan entry) gets a synthetic plan section
   from its title with generic guidance.
4. `draftedSections` = every *other* section's current content (so synthesis
   sections summarise the real report). `instruction` is passed as an additive
   optional `userInstruction` on the section brief (TS + Python writer contract
   mirror; prompt text only appended when present — v4 prompts stay byte-stable
   without it).
5. Runs in the background (same timeouts: 90s per LLM call, 200s per section).
   Commits a new revision (`changeOrigin: "REGENERATION"` — new enum value,
   additive), replaces the section's artifacts, re-runs assurance, records the LLM
   run. On fallback/timeout the **previous content is kept** (no deterministic
   overwrite) and the run is marked failed with a plain-language reason.
6. Tracking: a `ReportGenerationRun` with `generationParams.sectionId`; `GET …/draft`
   adds `regeneratingSectionIds: string[]` (runs in progress) so the UI shows the
   overlay and polls.
7. Credits: same metering rules as a full draft (tenant-own provider exempt).
   **Open decision:** charge 1 AI credit per section regenerate, or a fractional
   allowance (e.g. N free section regenerates per draft). Default until decided:
   not metered, rate-limited to 10 per draft per hour.
8. Audit: `report.section.regeneration_requested`, `…regenerated`, `…regeneration_failed`.

**Tests:** handler unit tests (guards, synthetic plan section, keeps content on
fallback, reopen approved), worker contract mirror test for `userInstruction`,
e2e "regenerate section with instruction".

---

## 6. Phases

Estimates in focused engineering days (one developer).

### P0 — Hotfixes & groundwork on the current workspace (1–1.5 d) — **in progress**
- Fix F12 (`ReportWorkspace.tsx:568`).
- Fix F8 links (readiness rows, Smart Review deep links, "Approve the report").
- F2: rename the duplicate card titles (Smart Review = "Things to fix"; tab
  "Review" → "Statements").
- F4: step guide reflects real state (indicators verified, story answered, draft
  exists, draft submitted) instead of hard-coded states.
- F9: `lib/reporting-copy.ts` (fallback reasons, verification results, section and
  draft statuses) replacing `describeFallback()`, generator/model strings and raw
  `FAILED`/`PASSED` output; evidence ids replaced by labels where available.
- ~~Feature flag~~ → moved to the start of P1 (nothing to gate until the v2 shell exists).
- **Exit:** unit tests for copy module + step state; typecheck clean.

**P0 progress (2026-09-26, code complete, not yet deployed):**
- F12 fixed (`ReportWorkspace.tsx` generating counter).
- F8: readiness "Sections" opens the section list, "Approval" opens Report Check;
  "Approve the report" next-step opens Report Check; Smart Review links go to
  `?section=<id>&view=editor` (or `?view=check`), evidence items to
  `/projects/:id/evidence/:evidenceId`. Page reads `?section`/`?view` and the
  workspace follows them on soft navigation.
- F2: Smart Review card retitled "Things to fix"; "Review" tab renamed "Statements".
- F4: `features/reporting/application/reporting-steps.ts` (`computeReportingSteps`,
  `countStoryAnswers`); page fetches the period story server-side; steps 2–4 are
  buttons that reveal the Story panel / draft actions / Report Check; Story save
  updates the guide live.
- F9: `lib/reporting-copy.ts` (fallback reasons, draft-generated message,
  verification results/reasons/details, evidence labels). Removed
  `describeFallback()` and the "Generator: <model>" suffix; statement sources show
  evidence titles; `ReportReviewPanel` and `SectionEditor` rewrite notice use the
  copy module.
- Tests: `apps/web/tests/unit/reporting-copy.test.mts`, `reporting-steps.test.mts`
  (15 passing). `pnpm typecheck` clean. Pre-existing unrelated failure:
  `upload-queue.test.mts` "add appends unique files" (`action.items is not iterable`).

### P1 — Shell, document (static view), outline, inspector, checks (4–5 d)
- Feature flag `REPORT_EDITOR_V2` (env, default off) + `?editor=v2|classic`
  override, read in `page.tsx`.
- `ReportEditor` shell, top bar, `OutlineNav` + Reorder mode, `DocumentCanvas` with
  static markdown view (react-markdown) and, temporarily, the existing textarea
  editor in place; Inspector Sources / Chart (every section, F10) / Comments;
  `ChecksPanel` from `buildReportChecks()`; URL state (U18).
- Remove step guide, "What to do next", sidebar readiness, checklist card and the
  bottom approval/export row from the v2 path.
- **Exit:** v2 renders any existing draft with editing, charts, comments,
  reorder, add/delete parity; unit tests for model/checks/primary-action/url-state.

**P1 progress (2026-09-27, code complete behind the flag, not yet deployed):**
- Flag: `lib/shared/feature-flags.ts` `isReportEditorV2Enabled(query, env)` —
  `REPORT_EDITOR_V2=1|true` or `?editor=v2`; `?editor=classic` forces classic.
  `page.tsx` renders `ReportEditor` (v2) or the classic `ReportWorkspace`; the v2
  path also fetches smart-review, project and period list server-side for the
  heading ("<project> · <start – end> · due <date>").
- Application (pure, tested — `tests/unit/report-editor-model.test.mts`):
  `features/report-editor/application/{editor-model,report-checks,primary-action,url-state}.ts`.
- Presentation: `ReportEditor` shell; `useDraftGeneration` hook (generate / poll /
  stop / ETA); top bar (`EditorTopBar`, `ReadinessButton`, `MoreActionsMenu`);
  `OutlineNav` (status markers, Reorder mode with ↑↓×, add section);
  `DocumentSection` + `StaticSectionView` (react-markdown + GFM, no raw HTML,
  artifacts, `ChartFigure`), in-place `SectionEditor` for editing (rich text is P2);
  `GenerateLaunchCard`; `Inspector` with Statements / Sources / Chart / Comments
  and `ChecksPanel`; Version history and "Data & story" (Story + Flexible inputs)
  in drawers until P5; confirm dialogs for delete / regenerate / approve report.
- Selection lives in the URL via `history.replaceState` (no server re-render);
  deep links `?section=&panel=&claim=` select, open the tab, focus the statement
  and scroll on first load. Approve section moves to the next unapproved section.
- Shared: `features/reporting/presentation/document-blocks.tsx` (moved from
  `ReportPreviewPanel`); `ChartFigure.tsx` (read-only chart).
- Fixed along the way: `ReportChartPanel` never initialised ECharts when a
  section had no chart yet ("Add chart" drew nothing until reload) and leaked a
  resize listener.
- Verified: typecheck, `next build`, unit tests (the only failure is the
  pre-existing `upload-queue` test), and a Playwright visual pass of draft,
  checks, menu, deep link, empty, under-review, writing and 390px mobile states
  against a temporary fixture route (removed). **Not yet exercised against a live
  API** (the local DB credentials were rejected), so the first real run should be
  with `?editor=v2` on production before flipping `REPORT_EDITOR_V2`.
- Deferred to later phases as planned: autosave status in the top bar and
  inline claim highlights (P2/P3), drag-to-reorder (arrows only for now),
  responsive slide-over inspector (P6; below `xl` the inspector stacks under the
  document and the outline becomes a section dropdown).

### P2 — Rich-text editor (5–7 d)
- B8 (donor-template markdown rendering) and B9 (server normalisation) **first**.
- `RichSectionEditor` (TipTap, lazy chunk), formatting + tables + links (U23–U24),
  bubble menu + toolbar + input rules (U25), paste cleanup (U26), undo/redo (U27),
  word count (U29); autosave via `autosave-reducer`; conflict recovery.
- Round-trip golden test (CI gate), export parity test (every editor feature
  renders in DOCX, PDF and donor template).
- **Exit:** a user can produce every supported structure without seeing markdown,
  and the three export paths render it faithfully; no revision created by merely
  opening/closing a section.

**P2 progress (2026-09-27, code complete behind the flag, not yet deployed):**
- B8 — `apps/workers/app/donor_template/markdown_docx.py` parses the subset and
  builds a docxtpl Subdoc (donor's own Heading 3/4, List Bullet/Number, Quote,
  Table Grid styles when present; direct formatting otherwise). `renderer.py`
  promotes whole-paragraph `{{ key }}` tags to `{{p key }}` at render time (no
  change to stored templated files); inline tags get plain text; render now uses
  `autoescape=True` (raw `&`/`<` in section text previously risked invalid XML).
- B9 — `normalizeSectionMarkdown` / `sectionMarkdownEquivalent` /
  `SECTION_MARKDOWN_MAX_LENGTH` (100k) in the domain (own subpath export); applied
  in `UpdateReportSectionHandler` with a plain-language "too long" error.
- Editor — TipTap 3.31.3 (MIT: core, pm, react, starter-kit, markdown,
  extension-table, extensions; `@floating-ui/dom`), lazy chunk via `next/dynamic`.
  `rich-text/extensions.ts` (schema = the subset; strike/underline/code blocks/
  hr/hard breaks disabled), `markdown-io.ts` (`toStorageMarkdown`: decode entities,
  drop serializer escapes, compact tables, domain normalisation),
  `paste-cleanup.ts`, `EditorToolbar` (roving tabindex, table controls),
  `LinkEditor` (http/https/mailto only), bubble menu, Ctrl+K, word count,
  autosave + conflict recovery + unsaved guard, "Done editing" awaits the last
  save; save status shown in the top bar. Shared `.report-prose` typography
  (globals.css) for read view and editor. Whole-section "Rewrite with AI" moved
  to `AiRewritePanel` in the section toolbar.
- No spurious revisions: the editor's own serialisation at creation is the
  baseline (load-time table normalisation emits updates), so opening/closing never
  saves — verified in a browser (0 save requests on open; saves on real edits).
- Fixed along the way: the api's DOCX/PDF inline parser turned `**1,680**` into a
  literal `*` + italic (marker skip bug) and treated `2 * 3 * 4` as italic; the
  Python parser had the same flanking issue. Both now follow CommonMark flanking.
- Tests: web `rich-text-roundtrip.test.mts` (corpus incl. every golden draft,
  stability, entities/escapes, paste cleanup); domain `section-markdown.test.mjs`;
  infrastructure parity gate + bold/asterisk cases; worker donor-template markdown
  tests (native blocks, placement, style fallback, escaping, inline placeholders).
- Deferred: U28 Ask-AI-on-selection (P4 with B10), U24 lock badge on verified
  tables (P3, needs artifact↔table matching), Alt+F10 toolbar focus (P6).

**P0–P2 audit (2026-09-27) — gaps found and fixed:**
- **Section optimistic concurrency was broken (pre-existing).** `ReportSection` rehydrated with `updatedAt = createdAt` and the repository never wrote/read `updatedAt`, so the second autosave of any editing session got a false "changed by someone else" conflict and real concurrent edits were never detected. `Entity` now accepts a stored `updatedAt`; `PrismaReportSectionRepository` persists and reads it; update/rewrite handlers return the version read back *after* assurance (which may touch the section).
- **Every text save wiped the section's sources (pre-existing).** `UpdateSectionSchema` defaulted `sourceReferences`/`unsupportedClaims` to `[]`; they are now optional and kept when omitted.
- Edits are only accepted on the current working draft (not superseded / under review / approved); editing an approved section reopens it (`report.section.reopened`).
- Missing route permissions added: reject (`report.approve`), activate, chart, sections-order, story (`report.edit`), cancel-generation (`report.generate`), bulk-resolve (`report.resolve-claim`), period-values + field-report apply (`indicator.update`), field-report propose (`report.edit`).
- Web: saved text/version flow back to the read view and the next edit (no stale content after switching sections); saves are serialised with a reliable flush on close/"Done"; editor becomes read-only on conflict; generation polling resumes after a reload; "open statements" now means MATERIAL + FAILED + undecided (matches the server gate); classic `?view=` deep links open the matching v2 panel; whole-section "Rewrite with AI" hidden while editing; pre-existing `upload-queue` unit test fixed.

### P3 — Statements inline (3–4 d)
- B1, B2, B3, B4, B5. `claim-anchors.ts`, static-view highlight plugin + editor
  decorations, `EvidencePeek` (U2), `StatementsTab` with plain verbs + undo (U7),
  approve gating, Approve & next + approve-all-clean (U8), issue navigator (U5),
  re-check section.
- **Exit:** a failed material claim can be found, understood and resolved without
  leaving the document; anchor tests cover offsets, fallback, stale text, tables,
  formatted text (bold/links inside a claim).

**P3 progress (2026-09-27, code complete behind the flag):**
- B1/B2: `GET …/draft` returns claim `charStart/charEnd/materiality/verificationReasonCode`, `evidenceTitle` on claim sources and evidence `sourceReferences` (`IEvidenceDirectory`; SENSITIVE/HIGHLY_SENSITIVE titles show "Restricted evidence" unless the caller has `report.override-confidentiality`), per-section `assuranceState`.
- B3: domain `suggestNumericReplacement` (only when exactly one wrong achievement number and exactly one evidence number that is also a verified finding value) exposed on demand at `GET /v1/report-claims/:id/suggestion` (no schema change). B5 is applied **server-side**: `POST /v1/report-claims/:id/apply-suggestion` replaces the number inside the statement span and saves through the normal update (`AUTO_FIX`, re-verified); returns the previous text for Undo.
- B4: web actions `reassessSectionAction`, `requestChangesAction`, `reopenReportClaimAction`.
- New: `POST /v1/report-claims/:id/reopen` (undo keep/leave-out; reopens identical statements too because decisions follow the fingerprint). `resolve` now returns the claim id after reconciliation (assurance re-creates claims).
- **"Leave out" is real now (pre-existing gap):** EXCLUDED resolutions set `verificationResult = EXCLUDED` (kept through re-checks, reset by undo) and every export omits excluded statements (`omitExcludedStatements`).
- Web: `claim-anchors.ts` (§4.3), `highlight-hast.ts` (read-view marks via rehype on react-markdown source offsets), `rich-text/claim-highlights.ts` (ProseMirror decorations), `EvidencePeek`, rewritten `StatementsTab` (Use … from evidence / Keep with a note / Leave out, 10 s Undo toast, "Undo decision" link, "wording changed" + Re-check), `issue-order.ts` + `IssueNavigator`, Re-check (section and checks list), "Approve all clean sections (n)", `verified-tables.ts` lock badge + drift WARNING check, "Show evidence marks" toggle.
- Tests: domain `report-editor-v2.test.mjs`, application `report-editor-v2.test.mjs`, web `report-editor-statements.test.mts`.

### P4 — Generation, section regenerate & lifecycle (5–6 d)
- B7 (§5.1) incl. refactor; `RegeneratePopover` (U11), summary freshness (U31),
  launch card (U9), live fill (U10), regenerate-draft confirm (U12), versions drawer.
- B10 + Ask AI on selection (U28).
- Submit → Under review → Approve / Request changes (U14) → Export dialog (U16);
  reviewer mode.
- **Exit:** happy path Generate → regenerate one section → resolve → approve
  sections → submit → approve → export works with the primary button alone.

**P4 progress (2026-09-27, code complete behind the flag):**
- B7: `POST /v1/report-sections/:id/regenerate` (202, `report.generate`) → `RegenerateReportSectionHandler`. `GenerateReportDraftHandler` refactored onto `ReportGenerationContextBuilder` + `SectionGenerationService` (constructor unchanged, existing tests unchanged). Guards via domain `sectionRegenerationBlock` (superseded / not DRAFT / generation in progress / already running / 10 per draft per hour — not metered). Plan section matched by title, synthetic plan section for user-added sections; other sections' text passed as `draftedSections`. On fallback/timeout the text is kept and `report.section.regeneration_failed` is audited; success commits `REGENERATION` (new `ChangeOrigin`, string column) and replaces artifacts; approved sections are reopened. `userInstruction` mirrored in TS (`AiReporterSectionBrief`, legacy prompt `buildAuthorInstructionBlock`) and Python (`SectionBrief.userInstruction`, max 500) — emitted only when present. In-progress ids from `InMemorySectionRegenerationTracker` → `regeneratingSectionIds` on `GET …/draft`.
- Background work (section-wise generation and regenerate) now runs through an injected `BackgroundRunner`; the api's `onResponse` hook awaits `container.settleBackgroundWork()` before disconnecting the request's Prisma client (previously the client could be closed mid-transaction — found in the live run).
- U31: domain `staleSynthesisSectionIds` (regenerated/rewritten/restored, or ≥25 % words changed after the summary was written) → `summaryStaleSectionIds`; notice + "Regenerate summary".
- History: `GET /v1/report-sections/:id/revisions` + inspector History tab; Restore saves the text as a `RESTORE` revision. Regenerate toast offers "Restore previous version" for 30 s.
- B10: rewrite accepts `selection {from,to}` + `preview` (no save). "Ask AI…" in the bubble menu (Rewrite / Shorten / Make donor-friendly / Expand) shows the suggestion struck/inserted; Accept inserts it and saves with `changeOrigin: REWRITE`.
- U14 reviewer: "Request changes" (comment required) next to "Approve report"; U16 export opens the `ExportWizard` in a dialog; U9 launch card adds evidence and links to the inputs page.
- Not done: §8 client analytics events (`editor.*`) — no client analytics infrastructure exists yet.

### P5 — Data & story inputs page (2–3 d)
- `/projects/[id]/reports/[periodId]/inputs` tabs **Indicators** · **Story**
  (autosave) · **Import** (auto-refresh). `/indicators` redirects there.
- `ReportInputsCard`, launch-card links, inputs-changed banner (U13, B6).
- **Exit:** no input form remains on the editor page.

**P5 progress (2026-09-27, code complete):** `/projects/[id]/reports/[periodId]/inputs?tab=indicators|story|import` (indicator grid, autosaving `StoryInputs`, `FlexibleInputsPanel` refreshing the page after imports + evidence link); `/indicators` redirects there; `ReportInputsCard` under the outline; B6 `inputsChangedSince {indicators, evidence, sectionIds}` via `PrismaReportInputsChangeReader` → `InputsChangedBanner` + WARNING check with "Re-check affected sections". The Story/Flexible drawer was removed from the editor.

### P6 — Polish: keyboard, responsive, a11y, dark mode (2–3 d)
- Shortcuts (U19), responsive layouts (U21), dark tokens (U22), toast/undo
  replacing `window.confirm`, comment counts (U15).
- A11y: roving tabindex, `aria-live` for generation/saves, focus management on issue
  jumps, status never colour-only, 44px targets, contrast ≥ 4.5:1 both themes.
- **Exit:** axe-core clean (Playwright + `@axe-core/playwright`), keyboard-only
  happy path.

**P6 progress (2026-09-27, code complete):** `shortcuts.ts` + `useEditorShortcuts` (j/k, n/N, e, a, ?) and `ShortcutSheet`; inspector inline ≥1280 px, right slide-over 1024–1279 px, bottom sheet <1024 px (`Drawer` gained `side="bottom"`, `wide`, focus trap and scrolling body; `Dialog` gained scrolling + `size="lg"`); toasts support an action + duration (Undo); comment counts on outline rows, the Comments tab and a WARNING check (`ICommentCounter`); roving arrow keys on inspector tabs; status markers never colour-only. Dark mode: the Tailwind palette lacked 200/300/400/800/900 shades of success/warning/danger/info/ai, so ~100 existing `dark:text-*-400` classes app-wide were no-ops — added.
- Not done: axe-core Playwright suite (`@axe-core/playwright` not installed); the live browser pass was stopped before completion.

**Verification (2026-09-27):** typecheck all packages; domain 205, application 121, infrastructure 229, web unit 163, worker pytest 125 — all passing; `next build` clean. Live run on a local Postgres 16 + api + web: generate → edit (two autosaves, stale version → 409) → resolve (new claim id) → reopen → revisions → reassess → selection preview → regenerate (stub provider: text kept, failure audited). The two api `billing.test.mjs` cases fail only when a local Postgres is listening (they use fake credentials); they pass otherwise.

### P7 — Rollout & cleanup (1–2 d)
- Flag on: internal tenant → pilot (EERP) → all. Keep `?editor=classic` one release,
  then delete `ReportWorkspace.tsx`, `ReportingStepGuide`, `ReportCheckPanel`,
  `SmartReviewPanel`, `ReportPreviewPanel`, `SectionEditor`, and the Story/Flexible
  panels from the editor path.
- Deploy per `CONTABO-DEPLOY.md`; update memorybank (§9).

**Total:** ~24–32 developer-days.

---

## 7. Testing

| Layer | What | Where |
|---|---|---|
| Pure logic | editor-model, report-checks, primary-action (every §3.1 row), claim-anchors, issue-order, url-state, shortcuts, reporting-copy, step-state | `apps/web/tests/unit/*.test.mts` (`node --test`) |
| Markdown | round-trip golden corpus; `normalizeSectionMarkdown`; editor-feature ⇄ export-renderer parity | `packages/domain/test`, `packages/infrastructure/test`, `apps/workers/tests` (B8) |
| Application / API | B1/B2 fields + restricted masking; B3 only-when-unambiguous; B6 counts; B7 guards/fallback-keeps-content/synthetic plan/reopen; B10 selection preview | `packages/application/test/*.test.mjs` |
| Worker | `userInstruction` in writer contract (TS mirror string-identical test); donor-template RichText rendering | `apps/workers/tests` |
| E2E | happy path; rich-text formatting → DOCX; resolve via correction/keep/leave-out + undo; regenerate section with instruction; reviewer requests changes; deep links; mobile read+approve | `apps/web/tests/report-editor.spec.ts` |
| A11y | axe on empty, generating, draft (read + edit), under-review | Playwright |
| Regression | existing `phase2/phase3.spec.ts` with flag off and on; `reporting:eval` unchanged | Playwright, eval |

Before each merge: `pnpm -r typecheck`, unit tests, worker pytest, Playwright.

---

## 8. Success measures

| Measure | Classic baseline | Target |
|---|---|---|
| Cards / panels visible on load | ~12 | ≤ 4 |
| Interactive controls before section-level | 40+ | ≤ 12 |
| Clicks to find and resolve a flagged number | ~5 + scrolling | ≤ 2 |
| Places readiness/issues are shown | 4 | 1 |
| Users who see raw markdown while editing | all | none |
| Redo one weak section without losing others | impossible | 1 action |
| Time from generated draft to submit (seeded 7-section report) | measure | −40% |

Client events: `editor.issue_navigated`, `editor.primary_action_clicked{action}`,
`editor.statement_resolved{via}`, `editor.section_regenerated`, `editor.ai_selection_used{mode}`.

---

## 9. Documentation to update when shipping

`Features/20-report-gen.md` (new "Report Editor v2" section) ·
`Features/11-AI-Report-Draft-Generator.md` (section regenerate, userInstruction) ·
`INDEX.md` · `Fixes.md` (P0 hotfixes, F15) · `pending.md` ([Later] items) ·
`AGENTS.md` (markdown-subset invariant, new `REQUIRED_PRISMA_FIELDS` if any,
writer contract `userInstruction`).

---

## 10. Non-goals and backlog

**Non-goals:** real-time co-editing/presence; changes to verifier/gates; new
export formats; formatting beyond the export-renderable subset (underline,
colours, fonts, embedded images).

**Backlog [Later]:** U3 length hints · U17 version compare · U20 tour ·
U30 footnotes, comment-on-selection, track changes · offline draft buffer ·
per-donor document themes matching export templates.

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Markdown round-trip changes AI text (escaping, list markers) → spurious revisions or broken offsets | Normalise-and-compare before saving; golden round-trip CI gate; server normalisation (B9) so stored form is canonical. |
| Claim offsets drift after edits | Slice-equality check, search fallback, unanchored state, re-check CTA (§4.3); decorations map through edits. |
| Editor bundle size / performance on long reports | Lazy TipTap chunk; one editor mounted at a time; static view elsewhere; memoise anchors per `(sectionId, updatedAt)`. |
| Editor formatting that exports can't render | Single `markdown-schema.ts` subset + parity test across DOCX, PDF, donor template (B8). |
| Section regenerate overwrites good text on provider failure | Keep previous content on fallback/timeout; previous text always a revision; restore toast. |
| Section regenerate cost/abuse | Rate limit; credit policy open decision (§5.1.7). |
| Refactor of `GenerateReportDraftHandler` regresses full drafts | Pure extraction with existing tests unchanged; e2e full-draft run before merge. |
| Client state machine disagrees with server gates | Server authoritative; gate errors mapped via `reporting-copy.ts`. |
| Restricted evidence leaking via titles/peek | B2 masking; tests in P3. |
