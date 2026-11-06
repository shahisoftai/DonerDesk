# Phase 44 — Data entry: one simple system for the phone and the desktop (DRAFT FOR REVIEW, 2026-11-06, branch `0018-optimisation`)

**DonorDesk Version 3.007**

**Status: plan only, all decisions made (2026-11-06, section 11). Nothing here is built.** UX mocks (25 screens, phone and desktop, private design canvas): <https://claude.ai/artifact/59tpQQJWAL7RwUL1iaeLRg>; the screen-by-screen catalogue is **Appendix A**, what the mocks add to or change in this plan is **Appendix B**. Written from (a) a read of the data-entry code, (b) a signed-in browser pass on the production test tenant on 2026-11-06 (desktop 1400 px and an iPhone-sized headless profile, read-only, DEMO-8 and DEMO-14), and (c) the public documentation of ActivityInfo and DevResults plus offline-design guidance. Section 11 lists the decisions we need from the owner before building. **No code, schema or copy changes are made by this document.**

## 0. In one page

**The problem.** Entering data in DonorDesk is not hard because a screen is bad; it is hard because there are too many doors. One indicator value can be saved through about eight paths, "I did the work" has three entry points, the same files are asked for in three places, and the phone is a shrunken desktop with one separate offline mini-app (`/field`) that most people never find.

**The answer.** One *Record* flow, one *data source* abstraction and one *outbox*, used by both hosts:

- **Phone (field workers):** a *Today* home, a big **Record** button, a four-item bottom bar, a *Waiting to send* list, and an offline pack that carries everything needed to record with no signal. Two taps to the first field; five fields or fewer before Save.
- **Desktop (managers):** the same Record flow in a side drawer from the header (so a manager can enter without leaving the page), the existing Entry Sheet for bulk work, one *Data inbox* for what needs review, and live warnings instead of refusals where the product's own rules allow.
- **Underneath:** no new write path. Every record still goes through the existing handlers; the new code only decides *which* one, *where the data comes from* (network or pack) and *how it is sent* (now or later).

**What changes for a user, in numbers we will measure (section 10):** time from opening the app to the first saved record, taps to record a value, and tap targets under 44 px on entry screens (today 60–80 % of controls).

## 1. Evidence

### 1.1 Verified in the browser (2026-11-06)

| # | Finding | Where |
|---|---|---|
| E1 | The header **"Enter data"** button is unstyled: `btn-primary` has no CSS (computed background transparent, padding 0, height 20 px). The class is used in 9 places (Enter data, New form, Home layout Save, report builder Run, next-step button, setup "New project", indicator history Save, shared infographic download). Only `.btn`, `.btn-secondary`, `.btn-danger` are defined (`apps/web/src/app/globals.css`). | desktop + phone |
| E2 | On an **active** project the default state of Quick entry is an error: today's date lands in no period, "Create the period for that date first", with a link to another screen. | DEMO-14 `/enter` |
| E3 | On a phone the project header (title, meta, status, banner, tabs) fills the first screen: the first entry field is at the very bottom of the first 844 px. | `/enter`, `/activities/new` |
| E4 | The global **+ Create** is `hidden sm:block` (no phone version) and offers only "New project" and "Choose a project to add a report, activity, or evidence". There is no one-tap way to record anything. | `AppShell.tsx` `CreateMenu` |
| E5 | The activity form is one long screen on a phone (about 20 controls: five participant boxes, five narrative boxes, evidence). Dictation, "Take a photo" and "Tell it in your own words" exist and are good. | `/activities/new` |
| E6 | Period inputs on a phone: seven buttons (Download Excel, Import Excel, Import from Google Sheet, Save all, Submit for review, Verify all, Back) before any data; indicator codes wrap ("KE-/OC1"); a review control sits inside the entry screen. | `/reports/:id/inputs` |
| E7 | Between 60 % and 80 % of controls on the entry pages are under 44 px tall (mostly project tabs, breadcrumb and links). No horizontal scrolling on the real phone profile. | measured |
| E8 | Five inputs have no accessible label: the two file inputs on the activity form, the two on the evidence page, and the Google Drive link box on the evidence page. | measured |
| E9 | `/field` has no app shell and nothing in the main navigation links to it (only the Forms page does). A phone that has never opened it shows "Nothing is downloaded yet". | `/field` |

**Method note.** A first mobile emulation inside the headed 1400 px window produced misleading screenshots (a sidebar the DOM said was hidden) and a login click that was intercepted. Both were emulation artefacts and were discarded; every phone finding above is from a separate headless Chromium with a real device profile.

### 1.2 Read in the code

| # | Finding | Where |
|---|---|---|
| C1 | Seven or more ways to write an indicator value: `quickEnterValueAction`, `createIndicatorUpdateAction`, `bulkSaveIndicatorUpdatesAction` (sheet and grid), collection-form totals, connectors, data-sheet and xlsx import, the `indicator-values` outbox. The *rules* are shared in the handlers (good); the *screens* are many. | `lib/actions/indicators.ts`, handlers |
| C2 | Three entry points for "the work happened": `saveProgressAction` (progress log), `completePlannedActivityAction` (mark done), `createActivityAction` (completed activity form). | `lib/actions/workplan.ts`, `activities.ts` |
| C3 | Counts of people in four places: activity participants (five fixed boxes), the beneficiary register, indicator breakdowns, collection records. | `NewActivityForm`, beneficiaries, `DisaggregationEditor` |
| C4 | File capture is implemented separately in `NewActivityForm` (per-file settings and memory), `EvidenceUploadQueue`, the period "Import" tab and the collection `FILE` question. | features/activities, evidence, collection |
| C5 | Five outbox kinds (activity, progress, plan-status, indicator-values, collection-record). The engine is generic and well built (`outbox.ts`: entries, sender per kind, idempotency by entry id), but the senders are wired in one inline record in `OutboxProvider.tsx`, and each form decides for itself how to queue. | `features/offline/` |
| C6 | The offline pack holds forms and places only; the service worker keeps only `/field`. Quick entry and the activity form survive a connection that drops while the page is open, not a page opened with no signal. | `offline-pack.ts`, `public/sw.js` |
| C7 | `/field` renders no signed-in data on the server (by design, so it can be cached) and hosts its own form filler beside the main app's. | `app/field/page.tsx`, `FieldApp.tsx` |
| C8 | Entry layouts: the Entry Sheet is desktop-only; under 768 px the same data uses a separate form view with a table that wraps codes. | `IndicatorEntryGrid.tsx` |
| C9 | The vocabulary for a period's data state exists once (`summarizePeriodData`: NO_DATA, IN_PROGRESS, RETURNED, SUBMITTED, VERIFIED) but different screens show different words. | `logframe/period-data-status.ts` |
| C10 | Two button systems: the `Button` component and the `.btn*` CSS classes (177 uses of `btn-secondary`). A class that is used but not defined fails silently (E1). | `components/ui/Button.tsx`, `globals.css` |

### 1.3 What is already good and is kept

Period derived from the date (`periodForDate`); suggested running total; one atomic save path with locks, entry window and value checks; the outbox engine; draft stores; dictation; the Entry Sheet (paste, fill, undo, autosave, locked cells never changed); collection forms with offline pack, GPS, photos; the `IMPORT_OPTIONS` guide; role surfaces (`ROLE_SURFACES`); plain-language refusals; "a missing value is never 0".

## 2. What the competitors and the guidance teach us

