# Verification demo 12 — 6-month UNICEF-funded MNCH project in six localities of Sudan (scenario, setup and month 1)

**DonorDesk Version 2.007+** (production, tenant GEC, `mnpiracha@gmail.com`)

A complete six-month **Maternal, Newborn and Child Health (MNCH)** programme for displaced and host communities in **six localities of Sudan**, funded by **UNICEF** under a Programme Cooperation Agreement. The scenario is written first (this document); the project is then built and used **through the web UI only, as a real user would** — one visible browser, no API scripts, no database writes — from the wizard through setup, month-1 data entry and the first monthly report.

**The aim is not to produce a report. It is to find everything that is broken, slow, hidden or confusing.** Every point where the run hesitates, needs a second attempt, reads ambiguously or needs prior knowledge is logged as a finding (§15) with severity and fixed on the way (fix → test → deploy the same day, like demos 8–11).

All organisations, people, agreement numbers and figures are **fictional**. Locality and state names are real places, but the supported facilities, boundaries drawn in the custom layer, people, caseloads and every number in the data plan are synthetic. No real patient data is used. Sudan-specific figures in §2 are marked *(verify)* where they must be checked before donor copy.

New compared with demo 11 (it is a different shape of project, to reach features demo 11 never touched): **six named locations** that drive the **site map**, **location disaggregation** and the **Infographics Studio**; a **USD** budget and **UNICEF** (not EU) templates; a **second real sign-in** (invited approver, outside partner); **organisation-level custom boundaries**; imports of the work plan and activities; **Copy project setup**; **Data Center import**; **organisation export**.

---

## 1. The project

| Field | Value |
| --- | --- |
| Project title | **[DEMO-12] Strengthening Maternal, Newborn and Child Health Services for Displaced and Host Communities in Six Localities, Sudan (SMNCH-SD)** |
| Project code | `SD-MNCH-20261101` |
| Donor | **UNICEF** — Sudan Country Office, Health Section |
| Agreement no. (fictional) | `PCA/SDCO/2026/0412` (Programme Cooperation Agreement) |
| Implementer (lead) | Nile Basin Health and Relief Organisation (**NBHRO**, fictional) |
| Partners | State Ministries of Health of the six states (counterparts); Sudanese Red Crescent state branches (community mobilisation; fictional agreements) |
| Sector | HEALTH (nutrition screening is a component, not a second sector) |
| Country | Sudan |
| Currency | **USD** |
| Start / end | **2026-11-01 → 2027-04-30** (six months) |
| Budget | **USD 1,200,000** (UNICEF 100 %) |
| Time zone | Africa/Khartoum (project-level) |
| Project lead | Project Manager: Dr. Amira Hassan (fictional) |
| Report cadence | Monthly (Nov 2026 – Mar 2027), **Final** closing period (Apr 2027), one **Situation** report (Gedaref displacement influx, Feb 2027) |
| Reporting language | English (Arabic place names kept in brackets where useful, e.g. "Kassala (كسلا)") |

### The six locations (the map, the location disaggregation, the infographics)

| # | Location (as typed everywhere — one spelling) | State | Role | Supported PHC centres | Typed spelling traps |
| --- | --- | --- | --- | --- | --- |
| L1 | **Kassala** | Kassala | Host + eastern displacement corridor | 2 | "Kassala town", "Kassala City" (must normalise to one place) |
| L2 | **Gedaref** | Gedaref | Largest displaced caseload; influx in Feb | 2 | "Gedaref City", "Al Gadarif" (Arabic transliteration — gazetteer may not know it; a deliberate unplaced/hand-pin test) |
| L3 | **Ed Damazin** | Blue Nile | Host + returnee flows, flood-prone | 2 | "Damazin" |
| L4 | **Rabak** | White Nile | Large camp-based displaced population | 2 | "Rabak locality" |
| L5 | **Sinja** | Sennar | Host, road hub for supplies | 2 | "Singa" |
| L6 | **Port Sudan** | Red Sea | Logistics gateway; supply route risk | 2 | "Bur Sudan" |

Plus one **hand-pinned** place that the gazetteer will not know: **"Um Gargur IDP gathering site, Gedaref"** (illustrative name), pinned by hand on the map and typed with no gazetteer match.

Programme footprint (synthetic): 12 supported PHC centres (2 per locality), 6 mobile outreach teams (1 per locality), ~34 displacement gathering sites and villages covered by outreach, catchment ~410,000 people, ~95,000 women of reproductive age, ~68,000 children under five.

### One-paragraph summary (wizard description)

