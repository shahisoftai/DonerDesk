# Verification demo 9 — 6-month CMAM and IYCF project in Oromia, Ethiopia (scenario and setup, written 2026-10-20)

**DonorDesk Version 2.005** (branch `0013-programme-management`, Phase 28 programme management)

**Status: planned, not run.** This document is the complete scenario and setup for the demo: project, logframe, indicators, planned activities, team, reporting periods, story, evidence and the month-by-month data. Nothing has been entered in the app yet. The run log will be `verification-demo-9.md`'s successor section once the run starts, following the pattern of demos 7 and 8.

All names of organisations, donors and places are **fictional**. The geography is an illustrative catchment in Oromia, with woredas named A, B and C. Every number in the data plan is synthetic. Do not enter real child or patient data in this demo, or any other real personal data.

---

## 1. The project

| Field | Value |
| --- | --- |
| Project name | [DEMO-9] Community-based management of acute malnutrition and infant and young child feeding in three woredas of Demo Zone, Oromia (CMAM-IYCF-OR) |
| Donor | Horn of Africa Child Nutrition Fund (fictional), grant ref. HACNF/ET/2026/NUT-047 |
| Implementer (lead) | Highland Child Nutrition Partnership (fictional), "HCNP" |
| Partners | Demo Zone Health Office (government counterpart, fictional); Gelana Women and Child Development Association (fictional, community mobilisation and IYCF groups) |
| Sector | NUTRITION (`SectorSchema`) |
| Country | Ethiopia |
| Location | Woredas A, B and C, Demo Zone, Oromia. Catchment 118,000 people; about 15,000 children aged 6–59 months |
| Start / end | 2026-11-01 → 2027-04-30 (six months, one lean season: January to March) |
| Donor budget | USD 610,000 (cumulative expenditure to date is entered in USD; local costs are in ETB and converted on the statement of expenditure) |
| Currency to set | USD for the donor view (see §12, test point T-4) |
| Timezone | Africa/Addis_Ababa (UTC+3, no daylight saving). Reminders go out at 07:00 in this zone (`Organization.timeZone`) |
| Project lead | Project Manager: Hiwot Tesfaye (fictional) |
| Report cadence | Monthly (November–March), plus the Final report for the whole project (April) and one Situation report (January, lean-season alert) |

### One-paragraph summary (the project's own words, used in the setup)
HCNP and its partners deliver outpatient treatment for children with severe and moderate acute malnutrition through six community-based outpatient therapeutic programme (OTP) sites and one inpatient stabilisation centre (SC) referral point, supported by health extension workers and community volunteers who screen children by mid-upper arm circumference (MUAC). In parallel, women's development army groups and the health extension programme run infant and young child feeding (IYCF) counselling and mothers' group sessions, so that families can prevent malnutrition rather than only treat it. The project works through the existing Health Extension Program and Health Post structure, uses the national CMAM protocol, and reports against the national indicators the Demo Zone Health Office already collects.

---

## 2. Context and needs (sourced where possible)

These facts are for the report's Background section and the Situation report. Figures marked *(verify)* must be checked against the source before the donor copy is sent.

