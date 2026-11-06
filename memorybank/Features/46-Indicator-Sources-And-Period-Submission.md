# Feature 46: Formula indicators, target schedules and period submission

**DonorDesk Version 3.007 (Phase 33.3 + 33.4)**
**Status:** built, tested and deployed 2026-10-28 (`releaseId=20261028030634`, with migration `20261028120000_period_entry_window`; the "not applicable" answer, incremental targets and the concurrent-edit check went out with the later 2026-10-28 releases, migration `20261028130000_indicator_update_not_applicable`). Not yet checked by a person in a signed-in browser.
**Rules:** `AGENTS.md` → "Phase 33 invariants" (33.3–33.4 sections).

## Formula indicators

- An indicator can be **calculated** from other indicators of the same project: a ratio (optionally ×100), a total or a difference. Validation refuses references to other projects, self reference and cycles, and any rate used as a count.
- A calculated value is **never stored**. The data sheet, the entry grid and the report path all work it out from the typed values each time, so it cannot drift.
- A missing term or a zero divisor is "not measured", never a partial sum or zero.
- A formula indicator cannot take a typed value, and an indicator with typed values cannot be given a formula.

## Targets

- **Target schedule** (existing): the cumulative target due by each date.
- **Incremental entry** (new): the target can be typed as the amount added at each date. It is stored as the running total, so reports and the stoplight are unchanged. Switching the editor between the two modes converts what is typed.

## Period data status and submission

- Each reporting period has a derived status for its values: no data, in progress, returned, submitted, verified. It is calculated from the values, never stored.
- **Submit for review** hands in every draft or returned value that holds a figure (or a "not applicable" answer). Submission is per value, not atomic; locked reports refuse it.
- **Send back for a period**: a reviewer returns every waiting value with one required reason. The reason is the reviewer's review note, never part of a report. Entrants are told once.
- **Reviewers are told** once when values are handed in; the submitter is not told about their own action; a failed mail never blocks a submit.
- **Entry window**: a period can have an opening and closing day. Saving one value, saving the grid and submitting are all checked. People who can verify are exempt, so a reviewer can enter a late figure. "Today" is the UTC day.
- **Entry-grid stoplight**: "Target met" or "Below target", only. When the comparison would not be fair (how the indicator is read is unconfirmed, no value, no target, or a total with only the final target) there is no light and the grid says why.

## "Not applicable"

A value can be answered **not applicable for this period**, with a required reason. Its figures are cleared rather than set to zero. It goes through submission and verification like any value, is left out of the stoplight, and is left out of the period's report findings (so it is neither written about nor listed as "not measured"). Roll-up reports still read its life-of-project figure. The Data Center CSV writes "Not applicable" and an import reads that text back as empty. A formula indicator cannot be marked not applicable.

## Concurrent edits

The entry grid sends each row's version. If someone else saved the value since the sheet was opened, the whole save is refused and the message names the indicators. Nothing is merged.

## Not built

Explicit "not applicable" for a whole indicator across all periods; per-indicator entry-due days in the UI (read-only today); verified-value notice on the grid beyond the conflict check.