NBHRO and the State Ministries of Health restore life-saving maternal, newborn and child health services for displaced and host communities in six localities — Kassala, Gedaref, Ed Damazin, Rabak, Sinja and Port Sudan — where conflict-related displacement and a damaged supply chain have left primary health care centres without trained staff, equipped delivery rooms or reliable vaccines. Midwives, nurses and community health workers are trained in emergency obstetric and newborn care, IMNCI and immunisation; delivery rooms and newborn corners at twelve PHC centres are rehabilitated and equipped; essential medicines, vaccines and nutrition supplies are forecast, delivered and cold-chain checked every month; mobile teams bring ANC, PNC, immunisation catch-up and malnutrition screening to gathering sites and remote villages; community health volunteers, mother support groups and radio carry the messages that make families seek care early. The programme reports the indicators the state health information systems already collect, by locality.

---

## 2. Context and needs *(verify = check before donor copy)*

- **Crisis.** Conflict since April 2023 has displaced millions inside Sudan; Kassala, Gedaref, Blue Nile, White Nile and Sennar States host large displaced populations, and Port Sudan is the humanitarian logistics gateway *(verify current IOM-DTM / OCHA figures)*.
- **Health system.** A large share of health facilities in conflict-affected areas are non-functional; host-state facilities are over capacity, with shortages of trained midwives, medicines, vaccines and fuel for the cold chain *(verify WHO/MoH figures)*.
- **Maternal and newborn.** Sudan's maternal mortality ratio is estimated at roughly **295 per 100,000 live births** and neonatal mortality at about **29 per 1,000** *(verify)*. Skilled attendance at birth is far lower among displaced women than the national average; the programme's baseline facility rate is **41 %**.
- **Immunisation and nutrition.** Zero-dose children are concentrated among displaced households; routine EPI sessions were interrupted in 2023–25 *(verify)*. Severe acute malnutrition is high among under-fives in displacement sites; referral from screening to treatment is the weak link (baseline **52 %** admitted after referral).
- **Seasonality and access.** The rainy season (Jun–Oct) is over by the start; the Feb influx and the cold season raise respiratory and diarrhoeal caseloads; road access between Port Sudan and the interior is the main supply risk.
- **Synthetic scenario facts (not real events):** Gedaref receives ~5,200 newly displaced people in the first week of February 2027 (source named in the Situation report: "Gedaref State HAC flash update, 6 Feb 2027" — fictional), and the Port Sudan–Kassala supply route is blocked for 9 days in January.

---

## 3. Results framework (logframe) — 25 rows

Generated by `scripts/demo-mnch-sd/mk_inputs.py` → `/tmp/kilo/dd12/logframe.csv` (header `Level,Code,Title`). 1 goal, 2 outcomes, 7 outputs, 15 activities.

| Level | Code | Text |
| --- | --- | --- |
| GOAL | G | Maternal, newborn and child deaths and illness are reduced among displaced and host communities in six localities of Kassala, Gedaref, Blue Nile, White Nile, Sennar and Red Sea States, Sudan |
| OUTCOME | OC1 | Women, newborns and children under five use quality, timely maternal, newborn and child health, immunisation and nutrition-screening services at supported PHC centres and through mobile teams |
| OUTCOME | OC2 | Caregivers and communities practise safe motherhood, early care-seeking and optimal infant and young child feeding |
| OUTPUT | 1.1 | Midwives, nurses and community health workers competent in EmONC, essential newborn care, IMNCI and immunisation |
| OUTPUT | 1.2 | Supported PHC centres provide safe delivery, newborn care and referral |
| OUTPUT | 1.3 | Essential MNCH medicines, vaccines and nutrition supplies continuously available; cold chain working |
| OUTPUT | 1.4 | Displaced and remote communities reached by monthly mobile integrated outreach |
| OUTPUT | 2.1 | Community health volunteers identify pregnancies, sick children and malnutrition early and refer |
| OUTPUT | 2.2 | Caregivers, men and leaders support facility delivery, immunisation and feeding practices |
| OUTPUT | 2.3 | State ministries of health use MNCH data to manage services |
| ACTIVITY | A1.1.1 | EmONC and essential newborn care training (two batches) |
| ACTIVITY | A1.1.2 | IMNCI, immunisation and nutrition-screening refresher |
| ACTIVITY | A1.1.3 | Monthly mentoring and supportive supervision |
| ACTIVITY | A1.2.1 | Rehabilitate and equip delivery rooms and newborn corners at 12 PHC centres |
| ACTIVITY | A1.2.2 | Operate the community referral transport scheme |
| ACTIVITY | A1.3.1 | Monthly supply forecasting, ordering and last-mile delivery |
| ACTIVITY | A1.3.2 | Monthly stock and cold-chain checks |
| ACTIVITY | A1.4.1 | Monthly mobile integrated outreach in gathering sites and remote villages |
| ACTIVITY | A1.4.2 | Catch-up vaccination rounds for zero-dose children |
| ACTIVITY | A2.1.1 | Train community health volunteers |
| ACTIVITY | A2.1.2 | Village pregnancy and under-five registration with referral cards |
| ACTIVITY | A2.2.1 | Mother support groups and community education sessions |
| ACTIVITY | A2.2.2 | Radio messages and community dialogues |
| ACTIVITY | A2.3.1 | Monthly state MNCH data review meetings |
| ACTIVITY | A2.3.2 | Baseline and endline coverage survey |

