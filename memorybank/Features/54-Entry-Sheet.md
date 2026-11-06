# Feature 54: The Entry Sheet (indicator values as a spreadsheet)

**DonorDesk Version 3.007 (Phase 34.2)**
**Status:** built, tested and deployed 2026-10-28 (no migration). Harness: `pnpm --filter @donordesk/web test:sheet` (16 checks). Not yet tried by a person in the signed-in app.
**Rules:** `AGENTS.md` → "Phase 34.2 invariants".

## What a person gets

On a reporting period's **indicator values** page, a **Sheet / Form** toggle. The Sheet is a grid with rows and columns always visible:

- **Frozen** Code and Indicator columns; then the four typed columns **This period, Cumulative, Notes, Data source** (contiguous, so a four-column block pasted from Excel lands one to one), then read-only % of target and status.
- **Keyboard like a spreadsheet**: arrows, Tab, Enter, F2 to edit, Esc to cancel, Delete to clear, Ctrl/Cmd + C/V/X/Z/Y, Shift + arrows to select a block, **drag fill**, Ctrl + F (find) and Ctrl + G (go to a row).
- **Paste from Excel or Google Sheets**: impossible values are named and not stored.
- **Columns**: hide, reorder, resize; density and zoom; earlier-period columns beside the current one. Preferences are kept in the browser.
- **Rows**: filters (nothing entered, returned, draft, handed in, verified), sort, search. The shown rows change only when you change the filter, so a row never jumps from under the cursor.
- **Cell states are never only a colour**: a corner mark, a tint and a read-out label (unsaved, saved, locked, calculated, not applicable, error).
- **Locked cells** (verified, calculated, read-only, period closed) are never changed by paste, fill, clear or undo.
- **Not applicable** is an answer with a reason, not a gap.
- **Autosave** (drafts only, 2.5 s after the last change, never while a value is impossible; nothing is handed in or verified by it). **Offline**: a save made without a connection waits in the outbox and is sent later; a refusal is parked with the reason, never retried by itself.
- **By-place table** for indicators that record locations; **comments**; **value history** for each cell from the audit trail; **verify selected**.
- **Excel**: download a workbook with data validation (numbers, 0–100, Yes/No) and upload it back; rows match by the hidden id column, else by code; unknown rows are kept and named, locked rows shown and never applied.

## Rules

- The Sheet adds no write path: it uses the form view's own bulk save (`expectedUpdatedAt` per row, "" clears, a reason makes a row not applicable).
- Undo restores exactly; a row put back to what the server holds is clean again.
- An effect that runs on every keystroke must never set a new state object when nothing changed (this looped twice and is pinned by the harness).
- Hand-in and verification are unchanged: the entry window, period locks and reviewer rules still apply.
- **Simple review (Phase 36):** when a project turns it on, the explicit **Save** (button "Save and hand in") hands the saved values in, and verifies them when the saver may verify and a file is attached. **Autosave never does**: it keeps drafts. See [`59-Quick-Entry-And-Simple-Review.md`](59-Quick-Entry-And-Simple-Review.md).

## Not built

A places × periods layout (the Data Center "By place" tab covers it); editing earlier periods inside the sheet (open that period); per-column history and comments.
