# Verification demo 11 — 6-month EU-funded MNCH project in South Ethiopia (scenario and setup run)

**DonorDesk Version 2.007** (production, tenant GEC, `mnpiracha@gmail.com`)

A complete six-month **Maternal, Newborn and Child Health (MNCH)** project in Ethiopia funded by the **European Union (ECHO)**, designed in the pattern of demos 7 (EU MNCH-R Ghana) and 9-ET (CMAM Oromia): the scenario is written first, then the project is built **through the web UI only** (one visible browser, no API scripts, no database writes) up to the end of setup — project, logframe, indicators, donor templates, reporting profile, team, work plan and the first reporting period — and the run **stops for review** before any data entry, exactly like the demo-9-ET month-0 stop.

All organisations, people, grant numbers and figures are **fictional**. The geography is an illustrative zone in South Ethiopia with fictional woredas **Basha** and **Kecha**. Every number in the data plan is synthetic. No real patient data is used anywhere.

---

## 1. The project

| Field | Value |
| --- | --- |
| Project title | **[DEMO-11] Emergency Maternal, Newborn and Child Health Response in Demo Zone, South Ethiopia (EMNCH-SE)** |
| Project code | `ET-MNCH-SE-20261021` |
| Donor | European Union — European Civil Protection and Humanitarian Aid Operations (**ECHO**), HIP 2026 Ethiopia Health |
| Grant / contract no. (fictional) | `ECHO/ET/BUD/2026/91066` |
| Implementer (lead) | South Ethiopia Health and Development Association (**SEHDA**, fictional) |
| Partners | Demo Zone Health Department (government counterpart, fictional); Aba Women's Development Association (community mobilisation, fictional) |
| Sector | HEALTH |
| Country | Ethiopia |
| Location | Woredas **Basha** and **Kecha**, Demo Zone, South Ethiopia. 12 supported health facilities (2 health centres with BEmONC, 10 health posts); catchment ~96,000 people, ~23,000 women of reproductive age, ~3,800 expected pregnancies per year |
| Start / end | **2026-11-01 → 2027-04-30** (six months) |
| Budget | **EUR 480,000** (ECHO 100 %, humanitarian action) |
| Currency | EUR |
| Timezone | Africa/Addis_Ababa (project-level time zone; reminders still run in the organisation's 07:00 hour) |
| Project lead | Project Manager: Meseret Bekele (fictional) |
| Report cadence | Monthly (Nov 2026 – Mar 2027), **Final** closing period (Apr 2027), one **Situation** report (Jan 2027, IDP influx) |

### One-paragraph summary (used in the wizard description)

SEHDA and its partners restore life-saving maternal, newborn and child health services in two drought- and displacement-affected woredas of Demo Zone: midwives, nurses and health extension workers are trained and mentored in basic emergency obstetric and newborn care; delivery rooms and newborn care corners at four health posts and two health centres are rehabilitated and equipped; two maternity waiting homes and a community referral transport scheme bring women in labour to a facility; monthly integrated outreach clinics take ANC, PNC and immunisation to remote kebeles; and Women's Development Army volunteers, women's groups, religious leaders and husbands' forums carry the messages that make families seek care early. The action works through the existing Health Extension Program and health-post network, uses national MNCH protocols, and reports the indicators the woreda health offices already collect.

---

## 2. Context and needs (sourced where possible; figures marked *(verify)* need a check before donor copy)

- **Maternal mortality.** Ethiopia's 2019 EDHS reports a maternal mortality ratio of **412 per 100,000 live births** *(verify against the EDHS 2019 final report)*. Most deaths are from haemorrhage, hypertensive disorders and obstructed labour, and most occur around delivery and the first 24 hours after birth.
- **Skilled birth attendance and ANC.** EDHS 2019: about **50 %** of live births were delivered by a skilled provider, and about **43 %** of women had four or more ANC visits *(verify both)*. Rural SNNPR-region figures are lower than the national average.
- **Newborn survival.** EDHS 2019: neonatal mortality **30 per 1,000**, infant mortality 43, under-five 67 per 1,000 *(verify)*. Postnatal care for newborns within two days of birth was around **49 %** nationally *(verify)* and far lower in remote woredas; late recognition of newborn danger signs is a documented driver.
- **Immunisation.** EDHS 2019: **61 %** of children 12–23 months had received all basic vaccinations; Penta3 coverage about **68 %** regionally *(verify)*. Drought-related displacement interrupted routine sessions in Demo Zone in 2026 (fictional, consistent with the scenario).
- **Service delivery reality.** The two woredas' health posts were damaged or exhausted by the 2025–26 drought response; delivery registers show a skilled-attendance rate of **46 %** and a 48-hour newborn check rate of **28 %** in the year before the action (illustrative facility baselines used as indicator baselines).
- **Health system.** The action works through the Health Extension Program (two HEWs per health post), the Women's Development Army (1-to-5 community networks), health centres providing BEmONC and the woreda health offices' monthly review meetings. National references: Health Sector Transformation Plan, national BEmONC/ENC training package, national immunisation protocol *(check current editions, open question Q-1)*.
- **Seasonality.** The belg rains (Feb–May) cut secondary roads in Kecha woreda; the lean season (Jan–Mar) raises food insecurity and displacement pressure on services. The January Situation report covers an IDP influx of about 1,400 people into Basha kebeles straining MNCH services *(synthetic figure with named source: woreda early-warning bulletin)*.

---

## 3. Results framework (logframe)

Codes follow the demo convention. The paste import carries 24 rows: 1 goal, 2 outcomes, 7 outputs, 14 activities.

| Level | Code | Text |
| --- | --- | --- |
| GOAL | G | Maternal and newborn deaths and illness are reduced among women and children in Woredas Basha and Kecha, Demo Zone |
| OUTCOME 1 | OC1 | Women and newborns receive quality, timely maternal and newborn health services at supported facilities and in the community |
| OUTCOME 2 | OC2 | Families and communities support safe motherhood, early care-seeking and newborn care |
| OUTPUT 1.1 | 1.1 | Health workers (midwives, nurses, HEWs) competent in BEmONC, essential newborn care and integrated ANC/PNC |
| OUTPUT 1.2 | 1.2 | Supported facilities provide round-the-clock safe delivery, newborn care and referral (maternity waiting homes, referral transport) |
| OUTPUT 1.3 | 1.3 | Essential MNCH medicines and supplies are continuously available at supported facilities |
| OUTPUT 1.4 | 1.4 | Remote kebeles are reached by monthly integrated outreach clinics (ANC, PNC, immunisation) |
| OUTPUT 2.1 | 2.1 | Women's Development Army volunteers identify pregnancies early and refer |
| OUTPUT 2.2 | 2.2 | Men, women and community leaders support facility delivery and newborn care practices |
| OUTPUT 2.3 | 2.3 | Woreda health offices use MNCH data to manage services |

### Logframe activities (ACTIVITY nodes, linked to outputs)

| Code | Activity | Output |
| --- | --- | --- |
| A1.1.1 | BEmONC and essential newborn care training for midwives and nurses (two batches) | 1.1 |
| A1.1.2 | Integrated ANC/PNC and danger-sign refresher training for health extension workers | 1.1 |
| A1.1.3 | Monthly on-the-job mentoring and supportive supervision at supported facilities | 1.1 |
| A1.2.1 | Rehabilitate and equip delivery and newborn care corners at 4 health posts and 2 health centres | 1.2 |
| A1.2.2 | Operate two maternity waiting homes and the community referral transport scheme | 1.2 |
| A1.3.1 | Monthly MNCH supply forecasting, ordering and last-mile delivery | 1.3 |
| A1.3.2 | Monthly stock and cold-chain checks at supported facilities | 1.3 |
| A1.4.1 | Monthly integrated outreach clinics (ANC, PNC, immunisation) in remote kebeles | 1.4 |
| A2.1.1 | Orient and refresh WDA team leaders (1-to-5 networks) on pregnancy identification and danger signs | 2.1 |
| A2.1.2 | Kebele pregnancy mapping and referral-slip distribution with HEWs | 2.1 |
| A2.2.1 | Community education sessions through women's groups, religious leaders and husbands' forums | 2.2 |
| A2.2.2 | Radio messages and community conversations on maternal and newborn danger signs | 2.2 |
| A2.3.1 | Monthly woreda MNCH data review and action meetings | 2.3 |
| A2.3.2 | Baseline and endline MNCH coverage survey | 2.3 |

---

## 4. Indicators (15)

Import file columns: `Code,Name,Type,Baseline,Target,Unit,Frequency,Disaggregated,Logframe Code,Data source`.
Imported rate indicators arrive as "Calculation needs review" with direction NEUTRAL (demo-8 finding 2) — every rate's direction is then chosen by hand (T-7).

| Code | Level | Indicator | Type / unit | Direction | Frequency | Baseline (Nov 2026) | Target (Apr 2027) | Calculation | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GI-1 | G | Institutional maternal deaths at supported facilities (project period) | Number (deaths) | Lower | Final | 4 (2025 season, illustrative) | ≤ 2 | Sum of period values | Facility registers, maternal death review minutes |
| OC1a | OC1 | Deliveries at supported facilities attended by a skilled birth attendant | % | Higher | Monthly | 46 | 65 | Reported directly | Delivery registers |
| OC1b | OC1 | Newborns with a postnatal care check within 48 hours of birth | % | Higher | Monthly | 28 | 55 | Reported directly | PNC registers |
| OC1c | OC1 | Pregnant women attending four or more ANC visits | % | Higher | Monthly | 37 | 55 | Reported directly | ANC registers |
| OC1d | OC1 | Children under one year receiving Penta3 vaccine | % | Higher | Monthly | 62 | 78 | Reported directly | EPI registers |
| OP1.1 | 1.1 | Health workers and HEWs trained in BEmONC, ENC and ANC/PNC (by sex) | Number (people) | Higher | Monthly | 0 | 132 | Sum of period values, cumulative | Training attendance sheets |
| OP1.2a | 1.2 | Women staying at a maternity waiting home before delivery | Number (women) | Higher | Monthly | 0 | 240 | Sum of period values, cumulative | MWH registers |
| OP1.2b | 1.2 | Emergency obstetric and newborn referrals completed by project-supported transport | Number (referrals) | Higher | Monthly | 0 | 120 | Sum of period values, cumulative | Referral slips, transport log |
| OP1.3 | 1.3 | Tracer MNCH medicine stock-out days (average per supported facility in the month) | Number (days) | **Lower** | Monthly | 4 | ≤ 2 | Average | Stock cards, tracer list (oxytocin, misoprostol, amoxicillin, RDT) |
| OP1.4 | 1.4 | Women reached by integrated outreach clinics (ANC, PNC, immunisation) | Number (women) | Higher | Monthly | 0 | 3,600 | Sum of period values, cumulative | Outreach tally sheets |
| OP2.1 | 2.1 | WDA team leaders oriented and active | Number (people) | Higher | Monthly | 0 | 360 | Sum of period values, cumulative | Orientation attendance |
| OP2.2 | 2.2 | People reached by community education on maternal and newborn health (by sex) | Number (people) | Higher | Monthly | 0 | 12,000 | Sum of period values, cumulative | Session registers, radio log |
| OP2.3 | 2.3 | Woreda MNCH data review meetings held | Number (meetings) | Higher | Monthly | 0 | 12 | Sum of period values, cumulative | Meeting minutes |
| OC2a | OC2 | Recently delivered women who know at least three newborn danger signs | % | Higher | Survey (Nov, Apr) | 24 | 45 | Reported directly | Household survey |
| OC2b | OC2 | Mothers who attended ANC in the first trimester (most recent birth) | % | Higher | Survey (Nov, Apr) | 31 | 50 | Reported directly | Household survey |

Notes:
- Rates (OC1a–d, OC2a–b) show "—" in "% of target"; only counts get a percentage of target (demo 7/8/9 rule).
- Lower is better: **GI-1** and **OP1.3** (the stock-out days).
- Sex disaggregation on **OP1.1** (about 70/30 F/M midwives-nurses-HEWs), **OP2.1** (about 97/3 F/M WDA) and **OP2.2** (participants by sex).
- GI-1 is honest-miss material: the action ends with **3** institutional maternal deaths against a target of ≤ 2 — the Final must say so and explain (one late referral in the January influx; maternal death review minutes as evidence).

---

## 5. Planned activities (work plan, Phase 28)

Built through *Activities → Planned → Start from my logframe*; recurring rows carry the "Monthly" checkbox. Owners are the stand-in accounts in §6.

| # | Planned activity | Logframe | Timing | Recurrence | Lead |
| --- | --- | --- | --- | --- | --- |
| P-01 | Baseline MNCH coverage survey (enumerator training, fieldwork, cleaning) | A2.3.2 | 2026-11-02 → 2026-11-20 | One-off | M&E Officer |
| P-02 | BEmONC/ENC training batch 1 (24 midwives and nurses, 6 days) | A1.1.1 | 2026-11-09 → 2026-11-14 | One-off | Health Advisor (second approver) |
| P-03 | ANC/PNC refresher for HEWs (60 HEWs, 3 days, two woredas) | A1.1.2 | 2026-11-23 → 2026-11-25 | One-off | Field Officer (Basha) |
| P-04 | WDA team-leader orientation (360 leaders, rounds of 60) | A2.1.1 | 2026-11-30 → 2027-01-29 (three rounds in one window — the wizard's "Monthly" repeats to the end of the project) | One-off window | Field Officer (Kecha) |
| P-05 | Delivery and newborn care corner rehabilitation (4 health posts, 2 health centres) | A1.2.1 | 2026-11-02 → 2027-01-15 | One-off | PM |
| P-06 | Maternity waiting homes open and running (2) | A1.2.2 | 2026-12-01 → 2027-04-30 | One-off (continuous) | Field Officer (Basha) |
| P-07 | Referral transport scheme (ambulance support + stretcher teams) | A1.2.2 | 2026-11-15 → 2027-04-30 | One-off (continuous) | Logistics |
| P-08 | MNCH supply forecast, order, last-mile delivery | A1.3.1 | 1st week each month | Monthly ×6 | Logistics |
| P-09 | Stock and cold-chain checks at supported facilities | A1.3.2 | 3rd week each month | Monthly ×6 | Logistics |
| P-10 | Integrated outreach clinics in remote kebeles (8 kebeles) | A1.4.1 | 2nd week each month | Monthly ×6 | Field Officers |
| P-11 | Community education sessions (women's groups, religious leaders, husbands' forums) | A2.2.1 | 2026-11-16 → 2027-04-23 | Monthly | Community Mobiliser (Field Officer Kecha) |
| P-12 | Radio messages and community conversations on danger signs | A2.2.2 | 2026-12-01 → 2027-03-31 (four months inside one window) | One-off window | PM |
| P-13 | Woreda MNCH data review and action meetings | A2.3.1 | last week each month | Monthly ×6 | M&E Officer |
| P-14 | Mentoring and supportive supervision rounds | A1.1.3 | 2026-11-16 → 2027-04-30 | Monthly ×6 | Health Advisor |
| P-15 | Kebele pregnancy mapping and referral slips | A2.1.2 | 2026-12-07 → 2026-12-18 | One-off | Field Officers |
| P-16 | BEmONC/ENC training batch 2 (24 midwives and nurses) | A1.1.1 | 2027-01-11 → 2027-01-16 | One-off | Health Advisor |
| P-17 | Endline MNCH coverage survey | A2.3.2 | 2027-04-05 → 2027-04-23 | One-off | M&E Officer |
| P-18 | Close-out: handover of MWH and equipment, final reconciliation | (none) | 2027-04-19 → 2027-04-30 | One-off | PM |

Milestones: P-06 opening (start = end on 2027-12-01 not needed; it is continuous), "Maternity waiting home openings" can be a milestone row if added by hand. The IDP-influx response (Jan) is **not** a plan row: it arrives as a Situation report and completed-activity records.

---

## 6. Team and roles (stand-in accounts, demo-9-ET pattern — no new accounts created)

| Scenario person (fictional) | Role in the action | Account on the project | Project role |
| --- | --- | --- | --- |
| Meseret Bekele | Project Manager, Final report author | Amara Okafor | Project Manager |
| Lensa Ahmed | M&E Officer (surveys, monthly reports) | Anita Gurung | M&E Officer |
| Dr. Sara Tesfaye | Health Advisor, second approver, training lead | Zainab Lawan | Project Manager |
| Kebede Wolde | Field Officer, Basha woreda | Ram Bahadur Chaudhary | Field Officer |
| Aster Girma | Field Officer, Kecha woreda | Grace Achieng | Field Officer |
| Tadesse Fikru | Field Officer, facilities liaison | P25 Check Field Officer | Field Officer |
| Hirut Mengistu | Logistics Officer | Ingrid Solberg | Grants Officer |
| Genet Dessie | Finance Officer | Najeeb Piracha (own account) | Grants Officer |

Second-approver rule: the author cannot approve. Monthly reports written by Lensa (Anita) are approved by Meseret (Amara); the Final is written by Meseret and approved by Dr. Sara (Zainab).

---

## 7. Reporting setup

### 7.1 Reporting profile

Language **English**, tone **Formal**, deadline offset **15 days**, **second approver on**, financial figures **"Type them in"** (verified figures only; finance exists only on the non-monthly Final), standing statements:
- "All service statistics are from the supported facilities' ANC, delivery, PNC and EPI registers unless a survey is named."
- "Women are identified by chart number only; no personal names appear in any register extract."
Formatting rules: EU spelling ("organisation", "immunisation"); thousands separators; the word "the Action" for the project as EU contracts do.
Special requirements: EU visibility statement quoted in exactly one section (§7 Visibility); "Funded by the European Union" wording on all beneficiary-facing materials.

### 7.2 Donor templates (two DOCX, generated, uploaded, extracted, reviewed, approved)

1. **EU ECHO Monthly Progress Report (EMNCH-SE)** — 8 sections: 1 Summary of the Month; 2 Progress Against Expected Results; 3 Activities Implemented; 4 Outcome Indicators and Data Quality; 5 Challenges, Risks and Mitigation; 6 Protection, Gender and Accountability to Affected Populations; 7 Visibility and Communication; 8 Plan for the Next Month. Word limits: 250 (§1), 400 (§5). Donor instructions and one or two mandatory questions per section; §2 requires the results table (indicator, this month, cumulative, target, % of target); §7 requires the EU disclaimer sentence.
2. **EU ECHO Final Narrative and Financial Report (EMNCH-SE)** — 11 sections with nesting: 1 Executive Summary (≤ 400 words); 2 Context and Description of the Action (2.1 Context Update, 2.2 Intervention Logic); 3 Assessment of Implementation (3.1 Outcome Results, 3.2 Output Delivery, 3.3 Activities, 3.4 Deviations from Plan); 4 Assessment Against Evaluation Criteria (4.1 Relevance, 4.2 Effectiveness, 4.3 Efficiency, 4.4 Sustainability, 4.5 Impact); 5 Cross-Cutting Issues: Gender, Environment, Do-No-Harm; 6 Risks and Assumptions; 7 Visibility and Communication; 8 Lessons Learned; 9 Sustainability and Exit Strategy; 10 Financial Report; 11 Recommendations. §3.1 requires the indicator table (baseline, target, achieved, % of target); §10 requires the budget-line table (budget, expended, balance) and a variance explanation above 10 %.

Never title a section "Overview"/"Abstract" (worker treats them as Executive Summary). Report types: MONTHLY and FINAL; each approved template becomes the default for its type.

### 7.3 Reporting periods (calendar)

| Period | Type | Dates | Deadline | Template |
| --- | --- | --- | --- | --- |
| November 2026 | Monthly | 2026-11-01 → 2026-11-30 | 2026-12-15 | Monthly |
| December 2026 | Monthly | 2026-12-01 → 2026-12-31 | 2027-01-15 | Monthly |
| January 2027 | Monthly | 2027-01-01 → 2027-01-31 | 2027-02-15 | Monthly |
| January 2027 — IDP influx | Situation (as-of 2027-01-22) | window 2027-01-15 → 2027-01-22 | 2027-01-25 (the app's rule: 3 days after the end) | Built-in situation structure |
| February 2027 | Monthly | 2027-02-01 → 2027-02-28 | 2027-03-15 | Monthly |
| March 2027 | Monthly | 2027-03-01 → 2027-03-31 | 2027-04-15 | Monthly |
| April 2027 (closing) | Final, cumulative Nov 2026 → Apr 2027 | 2027-04-01 → 2027-04-30 | 2027-05-15 | Final |

At setup the whole monthly calendar is created (November by hand, then **"Create all 4 periods"** for Dec 2026 – Mar 2027), plus the January Situation report. The **April Final** is left to the guided closing report, because creating it early would close the cadence (see the run log, §16).

---

## 8. Story and compliance statements (for later months; not entered at setup)

- **Nov 2026 (start-up).** *What changed?* Baseline survey completed (511 households); BEmONC batch 1 trained 24 (17 female, 7 male); WDA orientation round 1 (60 leaders); rehabilitation started at 2 health posts. *What went wrong?* Rehabilitation at Kecha health centre waited 11 days for the contractor. *What did people say?* Husbands asked for the education sessions after market prayers, not on weekday mornings.
- **Dec 2026.** *What changed?* MWHs opened (2); pregnancy mapping covered 14 of 18 kebeles. *What went wrong?* First tracer-medicine stock-out (2.5 days average) — regional store transition. *Decision:* buffer stock at woreda level from January.
- **Jan 2027 (influx).** *What changed?* ~1,400 people arrived in Basha kebeles (woreda early-warning bulletin, 19 Jan); ANC and delivery caseload rose about 30 %. *What went wrong?* Stock-out days peaked at 5.5; one maternal death after a late referral (see GI-1); Situation report issued 22 Jan.
- **Feb 2027.** *What changed?* Outreach doubled; Penta3 recovering. *What went wrong?* Belg rains began; one outreach round in Kecha cancelled (road). *Next:* pre-position supplies before March.
- **Mar 2027.** *What changed?* Stock-outs back to 1.1 days; SBA rate at 61 %. *What went wrong?* Flooding cut the referral road for 3 days; two stretcher-team referrals took 6+ hours. *Lesson:* the maternity waiting home is the buffer when roads close.
- **Apr 2027.** Endline survey; close-out and handover; the honest misses: GI-1 (3 vs ≤ 2), OP1.3 (2.4 vs ≤ 2), OC1b (51 vs 55).

### Compliance statements (one per template compliance section, written by the PM)

- **Protection:** "Staff and volunteers signed the protection code of conduct. Two protection concerns in January were referred to the woreda protection focal point within 24 hours; neither concerned a programme participant."
- **Gender:** "Women's Development Army volunteers lead pregnancy identification; 97 % of WDA leaders oriented are women. Husbands' forums ran in all 18 kebeles."
- **Accountability to affected populations:** "Feedback boxes at all 12 facilities and during outreach; 41 comments in the period, 36 answered within a week."
- **Visibility:** EU emblem and "Funded by the European Union" on training materials, MWH signage and radio spots; one joint press note with the zonal health department in February.

---

## 9. Evidence plan (18 files; each linked to an activity and an indicator value at entry time)

| Folder | Example file | Linked to | Period | Sensitivity |
| --- | --- | --- | --- | --- |
| training | `nov-bemonc-batch1-attendance.pdf` | P-02 / OP1.1 | Nov 2026 | Internal |
| training | `nov-hep-refresher-prepost-summary.xlsx` | P-03 / OP1.1 | Nov 2026 | Internal |
| survey | `nov-baseline-household-survey-tables.pdf` | P-01 / OC2a, OC2b | Nov 2026 | Internal |
| survey | `nov-enumerator-training-attendance.pdf` | P-01 | Nov 2026 | Internal |
| rehab | `nov-healthpost-delivery-corner-photos-consent.jpg` | P-05 | Nov 2026 | Confidential |
| wda | `nov-wda-orientation-round1-attendance.pdf` | P-04 / OP2.1 | Nov 2026 | Confidential (names) |
| supply | `dec-tracer-stock-cards-all-facilities.xlsx` | P-09 / OP1.3 | Dec 2026 | Internal |
| supply | `jan-stockout-regional-store-memo.pdf` | P-08 / OP1.3 | Jan 2027 | Internal |
| mwh | `dec-mwh-basha-register-extract.pdf` | P-06 / OP1.2a | Dec 2026 | Highly sensitive (patient-level) |
| referral | `jan-referral-transport-log.pdf` | P-07 / OP1.2b | Jan 2027 | Highly sensitive |
| mdr | `jan-maternal-death-review-minutes.pdf` | GI-1 | Jan 2027 | Highly sensitive — never in donor exports |
| outreach | `jan-outreach-tally-kebeles-5-8.pdf` | P-10 / OP1.4 | Jan 2027 | Internal |
| situation | `jan-woreda-early-warning-bulletin.pdf` | Situation | Jan 2027 | Internal |
| education | `feb-community-education-register.pdf` | P-11 / OP2.2 | Feb 2027 | Internal |
| radio | `feb-radio-spots-log.pdf` | P-12 / OP2.2 | Feb 2027 | Internal |
| meetings | `mar-woreda-mnch-review-minutes.pdf` | P-13 / OP2.3 | Mar 2027 | Internal |
| survey | `apr-endline-household-survey-tables.pdf` | P-17 / OC2a, OC2b | Apr 2027 | Internal |
| finance | `apr-statement-of-expenditure.xlsx` | Final finance | Apr 2027 | Internal |

Evidence rules to exercise: the highly sensitive MWH register, referral log and MDR minutes stay out of donor exports unless explicitly included (and the preflight says so); attendance sheets with names are Confidential; the January early-warning bulletin grounds the Situation report's affected-population figure (named source and date).

---

## 10. Completed-activity records (examples for the run, entered month by month)

- Nov 3–7: baseline survey fieldwork (511 households, 22 enumerators). P-01.
- Nov 9–14: BEmONC batch 1 (24 participants: 17 F / 7 M; pre/post test pass 23 of 24). P-02.
- Nov 23–25: HEW refresher (60 HEWs). P-03.
- Nov 16: supervision round 1 (6 facilities). P-14.
- Dec 1: both MWHs opened (Basha 8 beds, Kecha 6 beds). P-06.
- Dec 7–18: pregnancy mapping, 14 kebeles, 926 pregnancies registered. P-15.
- Jan 11–16: BEmONC batch 2 (24 participants: 16 F / 8 M). P-16.
- Jan 19–22: influx response — two temporary ANC points in Basha kebele schools; outreach added. Situation report.
- Jan 21: **the late referral** — a 34-year-old mother referred from Kecha health post arrived after six hours; death review held 28 Jan (this is GI-1's third death; record honest, minutes highly sensitive).
- Feb 8–12: outreach doubled to 8 kebeles (P-10); one Kecha round cancelled (road).
- Mar 14–16: referral road flooded; stretcher teams moved 2 women; both delivered safely at Basha HC (records exist).
- Apr 5–23: endline survey (498 households). P-17.
- Apr 19–30: handover of MWH and equipment (signed handover certificates). P-18.
- One **withdrawn** record: a duplicate outreach tally for Kecha in February, withdrawn with a reason (T-11: withdrawn records never count).

---

## 11. Monthly data plan (synthetic; enter through the period Inputs grid)

### 11.1 Counts and rates

Blank = not due (never 0). "Cum." = cumulative to date. Sex splits add to the period value.

| Code | Nov | Dec | Jan | Feb | Mar | Apr (Final) | Target | Final vs target |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OP1.1 trained (period) | 84 (60 HEW + 24 batch 1) | 60 (WDA counts separately) | 24 (batch 2) | 0 | 0 | 0 | 132 | cum. 168 = 127 % (HEWs + 2 batches + WDA rounds; see note) |
| — of which female | 58 | 58 | 16 | 0 | 0 | 0 | | |
| OP1.2a MWH stays | 0 | 22 | 41 | 48 | 52 | 55 | 240 | cum. 218 = 91 % (honest miss) |
| OP1.2b referrals completed | 6 | 14 | 27 | 22 | 16 | 20 | 120 | cum. 105 = 88 % (honest miss) |
| OP1.3 stock-out days (avg) | 2.5 | 2.0 | **5.5** | 2.8 | 1.1 | 0.6 | ≤ 2 | avg 2.4 = **missed** |
| OP1.4 women at outreach | 290 | 410 | 520 | 780 | 640 | 610 | 3,600 | cum. 3,250 = 90 % (honest miss) |
| OP2.1 WDA leaders oriented (period) | 60 | 120 | 180 | 0 | 0 | 0 | 360 | cum. 360 = 100 % |
| OP2.2 people reached (period) | 640 | 1,850 | 2,300 | 2,650 | 2,400 | 2,150 | 12,000 | cum. 11,990 ≈ 100 % |
| OP2.3 meetings (period) | 2 | 2 | 2 | 2 | 2 | 2 | 12 | cum. 12 = 100 % |
| OC1a SBA % | 47 | 49 | 51 | 55 | 58 | 61 | 65 | **missed** (61 vs 65; rate —) |
| OC1b PNC-48h % | 30 | 34 | 38 | 43 | 48 | 51 | 55 | **missed** (51) |
| OC1c ANC4+ % | 38 | 40 | 39 | 43 | 46 | 49 | 55 | missed (49) |
| OC1d Penta3 % | 63 | 64 | **57** | 66 | 71 | 74 | 78 | missed (74) |
| GI-1 maternal deaths (period) | 0 | 1 | **1** | 0 | 0 | **1** | ≤ 2 (cum.) | cum. 3 = **missed** — honest reporting |

Note: OP1.1 overshoots because the 60 HEWs in November and the WDA-oriented volunteers were counted with the two BEmONC batches (24 + 24 = 48) plus 60 HEW refreshers + 60 late top-up HEWs from the influx response = 168; the plan is entered honestly (the app shows the overshoot rather than capping).

### 11.2 Survey indicators

| Code | Baseline (Nov 2026) | Endline (Apr 2027) | Target | Result |
| --- | --- | --- | --- | --- |
| OC2a danger-sign knowledge | 24 % | 43 % | 45 % | missed narrowly |
| OC2b first-trimester ANC | 31 % | 51 % | 50 % | met |

### 11.3 Finance (EUR, cumulative; entered only in the Final, verified before generation)

| Budget line | Budget | Expended |
| --- | --- | --- |
| Personnel | 148,000 | 145,200 |
| MNCH medicines and supplies | 96,000 | 93,400 |
| Rehabilitation, MWH and equipment | 74,000 | 71,800 |
| Referral transport and outreach | 90,000 | 86,100 |
| Training | 46,000 | 44,300 |
| Community mobilisation and radio | 26,000 | 21,300 |
| **Total** | **480,000** | **462,100 (96.3 %)** |

Underspend driven by the cancelled February outreach round and cheaper local radio slots; explained in §10 of the Final.

---

## 12. Setup checklist (run order, UI only)

1. **Login** `mnpiracha@gmail.com` at `donordesk.online`.
2. **New project wizard** (`/projects/new`): title `[DEMO-11] Emergency Maternal, Newborn and Child Health Response in Demo Zone, South Ethiopia (EMNCH-SE)`, code `ET-MNCH-SE-20261021`, donor `European Union (ECHO — European Civil Protection and Humanitarian Aid Operations)`, implementer SEHDA, partner Demo Zone Health Department, country **Ethiopia**, region South Ethiopia, district Basha and Kecha woredas, sector **Health**, 2026-11-01 → 2027-04-30, budget **480,000 EUR**, frequency **Monthly**, contact Meseret Bekele, description = §1 summary. Check the wizard does **not** silently pre-fill another country/sector/currency (demo-8 gotcha).
3. **Logframe import** (`/logframe/import`): paste the 24 rows (header `Level,Code,Title`).
4. **Indicator import** (`/logframe/indicators/import`): the 15-row CSV, linked by `Logframe Code`.
5. **Indicator semantics**: on all 15, set calculation (rates "Reported directly", counts "Sum of period values", OP1.3 "Average"), direction (lower: GI-1, OP1.3), basis ("Cumulative to date" for counts, "This period's value" for rates and OP1.3). 17 page visits — no bulk setting (demo-9-ET F-7).
6. **Templates**: upload the Monthly DOCX then the Final DOCX (`/templates/new`); wait out extraction (up to ~5 min); "Accept all" sections; **Approve**; make each the default for its type.
7. **Reporting profile** (`/setup/profile`): §7.1 values; wait for hydration before editing (demo-8 gotcha).
8. **Team** (`/team`): add the 8 stand-ins with §6 roles.
9. **Project settings**: time zone **Africa/Addis_Ababa** (per-project; organisation zone unchanged, D-2 in demo-9-ET).
10. **Work plan** (`/activities/plan/start`): tick all 14 logframe activities; set Monthly on P-04, P-08, P-09, P-10, P-11, P-12, P-13, P-14; set leads; create. Expect ~14 rules and ~40 expanded rows (under the 120 cap).
11. **Calendar** (`/reports/new`): create **November 2026 Monthly** (1–30 Nov, deadline 15 Dec, Monthly template default), then **"Create all 4 periods"** (Dec 2026 – Mar 2027) and the **January Situation report** (influx, 15–22 Jan, affected population with a named source). April stays for the closing plan.
12. **Setup checklist** shows READY; acknowledge it, activate the project; screenshots; **stop for review**.

---

## 13. Verification test points

| ID | Area | What to check | Pass when |
| --- | --- | --- | --- |
| T-1 | Wizard | No silent pre-fill of country/sector/currency | Ethiopia / Health / EUR chosen explicitly and shown |
| T-2 | Logframe import | 24 rows in one paste | Codes preserved; activities under outputs |
| T-3 | Indicator import | 15 rows linked by Logframe Code | All linked; rates "Calculation needs review" |
| T-4 | Semantics | All 15 configured | Rates show "—" in % of target; GI-1/OP1.3 judged lower-is-better |
| T-5 | Templates | Both DOCX extracted via LLM path | Monthly 8 sections; Final 11 with nesting; numbering kept |
| T-6 | Template defaults | Approved templates default per type | New-period form preselects each |
| T-7 | Profile | Second approver + finance typed | Saved; reload shows values |
| T-8 | Time zone | Project zone Africa/Addis_Ababa | Plan list "today" in Addis; org zone unchanged |
| T-9 | Plan | Monthly rows expand | ~40 rows created all-or-nothing; leads set |
| T-10 | Calendar | 5 monthly periods + 1 situation | Monthly type, template default, deadline 15 days after each month end; situation deadline +3 days |
| T-11 | Setup | Checklist READY | No blockers |

Later months (not at setup): honesty of the missed indicators (GI-1, OP1.3, OC1a/b/c/d), Situation report grounding, sensitive-evidence exclusion from exports, second-approver approval flow, plan delivery counts in the Final (T-23 of demo 9), EU visibility in exactly one section.

---

## 14. Risks and reviews (Phase 28.7, for the run)

| Kind | Title | Seriousness | Action | Owner |
| --- | --- | --- | --- | --- |
| Supply | Tracer-medicine pipeline breaks in the influx | High | Buffer stock at woreda level; weekly forecast review in Jan–Feb | Logistics |
| Access | Belg rains cut the Kecha referral road | High | MWH as buffer; stretcher teams; pre-positioned supplies | PM |
| Security | Civil unrest along the regional border | Medium | Activity curfew plan; coordination with zonal security desk | PM |
| Data | Patient-level registers without lockable storage at 2 health posts | High | Lockable cabinets procured; spot checks | M&E Officer |

Risks never reach the report writer.

---

## 15. Open questions

- **Q-1.** Current national BEmONC/ENC training package edition and immunisation protocol — verify before donor copy.
- **Q-2.** EDHS 2019 exact figures (§2) marked *(verify)*.
- **Q-3.** ECHO's actual monthly-report format for this HIP year is NOT copied — the templates are EU-styled synthetic documents; wording is deliberately ECHO-like but must not be presented as the donor's real format.
- **Q-4.** Belgian-rain timing (Feb–May) and the influx scenario are illustrative.

---

## 16. Setup run log (2026-10-21 — stopped for review)

Run on production `https://donordesk.online`, tenant GEC, account `mnpiracha@gmail.com` (tenant admin), **one visible browser driven through the web UI only** — no API script, no database write. The password was used only in the browser login. Scenario: §1–§12 above.

**Project:** `4ffaf654-1cfe-4ae1-ba4a-884274b92ec5`, code `ET-MNCH-SE-20261021`, status **ACTIVE** (setup acknowledged, then activated), sector HEALTH, Ethiopia, 2026-11-01 → 2027-04-30, EUR 480,000, monthly reporting.

### What is set up

| Area | Result |
| --- | --- |
| Project (wizard) | Created in 3 steps. Country pre-filled "Kenya" from the last project and currency "ETB" from the country — both **labelled** "Suggested from your last project" and changed by hand to Ethiopia / EUR. Sector Health, monthly frequency, contact and description set |
| Logframe | **24 items** pasted in one go (`Level,Code,Title` CSV): goal G, outcomes OC1/OC2, outputs 1.1–1.4 and 2.1–2.3, activities A1.1.1–A2.3.2. "Created 24 logframe items", codes kept, hierarchy right |
| Indicators | **15 created** from one CSV paste, each linked by `Logframe Code`. The logframe page shows 1 indicator on the goal, 4 on OC1, 2 on OC2 and one on each output |
| Indicator semantics | All 15 configured, one page each: rates (OC1a–d, OC2a–b) "Reported directly", counts "Sum of period values" with "Cumulative to date", OP1-3 (stock-out days) "Average" of period values. Direction: **lower is better** on GI-1 (maternal deaths) and OP1-3; higher is better on the other 13. Every save confirmed "Saved. New drafts will use this calculation." |
| Donor templates | Two DOCX files generated for the demo and uploaded: **Monthly** (8 sections, 2 with word limits, 9 headings read from the file) and **Final** (11 sections + 11 sub-sections). Both extracted through the **LLM path** (`AI extracted — glm-5.3-flash`), all sections accepted, both **Approved** (v3 each), and each set as **default for its type** |
| Reporting profile | Language `en`, tone Formal, writing style, audience notes, 5 formatting rules, 5 special requirements, deadline offset **15 days**, **second approver ON**, financial figures **"Type them in"**. Re-read after saving: every value persisted |
| Team | **8 members** assigned with roles: 2 Project Managers, 1 M&E Officer, 3 Field Officers, 2 Grants Officers (the stand-in accounts of §6) |
| Project time zone | **Africa/Addis_Ababa** set on the project (the organisation's zone was not changed) |
| Work plan | "Start from my logframe" created **44 rows** from the 14 logframe activities (8 one-off with the scenario's dates, 6 repeating monthly) and 3 more rows were added by hand (BEmONC batch 2, endline survey, close-out) → **47 planned activities**, every row with a lead |
| Reporting calendar | **6 periods**: Nov 2026, Dec 2026, Jan 2027, Feb 2027, Mar 2027 (all Monthly, deadlines 15 days after each month end, taken from the template rule) + the **January Situation report** (influx, 15–22 Jan, built-in structure, affected population 1,400 with the named source). The April Final is left to the guided closing report, as the app prescribes |
| Setup checklist | **READY**, no blockers: workspace *not required*, donor template *22 reviewed required sections*, logframe and indicators *15 reportable of 15*, reporting profile *en · formal*, team *staff assigned*. Acknowledged, then the project was **activated** |

### Deviations from the scenario document

- **WDA orientation** (§5, P-04, "monthly ×3") and **radio messages** (§5, P-12, "monthly ×4") are fixed windows in the app (30 Nov 2026 – 29 Jan 2027 and 1 Dec 2026 – 31 Mar 2027): the wizard's "Monthly" means *repeat to the end of the project*, so it was not used for these two.
- **Indicators: 15, not 17** — the scenario table has 15 rows; the earlier "17" in §4/§12 was a slip and has been corrected.
- **Situation report deadline 25 Jan 2027**, not 27 Jan: the app's rule for a situation report is three days after the period ends, and the app owns that rule.
- The **April 2027 Final** period is not created: the app creates the closing report from its own guided steps, and creating it early would close the cadence.
- **Standing statements** (§7.1) are not in the reporting profile: they are saved per compliance section from a report's compliance panel, so they belong to the month-1 work.

### Findings (Sev, Step, What happened, Status)

| # | Sev | Step | What happened | Status |
| --- | --- | --- | --- | --- |
| F-1 | L | Project wizard | Country and currency are pre-filled from the last project (Kenya, then ETB from the country). Both pre-fills are now **labelled** ("Suggested from your last project"), so they are visible — unlike the silent pre-fill recorded in demo 8 | Info (improved) |
| F-2 | L | Work-plan wizard | The 14 activities are listed under one group whose heading is a single output's title ("2.3 Woreda health offices use MNCH data to manage services"), although the list holds activities from seven outputs. The heading misleads | Open (UX) |
| F-3 | L | Work-plan wizard | Marking a row "Monthly" removes that row's date inputs, so the form changes shape while it is being filled | Info |
| F-4 | L | Reporting profile | The second-approver switch saves on toggle and leaves its confirmation message on screen; a later toggle reads the older message until the page is reloaded | Info |
| F-5 | Info | Work-plan wizard | Step 3 is labelled "Review" (not "Next"), and the summary line "44 activities, 6 repeating monthly" appears only at the end — the demo-9-ET wording fix is live | Info (as documented) |
| F-6 | Info | Planned list / Timeline | The planned list and the Timeline render without the endless-re-render loop of demo 9-ET F-1; 47 rows and the six-month scale draw correctly | Fixed since demo 9 |
| F-7 | Info | Donor template | Both DOCX files extracted through the LLM path with the donor's word limits, mandatory questions, required tables and the EU disclaimer sentence carried into the sections | None |

### Decisions for you (D)

- **D-1 The project is ACTIVE.** The setup checklist was acknowledged and the project activated, so periods, values and reports can be entered now. It can be paused again from project Settings if you prefer to keep it as a draft.
- **D-2 The calendar is complete except the closing report.** Dec 2026 – Mar 2027 were created in one action ("Create all 4 periods"); April 2027 is left to the guided closing plan, as the app prescribes.
- **D-3 The stand-in team.** No accounts were created; the eight existing organisation accounts stand in for the fictional people of §6, exactly as in the demo-9-ET run. Say the word and the scenario people are invited instead (the invite link is copied by hand, because email is not delivered in this build).
- **D-4 Monthly rows repeat to the end of the project.** Six of the fourteen plan rules are monthly series (mentoring, supply forecast, stock checks, outreach, community education, data review). If a series should stop earlier, the "Until" date is edited on the planned activity.
- **D-5 Month 1 (November 2026) is done** — see §17. The report is written, checked and submitted for review; it waits for a second approver. Nothing has been entered for December.

---

## 17. Month 1 run log — November 2026 (2026-10-21, same browser session)

Everything below was entered through the web UI on production, on the project of §16. Files used: `scripts/demo-mnch-et/mk_evidence_nov.py` and `mk_evidence_nov2.py` (synthetic November evidence, 14 files), written to `/tmp/kilo/dd11/evidence-nov/`.

### 17.1 What was entered

| Area | What was done | Result |
| --- | --- | --- |
| Activity records | **14 accepted** records for November: enumerator training (2–4 Nov), baseline survey fieldwork (3–7 Nov), BEmONC batch 1 (9–14 Nov), outreach clinics (9–12 Nov), rehabilitation of two delivery/newborn corners (2–24 Nov), supervision round 1 (16 Nov), stock and cold-chain checks (16–20 Nov), community education (16–18 Nov), referral transport started (15–30 Nov), HEW refresher (23–25 Nov), woreda data review (27–29 Nov), WDA orientation round 1 (30 Nov), EU visibility (30 Nov) | All **Accepted**; each with a logframe link, participants by sex where the evidence records them, and a summary / achievements / challenges / lessons / next steps |
| Evidence | **14 files** uploaded, all **Verified**, each linked to the November period; 9 of them also linked to the indicator they prove (OP1-1 ×2, OP1-2b, OP1-3, OP1-4, OP2-1, OP2-2, OP2-3, OC2a) | Evidence count on the period: 14 files |
| Indicator values | All **15** entered and **verified** (15/15): GI-1 0, OC1a 47 %, OC1b 30 %, OC1c 38 %, OC1d 63 %, OC2a 24 %, OC2b 31 %, OP1-1 84, OP1-2a 0, OP1-2b 6, OP1-3 2.5 days, OP1-4 290, OP2-1 60, OP2-2 640, OP2-3 2. Running totals filled for the eight cumulative indicators | The rate rows show "—" for % of target; OP1-1 and OP1-3 are judged lower-is-better |
| Sex breakdown | OP1-1 → Female 77 / Male 7 (sums to 84); OP2-2 → Female 377 / Male 263 (sums to 640) | The editor shows "Sex: 84 of 84" and "Sex: 640 of 640" |
| Plan delivery | The **9** plan rows whose planned end falls in November marked **Done** through the plan item's status control | The "Tell the story" panel no longer says activities were not held; the project Overview reads "Delivery — On track, 9 of 47" |
| Story | **5/5 answered**: what went well, challenges, why targets were missed, what changed, the lesson | Saved and re-read after a reload |
| Compliance statement | The Monthly template's compliance section (Protection, Gender and Accountability to Affected Populations) answered from the records | "1 statement is still to do" is gone |
| Report | **Generated** by the AI reporter (8 sections, `ai-reporter`, writer rules v6), one statement flagged, re-checked, all **8 sections approved**, **submitted for review** | November readiness **95 %**: Sections 100 %, Indicators 100 %, Evidence 100 %, Checklist 100 %, **Approval 50 %** (the second approver) |

### 17.2 What the report says (abridged)

- **§1 Summary** — no maternal death recorded; skilled birth attendance 46 → 47 %, newborn check 28 → 30 %; 24 midwives and nurses and 60 health extension workers trained (84 of the 132 target); 6 referrals of 120; 290 women at outreach of 3,600; 640 people in community education (377 women, 263 men); baseline survey of 511 households.
- **§2 Progress Against Expected Results** — the results table is built from the verified values, with % of target, a status per indicator and the data source of each figure; every count is "Below expectation", which is correct in month 1.
- **§3 Activities Implemented** — all nine planned activities, each with its dates, its reach and the verified source of the record.
- **§4 Outcome Indicators and Data Quality** — where every figure comes from (registers, the survey), what was checked in the month, and the known gaps (two health posts without a midwife in one week, two without a vaccine carrier, six kebeles not covered).
- **§5 Challenges, Risks and Mitigation** — the road closure as the materialised risk, with the five records it touched.
- **§6 Protection, Gender and Accountability** — the referral-slip instruction from the orientation, 58 of 60 leaders being women, 377 women and 263 men reached, and what the women's groups asked for.
- **§7 Visibility** — the EU emblem and the funding statement on 24 training folders, 60 refresher flipcharts, 24 session flipcharts, 60 team-leader cards and one signage panel; radio spots from December; the donor disclaimer sentence.
- **§8 Plan for the Next Month** — the four uncovered kebeles and the six uncovered education kebeles first in December, the two maternity waiting homes opening on 1 December, the remaining four rehabilitation sites, and the solar fridges.

### 17.3 Findings (Sev, Step, What happened, Status)

| # | Sev | Step | What happened | Status |
| --- | --- | --- | --- | --- |
| F-8 | M | Indicator grid | The row's "Breakdown (0) required" button opens nothing when the page has not been scrolled to the row; the editor only appears after a scroll into view | Open (UX) — the grid should scroll the row into view itself |
| F-9 | M | Indicator grid | A value can be **verified while its required breakdown is still missing** (OP1-1 was verified with an empty breakdown). The only way back is "Request correction" on the indicator page, which needs a reviewer note | Open — the verify action should refuse a row whose required breakdown is empty |
| F-10 | L | Activity form | The "Link to a planned activity" radio selection is not stored: a record created from the form keeps the logframe link but no `plannedActivityId`, so the plan row has to be marked Done separately for the delivery count to move | Open (UX) — the wizard's own "Mark done" flow is the path that sets both |
| F-11 | L | Plan item | The status control (Not started / Under way / Done) sometimes does not save on the first click; the second click works, with no message either way | Open (UX) — the control should report the save |
| F-12 | M | Rewrite with AI | "Rewrite with AI" **appends the officer's instruction as a visible "[Editor note: …]" paragraph** in the section instead of rewriting the prose. The section history shows it as version 2 ("Rewritten with AI", 300 words) | Open — the note must not enter the report |
| F-13 | L | Try AI again | On a hand-edited section, "Try AI again" → "Regenerate" leaves the text as it is when the AI reproduces it, records no new version, and the section keeps the "Written without AI" banner with no way to record why it was written by hand | Open (UX) |
| F-14 | L | Approval | The second-approver rule is enforced on the author, and the report lead set on the period does not change that: the report still says "you wrote this report", so a different person must approve | Info (by design) — the November report waits for a project manager or M&E officer other than the author |
| F-15 | Info | Readiness | The November period reads 95 %: Sections, Indicators, Evidence and Checklist are 100 %, Approval 50 % — the missing half is exactly the second approver | None |

### 17.4 Decisions for you (D)

- **D-6 The report waits for a second approver.** Nothing else is missing: the draft is written, every statement is backed by evidence, and all eight sections are approved. Any other project manager or M&E officer in the team (Amara Okafor, Anita Gurung, Zainab Lawan) can approve it; the app has already told them the report is waiting.
- **D-7 Section 7 was finished by hand** after the rewrite misbehaved (F-12), and it still carries the "Written without AI" banner. The text is grounded and the statements were re-checked, so nothing is missing but the marker.
- **D-8 The plan rows carry the delivery, not the records.** The nine November plan rows are marked Done; the records themselves are not linked to them (F-10). The report reads correctly either way, but the "People reached" view cannot join the two.
- **D-9 December is ready to start** the moment the November report is approved: the December period exists, the monthly template is its default, and the December story is written in §8 of this document.

### 17.5 Ids for reference (month 1)

| Item | Id |
| --- | --- |
| Reporting period — November 2026 | `87c7d0e1-a75a-4af2-9340-83fffc519da8` |
| Reporting period — January 2027 Situation | `ebf0b582-f4a6-4444-b1e3-9c02cd57287a` |
| Evidence — WDA orientation attendance | `f5fda8bc-f426-45c0-b1dc-b42d79c2d3f9` |
| Evidence — baseline survey tables | `94b37a90-a2c4-46d2-9ce1-791e84de5503` |
| Evidence — tracer stock cards | `c20a7c38-93e1-4238-9e54-1c824ff3cef7` |
| Evidence — EU visibility log | `b4920241-0081-41f7-ac43-f4be948a9764` |
| Plan row — BEmONC training (rule) | `770c9dc6-ff8a-4e7d-b2bd-bb1c33913621` |
| Plan row — survey (rule) | `9f01e0bf-1351-400f-b181-6fa5f5e658df` |

### Ids for reference

| Item | Id |
| --- | --- |
| Project | `4ffaf654-1cfe-4ae1-ba4a-884274b92ec5` |
| Donor template — Monthly | `6246de9a-aa45-46fe-8908-3d58c753534e` |
| Donor template — Final | `27cc65c4-cb72-4ca0-bb8d-4ad7a70f20f9` |
| Reporting period — November 2026 | `87c7d0e1-a75a-4af2-9340-83fffc519da8` |
| Reporting period — January 2027 Situation | `ebf0b582-f4a6-4444-b1e3-9c02cd57287a` |

Project page: `https://donordesk.online/projects/4ffaf654-1cfe-4ae1-ba4a-884274b92ec5`

### Files used (generated for the run)

`scripts/demo-mnch-et/` (in the repository, so the run is reproducible): `mk_templates_and_inputs.py` writes the two EU DOCX templates and the two CSV files; `logframe.csv` and `indicators.csv` are the exact text pasted into the app. Run it with `python3 scripts/demo-mnch-et/mk_templates_and_inputs.py` (needs `python-docx`); it writes the four files to `/tmp/kilo/dd11/`.

Screenshots of the run: `/tmp/kilo/dd11/shot-overview.png`, `shot-reports.png`, `shot-logframe.png`.

---

## 18. Month 2 run log — December 2026 (2026-10-22, production, demo tenant, one visible browser session)

Everything below was done through the web UI as a user would (account `mnpiracha@gmail.com`, tenant GEC). December is the second of the six monthly periods. Files used: `scripts/demo-mnch-et/mk_evidence_dec.py` (12 synthetic evidence PDFs; the plan's one `.xlsx` is a PDF because `openpyxl` is not installed on the machine that built them).

### 18.1 What was entered

| Area | What was done | Result |
| --- | --- | --- |
| Activity records | **13 records** for December through the activity form (one by the plain-words fill-in, one started from an earlier record, the rest typed): waiting homes opened, WDA rounds 2 and 3, pregnancy mapping, supply order, outreach (kebeles 5–8), stock and cold-chain checks, supervision round 2, community education (36 sessions, 1,850 people), radio spots, woreda review meetings, referral transport (14), rehabilitation, and one maternal death notification | All 13 accepted in one bulk action ("Select all waiting", with a note). Two (pregnancy mapping, supply) were saved without their plan link, then sent back for correction, linked and accepted again |
| Evidence | **12 files** uploaded inside the activity form, each with a type, a sensitivity and an indicator chosen at upload (two Highly sensitive, two Sensitive, one Public, the rest Internal) | 11 verified in bulk; one sent back with a reason ("Ask for a correction"), answered by a comment, then verified |
| Indicator values | **13 of 15** entered and verified (OC2a, OC2b are baseline/endline surveys): GI-1 1, OC1a 49, OC1b 34, OC1c 40, OC1d 64, OP1-1 60 (cum. 144), OP1-2a 22, OP1-2b 14 (cum. 20), OP1-3 2.0, OP1-4 410 (cum. 700), OP2-1 120 (cum. 180), OP2-2 1,850 (cum. 2,490), OP2-3 2 (cum. 4) | Sex breakdowns for OP1-1 (58/2) and OP2-2 (1,090/760) reconcile to their totals |
| Plan | 7 December rows marked Done through the status control; 5 ongoing rows accepted the "Mark under way?" suggestion | Overview "Delivery: On track, 16 of 47" |
| Story and statements | 5 of 5 story answers and the compliance statement, written from the December records (stock-out 2.5 → 2.0, one maternal death, late oxytocin issue) | Persisted across a reload |
| Report | Generated by the AI Reporter in about 2½ minutes (8 sections, writer rules v6), one statement flagged and decided with "This matches a verified indicator", all 8 sections approved, **submitted for review**, report lead set to Anita Gurung | December readiness 95 %: Approval is the missing half, held by the second-approver rule (the author cannot approve) |
| Change of plan | Buffer stock of oxytocin and magnesium sulphate at the health centres from January, linked to OP1-3 and the December report | Listed on the changes page |
| Risk | "The regional store is still moving to a new stock system" (might happen, medium, owner Ingrid Solberg) | On the Overview and the portfolio |
| Request | Ask Grace Achieng for the January outreach tally, due 5 Feb | Shown on the Overview Requests card (after the fix below) |
| Funding | A programme ("Ethiopia Health Humanitarian Programme (ECHO HIP 2026)") and the grant `ECHO/ET/BUD/2026/91066` (EUR 480,000), with the project placed under it | "1 project (1 active) · project budgets 480,000 EUR · awarded 480,000 EUR" |
| Plan item extras | A custom field "Woreda" (Basha / Kecha / Both), a monthly progress entry (22 people), a budget line MWH-OPS (EUR 36,000, 6,200 spent), three people linked by case code | All saved and reloaded correctly; a duplicate case code is refused |
| Targets and mapping | A target schedule on OP1-1 (Nov +24, +40 %; Dec +34, +31 % against it), one donor requirement matched to OP1-1, and the survey indicators' frequency set to "Baseline and endline survey" | Variance and mapping both read correctly |

### 18.2 Features verified live (all passed unless a finding says otherwise)

Role-based home and navigation; portfolio home and portfolio page; Project Overview v2; plain-words activity fill-in; draft restore; period derived from the date; plan-link suggestions; bulk accept; evidence upload with link-at-creation; evidence filters; evidence review (correct, verify, comment); indicator grid with suggestions, breakdowns and bulk verify; story and compliance statements ("Same as last month"); AI Reporter generation, flags and the confidentiality notice ("4 sensitive files"); second-approver rule; Data Center (sheet, charts, variance); management report; changes of plan; risks; requests; programmes and grants; framework history; Timeline drag with Save/Undo; custom fields, progress log, budget lines and people on a plan item; donor indicator mapping; target schedule; AI usage; security page; invitation form (outside partner option, not sent).

Not exercised: signing in with a second account (so Field Officer My week, the second approver's approval and the outside-partner view), two-step sign-in set-up (it would change the demo account), offline use, the organisation export download, and generating the January Situation report.

### 18.3 Findings (Sev: H high, M medium, L low; status as of the last release of the day)

| # | Sev | What happened | Status |
| --- | --- | --- | --- |
| F-2, F-19 | H | Deaths and stock-out days (lower is better) were read as "% of target": 2.5 against a target of 2 showed 125 % and "ahead of the clock". The web schema also dropped the flag the server sent | Fixed (releases `…112732`, `…115803`: Overview, Data Center, progress chart) |
| F-12 | M | Every rate read "latest —" on the Overview because "latest" took the last calendar period (empty) | Fixed (`…094518`) |
| F-22 | M | The Overview "Requests" card showed only requests assigned to the viewer, so a request I sent showed "None open" | Fixed (`…112732`) |
| F-20 | M | Management report showed Nov and Dec as 0 % ready (stored score) while the workspace said 95 % | Fixed (`…112732`) |
| F-26 | M | All sections written by the AI Reporter were costed at 0 (the run is named after the pipeline, not the model) | Fixed for new runs (`…112732`); earlier runs keep cost 0 |
| F-10, F-18 | M | Comment threads and the audit trail showed "User 5d4e833c"; three pages threw React hydration error #418 | Fixed (`…094518`, `…112732`) |
| F-23 | M | Framework history printed raw JSON and codes in its sentences | Fixed (`…112732`) |
| F-28 | M | Re-linking a record saved but reported "unexpected response shape" (wrong schema on the update action) | Fixed (`…115803`) |
| F-27 | M | The indicator edit form had no Frequency field, so a frequency such as "Survey" could not be corrected | Fixed (`…115803`) |
| F-6 | M | A saved record showed no planned activity and could not be re-linked | Fixed (`…112732`): shown on every record, editable while the record can be edited |
| F-3 | L | A report under review left its period saying "draft generated" | Fixed for new submissions (`…112732`). The two demo periods keep the old label until their next transition (a data repair was not run) |
| F-8 | L | Choosing an evidence filter and then clicking Apply straight away dropped the filter | Fixed (`…094518`) |
| F-9 | L | "Select all awaiting verification" also selected a file with an open correction request | Fixed (`…112732`) |
| F-7 | L | The activity form's logframe list offered Goal, Outcome and Output rows and then refused them | Fixed (`…112732`): those rows are disabled |
| F-5, F-25 | L | Submitting an activity or saving custom fields gave no confirmation | Fixed (`…112732`): a toast, and the activity form lands on the Completed tab |
| F-1 | L | Home "Your work" rows showed only "report · Open in My Work" | Fixed (`…112732`) |
| F-13 | L | "Same as last month" copied last month's figures with no warning | Fixed (`…112732`): a warning stays until the text is edited |
| F-17 | L | A chart axis ended on "114.554999…%" | Fixed (`…112732`) |
| F-21, F-24 | L | Period lists named every period "Monthly report report" with no month; "Comes after" listed six identical monthly titles | Fixed (`…112732`): "Monthly report · Dec 2026", dates in the picker |
| F-4 | Info | The plain-words fill-in uses the first sentence as the title (shortened when long) and the first place it finds | By design |
| F-11 | L | Every plan row shows two "Done" controls (the big button and the status control); two December rows were set to Done by the user's account at 08:38 UTC without a click my scripts made | Open: Plan §16 decision; the unattributed change is unexplained (the plan history records it) |
| F-15 | M | In the report's results table, "This period" shows the cumulative-to-date value for summed indicators (OP1-1: 144 while the month's value is 60) | Open: the table is built by the worker (`artifact_builder.py`); the header needs "To date" or the column needs the period value |
| F-16 | L | A sentence listing four verified rates is flagged "the number does not match the evidence; the calculation does not add up" | Open: the reason copy |

Also found and fixed in passing: the audit chain verification job and the stopped Kestra service (release `…073456`, see `pending.md`), and a boot test that timed out at 30 s on a loaded machine.

### 18.4 Decisions for you (D)

- **D-10 November and December both wait for a second approver.** The author (the account that generated them) cannot approve. Amara Okafor, Anita Gurung or Zainab Lawan can; their passwords are not in this run.
- **D-11 The two demo periods still read "draft generated".** Run `UPDATE "ReportingPeriod" SET status = 'UNDER_REVIEW'` for the periods whose draft is under review, or leave it: it corrects itself on the next transition. The change was blocked here because it is a direct production write.
- **D-12 Plan §16 (a second "Done" control)** is still undecided; see F-11.
- **D-13 January is next.** Create the January story and inputs; the Situation report (15–22 Jan) and the influx are in §8.

### 18.5 Ids for reference (month 2)

| Item | Id |
| --- | --- |
| Reporting period — December 2026 | `ba428d4d-9175-4ecc-9650-a7521db798ac` |
| Reporting period — January 2027 | `38b87286-c63f-4273-bde0-54bb42ccb0d8` |
| Plan item — Operate two maternity waiting homes… | `6dd0209c-8971-4597-8b7c-fecfe2dcf0e9` |
| Evidence — supply delivery notes (corrected then verified) | `fb2c9e95-a887-401c-b28c-22c2015e225d` |
| Releases of the day | `20261022073456`, `…094518`, `…112732`, `…115803` |