- **Malnutrition burden.** Ethiopia's 2019 Demographic and Health Survey showed high stunting and a low share of children receiving a minimum acceptable diet. A 2019 mini-DHS analysis of 1,427 children aged 6–23 months found that only **10.4%** met the minimum acceptable diet (MAD) ([Frontiers in Public Health, 2025](https://www.frontiersin.org/journals/public-health/articles/10.3389/fpubh.2025.1464008/full)). The national EDHS 2019 stunting prevalence of about 37% and wasting of about 7% are commonly cited *(verify against the EDHS 2019 final report)*.
- **Treatment outcomes are below standard.** A pooled analysis of 19 Ethiopian outpatient programme studies (23,395 children) found a pooled recovery rate of about **70%**, a defaulter rate of about 10% and a non-recovery rate of about 15% ([PMC7339430](https://pmc.ncbi.nlm.nih.gov/articles/PMC7339430)). UNICEF's Amhara briefing states that the Sphere standard for recovery is **75%** ([UNICEF Ethiopia, Nutrition Emergency Response in Amhara](https://www.unicef.org/ethiopia/media/1296/file/Nutrition%20Emergency%20Response%20in%20Amhara.pdf)). Causes reported in the literature: ration sharing, no antibiotics for co-morbidities, distance to the site. The project's activities target each of these.
- **Protocol.** The national reference is the **National Guideline for the Management of Acute Malnutrition (May 2019)**, which covers SAM and MAM and aligns with WHO guidance ([Nutrition Cluster copy](https://stg.nutritioncluster.net/sites/nutritioncluster.com/files/2022-06/National%20Guideline%20for%20Management%20of%20Acute%20Malnutrition%20May%202019%20Version.pdf)). The earlier SAM protocol dates from 2007 and the MAM guideline from 2012. Whether a newer revision exists must be checked on the Federal Ministry of Health site before the demo's donor copy is generated *(open question Q-1)*.
- **Screening and admission.** OTP admission in Ethiopia is commonly by MUAC below 115 mm (SAM) and 115 to below 125 mm (MAM), with oedema or failed appetite test as additional SAM criteria *(verify the threshold in the 2019 guideline; one Wolaita Zone study reports MUAC <11.5 cm and oedema +/++)*.
- **Lean season.** January to March is the assumed lean season in the catchment, with the belg rains (February to May) and the post-harvest gap. The Situation report in January covers an early-warning alert and a measles and acute watery diarrhoea spike, which the RUTF pipeline must absorb.
- **Calendar.** The project overlaps Ramadan (approximately 8 February to 9 March 2027) and the Ethiopian Orthodox fasting period before Easter. Planned mobile days avoid the fasting days for the Orthodox community, and the fasting hours for Muslim households are noted in the community mobilisation activities *(verify dates)*.

---

## 3. Results framework (logframe)

Codes follow the demo convention: GOAL, OUTCOME (`OC`), OUTPUT (`OP`), ACTIVITY (`A`).

| Level | Code | Text |
| --- | --- | --- |
| GOAL | G | Acute malnutrition and its consequences are reduced among children 6–59 months and 6–23 months in three woredas of Demo Zone |
| OUTCOME 1 | OC1 | Children with SAM and MAM recover through quality, community-based treatment |
| OUTCOME 2 | OC2 | Caregivers practise recommended infant and young child feeding |
| OUTPUT 1.1 | OP1.1 | Children are screened for malnutrition by MUAC through community and facility outreach |
| OUTPUT 1.2 | OP1.2 | Children with SAM are admitted and treated at OTP sites, with SC referral where needed |
| OUTPUT 1.3 | OP1.3 | Children with MAM are admitted and treated |
| OUTPUT 1.4 | OP1.4 | OTP sites have a continuous supply of RUTF and essential medicines |
| OUTPUT 1.5 | OP1.5 | Health workers and volunteers are trained in CMAM |
| OUTPUT 2.1 | OP2.1 | Caregivers receive IYCF counselling at home and at health posts |
| OUTPUT 2.2 | OP2.2 | Mothers' group sessions on feeding, hygiene and care are held |
| OUTPUT 2.3 | OP2.3 | IYCF counsellors are trained and supervised |

### Logframe activities (linked in the app to outputs; `ACTIVITY` nodes)
| Code | Activity | Output |
| --- | --- | --- |
| A1.1.1 | Monthly MUAC screening campaigns in every kebele (community) | OP1.1 |
| A1.1.2 | Referral from screening to OTP and SC with a referral slip | OP1.1 |
| A1.2.1 | Operate six OTP sites (weekly and fortnightly follow-up visits) | OP1.2 |
| A1.2.2 | SC referral and stabilisation for children with complications | OP1.2 |
| A1.3.1 | MAM treatment with supplementary feeding at OTP sites | OP1.3 |
| A1.4.1 | Monthly RUTF and medicine forecasting, ordering and last-mile delivery | OP1.4 |
| A1.4.2 | Stock and cold-chain checks at each OTP site | OP1.4 |
| A1.5.1 | CMAM training for health extension workers and volunteers (two batches) | OP1.5 |
| A2.1.1 | Household IYCF counselling visits by women's development army volunteers | OP2.1 |
| A2.1.2 | Health post IYCF counselling for caregivers at growth monitoring | OP2.1 |
| A2.2.1 | Facilitated mothers' group sessions (fortnightly) | OP2.2 |
| A2.3.1 | IYCF counsellor training and monthly supportive supervision | OP2.3 |
| A2.3.2 | Baseline, midline and endline KAP and IYCF survey | OC2 |

---

## 4. Indicators

Direction matters: `Higher` / `Lower` is better. The rate indicators come in as **Calculation needs review** with direction NEUTRAL when imported from a file (demo 8 finding 2), so the direction for every rate must be chosen by hand (test point T-7).

| Code | Level | Indicator | Type / unit | Direction | Frequency | Baseline (Nov 2026) | Target (Apr 2027) | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GI-1 | GOAL | Children 6–59 months with MUAC below 125 mm at community screening | Rate (%) | Lower | Survey / screening round | 7.8% | 6.0% | Screening registers (Health Post) |
| OC1a | OUTCOME 1 | Cure rate, SAM children (cohort discharged in period) | Rate (%) | Higher | Monthly cohort | 68% (2025 facility data, illustrative) | ≥75% | OTP registers |
| OC1b | OUTCOME 1 | Defaulter rate, SAM children | Rate (%) | Lower | Monthly cohort | 17% | <15% | OTP registers |
| OC1c | OUTCOME 1 | Death rate, SAM children | Rate (%) | Lower | Monthly cohort | 2.4% | ≤3% | OTP registers |
| OC1d | OUTCOME 1 | Non-response rate, SAM children | Rate (%) | Lower | Monthly cohort | 12% | <15% | OTP registers |
| OP1.1 | OUTPUT 1.1 | Children 6–59 months screened by MUAC (community and facility) | Count, cumulative | Higher | Monthly | 0 | 13,500 | Screening tally sheets |
| OP1.2 | OUTPUT 1.2 | Children with SAM admitted to OTP or SC (by sex and age: 6–23 / 24–59 months) | Count, cumulative | Higher | Monthly | 0 | 240 | OTP admission register |
| OP1.3 | OUTPUT 1.3 | Children with MAM admitted for supplementary feeding (by sex and age) | Count, cumulative | Higher | Monthly | 0 | 520 | MAM register |
| OP1.4 | OUTPUT 1.4 | RUTF stock-out days per OTP site (average across sites in the month) | Rate (days) | Lower | Monthly | 6 | ≤2 | Stock cards |
| OP1.5 | OUTPUT 1.5 | Health extension workers and volunteers trained in CMAM | Count, cumulative | Higher | Monthly | 0 | 120 | Training attendance sheets |
| OP1.6 | OUTPUT 1.2 | OTP sites functional for at least 90% of days | Count | Higher | Final | 0 | 9 | Supervision checklist |
| OP2.1 | OUTPUT 2.1 | Caregivers receiving IYCF counselling (by caregiver type: mother / father / other) | Count, cumulative | Higher | Monthly | 0 | 4,000 | Household visit and growth monitoring forms |
| OP2.2 | OUTPUT 2.2 | Mothers' group sessions held | Count, cumulative | Higher | Monthly | 0 | 240 | Group session registers |
| OP2.3 | OUTPUT 2.3 | IYCF counsellors trained and supervised monthly | Count, cumulative | Higher | Monthly | 0 | 80 | Training and supervision records |
| OC2a | OUTCOME 2 | Children 6–23 months meeting minimum dietary diversity (MDD) | Rate (%) | Higher | Survey (baseline, midline, endline) | 14% | 30% | Household survey |
| OC2b | OUTCOME 2 | Children 6–23 months meeting minimum acceptable diet (MAD) | Rate (%) | Higher | Survey | 9% | 20% | Household survey |
| OC2c | OUTCOME 2 | Infants under 6 months exclusively breastfed in the last 24 hours | Rate (%) | Higher | Survey | 56% | 70% | Household survey |

Notes for the demo:
- **Cumulative vs period.** Counts (OP1.1–OP1.5, OP2.1–OP2.3) are cumulative in the Final report. The monthly grid takes the sum for counts.
- **Rates and "% of target".** Rate indicators show "—" in the "% of target" column (demo 7 and 8 rule). Only counts get a percentage of target.
- **Cohort rates.** OC1a–OC1d are reported by discharge cohort. December has no discharges yet, so the grid shows "Not due" for that month, which must not count as "not measured" (T-9).
- **Survey indicators.** OC2a–OC2c are entered at survey dates (midline in the February report, endline in April). The baseline values are entered in November.
- **Sex breakdown.** OP1.2 and OP1.3 carry sex and age disaggregation; OP2.1 carries caregiver type.

---

## 5. Planned activities (work plan, Phase 28)

The plan is set up through *Work plan → Start from my logframe*. The dates below are the proposed dates from each logframe activity's own monthly or one-off cadence. The "Required files" column is what the app should suggest (`suggestRequiredFiles`). Owners are the roles in §6.

| # | Planned activity | Logframe | Start → end | Recurrence | Owner | Required files (suggested) |
| --- | --- | --- | --- | --- | --- | --- |
| P-01 | Baseline KAP and IYCF household survey (enumerator training, fieldwork, data cleaning) | A2.3.2 | 2026-11-02 → 2026-11-27 | One-off | M&E Officer | Survey protocol, consent form, enumerator training attendance, data cleaning log |
| P-02 | CMAM training batch 1 (health extension workers, 60 participants, 5 days) | A1.5.1 | 2026-11-09 → 2026-11-13 | One-off | Nutrition Officer | Training agenda, attendance sheet, pre- and post-test |
| P-03 | Monthly MUAC screening campaign, all kebeles | A1.1.1 | Monthly, 2nd week of each month | Monthly ×6 | Field Officer (Woreda A), Field Officer (Woreda B), Field Officer (Woreda C) | Screening tally sheets, campaign photo (consent) |
| P-04 | RUTF and medicine forecast, order and last-mile delivery | A1.4.1 | Monthly, 1st week | Monthly ×6 | Logistics Officer | Stock cards, delivery note, forecast sheet |
| P-05 | OTP follow-up visits, six sites (weekly attendance, fortnightly review) | A1.2.1 | Weekly, Mon–Thu | Weekly ×26 | OTP Focal Health Workers | OTP admission register (confidential), discharge summary |
| P-06 | Stock and cold-chain check at each OTP site | A1.4.2 | Monthly, 3rd week | Monthly ×6 | Logistics Officer | Stock check form, fridge temperature log |
| P-07 | IYCF counsellor training batch 1 (80 counsellors, 4 days) | A2.3.1 | 2026-11-16 → 2026-11-19 | One-off | Nutrition Officer | Training agenda, attendance, IYCF counselling card |
| P-08 | Household IYCF counselling visits by women's development army volunteers | A2.1.1 | Weekly, per volunteer round | Weekly ×26 | Field Officer (Woreda A–C) | Household visit form (confidential) |
| P-09 | Health post IYCF counselling at growth monitoring | A2.1.2 | Fortnightly, Mon | Fortnightly ×12 | Health Post Focal Person | Growth monitoring form, counselling card |
| P-10 | Facilitated mothers' group sessions (fortnightly, 12 groups) | A2.2.1 | Fortnightly | Fortnightly ×12 | Community Mobiliser | Group session register, session photo (consent) |
| P-11 | CMAM training batch 2 (refresher and new health posts, 60 participants) | A1.5.1 | 2026-12-07 → 2026-12-10 | One-off | Nutrition Officer | Training agenda, attendance, pre- and post-test |
| P-12 | Monthly supportive supervision of OTP sites and counsellors | A2.3.1 | Monthly, last week | Monthly ×6 | Nutrition Officer | Supervision checklist, action points |
| P-13 | Monthly data review and dashboard meeting with the Demo Zone Health Office | (none) | Monthly, 1st Thursday | Monthly ×6 | M&E Officer | Meeting minutes, indicator summary |
| P-14 | Lean-season early-warning review with Woreda health offices (Situation report input) | (none) | 2027-01-12 → 2027-01-14 | One-off | Project Manager | Early-warning bulletin, measles and AWD case counts |
| P-15 | Measles vaccination outreach linked to OTP referral (one day per woreda) | (none) | 2027-01-18 → 2027-01-20 | One-off | Field Officer (Woreda B) | Vaccination register extract (no names), outreach report |
| P-16 | Midline KAP and IYCF survey | A2.3.2 | 2027-02-15 → 2027-02-26 | One-off | M&E Officer | Survey protocol, ethics approval, data cleaning log |
| P-17 | Mid-term review meeting with the donor (remote) | (none) | 2027-02-24 | One-off | Project Manager | Mid-term review agenda, minutes |
| P-18 | Endline KAP and IYCF survey | A2.3.2 | 2027-04-05 → 2027-04-16 | One-off | M&E Officer | Survey protocol, data cleaning log, comparison table |
| P-19 | Close-out: OTP handover plan to Demo Zone Health Office, RUTF stock reconciliation | (none) | 2027-04-19 → 2027-04-30 | One-off | Project Manager | Handover plan (signed), RUTF reconciliation, asset list |
| P-20 | Community sensitisation on ration sharing and caregiver roles (before the lean season) | A2.1.1 | 2026-12-14 → 2026-12-18 | One-off | Community Mobiliser | Sensitisation attendance, message card |

Milestones are planned activities with start = end (for example P-17). The app treats them through the same delivery-state table as the rest.

Test points for the plan: P-05 (weekly) should create 26 rows with a cap of 120 (`expandRecurrence`); P-14 is an event in the lean season that the Situation report should cite as an activity; P-18 has an original end date that becomes "Late" on 16 April only if it slips (use it for the reason-required prompt, T-14).

---

## 6. Team and roles

| Person (fictional) | Project role | App role | Notes |
| --- | --- | --- | --- |
| Hiwot Tesfaye | Project Manager, report author for April | Project Manager | Owns P-14, P-17, P-19. Second approver for Monthly reports |
| Dawit Mekonnen | M&E Officer | M&E Officer | Owns the survey work and the monthly data review. Writes the Monthly reports |
| Selam Worku | Nutrition Officer | Field Officer (lead) | Training and supervision. Second approver for Final (second-approver rule) |
| Abdi Hassan | Field Officer, Woreda A | Field Officer | Screening, IYCF visits Woreda A |
| Tigist Alemu | Field Officer, Woreda B | Field Officer | Screening, IYCF visits Woreda B; P-15 |
| Yonas Bekele | Field Officer, Woreda C | Field Officer | Screening, IYCF visits Woreda C |
| Mulugeta Addis | Logistics Officer (HCNP) | Field Officer | RUTF and stock checks (P-04, P-06) |
| Genet Dessie | Finance Officer (HCNP) | Admin | Finance entry for each period, verified before the report |

Second-approver rule: the author of a report cannot approve it. The Final report is written by Hiwot and approved by Selam; a Monthly report written by Dawit is approved by Hiwot. Test point T-12 uses the wizard's second-approver toggle.

Invitations: email delivery is not active in this build, so the invite link is copied and opened in a second window (demo 8 pattern). Terms acceptance happens on the invite page (Phase 27 fix).

---

## 7. Reporting setup

### 7.1 Reporting profile
- Reporting frequency: monthly default, Final at close.
- Second approver: **on** (the rule is tested end to end).
- Finance data mode: **on** (for the Final report only, since finance exists only for non-monthly periods; monthly reports show the finance line as "not reported this period", which must be checked, T-16). If the app does not allow finance on a monthly period, the statement of expenditure goes in the Final.
- Standing statements (`standingStatementsJson`): "All figures are from HCNP's OTP and screening registers unless a survey is named." and "Children are identified by a code, never by name."

### 7.2 Donor templates
Three templates, uploaded as in demo 8 (`DonorTemplate`, extraction and review before use):
1. **Monthly report, DOCX** (7 sections): 1 Summary, 2 Context and update, 3 Results against indicators, 4 Challenges and lessons, 5 Next month, 6 Compliance and safeguarding, 7 Financial summary. Word limits: 300 words for section 2, 400 for section 4. Compliance sections: child protection, data protection, accountability to affected people.
2. **Quarterly report, PDF** is **not** used here (no quarterly period). Skip it, and leave the template library with one unused template to show the default-by-type rule (`defaultTemplateByType`).
3. **Final report, DOCX** (10 sections, 4 nested): 1 Executive summary, 2 Background, 3 Results framework (3.1 Outcome 1, 3.2 Outcome 2), 4 Results by output (4.1–4.3), 5 Lessons and sustainability, 6 Financial report, 7 Compliance (7.1 child protection, 7.2 data protection, 7.3 gender and inclusion, 7.4 do-no-harm), 8 Annexes.

Test point T-8 looks at the template extraction: the Final DOCX has numbered and nested sections, and the outcome sub-sections must not reuse the same table (demo 8 finding 10).

### 7.3 Reporting periods (calendar)
| Period | Type | Dates | Deadline | Template |
| --- | --- | --- | --- | --- |
| November 2026 | Monthly | 2026-11-01 → 2026-11-30 | +15 days | Monthly DOCX |
| December 2026 | Monthly | 2026-12-01 → 2026-12-31 | +15 days | Monthly DOCX |
| January 2027 | Monthly | 2027-01-01 → 2027-01-31 | +15 days | Monthly DOCX |
| January 2027 Situation | Situation (lean-season alert) | as-of 2027-01-20, window 2027-01-01 → 2027-01-20 | 2027-01-27 | Built-in situation structure |
| February 2027 | Monthly | 2027-02-01 → 2027-02-28 | +15 days | Monthly DOCX |
| March 2027 | Monthly | 2027-03-01 → 2027-03-31 | +15 days | Monthly DOCX |
| April 2027 (closing) | Final, cumulative Nov 2026 → Apr 2027 | 2027-04-01 → 2027-04-30 | 2027-05-15 | Final DOCX |

Calendar test points: create the November period with "Create just the next one" (T-5); the Final is created through the guided closing plan once March is approved (T-15).

---

## 8. Story and compliance statements

### 8.1 Five story answers (Tell the story, per period; a few example answers)
- **Nov 2026 (start-up).** *What changed?* Baseline survey and CMAM training batch 1 started; screening campaigns ran in all 3 woredas. *What went wrong?* Two OTP sites waited 9 days for the RUTF pallet (cold storage delay at Woreda B). *What did people say?* Caregivers asked for the counselling sessions at the health post, not only at home.
- **Dec 2026.** *What changed?* IYCF counsellors trained; mothers' groups started (12 groups). *What went wrong?* Ration sharing reported at two sites. *Decision:* ration sharing sensitisation (P-20) brought forward.
- **Jan 2027 (lean season).** *What changed?* Admissions rose sharply in every woreda. *What went wrong?* RUTF stock-out in 5 of 6 OTP sites for 5.2 days on average; a transport delay from the regional store. *What is being done?* Emergency order and a buffer stock at woreda level (linked to the Situation report).
- **Feb 2027.** *What changed?* Midline survey fieldwork; MDD and EBF improved in households reached. *What went wrong?* Ramadan fasting reduced OTP attendance on the fasting days (ten days of lower attendance noted). *Next:* follow-up visits scheduled for the evenings in Woreda C.
- **Mar 2027.** *What changed?* Stock-outs fell to 1.2 days; cure rate rose. *What went wrong?* One SC referral waited 26 hours for a bed. *Lessons:* the referral slip must name the nearest bed.

### 8.2 Compliance statements (per donor-template compliance section)
Written by the Project Manager, one per section (`StoryContext.sectionNotes`):
- **Child protection (Monthly 6 / Final 7.1):** "Staff sign the child safeguarding code. Two concerns were raised in Jan, both referred to the woreda child protection focal person within 24 hours; neither concerns a programme participant directly *(officer's note, demo)*."
- **Data protection (Monthly 6 / Final 7.2):** "Child-level registers are kept at the OTP sites in locked cabinets. Only codes leave the site. The survey uses consent forms signed before interview."
- **Accountability to affected people (Final 7.3 / 7.4):** "Feedback boxes at each OTP site; 14 comments in the period, 12 answered within a week."

Test point T-6: the compliance statements must reach the writer only as that section's officer note, and the Monthly 6 section must not repeat the Final 7.1 text.

---

## 9. Evidence and files

Evidence is the spine of the verification: each file links to an activity or an indicator update, and the sensitivity drives the export (demo 7 and 8 rules).

| Folder (demo file names) | Example file | Linked to | Period | Sensitivity |
| --- | --- | --- | --- | --- |
| screening | `nov-muac-screening-woreda-a-tally.pdf` | P-03 / OP1.1 | Nov 2026 | Confidential (child codes) |
| otp | `dec-otp-admission-register-site-3.pdf` | P-05 / OP1.2 | Dec 2026 | Highly sensitive (child-level) |
| otp | `jan-otp-discharge-summary-site-1.pdf` | P-05 / OC1a | Jan 2027 | Highly sensitive |
| supply | `jan-rutf-stock-cards-all-sites.xlsx` | P-04 / OP1.4 | Jan 2027 | Internal |
| supply | `jan-stockout-transport-delay-memo.pdf` | P-04 / OP1.4 | Jan 2027 | Internal |
| training | `nov-cmam-batch1-attendance.pdf` | P-02 / OP1.5 | Nov 2026 | Internal (names of trainees: Confidential) |
| training | `dec-cmam-batch2-pre-post-test-summary.xlsx` | P-11 / OP1.5 | Dec 2026 | Internal |
| counselling | `dec-iycf-counselling-visit-form-sample.pdf` | P-08 / OP2.1 | Dec 2026 | Highly sensitive (household) |
| groups | `dec-mothers-group-register.pdf` | P-10 / OP2.2 | Dec 2026 | Confidential |
| groups | `jan-mothers-group-session-photo-consent.jpg` | P-10 / OP2.2 | Jan 2027 | Confidential (consent) |
| survey | `nov-baseline-enumerator-training.pdf` | P-01 / OC2 | Nov 2026 | Internal |
| survey | `feb-midline-data-cleaning-log.xlsx` | P-16 / OC2a–c | Feb 2027 | Internal |
| survey | `feb-midline-summary-tables.pdf` | P-16 / OC2a–c | Feb 2027 | Internal |
| situation | `jan-early-warning-bulletin-woreda-b.pdf` | P-14 | Jan 2027 | Internal |
| situation | `jan-measles-awd-case-counts.xlsx` | P-14 / P-15 | Jan 2027 | Internal (no names) |
| compliance | `safeguarding-code-signed-staff.pdf` | Compliance: child protection | Nov 2026 | Confidential |
| compliance | `data-protection-register-storage-check.pdf` | Compliance: data protection | Dec 2026 | Confidential |
| finance | `apr-statement-of-expenditure.xlsx` | Final finance | Apr 2027 | Internal |

Evidence rules to test:
- The **Highly sensitive** OTP register is not in the donor export unless the officer opts in (demo 8 rule), and it appears in the export preflight warning.
- Consent photo `jan-mothers-group-session-photo-consent.jpg` requires the consent file to be linked too (required-files suggestion, T-10).
- An activity record for an OTP visit with a child-level register attached is in the confidentiality gate's list (the "Sensitive data handling confirmed" checklist item, demo 8 finding 22).

---

## 10. Activity records (completed activities) for the demo run

Completed records are entered as the team works (Phase 28 "log progress"). Examples for the run:
- Nov 3: **Screening campaign, Woreda A, kebele 1–4**, 1,920 children screened (936 boys, 984 girls); 84 referred to OTP. Linked to P-03 and A1.1.1. Files: `nov-muac-screening-woreda-a-tally.pdf`.
- Nov 10: **CMAM training batch 1, day 1–5** (60 health extension workers). Linked to P-02 and A1.5.1. Attendance and pre/post-test files.
- Nov 16–19: IYCF counsellor training batch 1 (78 of 80 attended). Linked to P-07.
- Dec 9: **CMAM training batch 2**, 60 participants. Linked to P-11. The record needs a span: start 2026-12-07, end 2026-12-10 (test point T-13 for the activity end date).
- Jan 12–14: Lean-season review; activity created from the story, linked to P-14 (plan link suggestion, rank by owner, logframe activity, then date).
- Jan 18–20: Measles outreach in Woreda B: 412 children vaccinated, plus 9 MUAC referrals to OTP. Linked to P-15 (activity end date set to 20 Jan).
- Feb 15–26: Midline survey fieldwork. Linked to P-16; values go to OC2a–c at the survey date.
- Apr 5–16: Endline survey. Linked to P-18.
- A withdrawn record: a duplicate screening entry for Woreda C in January, withdrawn with a reason (test point T-11: withdrawn records do not count, and do not appear in evidence pickers).

---

## 11. Monthly data plan (synthetic; enter through the Inputs grid)

### 11.1 Counts (cumulative) and rates
Columns: Nov, Dec, Jan, Feb, Mar, Apr (final). "Cum." is the cumulative to date. Blank means "not due" (not 0).

| Code | Nov | Dec | Jan | Feb | Mar | Apr (Final) | Target | Final vs target |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OP1.1 Screened (count, period) | 1,920 | 2,140 | 2,460 | 2,310 | 2,250 | 1,920 | 13,500 | — (cum. 13,000 = 96%) |
| OP1.2 SAM admitted (count, period) | 30 | 38 | 52 | 48 | 42 | 40 | 240 | cum. 250 = 104% |
| — of which girls | 14 | 19 | 24 | 22 | 21 | 19 | | |
| — of which 6–23 months | 12 | 16 | 22 | 20 | 18 | 17 | | |
| OP1.3 MAM admitted (count, period) | 70 | 80 | 105 | 98 | 90 | 84 | 520 | cum. 527 = 101% |
| OP1.4 RUTF stock-out days (average per site) | 1.0 | 1.5 | 5.2 | 2.8 | 1.2 | 2.1 (avg 6 months) | ≤2 | 2.1 = missed |
| OP1.5 Trained in CMAM (count, period) | 60 | 60 | 0 | 26 | 0 | 0 | 120 | cum. 146 = 122% (see note) |
| OP1.6 OTP sites functional ≥90% days (count) | | | | | | 9 | 9 | 9 = met |
| OC1a Cure rate SAM (rate, cohort) | — | not due | 74% | 77% | 79% | 78% (cum.) | ≥75% | 78% = met |
| OC1b Defaulter rate (rate) | — | not due | 13.1% | 11.8% | 11.0% | 11.4% | <15% | met |
| OC1c Death rate (rate) | — | not due | 2.2% | 1.9% | 1.4% | 1.6% | ≤3% | met |
| OC1d Non-response rate (rate) | — | not due | 9.0% | 8.1% | 6.9% | 7.2% | <15% | met |
| OP2.1 Caregivers counselled (count, period) | 480 | 610 | 720 | 690 | 655 | 600 | 4,000 | cum. 3,755 = 94% |
| OP2.2 Mothers' group sessions (count, period) | 0 | 38 | 42 | 46 | 44 | 36 | 240 | cum. 246 = 103% |
| OP2.3 IYCF counsellors trained (count, period) | 78 | 0 | 0 | 0 | 0 | 0 | 80 | cum. 78 = 98% |

Notes on the table:
- **OP1.5 trained**: batch 1 (Nov) 60 and batch 2 (Dec) 60 reach the target of 120 on their own. The Feb figure of 26 is a late top-up from a health post that asked to join. The Final cumulative is therefore **146** against a target of 120 (122%). Enter the real count so the app shows the overshoot rather than capping it.
- **OP1.4 stock-out**: January's 5.2 days is the lean-season peak. Final is an average over six months (2.1), so it misses the ≤2 target narrowly. This is the honest shortfall for the Final.
- **OC1a–d** are cohort rates. The Final figures are cumulative across the project, and the January, February and March cohort values are shown in the monthly grid.
- **OP2.3** is entered once in November as the batch count, with monthly supervision counted in the activity records (not in this indicator).

### 11.2 Survey indicators (entered at survey dates)
| Code | Baseline (Nov 2026) | Midline (Feb 2027, in Feb report) | Endline (Apr 2027, in Final) | Target | Endline vs target |
| --- | --- | --- | --- | --- | --- |
| OC2a MDD 6–23 months | 14% | 24% | 31% | 30% | met (103%) — rate, no % of target |
| OC2b MAD 6–23 months | 9% | 14% | 19% | 20% | missed narrowly (95%) — rate |
| OC2c EBF under 6 months | 56% | 64% | 71% | 70% | met |
| GI-1 MUAC below 125 mm (screening prevalence) | 7.8% | 7.1% | 6.4% | 6.0% | missed (not met) |

The baseline value for OC1a (68%) is from 2025 facility data in the same woredas and is marked "illustrative" in the baseline note, because the project's own baseline is the cohort data from December onward.

### 11.3 Finance (USD, cumulative to the period end; entered only in the Final, with a note)
- Budget: USD 610,000 (lines: staff 218,000; RUTF and medicines 196,000; community mobilisation 61,000; transport 58,000; training 37,000; survey 25,000; admin and monitoring 15,000).
- Cumulative expenditure to 31 March 2027: USD 412,600 (verified in the period's finance entry).
- Expenditure to 30 April 2027 (Final): **USD 587,300** (96.3%). By line: RUTF and medicines 189,400 (96.6%); staff 214,900 (98.6%); transport 55,700 (96.0%); survey 23,900 (95.6%).
- The stated shortfall, ETB exchange loss (~6%), explained in the Final's financial section, not in the grid.

---

## 12. Setup checklist (what to do in the app, in order)

Use this as the run order. Each step names the screen and the expected result.

1. **Organisation.** Admin settings: timezone **Africa/Addis_Ababa**. Expected: the reminders hour reads 07:00 Addis time (T-1).
2. **New project wizard.** Name, donor, implementer, partner, sector **Nutrition**, country **Ethiopia**, currency **USD** (donor) with local costs noted, start 2026-11-01, end 2027-04-30, budget 610,000. Expected: the wizard suggests Nutrition for "CMAM" in the title and does not pre-fill Kenya or Health (T-2, a demo 8 finding 1 check). Show the sector hint "suggested" until confirmed.
3. **Logframe import.** Paste the 24 logframe items (goal, two outcomes, eight outputs, thirteen activities) in the paste box. Expected: one import, codes kept (T-3).
4. **Indicator import.** Upload the 17-indicator file linked by Logframe Code (run record: `verification-demo-9-et-run.md`). Expected: rate indicators come in as "Calculation needs review" with direction NEUTRAL. Choose Higher or Lower for each rate by hand (T-7).
5. **Indicator details.** Set the disaggregation (sex and age for OP1.2, OP1.3; caregiver type for OP2.1). Confirm the baselines in §4.
6. **Templates.** Upload the monthly DOCX and the Final DOCX; approve each (becomes the default for its type). Leave the quarterly PDF out, or upload and do not approve, to test the default rule (T-8).
7. **Reporting profile.** Second approver on, finance data mode on, standing statements from §7.1.
8. **Team.** Invite the seven people in §6 by email; copy each invite link and accept in a second window. Assign to the project with roles from §6.
9. **Work plan.** *Start from my logframe* proposes P-01 to P-20 with dates from §5. Adjust P-14, P-15, P-17 as in the table; the wizard refuses a project that already has planned activities, so set up the plan once (T-15 uses the same rule). Expected: the weekly and fortnightly rows are created as real rows (T-4).
10. **Calendar.** Create the November period (*Create just the next one*), then the rest one by one. Create the January Situation report separately (§7.3).
11. **Activities.** Enter the records in §10 through the activity form as the team works (dates in order), attach the files in §9, link each to its planned activity (suggestions appear, T-13).
12. **Indicator values.** Enter the monthly grid in §11.1 through the period Inputs pages (not the Data Center import). Enter survey values at the survey dates (§11.2).
13. **Finance.** Enter the cumulative expenditure at the Final period (§11.3), verified before generation.
14. **Story and compliance.** Five answers per period (§8.1); compliance statements per template section (§8.2).
15. **Monthly reports.** Generate November, December, January, February, March. Approve each through the second-approver rule (author submits, second approver approves in a second window).
16. **Situation report.** Generate the January Situation report with the affected-households figure from the assessment (demo 8 finding 18 check: 3,250 households affected, named source and date).
17. **Closing report.** Use the guided closing plan from March; create the April Final period; generate; check the banner, the readiness and the donor checks; approve.
18. **Export.** Word (monthly and Final), PDF of the Final, indicator spreadsheet, evidence checklist CSV, evidence pack ZIP.
19. **Project completion.** Mark completed. Expected: "Completed — no new reports" banner; the reminders stop for this project.

---

## 13. Verification test points

Each test point names what to check and what a pass looks like. Results go in the run log.

| ID | Area | What to check | Pass when |
| --- | --- | --- | --- |
| T-1 | Timezone | Admin sets Africa/Addis_Ababa | Reminder hour shown as 07:00 Addis time |
| T-2 | Wizard | Sector and country suggestions | Nutrition and Ethiopia are chosen; no Kenya or Health pre-fill |
| T-3 | Logframe import | 26 rows in one paste | Codes preserved; ACTIVITY nodes link to outputs |
| T-4 | Plan recurrence | P-05 weekly ×26 and P-03 monthly ×6 | Real rows; the 120 cap is not hit; a series is created all or none |
| T-5 | Calendar | "Create just the next one" for November | Monthly default template; deadline +15 days |
| T-6 | Compliance | Section notes reach the writer as officer notes only | Monthly 6 and Final 7.1 do not repeat each other's text |
| T-7 | Direction | Rate indicators set by hand | Rate rows show "—" in "% of target"; lower-is-better rows (OC1b–d, OP1.4, GI-1) judged correctly (cure higher, death lower) |
| T-8 | Templates | Final DOCX with nested sections; quarterly not used | Outcome sub-sections 3.1 and 3.2 carry their own outcome rows (demo 8 finding 10) |
| T-9 | Not due | December cohort rates | "Not due", never "not measured" and never 0 |
| T-10 | Required files | Consent photo linked without consent file | Suggestion appears; accepting without it asks "Accept anyway" (Phase 28.6) |
| T-11 | Withdrawn | Withdrawn January duplicate | Not counted, not offered in evidence pickers, not in the project overview count |
| T-12 | Second approver | Monthly by Dawit; Final by Selam | Author sees the blocked-approval explanation; approver in own window succeeds |
| T-13 | Activity links | Dec training record with an end date; plan link suggestions | "from 7 Dec to 10 Dec" in the record sentence; plan link ranked by owner then logframe then title then date |
| T-14 | Reason prompt | P-18 end date passed (test by setting an original end before today in the test copy only) | "Why?" asked only when the reason is required |
| T-15 | Closing | Guided closing from March | Final period created 1–30 April with cumulative to date; plan items closed by the data |
| T-16 | Finance mode | Finance on a monthly period | Refused or marked "not reported this period", as the design says (check against the cadence rule) |
| T-17 | Situation | Affected-households figure with its source | Figure accepted by the check; not reported as "not in the inputs" (demo 8 findings 16 and 18) |
| T-18 | Writer leaks | Workflow words, file stems, internal ids in donor text | None (demo 8 findings 4, 19, 24) |
| T-19 | Rates in exports | Indicator spreadsheet "% of target" | Rates "—"; counts show % of target |
| T-20 | Evidence export | Donor checklist and evidence pack | No internal resolution notes in the donor checklist; ZIP contains the files; Highly sensitive files excluded unless opted in |
| T-21 | Risks | Add three project risks (see §14) | Risks on the Overview only; none reach the writer |
| T-22 | Comments | Comment on P-18 with a mention of a team member | The mentioned person is told once; the author is not told |
| T-23 | Plan delivery in report | April Final: planned, held, not held, moved, cancelled counts | Counts match the plan; recorded reasons quoted; no names or statuses |
| T-24 | Reminders | Overdue activity and a 7-day late item | One summary per person at 07:00; escalation once after 7 days (needs the reminders timer; see the reminders runbook) |
| T-25 | Currency | USD donor view with ETB local costs | ETB shown only as a note; totals in USD |

### Rubric (0–2 each, same 12 rows as demos 7 and 8, plus planning)
grounding, honesty, template fit, register, specificity, no leaks, tables, gender and cross-cutting (ration sharing, women's groups, IYCF caregivers), continuity, visibility, flags, edit effort, and **planning** (plan is used in the reports, delivery counts match, reasons quoted). Target score: 20 of 26.

---

## 14. Risks and reviews (Phase 28.7)

| Kind | Title | Seriousness | Action | Owner |
| --- | --- | --- | --- | --- |
| Supply | RUTF pipeline breaks in the lean season | High | Buffer stock at woreda level; monthly forecast review (P-04) | Logistics Officer |
| Security | Road closure to Woreda C during the rainy season (belg) | Medium | Alternate route; mobile outreach days | Project Manager |
| Operational | Staff turnover in Woreda B (two health extension workers left in Dec) | Medium | Replacement training in Feb; handover file | Nutrition Officer |
| Data | Child-level register stored at a site without a lock | High | Lock installed (evidence: data-protection check); spot checks | M&E Officer |

Risk reviews are due at 30 days. Test T-21 uses these four.

---

## 15. Demo script in brief (for the run)

1. Set up the organisation timezone and the project (§12, steps 1–8).
2. Build the plan and the calendar (steps 9–10).
3. Run the first month as a real team would: plan items, activity records, evidence, indicator values, story (steps 11–14).
4. Generate and approve November and December; check the not-due cohort rows and the stock-out rule.
5. January: stock-out peak, the Situation report, the January Monthly report. Check the writer's lean-season wording and the rate direction.
6. February and March: midline survey, Ramadan attendance note, approvals, the closing plan.
7. April: endline survey, Final report with finance, compliance, export, completion.
8. Record every finding in the run log in the same format as demo 8: Sev, Step, What happened, Status.

---

## 16. Open questions

- **Q-1.** Is there a newer national CMAM protocol than the May 2019 guideline? Check the Federal Ministry of Health site before donor use.
- **Q-2.** Exact EDHS 2019 stunting, wasting and underweight figures for the context paragraph (§2) are marked *(verify)*.
- **Q-3.** The Sphere thresholds used (cure ≥75%, defaulter and non-response <15%, death rate ≤3% as the project target; the Sphere handbook's emergency death ceiling is higher) must be checked against the current Sphere Handbook before the donor copy.
- **Q-4.** The Ramadan and Orthodox fasting dates in §2 are approximate.
- **Q-5.** The lean-season months are assumed for this catchment; replace with the local early-warning calendar when real data is used.

---

## 17. Sources consulted (web, 2026-10-20)

- Frontiers in Public Health, 2025, on minimum acceptable diet in Ethiopia (2019 mini-DHS): <https://www.frontiersin.org/journals/public-health/articles/10.3389/fpubh.2025.1464008/full>
- Meta-analysis of Ethiopian CMAM outpatient outcomes, 2020 (recovery, death, defaulter and non-recovery rates): <https://pmc.ncbi.nlm.nih.gov/articles/PMC7339430>
- UNICEF Ethiopia, Nutrition Emergency Response in Amhara (recovery rate against the Sphere 75% standard): <https://www.unicef.org/ethiopia/media/1296/file/Nutrition%20Emergency%20Response%20in%20Amhara.pdf>
- Federal Ministry of Health, National Guideline for the Management of Acute Malnutrition, May 2019 (Nutrition Cluster copy): <https://stg.nutritioncluster.net/sites/nutritioncluster.com/files/2022-06/National%20Guideline%20for%20Management%20of%20Acute%20Malnutrition%20May%202019%20Version.pdf>

The search results gave summaries, not full texts. The figures in §2 and the indicator baselines were checked against those summaries only. Treat them as realistic defaults, not as verified national statistics, until Q-1 to Q-3 are closed.