Sources are listed in section 12; **source quality varies and is stated**.

| Source | What we take | What we do not take |
|---|---|---|
| **ActivityInfo** (feature page read in full; mobile, subform and form-designer pages could not be fetched, so those points come from search snippets only) | Warnings *while typing* for a locked period, a rule that fails, a missing required field or a duplicate, instead of refusing at save. Drafts on desktop and phone. Collection links without login. Interactive table with paste and fill-down (we already have it). Record history. Simple, flat forms for mobile ("keep structures simple"). | Subforms as the model for repeating data (we have planned activities and collection records; adding a third notion would blur the two-nouns rule). |
| **DevResults** (five help articles read in full) | A partner/field **landing on the open period** with a visible lock state; plain period states (No data, In progress, Submitted, Approved); a Summary comment per indicator; "mix online and Excel" (the template contains what was already typed); everything totalled automatically; submit all, return with a reason, discussion log; field data from a mobile tool imported into a data table. It has **no field app of its own**: that is where DonorDesk is already ahead. | Fixed template headings as the only offline route. |
| **KoboToolbox / ODK Collect / CommCare** (community and vendor material; low authority, no UX spec found) | A form must be *opened and cached while online* before offline use, so **say plainly whether a project is ready for offline**. Photo-heavy surveys use storage fast, so show **pending uploads with a count and size**. A per-record state (submitted / pending / failed) beats a global sync button. Test the exact device and features offline. | Anything specific: the search found no authoritative sync-UX standard. |
| **Google Open Health Stack, "Design Guidelines for Offline & Sync"** (one official source aimed at health workers) | Show sync status only on screens it affects; **an offline state is not an error** (do not style it red); confirm a finished sync with a check mark and a changed colour; **no endless spinner** (show progress); sparing timestamps; reassure ("You're offline. Updates will be uploaded when the device reconnects."); few, friendly reminders. | — |
| **Material Design (touch targets, bottom navigation, FAB)** (secondary sources only; official spec not read) | Touch targets of at least 48 dp for primary actions (44 px as our hard floor); a bottom bar of 3–5 destinations; a single prominent create action. **Verify the exact numbers against the official Material 3 and WCAG 2.2 pages before they are written into a test.** | Thumb-zone claims: no reliable source found, so none are used. |

## 3. Who this is for, and the rule for each

**Field worker on a phone** (officer, enumerator, volunteer): often one hand, sun glare, weak or no signal, low data, may not read English fluently, one task at a time. Rule: *never see a review state; never lose work; never have to know which screen to open.*

**Manager at a desk** (project manager, M&E officer): many values, review, correction, reports. Rule: *same data, more power, no second system.*

**Outside partner** (external VIEWER/FIELD_OFFICER): the same phone flow restricted to the routes in `EXTERNAL_ALLOWED`.

## 4. The target experience

### 4.1 Phone

**Shell.** Compact header (project name on one line, never more than 56 px of header content before the page body). Bottom bar with four destinations: **Today · Record · Waiting · More**. *Record* is the prominent centre button. Project sections (Logframe, Data, Finance, …) live behind *More* in a **Sections** sheet, never as a wrapping tab bar on a phone.

**Today** (the field home): (1) a **Record** card, (2) *This week*: planned items due, each with one tap to "What happened?", (3) *Sent back to you* with the reason, (4) *Ready for offline* (which projects, how fresh, one button to refresh), (5) *Waiting to send* count when not zero.

**Record sheet** (a bottom sheet; the same component is a right-side drawer on desktop):

1. **What are you recording?** Big buttons, only those the person may use: *A number* (indicator value), *Something we did* (activity), *A photo or file*, *An expense* (finance, only with permission), *A form* (a published collection form). One tap each. The last choice is remembered; the project is remembered and skipped when only one exists.
2. **One screen, five fields or fewer, one primary button pinned at the bottom.** Everything else is under **Add detail** (closed by default).
3. **After Save:** a plain confirmation ("Saved" or "Kept on this phone. It will be sent when you have signal."), then **Record another** (same project and kind) and **Done**. Nothing about review.

Per kind, the default fields:

| Kind | Default (visible) | Under "Add detail" |
|---|---|---|
| A number | Indicator, value, day (chips *Today / Yesterday / Pick*) | Breakdown (only when the indicator requires one: shown inline, not as a link elsewhere), note, where the figure came from, file |
| Something we did | What (title), when, where, how many people, photo | The five story boxes as **one** "What happened" box, end date, logframe and plan links, per-group participant counts, evidence settings |
| A photo or file | The file(s) and what it shows (linked automatically when started from a record) | Type, confidentiality, indicator, period |
| An expense | Amount, what for, day | Vendor, category, file |
| A form | The form's own questions | — |

**Waiting to send** (one list for every kind): each record with its state, in plain words: *Waiting* · *Sending (2 of 5)* · *Sent ✓* · *Needs you* (the reason and one action). Never red for "no signal". A banner says once: "Your work is safe on this phone." Photos show size.

**Language and reading:** the person's language (en, fr, es, ar; right to left uses logical spacing); icons beside words; units shown beside the value; the numeric keypad for numbers; large type supported; no codes or raw status words in any sentence (copy lint).

### 4.2 Desktop (managers)

- **Header "+ Record"** (and the Home quick action) opens the *same* Record flow in a drawer, so entering one value, activity or file never means leaving the page. The existing **"+ Create"** items (new project, new report) stay in the same menu under a second heading; the menu is available on every screen size.
- **Entry Sheet stays** as the power tool: paste from Excel, fill, undo, autosave drafts, locked cells never changed. It gets the same row component states as the phone's cards (section 6, batch 44.5).
- **Data inbox** (one screen): values handed in, activities to accept, files to verify, records waiting, returned items. It is the existing assignment queue (`AssignmentQueue`) shown as a list with bulk actions (verify all with a file, accept selected, return with a reason). **No new source of work.**
- **Period status strip** on each period: *No data · In progress · Handed in · Verified · Returned* from `summarizePeriodData`, with the one-sentence description, the same words on every screen (section 6, duplication D9).
- **Live advice while typing** (ActivityInfo-style): a locked period, a day that falls in no period (with the one-click fix), a duplicate for the same indicator, period and value, a missing required breakdown, an indicator not due this period, a future date. These are *notices*, not refusals; the entry window and period locks stay refusals by design (existing Phase 36 rule).
- **Spreadsheet round trip** (DevResults-style): the downloaded workbook should contain what is already entered. *To verify in 44.8 whether `buildIndicatorEntryWorkbook` already does; if it does, nothing to build.*

## 5. Architecture and SOLID

### 5.1 Layout (mirrors `features/maps/`)

```
features/record/
  domain/          pure, no React, no clock (today passed in), no node:*, table-tested
    record-kinds.ts        RECORD_KINDS (the one table: key, capability, needs, outbox kind, offline level)
    work-outcome.ts        chooseWorkOutcome(input) -> COMPLETE | PROGRESS | CREATE_ACTIVITY | STATUS_ONLY
    entry-advice.ts        ENTRY_ADVICE_RULES (ordered table) -> notices
    default-fields.ts      which fields are default vs detail, per kind (one table)
    sync-words.ts          SYNC_STATE_WORDS (state -> catalogue key + tone)
    record-draft.ts        the draft shape per kind; wraps createDraftStore
  ports/           interfaces only
    RecordLookup.ts        read: projects, indicators, periods, places, plan items, forms
    RecordSink.ts          write: one method per kind, each returning a Result
    PackWriter.ts          what the pack stores and refreshes
  adapters/        the only code that touches network actions or IndexedDB
    network-lookup.ts      uses existing loaders and server actions
    pack-lookup.ts         reads the offline pack
    network-sink.ts        calls the existing actions
    outbox-sink.ts         queues through the existing outbox
  presentation/    React; depends on ports and domain only
    RecordSheet.tsx  KindChooser.tsx  ValueForm.tsx  ActivityForm.tsx  FileCapture.tsx
    ExpenseForm.tsx  FormHost.tsx  WaitingList.tsx  SyncStatus.tsx  TodayHome.tsx  AdviceList.tsx
  composition.ts   the only place adapters are wired (online host vs /field host)
```

