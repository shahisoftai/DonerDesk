# 25 — Set up a project from a document

**DonorDesk Version 3.007.** Built and deployed (2026-10-31), improved by Phase 37 (2026-11-01, final release `20261101195215`) and **run on the real model (Anthropic Haiku) on production**: a four-file pack is read in 79–88 s with 16–17 requests and 71–79 k tokens. Plans: `memorybank/imp/phase36-ai-project-setup-wizard.md` (design) and `memorybank/imp/phase37-setup-wizard-v2.md` (v2, evaluation table in §9).

## What it is
An administrator adds up to five project documents (proposal, concept note, grant agreement, logframe or work-plan sheet) and goes through a slide-by-slide wizard: a welcome slide with the full instructions and do's and don'ts, then one slide per step (documents, reading, facts, results, indicators, reporting, activities, places, funding, risks, create) and a finish slide. Every step carries what to check, do's and don'ts, the options on offer and a tip. DonorDesk proposes the setup — project facts, results (logframe), indicators, reporting periods, planned activities, places, funding and risks — and the person reviews every item against the words it was read from. Nothing is created until they apply. Everything lands as a draft with no indicator values.

It is **proposal → review → apply**, not automatic. A target, date or amount the document does not state is "Not stated", never guessed and never 0.

## Where it is
- Entry: Projects → New → "Set up from a project document" (`/projects/new/document`); review at `/projects/new/document/[id]`.
- Switch: Settings → "Set up projects from a document" (administrator, off by default, `Organization.setupAssistEnabled`; also needs `aiEnabled` and a real, non-stub provider).
- Who: `project.create` (administrators today). A proposal is private to its creator and organisation managers.

## How it works
0. **Kind and sections (Phase 37).** Each file, and each sheet of a workbook, is read as a proposal, logframe table, work plan/Gantt, budget, indicator table or something else (`classifyDocument`; the person can change it in "Your documents"). Each non-tabular file is mapped by its own headings (`document-map.ts`); every block carries its section path. A part reads the kinds it owns and, within them, the sections whose headings it lists (`sectionTitles`, English/French/Spanish) first and whole; keywords fill the rest. Each file is mapped on its own, so a file with only a budget or only a work plan feeds just those parts ("Feeds these steps" in the panel).
1. **Store and read.** The uploaded document is saved in **the organisation's own Google Drive**, never on DonorDesk's servers: first in a staging folder (`DonorDesk / Project setup (documents in progress)`), and when the project is created it moves into that project's own `00-Project-Documents` folder. The proposal keeps only a Drive reference (`drive:<file id>`). A tenant without Drive connected is refused with a plain sentence; there is no fallback to server storage. The bytes pass through the server's memory while they are sent to Drive and read back, and are not kept; the proposal stores the suggestions and their short quotes. The document goes through the ordinary file parsers (OCR fallback, plain-language refusals), is cut into blocks and redacted (`redactForLlm`).
2. **Extract.** Eight areas, read in parallel by dependency layer (`extractionLayers`; `SETUP_ASSIST_CONCURRENCY`, default 3), each by one `PromptedAreaExtractor` over a spec (`prompts/<area>.ts`); a logframe or work-plan *sheet* is read by the existing parsers instead (`sheet-readers.ts`). Phase 37 reads more of the documents exactly, with no model: a Gantt chart (by its header row; task headings are kept), the Summary and Detailed Budget (categories, detail rows, stated totals, checked against each other), logframe matrices (EU/GCF layout, results and their indicators on the same rows), indicator tables (PITT/M&E plan) and labelled fact cells ("Project title", "Donor", "Start date"…). The results chain is found, then its levels and parents are decided in a small voted second call; a missing pass is recalled over the passages nothing was quoted from. Every item carries a verbatim quote.
3. **Ground.** `groundAreaPatch` drops any item whose quote is not in the document, whose figures are not in its quote or whose dates are not stated in it; a dropped fact becomes "Not stated". Link fields (`parentCode`, `logframeCode`, `adminLevel`) are checked by `checkProposal`, not the quote.
4. **Review.** Accept, reject, or (single-value facts only) write your own value. Also: choose another reading of a fact the documents state differently; place an indicator, planned activity or budget line under a result (a clear wording match is suggested, never guessed); move a result to another level or parent; add an indicator by hand; see the work plan on a timeline; open the passage a quote came from; see what was left out and why; change what a document was read as. Hard problems (duplicate codes, unknown parents, end before start, ...) block Apply.
5. **Apply.** `proposeCodes` gives code-less items generated codes; the project is created from the person's completed form; each accepted area is applied through its existing handler in order; the first failure stops the run (PARTIAL), earlier areas stay, and applying again resumes.

## More than one document, languages and cost
A setup takes up to five documents. The wizard is available in English, French, Spanish and Arabic (right to left); the translations are drafts awaiting a native review. After reading, the screen shows how many requests and tokens the AI used, and a cost estimate only when the model has a price on file.

## Evaluation (2026-11-01, real model)
AMAN pack (USAID Part C Word file, Gantt workbook, budget workbook, milestone workbook): goal 1 and outcomes 2 in every run after the document map (before: goals 1–2, outcomes 1–4); the Gantt gives 123 rows (112 dated); the budget (127 rows) reconciles to its stated total. Table: Phase 37 plan §9.

## What it does not do
Indicator values, evidence, completed activities, people, donor report templates, budget lines (they need a planned activity: the preview says how many were read), real team assignment.

## Honest limits
- Quality is measured on **one** real pack so far (table above). The Phase 36 bars (§10) need 8–10 real documents; run an EU, a UNICEF and a GCF pack next. `pnpm --filter @donordesk/infrastructure setup:eval` is a synthetic check only.
- Only 4–13 of 123 Gantt activities are linked to a result automatically (wording differs from the proposal's activities); the rest are placed with the picker.
- Items an importer could not take honestly are left out with a sentence (an indicator with no logframe link, an activity with no start, a place with no level, an unrated risk, funding with no source or currency, an ambiguous amount such as `1,250`).
- The French, Spanish and Arabic wording are drafts awaiting a native review; the Settings card and the server's own error sentences are English.
- Picking a file the person already has in Drive is not possible with the `drive.file` permission (owner decision to widen it).
- Usage and cost are shown after reading; a cost appears only for a model with a price on file (Claude models have none built in).

## Operations
Runbook: `memorybank/docs/runbooks/project-setup-assist.md`. Audit events: `setup.extraction.started|finished|failed`, `setup.proposal.edited`, `setup.apply.area`, `setup.apply.finished|partial`, `setup.proposal.discarded`, `organization.setup_assist_updated` (counts and ids, never document text).