---

## 4. Indicators (17) — `/tmp/kilo/dd12/indicators.csv`

Columns: `Code,Name,Type,Baseline,Target,Unit,Frequency,Disaggregated,Logframe Code,Data source`. Rates arrive from the import as "calculation needs review"; every one is set by hand (T-4). Codes use the hyphen form the app prints (OP1-1).

| Code | Level | Indicator | Type / unit | Direction | Freq. | Baseline | Target | Calculation / basis | Breakdown |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GI-1 | G | Institutional maternal deaths at supported facilities | Number | **Lower** | Final | 6 | ≤ 3 | Sum / cumulative | Location |
| OC1a | OC1 | Deliveries attended by a skilled birth attendant | % | Higher | Monthly | 41 | 60 | Reported directly | — |
| OC1b | OC1 | Newborns with PNC check within 48 h | % | Higher | Monthly | 22 | 45 | Reported directly | — |
| OC1c | OC1 | Pregnant women with 4+ ANC visits | % | Higher | Monthly | 29 | 48 | Reported directly | — |
| OC1d | OC1 | Children < 1 year receiving Penta3 | % | Higher | Monthly | 58 | 75 | Reported directly | — |
| OC1e | OC1 | Zero-dose children identified and vaccinated | Number | Higher | Monthly | 0 | 6,000 | Sum, cumulative | Location, sex |
| OC1f | OC1 | Children 6–59 m with SAM referred and admitted | % | Higher | Monthly | 52 | 80 | Reported directly | — |
| OP1-1 | 1.1 | Midwives, nurses, CHWs trained | Number | Higher | Monthly | 0 | 180 | Sum, cumulative | Sex, location |
| OP1-2a | 1.2 | PHC centres with rehabilitated, equipped delivery rooms | Number | Higher | Monthly | 0 | 12 | Sum, cumulative | Location |
| OP1-2b | 1.2 | Referrals completed by project transport | Number | Higher | Monthly | 0 | 300 | Sum, cumulative | Location |
| OP1-3 | 1.3 | Tracer-medicine stock-out days (avg per facility/month) | Number (days) | **Lower** | Monthly | 5 | ≤ 2 | Average | — |
| OP1-4 | 1.4 | Women and children reached by mobile outreach | Number | Higher | Monthly | 0 | 18,000 | Sum, cumulative | Location, sex |
| OP2-1 | 2.1 | Community health volunteers trained and active | Number | Higher | Monthly | 0 | 300 | Sum, cumulative | Sex, location |
| OP2-2 | 2.2 | Caregivers reached by community education | Number | Higher | Monthly | 0 | 24,000 | Sum, cumulative | Sex, location |
| OP2-3 | 2.3 | State MNCH data review meetings held | Number | Higher | Monthly | 0 | 12 | Sum, cumulative | — |
| OC2a | OC2 | Recently delivered women knowing ≥ 3 newborn danger signs | % | Higher | Survey (Nov, Apr) | 21 | 40 | Reported directly | — |
| OC2b | OC2 | Infants < 6 m exclusively breastfed | % | Higher | Survey (Nov, Apr) | 38 | 55 | Reported directly | — |

Location **targets** (a schedule planned by location) are set on OP1-1 (30/30/30/30/30/30), OP1-4 (3,000 each) and OP1-2a (2 each) — the project target is never divided by the app, a location with no planned target must read "Not planned". Rates have no "% of target".

---

## 5. Work plan (Phase 28) — built with *Start from my logframe*, then extended by hand and by import

Locations are typed in the plan form's Location field (suggestions from the gazetteer). Monthly rows repeat to the end of the project (cap 120 per series).