Rules enforced by `test/architecture-boundaries.test.mjs` additions (section 10): presentation never imports adapters; domain imports nothing outside itself; no file over 300 lines; one exported component or class per file; **no code branches on a record-kind name outside `record-kinds.ts`** (grep-pinned, like `SETUP_AREAS`).

### 5.2 How each principle is met (and how it is checked)

| Principle | Design | Check |
|---|---|---|
| **S**ingle responsibility | Each module has one reason to change: *what kinds exist* (`record-kinds`), *which handler a work record maps to* (`work-outcome`), *which advice applies* (`entry-advice`), *where data comes from* (lookup adapters), *how it is sent* (sink adapters, outbox senders), *how it looks* (presentation). | size and class-count tests; one `describe` per module |
| **O**pen/closed | New record kind = one row in `RECORD_KINDS` + one form component + one sender; new advice = one row in `ENTRY_ADVICE_RULES`; new sync state = one row in `SYNC_STATE_WORDS`; new offline pack part = one row in `PACK_PARTS`. No `switch` on kind in the shell. `OutboxProvider`'s inline sender record becomes a registry built from `OUTBOX_KINDS`. | `assertExhaustive(table, keys)`; grep pin for kind names |
| **L**iskov | The network and pack lookups are interchangeable behind `RecordLookup`; the network and outbox sinks behind `RecordSink`. One **contract suite** (like `assignment-source-contract.mjs`) runs against both adapters of each port. | contract tests for both adapters |
| **I**nterface segregation | Read (`RecordLookup`) and write (`RecordSink`) are separate; `PackWriter` is separate from both; a form depends only on the methods it calls (a number form never sees plan methods). | port files ≤ 8 methods; each form's props list its own port subset |
| **D**ependency inversion | Presentation depends on the ports; `composition.ts` wires adapters: the signed-in app wires network adapters, `/field` wires pack adapters. The two hosts differ **only** in composition. | architecture test; the harness runs the same forms with both compositions |

### 5.3 Existing rules this plan must keep

No new write path to a value: everything goes through the existing atomic handlers (Phase 36). Two nouns, never mixed (planned activity vs completed activity). A missing value is never 0. Period derived by `periodForDate`; a date in no period is never given to a neighbour. A `"use server"` file exports only async functions. A Server Component passes no functions to a Client Component. The `contexts/collection` index stays free of `node:*`. Copy from the typed catalogue in four languages (drafts until a native reader reviews). Domain imports no infrastructure. A control always has a label (`Field` names its child). Never `prisma format`. Additive migrations before code (none expected here).

## 6. Duplication ledger (what is merged, what survives)

The goal is *no duplication left* on completion; batch 44.9 enforces it with tests (section 10).

| # | Duplicate today | Survivor | How | Removed |
|---|---|---|---|---|
| D1 | `/enter` page, header "Enter data", Overview `InlineValueEntry`, planned Quick entry | `ValueForm` (extracted from `QuickEntryForm`) hosted three ways: Record sheet, `/enter` (deep link) and the Overview row | one component, one action (`quickEnterValueAction`); a grep test says only `ValueForm` imports it | the separate copies of the field/validation/landing logic |
| D2 | Progress log, Mark done, Completed-activity form | one *"What happened?"* flow; `chooseWorkOutcome` picks the **existing** action: complete (`completePlannedActivityAction`), progress (`saveProgressAction`), plain activity (`createActivityAction`), or a status change | the three backend handlers stay (they are distinct nouns); the three *entry points* become one | `MarkDoneButton` and `ProgressLog`'s own entry forms are re-pointed at the flow; dead code deleted |
| D3 | File capture in `NewActivityForm`, `EvidenceUploadQueue`, period Import tab, collection FILE | `FileCapture` + one upload helper extracted from the evidence queue; per-file settings and the remembered choices (`createFileSettingsMemory`) live there | the activity form, Quick entry, the evidence page and the form filler call it; links go through the existing `IEvidenceLinker` (`linkOnUpload`, `attachPendingFor`) | four implementations of the same settings and progress |
| D4 | Two layouts of the same period data (Sheet vs form with a wrapping table) | One row model from `entry-sheet.ts` (`toWritePlan`, `rowIsClean`, `lockReason`) drawn as a **table** on wide screens and as **cards** on phones | the card shows code, name, value, state, one tap to edit; same engine | the form-view table and its own save logic |
| D5 | Two offline hosts (`/field`'s form filler and the signed-in app's forms) | Same `FormHost`, composed with pack data (`/field`) or network data (app) | `RecordLookup`/`RecordSink` ports | the filler wiring in `FieldApp` |
| D6 | Five hand-wired outbox kinds | `OUTBOX_KINDS` registry (kind, title rule, sender factory); `RecordSink` queues by kind | `OutboxProvider` reads the registry | the inline `senders` record |
| D7 | Different words for a period's state | `describePeriodData` + one `DATA_STATUS_WORDS` table (catalogue keys) | sheet, period list, strip, inbox, Overview all read it | the screens' own wording |
| D8 | `+ Create` menu (desktop only, project list link) | one **+ Record / + Create** menu, all sizes, built from `RECORD_KINDS` and the role's capabilities | `ROLE_SURFACES` / `BUTTON_CAPABILITY` gain a `record` capability row | the hard-coded two-item menu |
| D9 | `.btn*` classes and the `Button` component (and the undefined `btn-primary`) | for this phase: **define `btn-primary` as the `.btn` alias** and add a test that every `btn-*` class used in TSX is defined; *consolidating onto one button system is listed as a follow-up, not done here* (honest scope) | `test/css-classes-defined.test.mts` | the silent failure class |
| D10 | Participant counts: five fixed boxes in the activity form, plus indicator breakdown categories | **Decision needed (section 11, Q3).** Default proposal: one `PARTICIPANT_GROUPS` table feeds both the activity form and the breakdown editor so the groups cannot disagree; the beneficiary register (individual records) is not merged | open | — |
| D11 | Several "import" entry points (Import tab in a period, Bring in data, Data Center import, Google Sheet import) | `IMPORT_OPTIONS` stays the one guide; the period tab is renamed **Files** (it holds evidence, not tables) and links to the guide for tables | label + link only | confusing second "Import" |

## 7. Offline specification

**What the phone holds (pack v2, additive over v1).** Per project the person may enter into: published form questions; the places list (v1); **the indicators they may enter** (id, code, name, unit, type, whether a breakdown is required, whether calculated, aggregation); **the reporting periods** (id, type, start, end, locked, cancelled, label) so the day-to-period rule runs offline (`dateLanding` is pure and already takes the periods list); **this person's planned items** for the next 14 days (id, title, dates, place name, status). It still holds **no recorded values, no people, no figures, no files**. Pack v1 is read and upgraded; a v1 pack keeps working for forms.

