# Operational notes: demo 7 (EU / Ghana, 12-month health project) and the fixes it produced

Written 2026-10-07. Audience: engineers and operators of DonorDesk. Companion files: `demo/verification-demo-7-reference.md` (plan and data), `demo/verification-demo-7.md` (run log and findings), `AGENTS.md` ("Phase 26 invariants").

## 1. What was run

A 12-month, EUR 1.8M EU-funded health project in Northern Ghana was built on production (`donordesk.online`, tenant GEC) through one visible browser, as a tenant would: project, logframe (23 items), 19 indicators, two EU donor templates (monthly, 8 sections; final, 22 sections), team, 11 monthly periods plus a closing report, about 55 activity records, about 130 synthetic evidence files, finance for the final period.

Result: 11 monthly reports and the final report were approved and exported (Word donor copies, no watermark; the final also as PDF, indicator workbook and evidence checklist). Project id `2b7659cf-8938-4c5a-b0ac-95ea73de9ae4`. The rubric score (12 rows, 0-2 each) was **15/24** against a target of 20, measured before the last fix round.

Honest limits of the result:
- The final checklist items were resolved in bulk by the project-manager account with a note: attested by the demo, not by a person.
- Oct-Jan reports were written before the fixes below and were not regenerated (file names in text, "% of target" on rates).
- Failure drills (second approver, worker timeout, cancelled period) were not run.

## 2. Issues found and what was done

| # | Issue | Cause | Fix (deployed) |
|---|---|---|---|
| 1 | Reports could not be approved: "A reported figure doesn't match your approved data", nothing to fix, Approve did nothing | The contradiction lint (`contradiction-lint.ts`) read "120 targeted / 6,000 targeted" as one metric with three values (`SAME_METRIC_DIVERGENCE`) and attached the finding to section 1 | Participles ("targeted"), time words ("to date"), comparison words ("against"), sex groups and currency words are never a metric; the noun phrase stops at the next figure or clause break; a finding points at a section that states a figure |
| 2 | Same blocker kept returning in other months | Seven separate false positives: "N targeted", "to date", sex-split counts, a phrase crossing a comma, "percent against", EUR amounts, and a date written twice (only the first occurrence was exempt, so the second "2026-07-31" became the figure 31) | One fix and one regression test each (`contradiction-lint.test.mjs`) |
| 3 | A real error caught | March said "up from 1,500" when February was 1,600 | Lint was right; section regenerated. No change needed |
| 4 | Production ran writer contract **v4**, so every v5 rule was off | `runtime-provisioner.ts` hard-coded `AI_REPORTER_CONTRACT_VERSION=4` and rewrote the env on every api start (a hand edit was reverted by the next deploy) | Provisioner now writes 5; `deploy-fast.sh` compares the worker's running env with `workers.env` and restarts the worker on a mismatch |
| 5 | File names in donor text ("01-A1.3-attendance") | INTERNAL_ID only matched names with an extension | Numbered stems with an activity code and snake_case stems are INTERNAL_ID (Python + TS mirror, shared test table) |
| 6 | Rates judged as "% of target" ("strongest result against target") | The table and writer treated every indicator alike | Rate indicators (type PERCENTAGE or unit %) show "-" in the % of target columns; v5 rule: value, baseline, target and change in points, never rank |
| 7 | "Up from 53, 60 and 39 respectively" failed the numeric check | Prior values listed together | v5 rule: a previous value only beside its own indicator |
| 8 | "Every finding carries a neutral evaluation, so the report records no performance judgement"; donor questions echoed as headings | The writer narrated tool bookkeeping and the template | v5 rule plus `scrub.py` removes these sentences deterministically before validation |
| 9 | Summaries over the 250-word limit in 8 of 12 months | Retry feedback was weak and a still-long text was kept | Retry asks for 90% of the limit; `trim_to_word_limit` drops figure-free sentences from the end as a last resort (never a sentence with a figure) |
| 10 | 3-11 "keep with a note" decisions per report (target 1 or fewer) | Causal claims always needed a human; sex splits were not matched | `CausalReviewPolicy`: a cause the officer's own record chunks state needs no extra decision; recorded breakdowns also stated as a sentence ("Of the 15 staff, 11 female and 4 male") |
| 11 | Sections 2 and 4 printed the same indicator table | No logframe level on findings | `VerifiedFinding.level` -> `logframeLevel` -> `_scoped_findings`: outcome/impact section gets GOAL/OUTCOME rows, a sibling progress section the rest |
| 12 | Monthly totals written as one-day events ("On 20 October the project held 20 clinics") | One date per activity record | v5 rule, then the real fix: optional `activityEndDate` (form "Through (optional)" + "End of month", list/detail show the range, writer gets `endDate`) |
| 13 | Reports list showed "Not started / Overdue" for approved periods | Nothing advanced `ReportingPeriod.status` (`transitionTo(status)` was a no-op) | `advanceStatus` (forward only) on draft generation and approval |
| 14 | Procurement checklist item stayed open after a verified procurement document | It was a pure attestation | `DATA_SETTLED_ATTESTATIONS`: a verified procurement document settles it (still an attestation otherwise) |
| 15 | A template's writing-style sentence became a checklist item | Extractor filed it under compliance | `isWritingStyleRule` keeps pure style rules out of the checklist |
| 16 | Lint blocker said only "in the section X"; "Review confidentiality" opened the whole evidence library | Generic text and link | The check shows the lint's own reason; the link opens the period's compliance list |
| 17 | Compliance statement field lost text typed before leaving the page | Saved only on blur | 1.5 s debounced autosave |
| 18 | Deploy script produced a half-updated host once | My 580 s timeout killed `deploy-fast.sh` at the Prisma regenerate step | Not a code fault; see section 4 |