| # | Planned activity | Logframe | Timing | Recurrence | Location |
| --- | --- | --- | --- | --- | --- |
| P-01 | Baseline MNCH coverage survey (training, fieldwork, cleaning) | A2.3.2 | 2026-11-02 → 11-20 | One-off | Six localities (all) — *unplaced on the map by design* |
| P-02 | EmONC batch 1 (30 midwives and nurses, 6 days) | A1.1.1 | 2026-11-09 → 11-14 | One-off | Kassala |
| P-03 | IMNCI/immunisation/nutrition-screening refresher (24 staff) | A1.1.2 | 2026-11-16 → 11-20 | One-off | Gedaref |
| P-04 | CHV training rounds (10 per locality per round) | A2.1.1 | 2026-11-23 → | Monthly | Six localities (all) |
| P-05a–f | Rehabilitate 2 PHC delivery rooms — <locality> (six rows) | A1.2.1 | staggered 2026-11-02 → 2027-02-28 | One-off | each of the six |
| P-06 | Referral transport scheme running | A1.2.2 | 2026-11-15 → 2027-04-30 | One-off (continuous) | Six localities (all) |
| P-07 | Supply forecast, order, last-mile delivery | A1.3.1 | week 1 of each month | Monthly | Sinja (hub) |
| P-08 | Stock and cold-chain checks | A1.3.2 | week 3 of each month | Monthly | Six localities (all) |
| P-09 | Mentoring and supportive supervision round | A1.1.3 | week 3 of each month | Monthly | Six localities (all) |
| P-10a–f | Mobile integrated outreach — <locality> (six rows) | A1.4.1 | week 2 of each month | Monthly | each of the six |
| P-11 | Catch-up vaccination round | A1.4.2 | week 4 of each month | Monthly | Six localities (all) |
| P-12 | Outreach to Um Gargur IDP gathering site | A1.4.1 | 2026-11-16 → 11-18 | One-off | hand-pinned, Gedaref |
| P-13 | Mother support groups and education sessions | A2.2.1 | week 2–4 of each month | Monthly | Six localities (all) |
| P-14 | Radio messages and community dialogues | A2.2.2 | 2026-12-01 → 2027-03-31 | One-off window | Port Sudan (station) |
| P-15 | Village pregnancy and under-five registration | A2.1.2 | 2026-12-07 → 12-18 | One-off | Rabak |
| P-16 | EmONC batch 2 (30 participants) | A1.1.1 | 2027-01-11 → 01-16 | One-off | Ed Damazin |
| P-17 | State MNCH data review and action meeting | A2.3.1 | last week of each month | Monthly | Kassala |
| P-18 | Endline MNCH coverage survey | A2.3.2 | 2027-04-05 → 04-23 | One-off | Six localities (all) |
| P-19 | Close-out: handover of facilities and equipment, reconciliation | (none) | 2027-04-19 → 04-30 | One-off | Port Sudan |

To exercise the **import**: P-13 to P-19 are loaded by *Plan → Import* (pasted text) instead of the wizard, including one deliberate bad row (unknown logframe code) that must block the import with its row number named (T-15).

---

## 6. Team (stand-in accounts + two real new sign-ins)

Existing accounts stand in for fictional staff (as in demos 9–11); **two people are invited and sign in for real** to exercise what no earlier demo did.

| Scenario person | Role | Account | Project role |
| --- | --- | --- | --- |
| Dr. Amira Hassan | Project Manager, report author | Amara Okafor | Project Manager |
| Yusra Idris | M&E Officer | Anita Gurung | M&E Officer |
| Dr. Omer Babiker | Health Advisor | Zainab Lawan | Project Manager |
| Hassan Ali (Kassala/Port Sudan) | Field Officer | Ram Bahadur Chaudhary | Field Officer |
| Mona Adam (Gedaref/Rabak) | Field Officer | Grace Achieng | Field Officer |
| Salih Khamis (Sinja/Ed Damazin) | Field Officer | P25 Check Field Officer | Field Officer |
| Tarig Osman | Logistics Officer | Ingrid Solberg | Grants Officer |
| Nadia Farah | Finance Officer | Najeeb Piracha (own account) | Grants Officer |
| **Invited #1** — Sara Mahgoub, second approver | Project Manager | new account via invitation link (copied by hand; email is not delivered in this build) | Project Manager |
| **Invited #2** — external reviewer (UNICEF focal point, outside partner) | Viewer, **external**, this project only | new account via invitation with *outside partner* | Viewer (external) |