**Why this stays safe for a lost phone.** The pack belongs to the person who downloaded it, is wiped at sign-out, warns when old (`PACK_STALE_AFTER_DAYS`), and adds only names the person already sees in the app. *The new parts (indicator names, plan titles) are the privacy question in Q1.*

**What the service worker keeps.** Today only `/field`. New: the Record route's static assets, so the record sheet opens with no signal. Still never caches anything under `/v1`, `/api` or `/internal`, and no signed-in HTML. The Record flow therefore must also open from `/field` (the session-free host); the signed-in app is the same flow with network data. *`/field` stays session-free on purpose: it is the only page that can be cached safely.*

**Sync states (shown, never red for no signal):** Waiting → Sending (n of m) → Sent ✓, or **Needs you** with the server's plain reason (the existing `needs-attention` state; a refusal is never retried by itself; idempotency by entry id is kept). A flush stops at the first "offline" answer. Photos: compressed in the browser before queueing (target in Q4), uploaded once each with progress saved after each (existing activity sender behaviour).

**Readiness is explicit.** *Ready for offline: DEMO-14, updated 2 days ago, 3 forms, 14 indicators* or *Not ready — download while you have signal*. Opening Record with no pack and no signal says what to do in one sentence.

**Known limits to state and test:** iPhone browsers may evict stored data after a period of inactivity (so a "download again" nudge, no promise of permanence); voice dictation uses the browser's speech service and is treated as **online only** until proven otherwise on real devices; the sheet and charts are not offline; opening other app pages offline is out of scope (existing decision).

## 8. API and data

No migration is expected. Additive API only: `GET /v1/projects/:id/offline-pack` returns the new parts (permission `indicator.update`, already in `RULES` and on `EXTERNAL_ALLOWED`; the pack builder is the only writer of that shape). A period created from Quick entry uses the existing `CreateReportingPeriodHandler`; the *proposal* of which period covers a date is a new pure function beside `period-type-rules.ts` in `packages/domain`, so the screen's explanation and the handler's enforcement use the same function (the Phase 23 rule). No `/ready` pair is added unless a column is.

## 9. Batches

Each batch ends with its tests green, the browser harness for that batch, and a short record here. Order is by value and risk; 44.0 can ship alone.

**44.0 — Fix what is broken today (hours, web only).**
`.btn-primary` defined; `test/css-classes-defined.test.mts` (every `btn-*`/`input`/`card` class used in TSX exists in `globals.css`). Labels for the five unlabelled inputs (via `Field`/`aria-label`). One shared touch-target token (`min-h-11`, 44 px floor; 48 px for primary) applied to the project tab bar, breadcrumb and link rows; a test reads the token table. Compact phone project header (title one line with ellipsis, meta in a collapsible row). **Acceptance:** E1, E3, E7, E8 re-measured with the audit script (kept as `tests/harness/entry-audit/`).

**44.1 — Record domain (no UI).**
`record-kinds.ts`, `work-outcome.ts`, `entry-advice.ts`, `default-fields.ts`, `sync-words.ts`; `proposePeriodForDate` in `packages/domain`. Table tests for each rule row; exhaustive checks. **Acceptance:** `chooseWorkOutcome` maps every input shape to one of the existing actions; every advice rule has a test row and a plain sentence; no rule reads the clock.

**44.2 — Ports, adapters, pack v2, outbox registry.**
Ports and the four adapters; contract suite run against network and pack lookups and against network and outbox sinks. Pack v2 builder (API) and reader (web) with v1 upgrade; `OUTBOX_KINDS` registry replacing the inline senders; service-worker asset caching for the Record route. **Acceptance:** with the network switched off (Playwright `setOffline`), a pack-backed Record can resolve a day to a period, list indicators and queue a value; reconnect sends it exactly once; a v1 pack still fills forms.

**44.3 — Record sheet and the number flow (D1).**
`RecordSheet` (bottom sheet on phone, drawer on desktop; the existing `Drawer` has a bottom variant), `KindChooser`, `ValueForm` extracted from `QuickEntryForm` with: inline breakdown through the existing `DisaggregationEditor` (no second editor), file/photo through `FileCapture` stub, **"Create the period for this date" inline** (permission rule in Q2), live advice list. `/enter` and `InlineValueEntry` re-host `ValueForm`; header "Enter data" opens the sheet. **Acceptance:** E2 fixed (no dead end on an active project); a required-breakdown indicator can be saved completely on a phone without leaving the sheet.