Dropped as not real: "regeneration is silent" (a timer notice already shows; my script read too early) and the billing validation error (the page loads in production now). One activity create that did not save (September, A1.1) could not be reproduced.

## 3. Open issues and recommendations

Ordered by value.

1. **Flag volume is still unmeasured after the fix.** Re-run a short demo (3 months, ideally 2 with story-stated causes and sex splits) and count notes per report; target is 1 or fewer. If the count stays high, look at `retrieveEvidence` in `claim-verifier.ts` (which record chunks reach the entailment check) before loosening any policy.
2. **Confirm the scrub, trim, outcome/output split and end-date wiring on a fresh production draft.** They are unit-tested but approved reports are locked, so none was seen on live output. Make this the first check of the next demo.
3. **Regenerate the Oct-Jan reports** (or accept them as pre-fix evidence) before treating the demo project as a reference.
4. **Edit and import for the end date.** `activityEndDate` exists only on create. Add it to the activity edit path, the CSV importer (`ImportActivitiesForm`, `import-activities.ts`) and the field-report extraction. Existing records keep a single date.
5. **Backfill period status.** `advanceStatus` only runs on the next generation or approval, so older periods still read "Not started". A one-off update (period has an approved draft -> APPROVED, has a draft -> DRAFT_GENERATED) would fix the list at once.
6. **Add `UNDER_REVIEW`.** `SubmitReportForReviewHandler` has no period repository, so the status skips from DRAFT_GENERATED to APPROVED.
7. **Failure drills not yet exercised:** second-approver block (needs a second login), worker timeout / fallback labelling, a typed ungrounded figure, cancel and restore of a period. Run them once with two test accounts.
8. **Regression corpus for the lint.** Each false positive has its own test, but a corpus of real report texts (the demo's 12) run through the lint in CI would catch the next one before a user does. Keep the texts small and scrub names.
9. **Lint design.** `SAME_METRIC_DIVERGENCE` is a heuristic on a noun phrase and produced seven false positives. Consider downgrading it to a warning unless the numbers are in the same sentence form (same noun, same basis, different values in different sections) and a verified finding disagrees; the grounded-figure check (`PROSE_VALUE_NOT_IN_VERIFIED_DATA`) already protects against invented numbers.
10. **Checklist and compliance flow.**
    - Compliance statements the template asks for are filled per template section and the mapping is not obvious (the final template asked for "Sustainability", "Risks and Assumptions", "Sustainability and Exit Strategy", not the cross-cutting section I expected). Show which template section each statement feeds and what the report will say.
    - Bulk "Resolve" of attestations works but nothing stops the same person who wrote the report from attesting everything; the second-approver rule (profile) is off by default.
11. **Template extraction time.** The 22-section final template took about 5 minutes with only "Analysing..." shown. Show progress or elapsed time.
12. **AI usage visibility.** Reading the server log was still needed twice (lint detail, worker env). The checks panel now shows the lint's reason; consider surfacing per-section generation outcome (retry used, trimmed, scrubbed) next to the section.
13. **The `trust` rule in `pg_hba.conf` and `0.0.0.0:5432`** remain standing risks recorded in `contabo-ops.md` section 8.1; migrations were applied through that unauthenticated local connection again. Tighten in a separate, approved pass.

## 4. Operating procedures learned

- **Deploy:** `scripts/deploy-fast.sh` takes 10-13 minutes (a 205 MB pnpm store tar and about 110 s transfer). Run it with `nohup` and poll the log for `==> Done`; never wrap it in a timeout. Use `SCOPE=api` (ships the worker) or `both` (adds web).
- **Schema changes:** copy the new migration folder to `/opt/donordesk/app/packages/infrastructure/prisma/migrations/`, run `prisma migrate deploy` on the host with `DATABASE_URL=postgresql://donordesk_migrator@127.0.0.1:5432/donordesk`, then deploy the code; add the new field to `REQUIRED_PRISMA_FIELDS` in `apps/api/src/routes/health.ts` in the same change. A nullable additive column is safe to apply before the code.
- **Writer contract:** production is v5. After any deploy that changes env, confirm `/proc/<donordesk-workers pid>/environ` shows `AI_REPORTER_CONTRACT_VERSION=5` (the deploy script now does this and restarts the worker on a mismatch). Hand edits to `api.env` / `workers.env` are reverted by the provisioner on the next api start.
- **Locked reports:** an approved report cannot be regenerated (correct). To test a writer change on live output you need a new period or an unapproved draft.
- **Browser demos:** Chromium needs `--disable-gpu` here and `localhost` resolves to `::1`, so use `http://127.0.0.1:9333`. One script per page at a time (lock file `/tmp/donordesk-demo-ui.lock`). Credentials are passed through the environment of the single command, never written down.
- **Shell traps:** `pkill -f` / `pgrep -f` with a pattern that appears in the command line kills the calling shell (exit 144); this happened three times. List with `ps | grep | awk` and kill by pid. A looped background job keeps spawning the next step after its child is killed: kill the parent loop first.
- **Tests that need a database:** three API tests (`billing summary`, `creem webhook`, `sensitive read routes RBAC`) fail without a live `DATABASE_URL`; they fail identically on the commit before this work.

## 5. Where things are

| What | Where |
|---|---|
| Demo plan, data, rubric | `memorybank/demo/verification-demo-7-reference.md` |
| Run log, findings, fix tables | `memorybank/demo/verification-demo-7.md` |
| Scripts (single data source `plan7.mjs` + `data.mjs`; `month.sh`, `full.sh`) | `scripts/demo-health-gh/` |
| Generated evidence and templates | `memorybank/demo/verification-demo-7-artifacts/` |
| Standing invariants | `AGENTS.md`, section "Phase 26 invariants" |
| Key code | `packages/domain/src/contexts/reporting/contradiction-lint.ts`, `apps/workers/app/ai_reporter/{scrub,artifact_builder,pipeline,writer_contract}.py`, `packages/infrastructure/src/llm/{claim-verifier,verifier-strategies}.ts`, `packages/application/src/services/{record-chunk-builder,indicator-analytics-service}.ts`, `packages/infrastructure/src/platform/runtime-provisioner.ts`, `scripts/deploy-fast.sh` |
