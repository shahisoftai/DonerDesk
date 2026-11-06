# Feature 60: Record — one data-entry flow for phone and desktop

**DonorDesk Version 3.007**

Built 2026-11-06 (Phase 44, branch `0018-optimisation`, commits `912212fb`, `3a72c663`, `a38ee780`). Plan, mocks and decisions: [`../imp/phase44-data-entry.md`](../imp/phase44-data-entry.md). Deployed 2026-11-06 (`20261106091554`, then web-only `20261106145458`); no migration, no env. Browser-checked on the demo tenant as manager (desktop) and field officer (phone profile); the list of checks still owed is in the plan's status section.

## What a person gets
- **One "Record" button** (header menu and project button on desktop; centre button of a bottom bar on phones for field roles). It opens one sheet: *A number*, *An activity*, *A file*, *An expense*, *A form*. Only kinds the person may record are shown.
- **A number**: pick the indicator, type the value and day; the period follows the day. A missing period is opened in place by someone with `project.edit`; others see an "ask the manager" card (a request, never a silent failure). Typed values survive the period opening.
- **An activity**: five core fields (title, day, where, story, photos); everything else behind "Add detail". Photos are shrunk to 1600 px JPEG before upload.
- **What happened?** from a planned item: *It is finished* / *Some progress* / *It did not happen* (needs a reason and `workplan.manage`; field leads are not offered it).
- **Phone shell**: bottom bar Today / Record / Waiting / More; Waiting lists what is queued with Retry/Discard; More holds Ready for offline, My projects, Language, Help, Sign out.
- **Offline**: the same forms run from the offline pack v2 (indicators, periods, own 14-day plan); entries go to the one outbox and send when signal returns.
- **My Work → "To review"**: numbers handed in and records waiting for review, as ordinary work-queue rows.

## Rules (also in AGENTS.md)
Ports/adapters under `features/record/` (composition is the only wiring); tables not branches; the same view runs online and offline; the pack only carries what the person may use (`GetOfflinePackHandler` `PACK_PERMISSIONS`).

## Not built
Expense form inside the sheet (links to finance), form kind inside the sheet (links to `/field`), GPS "Here" button, Entry Sheet live notes, phone card layout for period inputs, Data inbox strip/bulk bar (My Work "To review" instead), native-reviewed FR/ES/AR.
