# Project Creation Wizard: required information and CBPF proposal audit

**Date:** 2026-11-05
**Source document:** `Temp/CBPF-SOM-25-S-NGO-37159.docx` (CBPF Somalia, Standard Allocation 2 2025 PILOT, Youth In Action Baidoa, "Life-Saving Flagship WASH Response")
**Code read:** `packages/domain/src/contexts/project-setup/pcw/` (slides, requirements, draft, launch)
**Written for:** the product team, to see what the wizard needs and what this proposal does and does not supply.

Status key used below: **Stated** (the document says it), **Derived** (computed from stated figures, checked), **Inferred** (my suggestion, not in the document; a person must confirm), **Missing** (not in the document; a person must decide or supply it).

---

## 1. Summary

- The wizard has **10 slides** and **32 requirement rules** (counted in `requirements/*.ts`). A launch is refused until every rule is met or answered "not used", and a sign-off is given.
- The proposal fills the **Start**, **Project identity**, **Finance total** and **Location** slides well. It leaves the **results framework, indicators, work plan, team roles, data-entry methods, reporting rules and risk ratings** empty or as template text. Those must be entered in the wizard.
- **Most important issue:** the project period (01-Sep-2025 to 28-Feb-2026) **ended before today (2026-11-05)**. A launch would create a project already past its end, with every reporting period in the past. Confirm first whether this is a record of a finished project or a new one with wrong dates.
- The arithmetic in the budget, the sector split, the protection figure and the gender shares all check out (section 6).

---

## 2. Information the wizard needs

### 2.1 Requirement rules (what must hold before Launch)

| Slide | Requirement key | What it needs | Rule code if open | "Not used" allowed |
| --- | --- | --- | --- | --- |
| 1 Start | `start.donor` | Donor chosen | `donorMissing` | No |
| 1 Start | `start.sector` | Sector chosen | `sectorMissing` | No |
| 1 Start | `start.country` | Country chosen | `countryMissing` | No |
| 2 Project and team | `project.facts` | Name, code, start date, end date, currency (all accepted); end after start | `factsMissing`, `datesOrder` | No |
| 2 Project and team | `project.manager` | A team member with role PROJECT_MANAGER | `managerMissing` | No |
| 2 Project and team | `project.me` | A team member with role ME_OFFICER | `meMissing` | No |
| 2 Project and team | `project.partners` | Partners named, or "no outside partners" | `partnersMissing` | Yes |
| 3 Results framework | `results.decided` | Every proposed result decided (accepted, edited or rejected) | `resultsUndecided` | No |
| 3 Results framework | `results.chain` | Non-empty; every outcome has an output; every output has an activity | `resultsEmpty`, `resultsBroken` | No |
| 3 Results framework | `results.codes` | Every result has a code; generated codes confirmed | `codesUnconfirmed` | No |
| 4 Indicators | `indicators.decided` | Every indicator decided | `indicatorsUndecided` | No |
| 4 Indicators | `indicators.perOutput` | Non-empty; every output has an indicator | `indicatorsEmpty`, `outputWithoutIndicator` | No |
| 4 Indicators | `indicators.complete` | Type, frequency, target, and baseline (or "no baseline") | `indicatorIncomplete` | No |
| 4 Indicators | `indicators.owners` | Each indicator has an owner on the team | `indicatorWithoutOwner` | No |
| 4 Indicators | `indicators.direction` | Direction (higher/lower is better) confirmed | `directionUnconfirmed` | No |
| 5 Places | `places.decided` | At least one place; every place decided | `placesEmpty`, `placesUndecided` | Yes (via the place answer) |
| 5 Places | `places.area` | Project area set | `projectAreaMissing` | Yes |
| 6 Work plan | `plan.decided` | Every planned item decided | `planUndecided` | No |
| 6 Work plan | `plan.coverage` | Non-empty; every logframe activity has planned work | `planEmpty`, `activityWithoutPlan` | No |
| 6 Work plan | `plan.complete` | Each planned item has dates, a place (or "project-wide"), and a lead on the team | `planIncomplete` | No |
| 6 Work plan | `plan.indicators` | Each planned item feeds an indicator (or "feeds none") | `planWithoutIndicator` | Yes |
| 6 Work plan | `plan.indicatorFed` | Every indicator is fed by a plan item, or has its own collection method | `indicatorNotFed` | No |
| 7 Data entry | `entry.methods` | Every indicator has a collection method | `methodMissing` | No |
| 7 Data entry | `entry.review` | Review mode (simple or full) and entry-window rule set | `reviewModeMissing`, `windowRuleMissing` | No |
| 8 Reporting | `reporting.cadence` | Cadence chosen, or periods typed | `cadenceMissing` | No |
| 8 Reporting | `reporting.rules` | At least one report-type rule, each with a template and a due-date rule | `reportRulesMissing`, `reportRuleIncomplete` | No |
| 9 Finance | `finance.funding` | At least one funding line with amount and currency. Answering "not used" switches off the whole finance slide | `fundingMissing` | Yes (switch) |
| 9 Finance | `finance.budget` | Every budget row decided and linked to a planned activity or "support line" | `budgetUndecided`, `budgetLineUnlinked` | Yes |
| 9 Finance | `finance.reconcile` | Reporting currency set; budget agrees with funding, or the difference is acknowledged | `reportingCurrencyMissing`, `budgetDiffers` | Yes |
| 10 Launch | `launch.risks` | Every risk decided; at least one risk; every risk rated for seriousness | `risksUndecided`, `risksMissing`, `risksUnrated` | Yes |
| 10 Launch | `launch.assumptions` | At least one assumption (kind ASSUMPTION) | `assumptionsMissing` | Yes |
| 10 Launch | `launch.dashboard` | A dashboard template chosen | `dashboardMissing` | Yes |