Second-approver rule: the author cannot approve. The report is generated by the owner account; **Sara Mahgoub (invited #1) approves it in a second browser profile** (first real test of approval and My work).

---

## 7. Reporting setup

### 7.1 Profile
English, Formal, deadline offset **15 days**, **second approver ON**, financial figures "Type them in". Formatting: UK spelling ("organisation", "immunisation"), thousands separators, "the programme". Standing statements: (a) "All service statistics are from the supported facilities' registers and outreach tally sheets unless a survey is named."; (b) "Women and children are identified by chart number only; no personal names appear in any extract." Special requirements: UNICEF acknowledgement quoted in **exactly one** section.

### 7.2 Templates (generated by `mk_inputs.py`)
1. **UNICEF PCA Monthly Progress Report (SMNCH-SD)** — 8 sections (1 Summary of the Month; 2 Progress Against Expected Results; 3 Activities Implemented by Locality; 4 Service Coverage and Data Quality; 5 Access, Security, Risks and Mitigation; 6 Protection, Gender and Accountability to Affected Populations; 7 Visibility and Communication; 8 Plan for the Next Month). Word limits 250 (§1) and 400 (§5).
2. **UNICEF PCA Final Programme and Financial Report (SMNCH-SD)** — 11 sections with nesting (2.x, 3.x, 4.x); §10 financial table.
Never title a section "Overview"/"Abstract". Both approved and set as defaults for MONTHLY and FINAL.

### 7.3 Calendar
| Period | Type | Dates | Deadline |
| --- | --- | --- | --- |
| November 2026 … March 2027 | Monthly ×5 | calendar months | 15 days after month end |
| February 2027 — Gedaref influx | Situation | window 2027-02-01 → 02-08, as-of 02-08 | app rule (+3 days) |
| April 2027 | **Final** | via the guided closing report only | — |

---

## 8. Story and statements by month (month 1 is entered in this run)

- **Nov 2026 (start-up).** *What changed?* Baseline coverage survey in all six localities (2,610 households, 27 enumerators); EmONC batch 1 trained 30 (24 F / 6 M) in Kassala; IMNCI refresher 24 in Gedaref; 6 PHC delivery rooms rehabilitation started (one per locality); mobile outreach started in all six; CHV round 1 trained 60 across the six. *What went wrong?* Port Sudan supply convoy delayed 4 days; Ed Damazin outreach lost two days to a flooded track. *What did people say?* Mothers at Rabak asked for evening sessions because mornings are spent collecting water.
- **Dec.** Rehabilitation continues; village registration in Rabak; first stock-out improvement; MWH-equivalent (waiting room) at Rabak opened.
- **Jan.** Port Sudan–Kassala route blocked 9 days: stock-out days peak 4.8; Penta3 dips (57→55); one maternal death (late referral from Sinja).
- **Feb.** Gedaref influx (~5,200 people) → Situation report; outreach doubled in Gedaref; catch-up rounds peak.
- **Mar.** Stock-outs 1.8 days; SBA 55 %.
- **Apr.** Endline; honest misses: GI-1 (4 vs ≤ 3), OP1-3 (avg 2.7 vs ≤ 2), OC1a–d, OC2a.

Compliance statements: Protection (code of conduct signed; zero concerns in Nov), Gender (CHV 73 % women; mother support groups in all six localities), Accountability (feedback boxes at 12 centres; 27 comments, 24 answered within a week in Nov), Visibility (UNICEF logo on 90 training folders, 12 facility signs, radio spots from Dec).

---

## 9. Evidence plan — November (16 files, each linked to an activity and, where it proves a value, to an indicator at upload)

| File | Type | Linked to | Sensitivity |
| --- | --- | --- | --- |
| `nov-baseline-survey-tables.pdf` | survey | P-01 / OC2a, OC2b | Internal |
| `nov-enumerator-training-attendance.pdf` | attendance | P-01 | Internal |
| `nov-emonc-batch1-attendance-kassala.pdf` | attendance | P-02 / OP1-1 | Confidential (names) |
| `nov-imnci-refresher-prepost-gedaref.pdf` | training | P-03 / OP1-1 | Internal |
| `nov-chv-round1-attendance.pdf` | attendance | P-04 / OP2-1 | Confidential (names) |
| `nov-rehab-site-photos-6-centres.png` | photo | P-05a–f / OP1-2a | Internal (no faces) |
| `nov-handover-certificate-kassala-phc1.pdf` | certificate | P-05a / OP1-2a | Internal |
| `nov-referral-slips-log.pdf` | referral | P-06 / OP1-2b | **Highly sensitive** (patient-level) |
| `nov-supply-delivery-notes.pdf` | supply | P-07 / OP1-3 | Internal |
| `nov-stock-cards-tracer-medicines.pdf` | stock | P-08 / OP1-3 | Internal |
| `nov-supervision-checklists.pdf` | supervision | P-09 | Internal |
| `nov-outreach-tally-six-localities.pdf` | tally | P-10 / OP1-4 | Internal |
| `nov-catchup-vaccination-tally.pdf` | tally | P-11 / OC1e | Internal |
| `nov-education-sessions-register.pdf` | register | P-13 / OP2-2 | Internal |
| `nov-state-data-review-minutes.pdf` | minutes | P-17 / OP2-3 | Internal |
| `nov-unicef-visibility-photos.png` | photo | Visibility | Public |

Rules to exercise: the highly sensitive referral log stays out of donor exports unless explicitly included (the preflight says so); attendance sheets with names are Confidential; one file is uploaded **wrong on purpose** (an unreadable scan) to see the refusal sentence (T-22).

---

## 10. November completed-activity records (≈ 20 records through the activity form; the first by plain words, one by "start from an earlier record", one offline)

Per-locality outreach is **one record per locality** so the location breakdowns have real sources.

| # | Dates | Record | Plan row | Location |
| --- | --- | --- | --- | --- |
| 1 | Nov 2–4 | Enumerator training (27 enumerators) | P-01 | Kassala |
| 2 | Nov 3–12 | Baseline fieldwork (2,610 households) | P-01 | Six localities |
| 3 | Nov 9–14 | EmONC batch 1 (30: 24 F / 6 M) | P-02 | Kassala |
| 4 | Nov 16–20 | IMNCI refresher (24 staff) | P-03 | Gedaref |
| 5 | Nov 23–25 | CHV round 1 (60: 44 F / 16 M; 10 per locality) | P-04 | Six localities |
| 6 | Nov 2–28 | Delivery-room rehabilitation started, first 3 centres handed over (Kassala 1, Gedaref 1, Port Sudan 1) | P-05 | Six rows |
| 7 | Nov 15–30 | Referral transport started (38 referrals) | P-06 | Six localities |
| 8 | Nov 2–6 | Supply order and delivery (Port Sudan convoy 4 days late) | P-07 | Sinja |
| 9 | Nov 16–20 | Stock and cold-chain checks | P-08 | Six localities |
| 10 | Nov 16–20 | Supervision round 1 | P-09 | Six localities |
| 11–16 | Nov 9–13 | Outreach — Kassala (260), Gedaref (240), Ed Damazin (210), Rabak (250), Sinja (190), Port Sudan (270) | P-10a–f | each |
| 17 | Nov 16–18 | Outreach to Um Gargur IDP site | P-12 | hand pin |
| 18 | Nov 23–27 | Catch-up vaccination round (410 zero-dose children) | P-11 | Six localities |
| 19 | Nov 16–27 | Mother support groups + education (2,100 caregivers) | P-13 | Six localities |
| 20 | Nov 26–27 | State MNCH data review meeting ×2 | P-17 | Kassala |
| — | Nov 17 | One **duplicate** Ed Damazin tally — entered then **withdrawn with a reason** (withdrawn records never count) | | |

---

## 11. Data plan (synthetic)

### 11.1 Monthly counts and rates ("Cum." = cumulative; blank = not due, never 0)

| Code | Nov | Dec | Jan | Feb | Mar | Apr | Target | Final vs target |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OP1-1 trained | **54** | 30 | 36 | 24 | 18 | 18 | 180 | 180 = 100 % |
| OP1-2a centres | **3** | 3 | 2 | 2 | 1 | 1 | 12 | 12 = 100 % |
| OP1-2b referrals | **38** | 40 | 52 | 55 | 48 | 57 | 300 | 290 = 97 % |
| OP1-3 stock-out days | **3.1** | 2.6 | 4.8 | 2.9 | 1.8 | 1.2 | ≤ 2 | avg 2.7 = **missed** |
| OP1-4 outreach | **1,420** | 2,600 | 3,300 | 3,600 | 3,500 | 3,200 | 18,000 | 17,620 = 98 % |
| OP2-1 CHVs | **60** | 60 | 60 | 60 | 60 | 0 | 300 | 300 = 100 % |
| OP2-2 caregivers | **2,100** | 3,500 | 4,600 | 4,900 | 4,700 | 4,000 | 24,000 | 23,800 = 99 % |
| OP2-3 meetings | **2** | 2 | 2 | 2 | 2 | 2 | 12 | 12 = 100 % |
| OC1e zero-dose | **410** | 780 | 1,100 | 1,350 | 1,300 | 1,000 | 6,000 | 5,940 = 99 % |
| OC1a SBA % | **42** | 45 | 48 | 52 | 55 | 57 | 60 | **missed** |
| OC1b PNC48 % | **24** | 27 | 30 | 34 | 38 | 41 | 45 | **missed** |
| OC1c ANC4+ % | **30** | 32 | 33 | 36 | 39 | 42 | 48 | **missed** |
| OC1d Penta3 % | **59** | 60 | **55** | 62 | 66 | 69 | 75 | **missed** |
| OC1f SAM admitted % | **55** | 60 | 64 | 70 | 74 | 78 | 80 | missed narrowly |
| GI-1 maternal deaths | **0** | 1 | **1** | 0 | 1 | 1 | ≤ 3 | cum. 4 = **missed** |
| OC2a (survey) | **21** (baseline) | | | | | 38 | 40 | missed narrowly |
| OC2b (survey) | **38** (baseline) | | | | | 57 | 55 | met |

### 11.2 November values by location (the breakdowns entered through the grid)

| Code | Kassala | Gedaref | Ed Damazin | Rabak | Sinja | Port Sudan | Total | Sex split |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OP1-1 | 10 | 10 | 9 | 9 | 8 | 8 | **54** | F 41 / M 13 |
| OP1-2a | 1 | 1 | 0 | 0 | 0 | 1 | **3** | — |
| OP1-2b | 8 | 7 | 5 | 6 | 5 | 7 | **38** | — |
| OP1-4 | 260 | 240 | 210 | 250 | 190 | 270 | **1,420** | F 860 / M 560 |
| OP2-1 | 10 | 10 | 10 | 10 | 10 | 10 | **60** | F 44 / M 16 |
| OP2-2 | 380 | 350 | 310 | 390 | 300 | 370 | **2,100** | F 1,390 / M 710 |
| OC1e | 70 | 65 | 60 | 75 | 55 | 85 | **410** | F 215 / M 195 |

Notes: OP1-1 in November (54) = 30 EmONC (Kassala trainees from several localities counted by their facility's locality) + 24 IMNCI; location split is by trainee facility. Rates are entered once for the project (no location split). A value with a required breakdown missing must be refused at verify (known regression F-9 of demo 11 — re-test).

### 11.3 Finance (USD, entered only in the Final)
| Budget line | Budget | Expended |
| --- | --- | --- |
| Personnel | 340,000 | 331,500 |
| Medicines, vaccines and supplies | 260,000 | 252,300 |
| Rehabilitation and equipment | 150,000 | 146,900 |
| Training | 110,000 | 104,200 |
| Outreach and referral transport | 170,000 | 163,800 |
| Community mobilisation and communication | 70,000 | 58,900 |
| M&E and surveys | 40,000 | 38,100 |
| Indirect costs | 60,000 | 52,500 |
| **Total** | **1,200,000** | **1,148,200 (95.7 %)** |

---

## 12. Run order (UI only, as a real user; stop and fix on any friction)

**A. Setup**
1. Open the app (already signed in as the owner). Check what the home shows for a tenant with several projects (T-0).
2. New project wizard — type §1 values; watch pre-fills (country/currency/sector must be visible, never silent).
3. Logframe → paste 25 rows. Indicators → paste 17-row CSV. Set semantics on all 17 (note the number of page visits; propose bulk if > 10).
4. Disaggregation: set Location/sex breakdowns on the indicators in §4; **location targets** on OP1-1, OP1-4, OP1-2a.
5. Templates: upload both DOCX, wait for extraction, accept, approve, default per type.
6. Reporting profile (§7.1). Time zone Africa/Khartoum on the project.
7. Team: add 8 stand-ins; invite #1 (approver) and #2 (outside partner, this project only); open invitation links in a second browser profile and accept.
8. Work plan: wizard from the logframe → edit locations and leads → import P-13…P-19 (with the bad row first) → add P-12 with a hand-pinned place.
9. Map: open the plan **Map** view and the Overview "Where we work"; check placed/unplaced lists; spelling traps ("Kassala town", "Gedaref City", "Bur Sudan").
10. Calendar: create November, then "Create all 4 periods" (Dec–Mar), then the February **Situation** report. April stays for the closing plan.
11. Budget lines, risks, programme and grant (UNICEF PCA no. `PCA/SDCO/2026/0412`, USD 1,200,000), setup checklist → READY → activate.

**B. Month 1 (November)**
12. Enter the 20 activity records (§10) — the first with the plain-words fill-in, one offline (browser offline toggle), one started from an earlier record, bulk accept as the PM.
13. Upload the 16 evidence files inside the forms (link-at-creation), verify in bulk, send one back.
14. Enter the 17 indicator values (§11.1–11.2) in the period grid with location and sex breakdowns; verify; check suggestions and totals; baselines for OC2a/OC2b.
15. Mark plan rows Done; story (5/5) and compliance statements; "Same as last month" must not be offered in month 1.
16. Generate the November report; flags; confidentiality notice; approvals; submit; **second browser: Sara approves**; export an INTERNAL_REVIEW draft and a donor submission.
17. Data Center (sheet, by-location view, chart, table insert), management report, Infographics Studio (overview design, export PNG/PDF), site map export.
18. Anything left from §14 coverage checklist.

---

## 13. Verification test points

| ID | Area | What to check | Pass when |
| --- | --- | --- | --- |
| T-0 | Home | Landing for a workspace with many projects and another demo's data | I can tell where to start without help |
| T-1 | Wizard | Country/currency/sector shown, labelled when suggested; USD ≠ pre-filled local currency | Sudan / Health / USD chosen explicitly |
| T-2 | Logframe import | 25 rows in one paste | Codes preserved; activities under outputs |
| T-3 | Indicator import | 17 rows linked by code; `Disaggregated=yes` honoured | All linked; rates "calculation needs review" |
| T-4 | Semantics | All 17 configured; lower-is-better on GI-1 and OP1-3 | Rates show "—" in % of target |
| T-5 | Breakdowns | Location + sex enabled per §4; location targets | Grid shows breakdown editors; "Not planned" for an unplanned location |
| T-6 | Templates | Both DOCX extracted; word limits and the UNICEF acknowledgement carried | 8 and 11+ sections, numbering kept |
| T-7 | Profile / zone | Second approver, finance typed, Africa/Khartoum | Reload shows values |
| T-8 | Team / invites | 8 stand-ins + 2 invited users sign in in a second profile | Both land correctly; outside partner sees this project only |
| T-9 | Plan wizard | ~100 rows, all-or-nothing, leads set | Counts match; no confusing group heading |
| T-10 | Plan import | Bad row blocks with its row number named; exact repeats skipped | Plain sentences, nothing half-imported |
| T-11 | Map | Six locations pinned; spelling traps merge; hand pin works; "Six localities (all)" unplaced and listed | Pins coloured by delivery signal; no guess, no drop |
| T-12 | Calendar | 5 monthly + 1 situation; April left to closing plan | Deadlines +15 d (+3 d situation) |
| T-13 | Funding / budget | Programme, grant, budget lines | Placement shown on project and portfolio |
| T-14 | Setup checklist | READY with no blockers | Activate works |
| T-15 | Activity form | Plain-words fill-in; period derived from date; plan link stored; offline queue | Record shows plan row; offline entry syncs |
| T-16 | Accept / withdraw | Bulk accept; withdraw with reason; withdrawn not counted | Counts right |
| T-17 | Evidence | Link-at-creation, sensitivity, send-back, unreadable file refusal | Plain sentences; sensitive rules obeyed |
| T-18 | Indicator grid | Suggestions, location+sex breakdowns reconcile, required breakdown blocks verify | Cannot verify with a breakdown missing |
| T-19 | Plan delivery | Status control saves first click and says so | Delivery counts move |
| T-20 | Story | 5/5, compliance, no stale "Same as last month" | Persists after reload |
| T-21 | Generation | AI Reporter writes 8 sections; no invented numbers; location figures only if recorded | Numbers equal §11 |
| T-22 | Honesty | Not-measured shown, never 0; rates "—"; survey baselines labelled | No "0" for missing |
| T-23 | Approval | Author cannot approve; Sara can, in her own session | Status moves; notification arrives |
| T-24 | Export | INTERNAL_REVIEW watermark; donor submission blocked until clean; sensitive file excluded | Preflight says why |
| T-25 | Data Center | Sheet, chart, table, **by-location** view | Totals reconcile; units never share raw axis |
| T-26 | Infographic | Overview/results design; location table; export PNG & PDF; deterministic re-export | Preview equals export |
| T-27 | Custom boundaries | Upload `sudan-six-localities.geojson` (org-wide!), map draws it, remove it afterwards | Base map returns after removal |
| T-28 | Copy setup | Create a throwaway second project from this one | Definitions copied, no values |
| T-29 | Org export | Organisation export lists the new tables | Download works |
| T-30 | Language/RTL | Arabic place name typed once ("كسلا") | Not mangled in UI/report; reported as finding if unsupported |

Cross-cutting usability checks on **every** screen: a first-time user can tell what to do next; every button says what it does; every error is a plain sentence; every save says it saved; nothing needs a page reload to be correct; keyboard works; the layout holds at laptop and phone width.

---

## 14. Feature coverage checklist (tick as exercised; anything not reached is listed in §17 as not covered)

Project wizard · logframe import · indicator import · semantics · location/sex breakdowns · location targets · donor templates · reporting profile · team and roles · invitations (stand-in, approver, outside partner) · project time zone · work-plan wizard · plan import · timeline drag · plan map · Overview v2 · calendar and Situation report · programme/grant · budget lines · risks · requests and My work · changes of plan · activity form (plain words, draft restore, offline) · bulk accept · evidence upload/verify/send-back · sensitivity rules · indicator grid · story and compliance statements · AI Reporter · flags and decisions · readiness · second approver · exports (internal review, donor submission, evidence pack) · Data Center (sheet, charts, tables, import) · by-location analytics · Infographics Studio · management report · portfolio · AI usage · security page · custom boundaries · copy setup · organisation export · beneficiaries/people case codes · donor indicator mapping · framework history · my week · notifications.

---

## 15. Findings log (filled during the run: ID, severity H/M/L/Info, step, what happened, status)

*(see §16 onward as the run proceeds)*

## 16. Risks (for the run)
| Kind | Title | Seriousness | Action | Owner |
| --- | --- | --- | --- | --- |
| Supply | Port Sudan–Kassala route blocked | High | Buffer stock at Kassala hub; weekly forecast review | Logistics |
| Access | Flooded tracks in Blue Nile | Medium | Mobile teams reschedule; pre-position | PM |
| Security | Insecurity along the main road to Gedaref | High | Movement plan; coordination with state security desk | PM |
| Data | Paper registers at 4 centres without lockable storage | High | Lockable cabinets; spot checks | M&E |

## 17. Open questions
- Q-1 national EmONC/IMNCI curriculum edition; Q-2 *(verify)* figures in §2; Q-3 UNICEF's actual PCA reporting format is **not** copied: the templates are synthetic and UNICEF-styled only; Q-4 gazetteer coverage of the six names (checked live in T-11); Q-5 the custom boundary layer is organisation-wide (T-27: upload, test, remove).

---

*Run log follows below as sections are completed (setup run log, month 1 run log, findings, ids).*
