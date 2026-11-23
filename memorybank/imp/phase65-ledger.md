# Phase 65 feature ledger

**DonorDesk Version 4.01** · generated 2026-11-23 · read by `apps/web/tests/unit/project-ledger.test.mts`

Every project route, stage page, Overview panel, project command, Record kind and wizard requirement has one row. A new one needs a row, or the test fails. Status: KEPT (same address or same behaviour), NEW, REDIRECT (the address answers with a redirect; never linked), MERGED-INTO. Nothing is removed. The older document wizard (`/projects/new/document`) is a REDIRECT to `/projects/new/wizard` (parity: documents, reading progress, left-out items, re-read a part and where-found all live in the wizard's own Start slide).

| Kind | Item | Today | Now | Status |
|---|---|---|---|---|
| route | `/activities/@panel/(.)plan/[itemId]` | Work plan item panel | Plan › Work plan (panel) | KEPT |
| route | `/activities/[activityId]` | Project tabs (Phase 55) | Collect › Activities done | KEPT |
| route | `/activities/import` | Project tabs (Phase 55) | Collect › Activities done | KEPT |
| route | `/activities/new` | Project tabs (Phase 55) | Collect › Activities done | KEPT |
| route | `/activities` | Project tabs (Phase 55) | Collect › Activities done | KEPT |
| route | `/activities/plan/[itemId]` | Project tabs (Phase 55) | Plan › Work plan | KEPT |
| route | `/activities/plan/export` | Project tabs (Phase 55) | Plan › Work plan | KEPT |
| route | `/activities/plan/import` | Project tabs (Phase 55) | Plan › Work plan | KEPT |
| route | `/activities/plan/new` | Project tabs (Phase 55) | Plan › Work plan | KEPT |
| route | `/activities/plan` | Project tabs (Phase 55) | Plan › Work plan | NEW |
| route | `/activities/plan/start` | Project tabs (Phase 55) | Plan › Work plan | KEPT |
| route | `/adaptations` | Project tabs (Phase 55) | Plan › Plan changes | KEPT |
| route | `/ask` | Project tabs (Phase 55) | Report › Ask DonorDesk | KEPT |
| route | `/beneficiaries` | Project tabs (Phase 55) | Collect › People reached | KEPT |
| route | `/charts` | Project tabs (Phase 55) | Report › Visuals (opens the Chart Studio) | REDIRECT → /visuals/charts/[id] |
| route | `/collect` | Project tabs (Phase 55) | Collect › Add data | NEW |
| route | `/compliance` | Project tabs (Phase 55) | Report › Donor rules | KEPT |
| route | `/data` | Project tabs (Phase 55) | Review › Data Center | KEPT |
| route | `/datasets` | Project tabs (Phase 55) | Collect › Data files | KEPT |
| route | `/enter` | Project tabs (Phase 55) | Collect › Enter data | KEPT |
| route | `/evidence/[evidenceId]` | Project tabs (Phase 55) | Collect › Files and evidence | KEPT |
| route | `/evidence/import` | Project tabs (Phase 55) | Collect › Files and evidence | KEPT |
| route | `/evidence/new` | Project tabs (Phase 55) | Collect › Files and evidence | KEPT |
| route | `/evidence` | Project tabs (Phase 55) | Collect › Files and evidence | KEPT |
| route | `/finance` | Project tabs (Phase 55) | Finance › Finance | KEPT |
| route | `/forms/[formId]/edit` | Project tabs (Phase 55) | Collect › Forms | KEPT |
| route | `/forms/[formId]` | Project tabs (Phase 55) | Collect › Forms | KEPT |
| route | `/forms/new` | Project tabs (Phase 55) | Collect › Forms | KEPT |
| route | `/forms` | Project tabs (Phase 55) | Collect › Forms | KEPT |
| route | `/import` | Project tabs (Phase 55) | Collect › Import | KEPT |
| route | `/indicators/[indicatorId]` | Project tabs (Phase 55) | Plan › Results framework | KEPT |
| route | `/infographics/[designId]` | Project tabs (Phase 55) | Home › Home | KEPT |
| route | `/infographics` | Project tabs (Phase 55) | Report › Visuals (opens the project library) | REDIRECT → /visuals/assets?project= |
| route | `/logframe/history` | Project tabs (Phase 55) | Plan › Results framework | KEPT |
| route | `/logframe/import` | Project tabs (Phase 55) | Plan › Results framework | KEPT |
| route | `/logframe/indicators/import` | Project tabs (Phase 55) | Plan › Results framework | KEPT |
| route | `/logframe/new-indicator` | Project tabs (Phase 55) | Plan › Results framework | KEPT |
| route | `/logframe/new` | Project tabs (Phase 55) | Plan › Results framework | KEPT |
| route | `/logframe` | Project tabs (Phase 55) | Plan › Results framework | KEPT |
| route | `/management-report` | Project tabs (Phase 55) | Report › Management report | KEPT |
| route | `/maps` | Project tabs (Phase 55) | Report › Visuals (opens the Maps studio) | REDIRECT → /visuals/maps/[id] |
| route | `(home)` | Project tabs (Phase 55) | Home › Home | KEPT |
| route | `/periods` | Project tabs (Phase 55) | Plan › Reporting periods | NEW |
| route | `/places` | Project tabs (Phase 55) | Plan › Places | KEPT |
| route | `/report-builder` | Project tabs (Phase 55) | Report › Tables | KEPT |
| route | `/reports/[periodId]/export` | Project tabs (Phase 55) | Report › Reports | KEPT |
| route | `/reports/[periodId]/indicators` | Project tabs (Phase 55) | Report › Reports | KEPT |
| route | `/reports/[periodId]/inputs` | Project tabs (Phase 55) | Report › Reports | KEPT |
| route | `/reports/[periodId]` | Project tabs (Phase 55) | Report › Reports | KEPT |
| route | `/reports/closing` | Project tabs (Phase 55) | Report › Reports | KEPT |
| route | `/reports/new` | Project tabs (Phase 55) | Report › Reports | KEPT |
| route | `/reports` | Project tabs (Phase 55) | Report › Reports | KEPT |
| route | `/review` | Project tabs (Phase 55) | Review › To review | NEW |
| route | `/settings` | Project tabs (Phase 55) | Settings › Project settings | KEPT |
| route | `/setup` | Project tabs (Phase 55) | Settings › Setup checklist | KEPT |
| route | `/setup/profile` | Project tabs (Phase 55) | Settings › Setup checklist | KEPT |
| route | `/team` | Project tabs (Phase 55) | Settings › Team | KEPT |
| route | `/templates/[templateId]/mapping` | Project tabs (Phase 55) | Report › Donor templates | KEPT |
| route | `/templates/[templateId]` | Project tabs (Phase 55) | Report › Donor templates | KEPT |
| route | `/templates/new` | Project tabs (Phase 55) | Report › Donor templates | KEPT |
| route | `/templates` | Project tabs (Phase 55) | Report › Donor templates | KEPT |
| route | `/visuals` | Project tabs (Phase 55) | Report › Visuals | REDIRECT → /visuals/assets?project= |
| stage-page | `(home)` |  | Home › Home | KEPT |
| stage-page | `/logframe` |  | Plan › Results framework | KEPT |
| stage-page | `/activities/plan` |  | Plan › Work plan | KEPT |
| stage-page | `/places` |  | Plan › Places | KEPT |
| stage-page | `/periods` |  | Plan › Reporting periods | KEPT |
| stage-page | `/adaptations` |  | Plan › Plan changes (More) | KEPT |
| stage-page | `/collect` |  | Collect › Add data | KEPT |
| stage-page | `/activities` |  | Collect › Activities done | KEPT |
| stage-page | `/evidence` |  | Collect › Files and evidence | KEPT |
| stage-page | `/forms` |  | Collect › Forms | KEPT |
| stage-page | `/datasets` |  | Collect › Data files | KEPT |
| stage-page | `/beneficiaries` |  | Collect › People reached (More) | KEPT |
| stage-page | `/enter` |  | Collect › Enter data (More) | KEPT |
| stage-page | `/import` |  | Collect › Import (More) | KEPT |
| stage-page | `/review` |  | Review › To review | KEPT |
| stage-page | `/data` |  | Review › Data Center | KEPT |
| stage-page | `/reports` |  | Report › Reports | KEPT |
| stage-page | `/templates` |  | Report › Donor templates | KEPT |
| stage-page | `/compliance` |  | Report › Donor rules | KEPT |
| stage-page | `/visuals` |  | Report › Visuals (More) | KEPT |
| stage-page | `/management-report` |  | Report › Management report (More) | KEPT |
| stage-page | `/report-builder` |  | Report › Tables (More) | KEPT |
| stage-page | `/ask` |  | Report › Ask DonorDesk (More) | KEPT |
| stage-page | `/finance` |  | Finance › Finance | KEPT |
| stage-page | `/setup` |  | Settings › Setup checklist | KEPT |
| stage-page | `/settings` |  | Settings › Project settings | KEPT |
| stage-page | `/team` |  | Settings › Team | KEPT |
| panel | `NEEDS_YOU` | Overview panel | Home (top 3) + Review | KEPT |
| panel | `PULSE` | Overview panel | Home panel | KEPT |
| panel | `CALENDAR` | Overview panel | Home panel | KEPT |
| panel | `REPORTING` | Overview panel | Home panel | KEPT |
| panel | `DELIVERY` | Overview panel | Home panel | KEPT |
| panel | `LOCATION` | Overview panel | Home › Customise (hidden by default) | KEPT |
| panel | `RESULTS` | Overview panel | Home panel | KEPT |
| panel | `TEAM` | Overview panel | Home › Customise (hidden by default) | KEPT |
| panel | `RISKS` | Overview panel | Home panel | KEPT |
| panel | `CLOSEOUT` | Overview panel | Home panel | KEPT |
| panel | `SETUP` | Overview panel | Home › Customise (hidden by default) | MERGED-INTO setup checklist (panel kept) |
| command | `p.overview` | Project home | Project home | KEPT |
| command | `p.plan` | Work plan | Work plan | KEPT |
| command | `p.logframe` | Results framework and logframe | Results framework and logframe | KEPT |
| command | `p.periods` | Reporting periods | Reporting periods | KEPT |
| command | `p.collect` | Add data to this project | Add data to this project | KEPT |
| command | `p.review` | To review on this project | To review on this project | KEPT |
| command | `p.data` | Data Center | Data Center | KEPT |
| command | `p.enter` | Enter data for this project | Enter data for this project | KEPT |
| command | `p.import` | Import a file into this project | Import a file into this project | KEPT |
| command | `p.activities` | Activities done in this project | Activities done in this project | KEPT |
| command | `p.evidence` | Evidence of this project | Evidence of this project | KEPT |
| command | `p.upload` | Upload evidence to this project | Upload evidence to this project | KEPT |
| command | `p.reports` | Reports of this project | Reports of this project | KEPT |
| command | `p.new-report` | Start a new report for this project | Start a new report for this project | KEPT |
| command | `p.rules` | Donor rules of this project | Donor rules of this project | KEPT |
| command | `p.places` | Where we work (places and map) | Where we work (places and map) | KEPT |
| command | `p.finance` | Finance of this project | Finance of this project | KEPT |
| command | `p.team` | Team of this project | Team of this project | KEPT |
| command | `p.map` | Map of this project | Map of this project | KEPT |
| command | `p.checklist` | Setup checklist of this project | Setup checklist of this project | KEPT |
| command | `p.settings` | Project settings | Project settings | KEPT |
| record-kind | `PLACE` | Record sheet | Record sheet + Collect › Add data | KEPT |
| record-kind | `NUMBER` | Record sheet | Record sheet + Collect › Add data | KEPT |
| record-kind | `ACTIVITY` | Record sheet | Record sheet + Collect › Add data | KEPT |
| record-kind | `FILE` | Record sheet | Record sheet + Collect › Add data | KEPT |
| record-kind | `EXPENSE` | Record sheet | Record sheet + Collect › Add data | KEPT |
| record-kind | `FORM` | Record sheet | Record sheet + Collect › Add data | KEPT |
| requirement | `start.donor` | Wizard slide START | Before launch | KEPT |
| requirement | `start.sector` | Wizard slide START | Before launch | KEPT |
| requirement | `start.country` | Wizard slide START | Before launch | KEPT |
| requirement | `project.facts` | Wizard slide PROJECT_TEAM | Before launch | KEPT |
| requirement | `project.manager` | Wizard slide PROJECT_TEAM | Before launch | KEPT |
| requirement | `project.me` | Wizard slide PROJECT_TEAM | After launch (advice, setup checklist) | KEPT |
| requirement | `project.partners` | Wizard slide PROJECT_TEAM | After launch (advice, setup checklist) | KEPT |
| requirement | `results.decided` | Wizard slide RESULTS | Before launch | KEPT |
| requirement | `results.chain` | Wizard slide RESULTS | Before launch | KEPT |
| requirement | `results.codes` | Wizard slide RESULTS | Before launch | KEPT |
| requirement | `results.reasoning` | Wizard slide RESULTS | Before launch | KEPT |
| requirement | `indicators.decided` | Wizard slide INDICATORS | Before launch | KEPT |
| requirement | `indicators.perOutput` | Wizard slide INDICATORS | Before launch | KEPT |
| requirement | `indicators.placed` | Wizard slide INDICATORS | Before launch | KEPT |
| requirement | `indicators.complete` | Wizard slide INDICATORS | Before launch | KEPT |
| requirement | `indicators.owners` | Wizard slide INDICATORS | After launch (advice, setup checklist) | KEPT |
| requirement | `indicators.direction` | Wizard slide INDICATORS | Before launch | KEPT |
| requirement | `places.decided` | Wizard slide PLACES | After launch (advice, setup checklist) | KEPT |
| requirement | `places.area` | Wizard slide PLACES | After launch (advice, setup checklist) | KEPT |
| requirement | `plan.decided` | Wizard slide WORK_PLAN | After launch (advice, setup checklist) | KEPT |
| requirement | `plan.coverage` | Wizard slide WORK_PLAN | After launch (advice, setup checklist) | KEPT |
| requirement | `plan.complete` | Wizard slide WORK_PLAN | After launch (advice, setup checklist) | KEPT |
| requirement | `plan.indicators` | Wizard slide WORK_PLAN | After launch (advice, setup checklist) | KEPT |
| requirement | `plan.indicatorFed` | Wizard slide WORK_PLAN | After launch (advice, setup checklist) | KEPT |
| requirement | `entry.methods` | Wizard slide DATA_ENTRY | After launch (advice, setup checklist) | KEPT |
| requirement | `entry.review` | Wizard slide DATA_ENTRY | After launch (advice, setup checklist) | KEPT |
| requirement | `reporting.cadence` | Wizard slide REPORTING | Before launch | KEPT |
| requirement | `reporting.rules` | Wizard slide REPORTING | After launch (advice, setup checklist) | KEPT |
| requirement | `finance.funding` | Wizard slide FINANCE | After launch (advice, setup checklist) | KEPT |
| requirement | `finance.budget` | Wizard slide FINANCE | After launch (advice, setup checklist) | KEPT |
| requirement | `finance.reconcile` | Wizard slide FINANCE | After launch (advice, setup checklist) | KEPT |
| requirement | `launch.risks` | Wizard slide LAUNCH | After launch (advice, setup checklist) | KEPT |
| requirement | `launch.assumptions` | Wizard slide LAUNCH | After launch (advice, setup checklist) | KEPT |
| requirement | `launch.dashboard` | Wizard slide LAUNCH | After launch (advice, setup checklist) | KEPT |