**44.4 — "What happened?" and the activity form (D2, D10).**
Split `NewActivityForm` (807 lines) into a core (what, when, where, people, photo) and a detail panel (story, links, groups); the five story boxes become one "What happened" box that the existing narrative proposal and the writer split later (no change to stored fields; the box writes into them through `proposeActivityFromNarrative`, which only fills empty fields). One flow reached from a planned item or from Record. Draft saved through `createDraftStore`. **Acceptance:** a planned item can be recorded as finished, part done or not held in under four taps; the old three entry points are gone; the stored activity is byte-identical for the same answers (golden test against the current form's payload).

**44.5 — Files and the card layout (D3, D4).**
`FileCapture` (camera + picker, per-file settings, remembered choices, compression, progress) replacing the four implementations; period inputs cards on phones from the same row model as the sheet. **Acceptance:** the same file added in the activity form, Quick entry, the evidence page and a form question uses one code path (grep test); the card and the sheet agree on every state (shared fixtures).

**44.6 — Phone shell, Today, Waiting (D5, D6, D8).**
Bottom bar (Today · Record · Waiting · More) for roles whose `ROLE_SURFACES` say so; Sections sheet replacing the wrapping tab bar on phones; `TodayHome` for the field variant; `WaitingList` and `SyncStatus` (states, counts, size, "safe on this phone"); **`/field` becomes the Record flow composed with the pack** and is linked from More and Today ("Ready for offline"). One **+ Record / + Create** menu on every screen size. **Acceptance:** first-time field user records a value from the home screen in two taps to the first field; the same flow works from `/field` with no signal.

**44.7 — Manager desktop (D7).**
Header **+ Record** drawer; **Data inbox** over `AssignmentQueue`; period status strip and one status vocabulary; live advice in the Entry Sheet; tab labels by intent (see Q8); the period "Import" tab renamed **Files** (D11). Confirm whether the Excel workbook already carries entered values (section 4.2) and, only if not, add them in `buildIndicatorEntryWorkbook` (one place). **Acceptance:** a manager can enter a value, review a handed-in value and open the sheet without leaving the project page; one vocabulary for period state across five screens (test over the catalogue keys).

**44.8 — Languages and accessibility.**
`record.*` catalogue keys in en/fr/es/ar (typed, so a missing key does not compile; Arabic plurals avoided as in the wizard); logical spacing; reading-order and focus-order checks; keyboard path through the sheet; reduced motion; the label/tap-size audit script run as a test. **Acceptance:** i18n completeness test; copy lint clean; the audit script reports no unlabelled control and no entry-screen control under 44 px.

**44.9 — Verification, duplication gate and release.**
Duplication tests (section 10), real-phone offline test, usability test, fresh full-suite run (build contracts → domain → application → infrastructure first), deploy with `SCOPE=both`, live check on the test tenant.

## 10. Verification

**Automated (each batch adds its own; none is "trust me"):**
- *Architecture:* domain pure; presentation imports no adapter; ≤ 300 lines; one component per file; no record-kind branching outside `record-kinds.ts`; `assertExhaustive` on every table.
- *No duplication:* grep-pinned single-implementation list — only `ValueForm` imports `quickEnterValueAction`; only `FileCapture` talks to the evidence uploader from forms; only `OUTBOX_KINDS` names outbox kinds; only `work-outcome.ts` chooses among the three work actions; every `btn-*` class used is defined. A list of "allowed importers" per symbol in one test file, so a new duplicate fails the build.
- *Contract suites:* both lookups, both sinks.
- *Golden payloads:* the activity and value payloads from the new forms equal the current forms' for the same answers.
- *Browser harness* `pnpm --filter @donordesk/web test:record`: real components, phone profile and 1400 px, `setOffline(true)` flows, tap-size and label audit (the script used for this audit), no horizontal scroll, bottom bar and sheet behaviour.
- *Copy:* four languages, no raw tokens, no forbidden workplan words.

**Manual and field:**
1. **Real devices offline:** one Android Chrome and one iPhone Safari: download, airplane mode, record a value, an activity with a photo and a form, reconnect, check sent once; leave the phone idle for days and check eviction behaviour.
2. **Usability test** (protocol in the style of Phase 36): 5 field workers on their own phones, 3 managers on desktop; tasks: record a number, record what happened for a planned item, add a photo, find what is waiting; **targets:** first saved record within 30 s of opening the app; value recorded in ≤ 4 taps from Today; no participant asks "where do I…"; zero lost records.
3. **Budgets:** Record sheet JS ≤ 120 KB gzipped on first open (measure and set); pack size reported to the user; photo queue size shown.

## 11. Decisions (ALL DECIDED by the owner on 2026-11-06: "all agreed" — every default below is now the decision)

**Decision record.** Q1 to Q11 and Q12 to Q20 (Appendix B.4) were put to the owner with a default for each; the owner accepted **all defaults**, and Q15 earlier (one question per screen on a phone). The "Default if you agree" column below is therefore the decided answer. Q11 and Q20 are one decision (a native reader per language, Arabic and sector terms first); Q2 and Q14 are one decision (inline period opening for `project.edit`, everyone else asks the project manager through a `ProjectTask` request). Nothing is open; batch 44.0 may start, and 44.1 to 44.5 are unblocked.

| # | Question | Default if you agree |
|---|---|---|
| Q1 | **Pack v2 contents.** May the pack hold indicator names, the reporting periods and the person's own planned-item titles (still no values, people or files)? | Yes, for the person's own projects only |
| Q2 | **Missing period in Quick entry.** Who may create it inline? Everyone who can enter (`indicator.update`), or only `project.edit`? If not allowed: show "Ask your manager" and create a request through the existing `ProjectTask`? | Create inline only for `project.edit`; otherwise the request |
| Q3 | **Participant groups.** Keep the five fixed boxes fed by one `PARTICIPANT_GROUPS` table (default), or enter people through the indicator's breakdown categories only? | One shared table; no data migration |
| Q4 | **Photo size.** Compress in the browser to what long side / quality before queueing? (affects storage and mobile data) | 1600 px long side, JPEG ≈ 0.8, original kept if already smaller |
| Q5 | **One menu** "+ Record / + Create" on every size, or two buttons? | One menu, two headings |
| Q6 | **Bottom bar** for every role or only field roles? | Field roles on phones; managers keep the sidebar and get the drawer |
| Q7 | **`/enter`** stays as a deep link hosting the same `ValueForm` (default), or redirects into the sheet? | Stays (bookmarks, emails, "Needs you" links) |
| Q8 | **Tab renames** (project): keep names, or by intent (e.g. Reporting → *Reports*, Data → *Data*, Evidence → *Files*)? | Rename only the period "Import" tab to **Files**; leave the rest |
| Q9 | **Simple review for field roles.** Turn it on by default for new projects so field values are handed in on save? (it is per project and audited today) | No change in this phase; ask in the usability test |
| Q10 | **Dictation offline.** Treat as online only and say so, until tested on real devices? | Yes |
| Q11 | **Language review.** Who reads the new fr/es/ar copy before release (the existing translations are drafts)? | A native reader per language, Arabic and sector terms first |

## 12. Not doing (on purpose)

A native app (cost, store process, no gain over a cached web app for these tasks). WhatsApp/SMS entry (not validated by the domain rules). Subforms as a new notion (planned activities and collection records already cover repeating data). A second button system rewrite (only the missing-class bug and its guard). New review states, new health scores or new indicators of "behind". Opening other app pages offline. Merging the beneficiary register into activity counts. Changing the stored shape of any record.

## 13. Sources

- ActivityInfo, data entry feature page (read): <https://activityinfo.org/about/feature/data-entry.html>. Mobile, subform and form-designer pages **not fetched** (access blocked), so statements about them rest on search snippets: <https://www.activityinfo.org/support/docs/mobile/adding-records-using-a-mobile-device.html>, <https://www.activityinfo.org/support/docs/forms/understanding-the-difference-between-a-form-and-a-subform-in-activityinfo.html>.
- DevResults help (read): <https://devresults.knowledgeowl.com/help/enter-direct-entry-data>, <https://devresults.knowledgeowl.com/help/report-direct-entry-data-online-partners>, <https://devresults.knowledgeowl.com/help/report-direct-entry-data-via-excel-partners>, <https://devresults.knowledgeowl.com/help/integrating-mobile-data-collection-tools>, <https://devresults.knowledgeowl.com/help/video-tutorial-entering-data>.
- Google Open Health Stack, Design Guidelines for Offline & Sync: <https://developers.google.com/open-health-stack/design/offline-sync-guideline>.
- KoboToolbox community, offline data collection best practices (low authority): <https://community.kobotoolbox.org/t/best-practices-for-offline-data-collection-in-remote-areas/76424>.
- Material Design touch-target, bottom-navigation and FAB figures come from secondary sources only and **must be checked against the official Material 3 and WCAG 2.2 pages** before they become test values.
- Earlier internal records: `phase36-easy-data-entry.md`, `phase33-competitive-parity-plan.md`, `phase34-devresults-parity-plan.md`, `competitor-matrix-verified-2026-10-27.md`.

## 14. Appendix — audit method and what was not tested

Browser: Chromium via Playwright (`playwright-core` 1.62.1). Desktop in a visible window at 1400 × 880; phone in a separate headless context (390 × 844, device scale 2, touch, iPhone user agent). Test tenant `mnpiracha@gmail.com`; projects DEMO-8 (completed) and DEMO-14 (active). **Read-only: nothing was saved.** Measured per page: horizontal overflow, control counts, controls under 44 px, unlabelled inputs, console errors. Screenshots were reviewed for the entry, activity, period-inputs, field and More-menu screens.

**Not tested:** typing into the Entry Sheet on desktop or a phone; a real save; offline on a real device; the evidence upload on a phone; the collection form filler; dictation; Arabic layout; slow-network behaviour; screen readers. These are covered by batches 44.8 and 44.9.

---

## Appendix A — Screen catalogue (the 25 mocks)

**Where:** <https://claude.ai/artifact/59tpQQJWAL7RwUL1iaeLRg> (private; the owner shares it). Phone screens are 390 × 844, desktop 1280 × 800. The screens link to each other, so the flows can be clicked through. **The mocks were not rendered or screenshot-checked by the author**; text fit and spacing need a visual pass before anyone treats them as final. They are drawn with DonorDesk's own palette (page `#f1f4f1`, text `#0e1a16`, tiles `#fff` / `#d8e0db`; the primary is the deepened saffron `#8a5610`, the same token as the code badge, so white text passes 4.5:1; the live app's lighter primary button does not) and Public Sans (Noto Sans Arabic for the Arabic screen). "Reuses" below names code that exists today; "Needs" names what does not.

Reading the table: **Batch** is the Phase 44 batch that builds it; **Check** is what proves it in the browser harness (section 10).

### A.1 Flow 1 — open the app, record a number (phone)

| # | Screen | What it decides | Reuses | Needs | Batch | Check |
|---|---|---|---|---|---|---|
| 1a | **Today** | The field worker's home: *Record something* (three one-tap buttons), *Sent back to you* with the reason, *This week* with a "Finished?" button per item, one *Ready for offline* line, bottom bar Today · Record · Waiting · More | `GetMyWeekHandler` (`/v1/me/week`), `ROLE_SURFACES.home`, outbox counts, pack freshness | `TodayHome`; the readiness line reads pack age (`describePackFreshness`) | 44.6 | first screen fits one viewport; no review word anywhere; Record reachable in one tap |
| 1b | **Record: what?** | One bottom sheet, five choices in plain words (a number, something we did, a photo or file, an expense, a form), project shown and remembered, "Last time" badge on the previous kind | `Drawer` (bottom variant exists), capabilities | `RecordSheet`, `KindChooser`, `RECORD_KINDS`; "last kind / project" kept on the device only | 44.3 | only kinds the role may use appear; second record starts two taps in |
| 1c | **A number** | Five-or-fewer fields: which number, how many (numeric keypad), which day (Today / Yesterday / Pick), the period named in words, a hint when a breakdown is required, "Add detail", pinned Save | `quickEnterValueAction`, `dateLanding`, `periodForDate`, `suggestRunningTotal`, outbox `indicator-values` | `ValueForm` (extracted from `QuickEntryForm`), `AdviceList`, `ENTRY_ADVICE_RULES` | 44.3 | saves with a typed total only; period shown before Save; breakdown never a dead link |
| 1d | **Saved** | One confirmation, no review state; *Record another* (same project and kind) and *Done* | — | confirmation component shared with 3b | 44.3 | "Record another" keeps project and kind, clears the value |

### A.2 Flow 2 — record what happened (phone)

| # | Screen | What it decides | Reuses | Needs | Batch | Check |
|---|---|---|---|---|---|---|
| 2a | **No period for that day** | The dead end of today's `/enter` becomes a decision: say what is missing in words; a field worker **asks the project manager** (one tap); a manager sees the one-tap fix (7c); Save stays off until a period covers the day | `CreateReportingPeriodHandler`, `period-type-rules.ts`, `ProjectTask` (request) | `proposePeriodForDate` (domain, beside the period rules), the "ask" action (Q2) | 44.1 / 44.3 | an active project with no current period never shows a bare error; the request names the day |
| 2b | **What happened?** | From a planned item: *It is finished* / *Some progress* / *It did not happen*. One screen replaces Mark done, Progress log and the activity form's entry points | `completePlannedActivityAction`, `saveProgressAction`, `changePlanStatusAction`, `createActivityAction` | `chooseWorkOutcome` (domain), `WorkOutcomeChooser` | 44.4 | each choice calls exactly one existing action; the three old entry points are gone |
| 2c | **Something we did** | Five fields, prefilled from the plan: what, when, where (with a "Here" GPS button), how many people (stepper), photos; everything else behind "Add detail" | `createDraftStore`, `suggestPlanLinks`, `resolvePlanLink`, `proposeActivityFromNarrative`, GPS in the collection filler | `ActivityForm` core, `FileCapture`, `default-fields.ts` | 44.4 / 44.5 | stored activity equals the old form's payload for the same answers (golden test) |
| 2d | **A form** | A collection form on a phone: one question per screen, progress, big answer buttons, "Location noted", Back / Next | `FormFiller` rules (`visibleFields`, `validateSubmission`), pack forms | `FormHost` with a step layout for narrow screens | 44.6 | same answers produce the same record as the scrolling layout; a hidden question is never shown or stored |

### A.3 Flow 3 — no signal, and what is waiting (phone)

| # | Screen | What it decides | Reuses | Needs | Batch | Check |
|---|---|---|---|---|---|---|
| 3a | **Today, no signal** | Offline is calm, not an error: slate banner "No signal. You can keep working.", the same buttons, plan "From your phone, 08:10", "2 waiting to send" | outbox, pack | `SyncStatus`, `PackLookup` for the plan | 44.2 / 44.6 | with `setOffline(true)` the screen has no red, every button still works |
| 3b | **Kept on this phone** | The offline confirmation: "You do not need to do anything"; the waiting count | outbox enqueue | shared confirmation, `OutboxSink` | 44.2 | reconnect sends once; the count goes to zero |
| 3c | **Waiting to send** | One list for every kind with plain states: *Sending (2 of 4 photos)* with a bar (no spinner), *Waiting*, *Needs you* (reason + "Fix it" / "Delete"), *Sent ✓ today* | `OutboxProvider` (`entries`, `retry`, `discard`), activity-sender progress, `summarise` | `WaitingList`, `SYNC_STATE_WORDS`, photo size in the entry title | 44.6 | a refused entry parks with the server's sentence; nothing retries a refusal by itself |
| 3d | **Ready for offline** | Per project: *Ready* (updated, what is stored: numbers, forms, places, this week's plan) or *Not ready* (download, size); what is and is not kept; eviction warning | `describePackFreshness`, pack store, `PACK_STALE_AFTER_DAYS` | `ReadyForOfflineList`, pack v2 counts | 44.2 / 44.6 | a project with no pack says "Not ready"; refresh replaces the pack |

### A.4 "Add detail", opened (phone)

| # | Screen | What it decides | Reuses | Needs | Batch | Check |
|---|---|---|---|---|---|---|
| 4a | **A number, Add detail** | The main answer collapses to a summary card; the panel shows the split by women and men **only when the indicator requires it**, with a live check ("180 + 140 = 320"), where the figure came from, a note, a photo | `DisaggregationEditor`, the grid's consistency line, `attachPendingFor` | `ValueForm` detail panel | 44.3 | a required-breakdown indicator saves completely on a phone; a mismatch is a notice, not a block |
| 4b | **Something we did, Add detail** | "What happened?" in one box (with voice, labelled online-only), four fixed groups of people, plan tags filled in automatically | `proposeActivityFromNarrative`, `participants-consistency` (hints never block) | `ActivityForm` detail panel | 44.4 | the single box fills the story fields by the existing proposal; stored fields unchanged |
| 4c | **A photo or file** | Preview with the size ("reduced from 4.8 MB"), retake / choose / add more, what it shows, what it proves (auto-linked), who may see it | `IEvidenceLinker` (`linkOnUpload`), `CameraButton`, `FileDropzone`, `createFileSettingsMemory` | `FileCapture`, in-browser compression (Q4), the two-choice confidentiality wording (Q17) | 44.5 | one code path for every file added from a record, a number, the evidence page and a form question |

### A.5 Money, language, light and first day (phone)

| # | Screen | What it decides | Reuses | Needs | Batch | Check |
|---|---|---|---|---|---|---|
| 6a | **An expense** | Amount (with the project's currency), what for, day, receipt, "counted under" the plan item's budget; a footnote says the manager confirms expenses | finance register `addExpenseAction` (a DRAFT), `finance.approve` rules, plan-item budget lines | `ExpenseForm`; a rule for which budget line is suggested (the plan item the person came from) | 44.5 | an expense is always a DRAFT until decided; currency never assumed or mixed |
| 6b | **Today in Arabic** | The same screen right to left with logical spacing, Noto Sans Arabic, numbers in Latin digits; geography never mirrored | `I18nProvider`, `RTL_LANGUAGES`, bundled Arabic font | `record.*` keys in `ar`; **the wording in the mock is a layout draft, not reviewed copy** | 44.8 | `dir="rtl"` flips order and spacing; no physical `left/right` classes in `features/record` |
| 6c | **Today in dark mode** | Dark surfaces from the existing tokens (`tile-bg` `#12231f`, page `#0b1614`, accent saffron `#f2b544` with dark text) | `TOKENS`, `useColorMode` | `record-*` surface roles added to `TOKENS` + a `CONTRAST_PAIRS` row each | 44.8 | `design-tokens.test.mts` passes with the new pairs in both modes |
| 6d | **First day, nothing planned** | A new person sees two steps (download, record a first number) and an honest "Nothing is planned for you this week" line; no fake data | pack store, outbox | `TodayHome` empty branch derived from data (nothing planned, no pack, no values), **no stored "seen" flag** | 44.6 | the empty branch disappears as soon as a pack exists or a value is saved |

### A.6 The manager on desktop

| # | Screen | What it decides | Reuses | Needs | Batch | Check |
|---|---|---|---|---|---|---|
| 5a | **Record drawer** | The same Record flow in a right-hand drawer from the header "+ Record"; kinds as a segmented control; "Save" and "Save and record another"; a note when a value for the same indicator and day already exists | the phone's components; period rows already loaded for the indicator | `RecordSheet` desktop host; `DUPLICATE_VALUE` advice | 44.3 / 44.7 | the drawer and the phone use the same `ValueForm` (grep test) |
| 5b | **Data inbox** | One list across projects: a period status strip (No data → In progress → Handed in → Verified, "1 returned"), filters by kind, bulk bar ("Verify 2 (with a file)", "Send back with a reason"), a number with no file cannot be verified and says so | `AssignmentQueue`, `summarizePeriodData`, the existing bulk verify / return handlers, `checkEvidenceReview` | `DataInboxList`, `PeriodStatusStrip`, `BulkBar`; **possibly new `IAssignmentSource`s** (see B.3) | 44.7 | every row's action calls an existing handler; bulk verify skips values without a file and says how many |
| 5c | **Entry sheet with live notes** | The existing sheet with a state chip per row, a suggested running total, "Not measured", "Not due this period", and a panel of notes while typing; only the entry window and an approved report refuse a save | `entry-sheet.ts`, `isDueInPeriod`, `lockReason`, `toWritePlan` | `SheetNotesPanel` (reuses `AdviceList`), `ENTRY_ADVICE_RULES` | 44.7 | notes never disable Save; locked cells unchanged by paste, fill, clear, undo |

### A.7 Empty, error and set-up states (desktop)

| # | Screen | What it decides | Reuses | Needs | Batch | Check |
|---|---|---|---|---|---|---|
| 7a | **Inbox: nothing needs you** | An honest empty state with two next actions (open the sheet, record) | — | `EmptyState` (shared with 6d) | 44.7 | shown only when every source answered and all were empty |
| 7b | **Inbox: some projects did not load** | Per-project failure is isolated: a banner "2 of 5 projects could not be loaded", the failed ones named with a reason and a reference, the rest still shown, "Try again" | the Overview's `SectionData<T>` pattern, `referenceId` on errors | per-project read in `DataInboxList` | 44.7 | stubbing one project's read to fail still renders the others and names the failed one |
| 7c | **Manager opens the missing period** | Inside the drawer: the period the project's rule calls for (type, dates), "Open November 2026 and save" or "Open it only"; Save off until open | `CreateReportingPeriodHandler`, `GetPeriodOptionsHandler`, `period-type-rules.ts` | `PeriodOpenCard`, `proposePeriodForDate` | 44.3 | a created period equals one made through the Reporting screen for the same date (same function) |

### A.8 Screens not drawn (still open)
Arabic and dark versions of the desktop screens and of the forms; a larger-text setting; tablet widths (the plan treats 640–1023 px as phone layout with the sidebar hidden, to be confirmed); the **More** menu (3d is reached from it, its contents are Q16); the **Sections** sheet that replaces the project tab bar on a phone; the Record drawer with the other kinds; the field-worker view of a project (title, status) that 44.0 compacts.

## Appendix B — What the mocks add to, or change in, the plan

### B.1 Changes to the text above
1. **Section 4.1, bottom bar.** The mocks show the fourth destination as *More*, and 3d (Ready for offline) is where it leads for now. *More* needs its own content (Q16); until then it must not look finished.
2. **Section 4.1, Record sheet.** In the mocks the *photo* tile on Today opens the file screen directly and the sheet's "A photo or file" row opens the activity form in 1b. Align both to one destination (the file screen) when building.
3. **Section 4.2, Data inbox.** Written as "the existing assignment queue, no new source of work". The mock rows include *numbers handed in (waiting to be verified)*, *files to verify*, *activities to accept* and *form records waiting*. Today's assignment kinds are plan items, requests, checklist, report deadlines, evidence review, activity review, activity fix, indicator values due and risk reviews. **"A handed-in number waiting for a verifier" and "form records waiting" are not in that list**; B.3 says what to check and what to add.
4. **Section 6, D1.** `ValueForm` now also hosts a *period-open card* (2a / 7c) and a *duplicate-value note* (5a). Both are rows in `ENTRY_ADVICE_RULES`, not branches in the form.
5. **Section 7.** 3a shows the week's plan "from your phone, 08:10" (pack v2's plan part) and 3d lists what a pack holds with counts. The pack builder therefore returns counts as well as content.
6. **Section 9, 44.6.** Includes the *First day* state (6d) and the *Sections* sheet.
7. **Section 9, 44.7.** Includes the load-error and empty states (7a, 7b) and the inline period opening for managers (7c, which also needs 44.3's domain function).

### B.2 New components and registry rows this adds
Presentation (`features/record/presentation`): `WorkOutcomeChooser`, `PeriodOpenCard`, `ExpenseForm`, `ReadyForOfflineList`, `EmptyState`, `ConfirmationScreen` (1d and 3b are one component with two wordings from `SYNC_STATE_WORDS`). Inbox pieces live in the area that owns work items (`features/work-items` or `features/tasks`; decide at 44.7 which owns them): `DataInboxList`, `PeriodStatusStrip`, `BulkBar`, `InboxLoadBanner`. Registries: `ENTRY_ADVICE_RULES` gets `LOCKED_PERIOD`, `NO_PERIOD_FOR_DAY`, `DUPLICATE_VALUE`, `MISSING_BREAKDOWN`, `MISSING_FILE`, `NOT_DUE`, `FUTURE_DATE`, `RETURNED_NEEDS_CHANGE`; `RECORD_KINDS` gets its five rows (NUMBER, ACTIVITY, FILE, EXPENSE, FORM); `SYNC_STATE_WORDS` gets WAITING, SENDING, SENT, NEEDS_YOU, OFFLINE_NOTE, READY, NOT_READY.

### B.3 What to confirm in the code before building the inbox (44.7)
- Does an assignment source exist for *"a value handed in, waiting for verification"* and for *collection records waiting for review*? If not, each is one new `IAssignmentSource` plus one row in `TASK_KINDS` / `ASSIGNMENT_KINDS`, and each must pass `assignment-source-contract.mjs`. The Data inbox must **not** read the data sheet or the review tables directly (that would be a second queue).
- Does the existing "Verify all" skip values with no file, and report the count? The mock's bulk bar promises "Verify 2 (with a file)".
- Is a returned value's reviewer reason available per row without a second call (`IndicatorUpdate.reviewNote`)?
- Per-project isolation: the Overview already returns `SectionData<T>` per part; the inbox needs the same shape per project.

### B.4 New decisions raised by the mocks (add to section 11)

| # | Question | Default if you agree |
|---|---|---|
| Q12 | **Expense footnote.** The mock keeps one review fact visible to the field worker ("Your manager confirms expenses before they count as spent") because money is the one case where it matters. Keep? | Yes, for expenses only |
| Q13 | **Icon for a verified value** in the sheet (the mock used an emoji lock). | A proper lock icon from the icon set, with the word "Verified" |
| Q14 | **How the field worker asks for a missing period (2a).** Through the existing `ProjectTask` request to the project manager, or a plain notification? | `ProjectTask` request (it closes when the period exists) |
| Q15 | **DECIDED (owner, 2026-11-06): one question per screen on a phone** (2d). Still to check: what `FormFiller` does today, and whether desktop keeps the whole form on one scrolling page (assumed yes, not asked). | One question per screen below 640 px; the scrolling page stays for wider screens; confirm the step layout in the usability test (a long form hides its length, so the progress line must stay correct when conditional questions appear) |
| Q16 | **What is in *More*?** | Ready for offline, My projects, Language, Help, Sign out; nothing else |
| Q17 | **Confidentiality wording** (4c). "Everyone on the project" and "Only managers" must map to the real levels (PUBLIC / INTERNAL / SENSITIVE / HIGHLY_SENSITIVE). | Everyone → INTERNAL; Only managers → SENSITIVE; the other two stay in the evidence screen |
| Q18 | **Expense budget line (6a).** "Counted under Hygiene session budget" assumes a plan item's budget line. What is suggested when the person did not start from a plan item? | Nothing suggested; the line is chosen under "Add detail" |
| Q19 | **Dark mode on field screens.** Offer it on the phone (follow the system setting) or leave it to the desktop toggle? | Follow the system setting everywhere; keep the manual toggle |
| Q20 | **Arabic copy.** The Arabic in 6b is a layout draft. Who writes the production copy, and does it get a native reader before any release? | A native reader, Arabic and sector terms first |

### B.5 Risks the mocks make visible
- **Too much on Today.** Five blocks fit one screen at 390 × 844 in the mock; with longer names, two languages and a larger font they will not. Rule: *Record* and the sent-back card are never pushed below the fold; "This week" and the status lines collapse first.
- **Bottom bar and system gestures.** The bar is 76 px with a raised centre button; on phones with gesture bars it needs the safe-area inset, and on small phones (≤ 360 px wide) the four labels must still fit. Both go into the harness.
- **Disabled Save (2a, 7c).** A disabled primary button with no explanation is a known trap; both mocks print the reason beside it. Keep that rule.
- **One question per screen (2d)** hides how long the form is; the progress line carries that, and it must be right when conditional questions appear or disappear.
- **The duplicate-value note (5a)** needs the existing value for the same indicator and day. If it requires an extra read per keystroke it will be slow: read once when the indicator and day are chosen.

## Appendix C — Copy, translation and accessibility specification

**Copy.** All visible strings go in the typed catalogue under `record.*` (`en` first, then `fr`, `es`, `ar`; a missing key does not compile). The mock screens use roughly 260 distinct strings across phone and desktop; the count is a planning figure, not a measured one. Rules: plain words (*number*, *day*, *photo*, never *value*, *indicator*, *period* on the phone unless the person's own project uses them); no raw codes in a sentence except the indicator code shown as a label; counts agree through `countOf` / `agree`; no concatenated sentences; names of people and places are never translated. Terms the mocks use that must be fixed in a glossary before translation: *A number*, *Something we did*, *Record another*, *Kept on this phone*, *Needs you*, *Sent back*, *Ready for offline*, *Handed in*, *Verified*.

**Accessibility (checked by the audit script, now a test).** Every control has an accessible name; no control on an entry screen under 44 px (primary actions 48–52 px); text at least 14 px except the 12 px bottom-bar labels (those get a minimum of 12 px and must pass 4.5:1); focus order follows reading order and survives the right-to-left layout; the bottom sheet traps focus and closes with Escape and the back gesture; status is never colour alone (each state has a word, and the sync states an icon); a progress bar has a text equivalent ("2 of 4 photos sent"); reduced motion removes the sheet slide and the progress animation; the numeric keypad is requested for numbers (`inputMode="decimal"`). Contrast pairs for the new surfaces are added to `CONTRAST_PAIRS` in both modes.

**Performance.** The Record sheet and its forms are one lazy chunk loaded when Record is first opened (the budget in section 10); Today loads nothing it does not draw; the offline pack's indicator and place lists are searched in memory, not re-fetched; photo compression runs off the main thread or in chunks so the keypad stays responsive.

## Appendix D — How to review the mocks

1. Open the canvas and click through flow 1 on a real phone-sized window. Ask: *could someone do this with one hand, in sunlight, on their first day?*
2. Read each screen against its row in Appendix A: is the decision in "What it decides" the right one? Mark any you disagree with by its number (1a … 7c).
3. Answer Q1–Q20 (section 11 and B.4). Q1, Q2, Q3 and Q4 block batches 44.2–44.5 (Q15 is decided: one question per screen on a phone).
4. Look for words a field worker would not use. The mocks avoid review words on the phone on purpose; the footnote on 6a is the one exception (Q12).
5. Look at 7b and 2a: are these the right ways to say "something failed" and "something is missing"?
6. Do not judge pixel details yet: the mocks were not rendered or checked after drawing, and the Arabic is a draft.

**Usability test tasks tied to screens** (section 10): *record how many people have safe water today* (1b–1d); *a session you planned has finished* (2b–2c); *add a photo of the register* (4c); *you have no signal; record and check it will be sent* (3a–3c); *find out why something was sent back* (1a, 3c); manager: *verify the values that have a file and send one back* (5b); *open the missing month and save a number* (7c).



## 13. Status (2026-11-06) — BUILT AND DEPLOYED
Built through all batches except the gaps in Feature 60 "Not built". Commits `912212fb`, `3a72c663`, `a38ee780`; deployed `20261106091554` and web-only `20261106145458` (host declined the build for memory; built locally; `/ready` ok). Tests: web unit 907, application 1007, domain 1390, infrastructure 593, record harness 24/24.
Live fixes found by browser testing: typed value lost when a period opened; Back re-selected the kind; field officers could not load the project pack (pack needed `indicator.update`); duplicate Record button on phones; sub-44 px controls; Waiting hydration mismatch; "It did not happen" offered to people the server refuses; raw ISO date; Drawer close and language select 44 px; per-file "Sending…".
Still to verify live: offline `/field` flow, number on phone as admin, manager "Done" from the plan page, My Work "To review", period Files tab, Arabic on phone. Clean up ZZ TEST rows via the app.
