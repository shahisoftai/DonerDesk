# Verification demo 7 — 12-month EU health programme in Ghana (run log, started 2026-10-07)

Reference and plan: [`verification-demo-7-reference.md`](verification-demo-7-reference.md). Project: **[DEMO-7] Northern Ghana MNCH-R**, id `2b7659cf-8938-4c5a-b0ac-95ea73de9ae4`, tenant GEC, prod.
Scripts: `scripts/demo-health-gh/`.

## Findings
| # | Sev | Step | What happened | Status |
|---|---|---|---|---|
| + | - | Logframe import | Whole CSV incl. Goal row imported in one go (23 items); demo 5 needed the goal by hand | Improvement confirmed |
| + | - | Indicator import | 19 indicators linked by Logframe Code in one go | OK |
| 1 | M | Template extraction | EU Final template (22 sections incl. nesting) extracted correctly but took ~5 min with only "Analysing…" shown; monthly ~2.5 min. Extraction quality good (word limits, tables, questions captured) | Open (progress feedback) |
| 2 | L | Report calendar | Visiting Reports on a backdated project auto-creates one overdue period per visit (Oct, Nov, Dec) before "Create all" is offered; no explanation that the project start is in the past | Open |
| 3 | L | Create-all button | Label changes with the count ("Create all 10/8 periods"); fine, but a script keyed on it breaks | Info |
| + | - | Setup | "Confirm all (9)" semantics in one click; team assignment turned Done after assigning (demo 5 #11 stayed Todo); Final period reserved for closing report | Improvement confirmed |

Setup done: project active, 19 indicators confirmed, templates approved (monthly `3b0dad6f…`, final `4d455b89…`), team: Najeeb (PM), Kwame Mensah (M&E), Grace Achieng (field officer), Amara Okafor (PM, second approver; password unknown so cannot log in as them). Periods Oct 2025 - Aug 2026 created (`scripts/demo-health-gh/periods.txt`, in order); Sep 2026 closing report still to be started from the closing page.
| 4 | M | Activity form upload | Files dropped on the activity form: type guessed from the name ("NHIS register" → Attendance sheet), no indicator link on the form; but the evidence library now has inline "Link to…" (activity, indicator value, period) and "Suggest more links" (demo 5 #9 improved) | Partly fixed |
| 5 | L | Story tab | The compliance statement field ("Cross-Cutting Issues…") saved only after the field lost focus; typed text followed by navigation is lost. 5 story answers autosave | Open |
| 6 | H | M1 report approval | Report checks said "A reported figure doesn't match your approved data — in Summary of the Month; Review and fix", Review and fix opened Summary ("Nothing to decide"), and "Approve section" did nothing (no message). Real cause: lint `SAME_METRIC_DIVERGENCE` read "120 targeted / 6,000 targeted / 18,000 targeted" (targets of different indicators in section 3) as one metric "targeted" with 3 values → BLOCKER, and the finding was attached to `sections[0]` (Summary) instead of the section stating the figure. Only the export preflight showed the real text. Dead end for a user | **Fixed locally** (`contradiction-lint.ts`: participle-only phrases are not metrics; finding points to a section that states a figure; 2 tests). Not deployed. Workaround used: regenerate section 3 with an instruction |
| 7 | M | M1 report text | Evidence file stems leak into donor text: "(01-A1.3-attendance)", "(01-A2.2-supervision)", also as a source for a recruitment-delay claim (supervision report cited for an officer's causal statement) | Open |
| 8 | M | M1 report text | Percentage indicators (ANC4+ 53% vs baseline 52, target 70) are shown as "% of target 75.7%" and the writer ranks "the strongest result against target was Penta3" — wrong yardstick for a % indicator with a high baseline; should be change from baseline / pp to target. The flag system did catch the ranking sentence | Open |
| 9 | M | M1 report text | Meta sentences in donor text: "the evaluation for each is neutral, so no performance judgement is recorded", "No finding could not be calculated", "No disaggregation list was recorded…" (system vocabulary leaks) | Open |
| 10 | M | M1 report | Section 2 (Progress Against Expected Results) and section 4 (Outcome Indicators) print the same 11-row table and near-identical narrative; section 3 reads monthly totals as one-day events ("On 20 October, the project held 20 outreach clinics") | Open |
| 11 | L | Regenerate section | Regeneration is silent: the old text stays visible for ~45 s, then changes, and the approved section returns to review without a message (demo 5 #10 still open) | Open |
| 12 | L | Compliance statement | A gender statement saying "70 percent of health workers trained" was accepted although no health worker was trained that month (my input error; no cross-check of compliance text against figures) | Info |
| + | - | M1 | Donor copy exported sealed with no watermark; self-approval by the author allowed (second-approver rule is off by default); evidence pack picker shows 7 verified files | OK |

Month 1 numbers: values 11 of 19 (8 legitimately not due: 3 quarterly/annual + no activity), 5 activities (files on form), 7 evidence files, report generated in 77 s, 8 sections.

## Fixes deployed during the run (commit 2d655af, release 20261007100617)
- `contradiction-lint.ts`: participle-only phrases ("N targeted") and time words ("N to date") are no longer a metric; a divergence finding points at a section that states one of the figures (was always section 1). 3 tests.
- Donor-text validator (`INTERNAL_ID`, Python + TS mirror): file names quoted without extension (`01-A1.3-attendance`, snake_case stems) are an integrity issue that earns the retry; table cases extended.
- Workflow vocabulary (Python + TS mirror): "performance judgement", "evaluation for each is neutral", "finding could not be calculated", "disaggregation list".
- Finding 6 status: Fixed (deployed). Finding 7 and 9: Fixed (deployed; verify on months 5+). Still open: 8 (percent indicators judged as % of target), 10, 11, 5.
- Month 2: two flagged statements on verified figures (a 11 female/4 male split and "2 of 3 facilities planned"); month 3: 1 sensitive file suggestion (expected); month 4: prior-month values quoted as "up from 53, 60 and 39 respectively" failed numeric assertion (VALUE_MISMATCH) until the section was regenerated.
- Deploy note: `deploy-fast.sh` takes more than 10 min end to end (pnpm store tar 205 MB, ~110 s xfer); do not wrap it in a 580 s timeout (the first attempt died at the Prisma regenerate step and had to be re-run whole).
- Months 1-4 approved and exported (Word donor copy).

## Pause for fixes (2026-10-07, after month 4) — all deployed, demo resumed at month 5
Commits 2d655af, a6c2f12, 469d885, + provisioner. Releases 20261007100617 … 20261007111835.
- Fixed: rate indicators (type PERCENTAGE or unit %) show "—" in "% of target" (table) and writer rule v5 says give value/baseline/target and change in points, never rank by % of target; v5 rule for previous-period quoting ("up from 53% in December", never "respectively"); v5 rule never to mention a NEUTRAL evaluation; compliance statements autosave 1.5 s after typing.
- Found: **prod ran writer contract v4**, so every v5 rule (not-measured block, structure block, grounding for lifeOfProject, my new rules) was off. `runtime-provisioner.ts` rewrites the env managed block on each api start with a hard-coded `AI_REPORTER_CONTRACT_VERSION=4`; changed to 5 (and tests). A hand edit of api.env/workers.env is reverted by the next deploy. The worker is not restarted by the provisioner: after a deploy that changes env, restart `donordesk-workers` and check `/proc/<pid>/environ`.
- Not fixed: sections 2 and 4 print the same indicator table (needs a logframe level on findings to split outcome vs output); section 3 treats a monthly total as a one-day event (activity form has one date); flagged-for-note on verified disaggregation (11 F / 4 M) and officer-stated causes (by design: causal claim needs a human).
- Month 5 (Feb) before/after: v4 draft had "% of target" on every rate and "no performance judgement" sentences; after the fixes the table shows "—" for rates and no file names appear.

## Outcome (2026-10-07)
All 12 reports approved and exported (11 monthly Word donor copies; the final report as Word, PDF, indicator workbook and evidence checklist, sealed, no watermark). Final: 22 sections, generated in 275 s, EUR 1,712,400 of 1,800,000 (95.1%) finance verified, MMR 131 vs target 120 reported as missed with the recorded causes, 4 outputs honestly below target. Checklist items (sign-off, sensitive data, procurement, disaggregation, AI review) were resolved in bulk with a note by the project-manager account: **attested by the demo, not by a person**.

### Lint false positives found and fixed (all deployed; each had a regression test; domain tests 493)
1. "N targeted" and "N to date" read as a metric. 2. finding pointed at section 1 instead of the section stating the figure. 3. sex-split counts ("chvs female male"). 4. noun phrase crossed a comma/figure ("220 of 240, and 20 volunteers"). 5. "percent against". 6. amounts in one currency (EUR). 7. a date written twice: only the first occurrence was exempt, so the second "2026-07-31" became the figure 31. One flagged figure was a **true catch**: March said "up from 1,500" when February's value was 1,600.
### Other fixes deployed
Rate indicators show "—" for % of target and a v5 rule says never rank by it; previous-value quoting rule; never mention a NEUTRAL evaluation; extension-less file stems and snake_case names are INTERNAL_ID; bookkeeping vocabulary; compliance statement autosave; provisioner now writes contract v5 (prod was on v4); `scrub.py` removes bookkeeping sentences and echoed donor questions deterministically (unit-tested; **not yet confirmed on a production report**: approved reports are locked, so it needs a fresh draft).
### Still open
- Sections 2 and 4 print the same indicator table; monthly totals read as one-day events (single activity date).
- Notes needed per report (target <= 1): 11 (Mar), 5, 8, 4, 4, 3 (Aug), 8 (final). Many are officer-stated causes, which by design need a human.
- Procurement checklist item does not close after a verified Procurement document is uploaded; "Review confidentiality" opens the whole evidence library rather than the cited file; the template's intro sentence became a checklist item ("Use the formal EU reporting register…"); the writer echoes the donor's mandatory questions.
- Reports list shows "Not started / Overdue" for periods whose report is approved and exported.
- Regenerating a section is silent for about a minute; the create form for an activity failed to save once without a message (A1.1, September) and passed on retry.
- Oct–Jan reports were written before the fixes (file stems 7–17 per report, % of target on rates) and were not regenerated.
- Drills not run: second approver block (no second login), worker timeout, typed ungrounded figure, cancelled period. The lint did catch two ungrounded figures for real.
### Rubric (0-2 each, 12 rows, target 20/24): grounding 2, honesty 2, template fit 1 (summary 236-335 words against a 250 limit in 8 of 12), EU register 1, specificity 1, no leaks 1 (stems fixed from Feb, bookkeeping remains), tables 1, gender/cross-cutting 2, continuity 1, visibility 2, flags 0, edit effort 1 = **15/24**.

## Phase 26 fix round (2026-10-07, after the run) — all implemented, committed, deployed
| Issue | Fix |
|---|---|
| Too many "keep with note" flags | `CausalReviewPolicy`: a cause stated by the officer's own record chunks (story, activity record) is not a new decision; recorded breakdowns also become a plain sentence ("Of the 15 staff, 11 female and 4 male") so the entailment check can match them |
| Summaries over a 250-word limit (8 of 12) | Retry feedback now asks for 90% of the limit; `trim_to_word_limit` drops figure-free sentences from the end as a last resort (a sentence with a figure is never dropped) |
| "No performance judgement" / echoed donor questions | `scrub.py` removes them before validation (deterministic) |
| Sections 2 and 4 print the same table | `VerifiedFinding.level` → `logframeLevel` → `_scoped_findings`: outcome section gets GOAL/OUTCOME rows, progress section the rest |
| Monthly totals as one-day events | v5 writer rule ("during the month, never on that date") |
| Procurement checklist item never closes | `DATA_SETTLED_ATTESTATIONS` + `verifiedProcurementDocumentCount` fact |
| Template style rule became a checklist item | `isWritingStyleRule` filter in `donorRequirementItems` |
| "Review confidentiality" opens the whole library | opens the period's compliance list when no single file is named |
| Lint blocker shows only "in the section X" | `referenceFor` shows the lint's own plain-language reason |
| Reports list "Not started / Overdue" for approved periods | nothing advanced `ReportingPeriod.status` (`transitionTo(status)` was a no-op); `advanceStatus` (forward only) on draft generation and approval. Periods created before this release stay at their old status until their next generation/approval |
| Worker keeps an old env after a deploy | `deploy-fast.sh` compares the worker's running `AI_REPORTER_CONTRACT_VERSION` with `workers.env` and restarts the worker on a mismatch |
**Dropped as not real:** "regeneration is silent" (a `RegenerationNotice` with a timer already shows; my script read the page too early) and the billing validation error (the page loads in production now). The activity create form that once did not save (September A1.1) could not be reproduced.
**Not done:** a CI corpus test over real report texts (the seven lint regression tests cover each false positive found); the activity form still takes a single date (a "whole month" option needs a schema change); Oct–Jan reports were not regenerated; the failure drills (second approver, worker timeout, cancelled period) were not run. API tests `billing`/`creem webhook`/`RBAC` need a live `DATABASE_URL` and fail without one (same failures on the commit before this round).