Launch also needs a **sign-off** by the creator (`SIGN_OFF_MISSING`), and the sign-off goes stale after any change (`SIGN_OFF_STALE`). A second approver applies where the organisation requires one.

### 2.2 Information the wizard asks for that is not a rule

These are optional or stored for later. They do not block Launch.

- **Identity:** time zone (defaults to the organisation's), programme, grant, award number, summary, external/organisation project code.
- **Team:** name, email (needed to invite), role, external (partner) flag, invite now or later, for each person.
- **Places:** name, admin level, parent, coordinates or pin, project-area and boundary level.
- **Work plan:** planned-activity code, group, lead, required files, records-participants flag.
- **Finance:** disbursements, deliverables, advances, exchange rates, expense approver, separate-approver toggle. These stay on the Finance page after Launch.
- **Reporting:** author and reviewer per report type (optional), reminders on or off.
- **Launch:** compliance checklist items, the starting dashboard preview, invitations.

### 2.3 Setup steps the wizard does not ask for (deferred, with reasons)

From `DEFERRED_STEPS` and `AUTOMATIC_STEPS` in `requirements/index.ts`:

| Step | Item | Status |
| --- | --- | --- |
| 10 | Donor indicator mapping | Done on the Logframe page after Launch |
| 29 | Finance approver | No named approver in the product; follows roles |
| 34 | Collection links and partner access | Created on demand after Launch |
| 36, 37 | Evidence confidentiality default and exceptions | Chosen per file when added |
| 39 | Checklist | Generated from the data and donor requirements |
| 6, 35, 44–47 | Sign-off gate, Drive folder tree, review, checks, sign-off, start | Done by Launch itself |

Also not written by Launch (listed to the person as `notWrittenAtLaunch`): indicator owners and activity leads (they need people who have joined), report approvers and verifier, required files, checklist items, the starting dashboard, the evidence default, and whole-project budget lines.

---

## 3. CBPF proposal: field-by-field fill-in

### Slide 1: Start

| Field | Value | Status | Source in document |
| --- | --- | --- | --- |
| Donor | CBPF Somalia (Somalia Humanitarian Fund, "SHF") | Stated, but the document uses two names; confirm | Title block; §1.1; §2.6; §3 |
| Sector | Water, Sanitation and Hygiene (WASH) | Stated | Sector table, 100% |
| Country | Somalia | Stated | Title block |
| Default pack | WASH (sector pack, fill-only) | Inferred from sector | n/a |
| Documents | This proposal | n/a | n/a |

### Slide 2: Project and team

| Field | Value | Status | Source |
| --- | --- | --- | --- |
| Project name | Life-Saving Flagship WASH Response: Community-Driven Water, Sanitation, and Hygiene Services for Crisis-Affected Populations | Stated | Title; §1.5 |
| Project code | CBPF-SOM-25-S-NGO-37159 | Stated | Title block; §1.2 |
| External / organisation code | Blank | Missing (optional) | §1.3 |
| Organisation sequence | Blank | Missing (optional) | §1.4 |
| Start date | 01-Sep-2025 | Stated | §1.7 |
| End date | 28-Feb-2026 | Stated; **already past** (see §5, item 1) | §1.7 |
| Duration | 6 months | Derived (Sep to Feb) | §1.8 |
| Currency | USD | Stated ("US$", "$") | §2.1 |
| Time zone | Not stated; defaults to the organisation's | Missing (optional) | n/a |
| Summary | §1.6 text. Contains an unfilled "[insert target districts/regions]" | Stated, needs editing (placeholder inside the text) | §1.6 |
| Programme, grant, award number | Not stated | Missing (optional) | n/a |
| Partners | No sub-partners ("Sub-grants and sub-partners" table is empty). Answer: "no outside partners" | Stated as empty; the person confirms the answer | §18 |
| Project manager (team role) | Not stated. Focal point is Abdullahi Hudow Osman (youthinactionbaidoa@gmail.com); his role is not stated | **Missing** (decision: person and role) | §3 |
| M&E lead (team role) | Not stated. The document mentions "M&E officer" and "M&E" staff but no name | **Missing** | §17.2 |
| Other team | Facilitators, coordinators, two mobilisers to be recruited in two weeks | Stated as roles, no names; add as roster entries or leave "invite later" | §17.2 |

### Slide 3: Results framework

| Field | Value | Status | Source |
| --- | --- | --- | --- |
| Goal | Not stated. §4 says "To be completed after identification of priority interventions" | **Missing** (template text) | §4 |
| Outcome 1 | Template text: "To be completed after identification of priority interventions." | **Missing** | §4 |
| Output 1.1 | Template text, no description | **Missing** | §4 |
| Activity 1.1.1 | "Standard Activity: Not Selected"; description template text | **Missing** | Output 1.1 activities table |
| Logframe codes | None valid (template codes) | **Missing**; the wizard will generate codes and the person must confirm them | n/a |
| Cluster / HRP objectives | SO1 2025 and SO2 are HRP objectives, not project outcomes | Stated as context only; do not enter as outcomes | §4 |
| Contribution to cluster objectives | Template text | **Missing** | §4 |

Note: the logframe is blank. The wizard can only propose it from the narrative. The narrative names activities (water trucking, borehole rehabilitation, gender-segregated latrines, hygiene kits, hygiene promotion, community engagement), which are the basis for a result chain. That chain is **Inferred** and must be built and confirmed by a person.

### Slide 4: Indicators

| Indicator | Type / unit | Baseline | Target | Frequency | Direction | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Outcome indicator 1.1 (Custom) | Template row, all zeros; text is "To be completed" | Not stated | 0 (template) | Not stated | Not stated | Missing | **Missing**; no real indicator |
| Indicator 1.1.1 (Standard, WASH cluster): "Number of people reached with emergency water services in vulnerable settlements and communities" | Number of people (standard indicator); type and unit inferred | Not stated | **0 in the table, but 13,500 people directly targeted in §7** (conflict, see §5) | Not stated; reporting cadence likely (see slide 8) | Higher is better (inferred: a reach count) | Missing | **Stated indicator; target conflicts** |
| Disaggregation | Sex, age, disability, minority status | n/a | n/a | n/a | n/a | n/a | Stated in §13.10 and §17.6 |
| Female participation | "At least 50% female participation" | n/a | 50% (stated in §14.3, not in a field) | n/a | n/a | n/a | Stated as text; the wizard has no field for it, so enter as a target by group or a note |
| Formula, donor mapping, targets by group | Not stated | n/a | n/a | n/a | n/a | n/a | Missing (optional; done after Launch) |

### Slide 5: Places

| Place | Stated as | Status |
| --- | --- | --- |
| Baidoa (district) | "Baidoa Somalia > Bay > Baidoa > Baidoa" in the location table; "Baidoa District" in §2.4 | Stated |
| Baydhaba | Same town, written in the narrative ("Baydhaba and surrounding pastoralist satellite villages") | **Duplicate** of Baidoa; the wizard should match both to one place |
| Bay (region) | Parent of Baidoa in the location table | Stated |
| Somalia (country) | Top level | Stated |
| Rural pastoralist satellite villages; IDP sites | Named only as groups, no names | **Missing** (decision: name them or use "project-wide") |
| Project area | "Baidoa District, Bay" | Derived from the location table; confirm |
| Boundary level | Not stated; Baidoa is a district (level 2 by Somalia's structure is an inference) | **Inferred**; confirm |
| Coordinates | Not stated | Missing (optional; use the gazetteer or pin) |

Location budget: $500,000.30, people target 100% (§ Locations table).

### Slide 6: Work plan

| Item | Stated | Status |
| --- | --- | --- |
| Period | Sep-2025 to Feb-2026, six months, all marked active (X in each month) | Stated (grid) |
| Planned activity "Activity 1.1.1" | Placeholder title "To be completed…"; grid shows the whole period | **Missing** (placeholder) |
| Activities named in the narrative | Emergency water trucking; borehole rehabilitation; gender-segregated emergency latrines; hygiene kit distribution; hygiene promotion (cholera, safe water, sanitation); community engagement and consultations (FGDs, assemblies, ranking); recruitment of two community mobilisers (within 2 weeks); training and consultations (within 4 weeks); CEP finalisation and submission (week 5); procurement of training, IEC and logistics | **Inferred** from §2.5, §17.2 and §13. Each needs dates, a place, a lead and indicator links from a person |
| Dates | Given for the overall period only; in-period milestones given as weeks | Partly stated |
| Leads | Not stated | Missing |
| Files needed | Not stated (attendance sheets, session reports, feedback forms are the stated tools, §17.6) | Inferred as required files for the consultation activities |
| Records participants | Yes, participation is tracked by sex, age, disability and minority status (§17.6) | Stated |

### Slide 7: Data entry system

| Item | Stated | Status |
| --- | --- | --- |
| Collection method per indicator | Not stated. Tools are attendance sheets, session reports and feedback forms; facilitators collect data daily; M&E officer compiles weekly (§17.6) | Inferred as **form** for participation; person must choose |
| Review mode | Not stated | **Missing** (simple or full) |
| Entry-window rule | Not stated. Reports due at mid-point and closure | **Missing** |
| Evidence needed | Attendance sheets, session reports, feedback forms | Stated as tools; confirm as evidence |
| Confidentiality | Feedback includes confidential SEA and protection complaints (§13.11, §13.12) | Stated; a per-file choice when files are added, not set in the wizard |

### Slide 8: Reporting schedule

| Item | Stated | Status |
| --- | --- | --- |
| Cadence | Reports at **mid-point and closure** (§17.6), which for six months is one mid-point report and one final | **Inferred**: QUARTERLY (mid-point after the first quarter) plus FINAL; person must choose |
| Due-date rule | Not stated | **Missing** |
| Donor template | Not supplied | **Missing** (use the built-in structure or the donor's own) |
| Author, reviewer, approver | Not stated | Missing (author and reviewer optional; approver follows roles) |
| Reminders | Not stated | Default on |

### Slide 9: Budget and finance

| Item | Value | Status | Source |
| --- | --- | --- | --- |
| Total funds requested from CBPF | 500,000.30 USD (100%) | Stated and derived | §2.1, §2.3, budget total |
| Funding source | CBPF Somalia (SHF): 500,000.30 USD | Stated (one source) | §2.2 is blank; §2.3 gives the request |
| Total external funding | Blank | Missing | §2.2 |
| Funds received | Blank | Missing | §2.2 |
| Budget line G.1 | Estimate budget based on instructions; lump sum 1 × 467,290.00; 100% charged to CBPF | Stated | Budget section G |
| Programme support cost (PSC) | 7% = 32,710.30 | Derived and checked: 7% of 467,290.00 = 32,710.30 | PSC table |
| Total | 500,000.30 | Derived and checked: 467,290.00 + 32,710.30 | Budget total |
| Budget by sector | WASH 100%, 500,000.30 | Stated and checked | §10 |
| Budget linked to activities | Not stated; the only line is a general support line | **Decision**: link G.1 as a support line, or split it by activity (the document gives no split) | n/a |
| Reporting currency | USD | Inferred from the grant currency | n/a |
| Difference, budget vs funding | None (500,000.30 against 500,000.30) | Derived: agrees | n/a |
| Disbursement schedule, deliverables, advances | Not stated | Missing (optional; after Launch) | n/a |
| Expense approver, separate-approver toggle | Not stated | Missing (decision) | n/a |
| Finance mode | The grant has a budget, so finance applies | Inferred; person can set "not used" only if the organisation does not track finance | n/a |

### Slide 10: Review and launch

| Item | Stated | Status |
| --- | --- | --- |
| Risks | Section 17.4 names: insecurity, road inaccessibility, community tensions, financial and operational risks, staff safety. Mitigations are stated for each | Stated (kinds and titles); **seriousness, owner and review date not stated** |
| Assumptions | §17.3: ABC membership and community networks provide safe access (candidate assumption) | Inferred as one ASSUMPTION; person to confirm |
| Compliance checklist | Not in the wizard (generated, §3 above) | n/a |
| Dashboard | WASH sector template exists in `sector-templates.ts` | Inferred; person picks |
| Invitations | Focal point has an email; the two named roles are not stated | Missing (decision: invite now or later) |
| Sign-off | Creator's decision after review | Person |

### Other proposal sections (not wizard fields; record them in the summary or notes)

| Section | Content | Status |
| --- | --- | --- |
| Emergency type | Other: socio-economic disruption, 100% | Stated; no field; keep in summary |
| HRP project | Blank | Missing (optional) |
| Gender marker (GAM) | Code 4; reference H4636-9952-0752, but the same section says "GAM reference is not yet available" | **Conflict** (see §5) |
| Gender equality | Mainstreamed, no targeted programming | Stated |
| Disability marker | Mainstreamed, no targeted programming | Stated |
| GBV marker | Mainstreamed, no targeted programming | Stated |
| Protection budget | 5% = 25,000.02; people targeted 700 | Derived and checked (5% of 500,000.30 = 25,000.015, rounded to 25,000.02); **700 conflicts with 13,500** (see §5) |
| CVA | No | Stated |
| Localisation | Local NGO leads all stages | Stated |
| Coordination | WASH Cluster, Protection Cluster, ABC Baydhaba | Stated |
| Indirect beneficiaries | 4,500 | Stated |

---

## 4. People-targeted figures

These feed the indicator target, the location target and the protection figure. All were checked.

| Group | Women (>18) | Girls (<18) | Men (>18) | Boys (<18) | Total | Check |
| --- | --- | --- | --- | --- | --- | --- |
| Internally displaced | 3,000 | 2,800 | 2,400 | 2,800 | 11,000 | 3,000+2,800+2,400+2,800 = 11,000 ✓ |
| Host communities | 800 | 600 | 500 | 600 | 2,500 | 800+600+500+600 = 2,500 ✓ |
| **Total direct** | **3,800** | **3,400** | **2,900** | **3,400** | **13,500** | 11,000 + 2,500 = 13,500 ✓ |
| Persons with disabilities | 380 | 340 | 290 | 340 | 1,350 | 380+340+290+340 = 1,350 ✓ |
| Indirect | | | | | 4,500 | Stated ✓ |

Shares: female (3,800 + 3,400) ÷ 13,500 = 53.3%, stated 53% ✓. Male 47% ✓. Children (3,400 + 3,400) ÷ 13,500 = 50.4%, stated 50% ✓.

---

## 5. Problems in the document

Ordered by how much they affect a launch.

| # | Severity | Problem | Where | What to do |
| --- | --- | --- | --- | --- |
| 1 | **Critical** | The project **ended on 28-Feb-2026**. Today is 2026-11-05. All periods would be in the past, and entry windows and reports would start overdue | §1.7, §1.8 | Confirm whether this is a record of a completed project (then mark it as such) or a new project with new dates. Do not launch on these dates by accident |
| 2 | High | The logframe, outcome, output and activity are all template text | §4, Output 1.1 | Build the results framework from the narrative and confirm it. The wizard will propose it, but a person must check |
| 3 | High | Indicator 1.1.1 target is **0** while the people-targeted total is **13,500** | Indicator table vs §7 | Set the indicator target to 13,500 (or the figure the donor wants) and mark it as the person's decision |
| 4 | High | **Protection people targeted: 700**, against 13,500 directly targeted | §13.2 | Ask the organisation which is right; the protection figure is for a different scope or a mistake |
| 5 | Medium | Donor is named two ways: "CBPF" (title, budget) and "SHF" (strategy, hotline, reporting) | Title block; §1.1; §2.6 | Use "CBPF Somalia (Somalia Humanitarian Fund)" as the donor name, and confirm |
| 6 | Medium | Gender marker reference is given (H4636-9952-0752) and also "not yet available" | §14.1 | Confirm the correct reference before submission |
| 7 | Medium | Baidoa and Baydhaba are the same town; the location is "Baidoa > Bay > Baidoa > Baidoa" (district and town have the same name) | Location table; §2.4; §13 | Match both spellings to one place; confirm the admin level |
| 8 | Medium | Template text left in the summary: "[insert target districts/regions]" | §1.6 | Replace with Baidoa District and the named villages |
| 9 | Medium | Template placeholders read as real text: "To be completed after identification of priority interventions", "Standard Activity: Not Selected", "Activity 1.1.1 - To be completed…" | §4, §5 work plan | The wizard should treat these as empty. Have the person enter the real text |
| 10 | Medium | External funding and funds received are blank | §2.2 | Enter the amounts received, or state none |
| 11 | Low | The narrative says "Baydhaba" and "Baidoa" for the same place | §2.5, §12 | See 7 |
| 12 | Low | "Persons with disabilities" 340 is written "340.00" | Sector table | Formatting only; the value is correct |
| 13 | Low | The HRP and Cluster boxes are blank; the SO1/SO2 objectives are HRP-level and must not be entered as project outcomes | §4, §HRP | Leave out (the wizard already excludes HRP objectives as outcomes) |
| 14 | Low | "Standard Activity: Not Selected" on the activity | Output 1.1 activities | Replace with the real activity |

---

## 6. Arithmetic checks

| Check | Figures | Result |
| --- | --- | --- |
| Budget total | 467,290.00 + 32,710.30 | 500,000.30 ✓ |
| PSC | 7% × 467,290.00 | 32,710.30 ✓ |
| Protection value | 5% × 500,000.30 | 25,000.015, shown as 25,000.02 ✓ (rounded up) |
| Sector split | WASH 100% = 500,000.30 | ✓ |
| Location budget | 500,000.30 | ✓ |
| Direct total | 11,000 + 2,500 | 13,500 ✓ |
| Women / girls / men / boys totals | 3,800 + 3,400 + 2,900 + 3,400 | 13,500 ✓ |
| Persons with disabilities | 380 + 340 + 290 + 340 | 1,350 ✓ |
| Duration | Sep-2025 to Feb-2026 | 6 months ✓ |

All arithmetic in the document is correct. The problems are in what is missing or contradictory, not in the sums.

---

## 7. What a person must enter in the wizard

Listed by slide. Each item is either missing from the document or a decision the wizard asks the person to make.

1. **Start:** confirm the donor name (CBPF or SHF); keep the sector (WASH) and the country (Somalia).
2. **Project and team:** confirm the dates (see §5 item 1); add the project manager and the M&E lead with their roles; choose invite now or later for the focal point; confirm "no outside partners"; set the time zone.
3. **Results:** build the goal, outcome, output and activity chain from the narrative; confirm the generated codes.
4. **Indicators:** add real indicators per output (at least Indicator 1.1.1 with target 13,500, as the document states); for each, confirm type, unit, direction, frequency, baseline (or "no baseline"), and an owner on the team.
5. **Places:** merge Baidoa and Baydhaba into one place; set the project area and the admin level; name or pin the villages and IDP sites, or use "project-wide".
6. **Work plan:** replace the placeholder with real planned activities and dates in the six months; give each a place, a lead, indicator links and required files.
7. **Data entry:** choose a collection method per indicator (form is the suggested method for participation); set the review mode and the entry-window rule.
8. **Reporting:** choose the cadence (mid-point and final suggested); set a due-date rule per report type; choose a template (built-in or donor's).
9. **Budget and finance:** confirm the funding (500,000.30 USD); set the reporting currency to USD; decide how G.1 and PSC are linked (support line); enter funds received and external funding if known; set the expense approver.
10. **Launch:** rate each risk for seriousness (five risks named in §17.4) and give owners and review dates; confirm the one assumption (ABC access); choose the WASH dashboard; decide invitations; give the sign-off.

---

## 8. Open questions for the organisation

1. Is this project finished (ended 28-Feb-2026), or is it a new one? If finished, which dates should the wizard use, and should it be launched as a closed project?
2. Which donor name is correct, CBPF or SHF, and which reporting template does the donor require?
3. Who is the project manager and the M&E lead?
4. What is the correct indicator target for the emergency water indicator: 0 (as in the template) or 13,500?
5. Is 700 the protection target, or should it be 13,500?
6. What is the correct gender-marker reference?
7. Which villages and IDP sites are in scope?
8. Are the funds received and any external funding known?
9. Which activity does the G.1 budget line (lump sum, 467,290.00) belong to, or is it a support line?

---

## 9. Scope and limits of this audit

- This audit reads the document and the wizard's rules. It does not run the wizard or create a project, so it does not prove the wizard reads this document correctly. The wizard's own document reading is tested separately (see `Temp/cbpf-run/` and the 2026-11-04 audit at `memorybank/imp/audit-2026-11-04-project-wizard-cbpf.md`).
- Items marked **Inferred** are my suggestions from the narrative. They are not facts in the document and need a person's confirmation.
- The requirement count (32) is from the code in `requirements/*.ts`; the 2026-11-02 plan described 25 rules, which is out of date.
