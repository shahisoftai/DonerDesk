# Phase 27 — fixes from demo 8 (Nigeria WASH), implementation plan

**DonorDesk Version 2.001 → 2.002** · branch `0012-demo8-fixes` · source: [`../demo/verification-demo-8.md`](../demo/verification-demo-8.md) (29 findings, user assessment 7.4/10).

Goal: raise every user-facing score (relevance, usefulness, simplicity, ease of use, user-friendliness, trust, report quality, flexibility, speed, export, learning curve) by removing the blockers and friction found, without
weakening the existing invariants in `AGENTS.md`.

## Principles (SOLID applied to this work)
- **S** — one reason to change per unit: a rule lives in one pure domain function or one small service (transition table, grounding chunk builder, gate message table, export column set); UI components only render.
- **O** — extend by adding a row/rule, never by branching in a handler: new activity action = a row in `ACTIVITY_TRANSITIONS`; new blocker message = a row in the gate-message table; new grounded input = a new chunk source; new export column rule = a new column descriptor.
- **L** — new implementations honour the port contract (a repository still returns what its port promises; a replaced exporter still returns the same artifact type).
- **I** — small ports: new capabilities get a narrow port (`IActivityApprovalGuard`, `IReportStaleness`) instead of widening an existing fat one.
- **D** — application depends on ports; infrastructure implements them; the web app calls use cases through the existing gateway; no concrete adapter is imported in `packages/application`.
- Every change ships with a unit test beside the rule it changes; golden-pinned behaviour (readiness SUBMISSION formula, contract mirrors) stays green.

## Findings → root cause → fix (work packages)

### WP1 — Situation report integrity (demo 8 #15 #16 #17 #18 #20)
| Cause | Fix | Where |
|---|---|---|
| An affected-population row without a *Group* is silently dropped by `normalizeReportScope` (my "Figure 1" had no group) | Validate rows in the form and in `missingScopeFields`-style validation: a half-filled row is an error naming the row, never silently dropped | `report-scope.ts`, `ReportScopeFields.tsx`, create/update scope handlers |
| Scope figures, needs and summary are not record chunks, so the writer's quote of them is "unsupported" and the contradiction lint rejects it | Add the scope as record chunks (`record:scope:*`) and as lint-grounding figures | `record-chunk-builder.ts`, `lint-grounding.ts` |
| Zod path text shown to users (`scope: String must contain at most 200…`) | Map known field paths to the form's labels in one `fieldLabelFor(path)` table and show "Main needs: each line may be up to 200 characters" | web form-error helper |
| Situation window is a single day so activities/evidence "in this window" is 0 and the writer is told nothing was recorded | Optional "Event started on" field; window defaults to event start → as-of date; empty-window wording never claims records are missing | scope fields, `period-activities.ts` |
| Situation inputs page says "No indicators defined yet" | Show the project's indicators (or the real reason) | inputs page |

### WP2 — Blockers that guide wrongly (#8 #9 #22 #23)
| Cause | Fix |
|---|---|
| Gate `CONFIDENTIALITY_VIOLATION` is raised by the open checklist item "Sensitive data handling confirmed" but its message says a source is cited | Gate-message table row per cause: name the checklist item, action = "Open the checklist item" (deep link to the Compliance page filtered to that item). New `ConfidentialityCause` (`OPEN_ATTESTATION` \| `CITED_RESTRICTED_SOURCE`) |
| "Review confidentiality"/"Review files" open the unfiltered evidence library | Link to the Compliance page filtered (`?period=&item=`) or to the exact file when one is named |
| "No activity updates submitted for this period" stays open with accepted activities in the window | `DATA_SETTLED` state rule uses date-window membership as well as period id |
| Author sees an Approve button that always fails | Hide it and show "Another project manager or M&E officer must approve" when `checkApprover` would refuse (same function) |

### WP3 — Activity lifecycle (#13 #14 #28)
| Cause | Fix |
|---|---|
| Accepted records have no way back; UI only offers review for SUBMITTED | `canApplyActivityAction(status,"REQUEST_REVISION")` already allows ACCEPTED: add a "Reopen for correction" action for reviewers; resubmit panel also edits the logframe link (`logframeActivityId`) |
| Withdraw is refused for ACCEPTED | New transition row WITHDRAW from ACCEPTED guarded by `IActivityApprovalGuard` (refused when an approved report already used the record's period) |
| Withdrawn records counted and offered as link targets | `isOpenActivity`/counts and link pickers exclude WITHDRAWN (one shared selector) |
| Import template says "Output Code" but also accepts activity codes; unmatched codes are only a warning not shown | Rename to "Logframe Code (output or activity)", accept aliases, show import warnings and a pre-create preview |

### WP4 — Stale drafts and empty generation (#6 #7)
| Cause | Fix |
|---|---|
| "Re-check affected sections" only reassesses claims; tables built before verification stay | Banner gets two actions: "Re-check claims" and "Refresh figures and rewrite affected sections" (reuses section regenerate through `BackgroundRunner`) |
| Generating with 0 verified values has no confirmation | Confirmation dialog stating what is missing, only when 0 verified values |

### WP5 — Report text quality (#4 #10 #11 #12 #19 #24)
| Cause | Fix |
|---|---|
| Sub-sections "Outcome 1"/"Outcome 2" both match `"outcome" in title` and print the same rows | Findings carry `outcomeCode` (nearest outcome ancestor); `_scoped_findings` picks the rows whose outcome number matches the section title, outputs of that outcome included (Python + TS mirror of contract fields) |
| Finance prose says "in the quarter" for cumulative figures, no thousands separators, invents causes | `FinanceSummaryView.basis` (`PERIOD` \| `CUMULATIVE`) typed at entry, prompt block states the basis, numbers formatted with separators in the deterministic table and the writer rule v5 adds: never explain a variance unless the officer's note does |
| Workflow wording and file stems without numbers leak | Extend `WORKFLOW_VOCABULARY` ("reporting officer's account", "situation context", "inputs contain", "were not recorded") and make INTERNAL_ID reject any known evidence title/stem passed in the request (exact match, not pattern) |
| Donor name mangled ("Resilient Fund") | New deterministic check: any capitalised phrase that is one edit away from the donor name is replaced by the exact name (`restoreProperNouns`) |
| "Not measured" for an annual or not-yet-due indicator; "previous period" line in a Final | Only due indicators are listed as not measured (`isDueInPeriod`); roll-up reports skip the previous-period line |

### WP6 — Exports (#25 #26 #27)
| Cause | Fix |
|---|---|
| Spreadsheet prints % of target for rates and an empty life-of-project cell | `indicatorExportRow` uses the same `isRate` rule as the table: "—", and life-of-project shows the latest value for rates |
| Donor evidence checklist prints internal resolution notes | Donor copy omits the notes column; internal copy keeps it |
| ZIP holds only indexes and lists only the period's files | Pack includes the selected, non-sensitive files and, for roll-up reports, the project's evidence (`periodEvidenceMode`) |

### WP7 — First-run and setup friction (#1 #2 #3 + timings)
- Wizard: no silent Health/Kenya defaults — sector is a required, unselected choice; country/currency empty unless the tenant profile has them.
- Profile form: disabled until loaded (no silent loss of early input).
- Invitee: accept Terms on the invite page itself (no redirect dead-end).
- Template extraction: show the stages (reading file, finding sections, writing guidance) from the job status.

## Order of work and test gates
1. WP1 (domain + application + web) → 2. WP2 → 3. WP3 → 4. WP4 → 5. WP5 (TS + Python, contract mirror test) → 6. WP6 → 7. WP7.
Gate after each package: `pnpm --filter <pkg> build` for contracts → domain → application → infrastructure (tests run against `dist/`), package tests, `pnpm -r typecheck`; worker tests `cd apps/workers && .venv/bin/python -m pytest tests`.
Deploy only with the user's allowance (`SCOPE=both`); no migration is expected (additive optional fields live in JSON columns).

## Expected effect on the scores
| Factor | Before | Target | Main levers |
|---|---|---|---|
| Relevance | 9 | 9 | — |
| Usefulness | 8.5 | 9 | WP4, WP5 |
| Simplicity | 7.5 | 8.5 | WP7, WP2 |
| Ease of use | 7 | 8.5 | WP3, WP4, WP7 |
| User-friendliness | 6 | 8.5 | WP1, WP2 |
| Trust/accuracy | 8 | 9 | WP1, WP5 |
| Report quality | 7.5 | 9 | WP5 |
| Flexibility/control | 6.5 | 8.5 | WP3, WP4 |
| Speed/reliability | 8 | 8.5 | WP7 |
| Export/donor-readiness | 7 | 9 | WP6 |
| Learning curve | 6.5 | 8 | WP2, WP7 |

## Status (all seven work packages implemented, committed on `0012-demo8-fixes`; not deployed)
| WP | State | Notes |
|---|---|---|
| 1 Situation integrity | done | scope chunks + lint grounding, `scopeProblems`, labelled validation text (contracts), `eventStartDate`, no silent period in the activity form, empty-grid wording |
| 2 Blockers | done | confidentiality cause + target, `approverEligibility` hides Approve; the stale "No activity updates" item was a symptom of the period mis-assignment (WP1) |
| 3 Activity lifecycle | done | withdraw/reopen accepted unless an approved report used it, link edit on resubmit, `isLiveActivity`, import column + warnings. Not built: a pre-create import preview |
| 4 Stale drafts | done | banner "Rewrite affected sections", `generationWarning` |
| 5 Report text | done | per-outcome tables, not-due indicators, finance basis/separators, vocabulary and stems, exact donor name, no delta in roll-ups |
| 6 Exports | done | rate % of target, donor checklist notes, evidence pack files |
| 7 First run | done | wizard hints, hydration guard, terms on the invite page, PDF extraction time note |

Corrections to the demo-8 log found while fixing: the workbook's "Life of project" cell for rates was not empty (it holds the value), and the evidence pack's `index.csv` listed all 47 files (the real defect was that the files themselves were missing).

Verification: contracts 13, domain 527, application 462, infrastructure 340 (+1 skipped), web unit 280, worker 210 tests green; `pnpm -r typecheck` clean. Browser verification on production waits for a deploy (needs the user's allowance).
