# Sphere Handbook (2018, 4th edition): material for DonorDesk Sector Packs

**Edition used: 2018 only.** It is still the current official edition. A 5th edition revision started in March 2026, is digital-first, and is expected in Q4 2028 ([Sphere Q1 2026 roundup](https://spherestandards.org/sphere-handbook-revision-starts-in-earnest-and-thats-not-all-spheres-q1-2026-roundup/), [Sphere](https://spherestandards.org/)). Nothing from the 2011 edition is kept. Sphere's online platform *io* is the place to check wording.

**Confidence column** (used in every indicator table)
- **✔** The figure was confirmed by search against more than one source.
- **◐** The figure is recalled from the 2018 Handbook and not yet cross-checked. **Read it against the Handbook or io before it ships as a pack default.**

Only three figures are ✔ so far: 15 l/person/day, 500 m to a water point, and 20 people per toilet.

**How the pack uses a Sphere figure.** A Sphere indicator is a **minimum standard**, not a project target. A pack carries it as a *reference standard* (source, edition, threshold, direction) beside the indicator. The user confirms it as a target. A missing value is never 0, and a rate is never summed or shown as "% of target" (the existing rules).

---

## 1. Handbook structure → pack structure

| Handbook part | Pack use |
|---|---|
| Humanitarian Charter, 4 Protection Principles | `protection` compliance statements (every pack) |
| Core Humanitarian Standard, 9 commitments | `accountability` compliance statements and feedback/complaint indicators (every pack) |
| WASH | Pack `WASH` |
| Food security and nutrition (2 sub-sectors: nutrition; food security & livelihoods) | Packs `NUTRITION`, `FOOD_SECURITY` (livelihoods inside) |
| Shelter and settlement (incl. household items) | Pack `SHELTER` |
| Health | Pack `HEALTH` |
| Cross-cutting themes (gender, age, disability, psychosocial, environment, markets, cash) | Disaggregation set + checks in every pack |
| Standards → key actions → key indicators → guidance notes | Standard = result statement; key actions = activities; key indicators = indicators; guidance notes = help text |

---

## 2. What every pack contains (schema)

| Field | Meaning |
|---|---|
| `sectorKey` | `WASH`, `NUTRITION`, `FOOD_SECURITY`, `SHELTER`, `HEALTH` (+ `PROTECTION_AAP` always attached) |
| `standards[]` | Sphere standard id and name, with the 2018 wording of the result it asks for |
| `logframe` | Suggested impact → outcome → output → activity skeleton, codes generated, all editable |
| `indicators[]` | Code, name, definition, type (NUMBER / PERCENTAGE / RATIO), unit, aggregation (SUM / LATEST / AVERAGE), direction (higher/lower is better), frequency, disaggregations, Sphere reference standard, means of verification, confidence |
| `assessment` | Facts the project must state at creation (see §9) |
| `entry` | Forms and sheets that collect the data (fields, who, how often, offline-capable) |
| `evidence` | Evidence types expected (water test result, distribution list, MUAC register, ...) |
| `risks` | Suggested risks with seriousness left to the person |
| `compliance` | Statements and attestations (Protection, CHS) |
| `dashboards` | Template ids with roles mapped to indicators |
| `infographics` | Template ids and blocks |
| `report` | Section blueprint titles (never "Overview"/"Abstract") |
| `glossary` | Plain-language definitions |

Packs fill only what is empty, hold no people and no donor, and can be overridden by an organisation's own pack (existing rules).

---

## 3. Pack WASH

### 3.1 Standards (2018)
- **Hygiene promotion:** 1.1 implementation; 1.2 identification, access and use of hygiene items; 1.3 menstrual hygiene management and incontinence
- **Water supply:** 2.1 access and water quantity; 2.2 water quality; 2.3 water supply facilities and materials
- **Excreta management:** 3.1 environment free from human faeces; 3.2 appropriate and adequate toilets
- **Vector control:** 4.1 settlement-level control; 4.2 household and personal actions
- **Solid waste management:** 5.1 environment free from solid waste; household actions; community systems
- **WASH in settings:** disease outbreaks, health facilities, schools (guidance and indicators)

### 3.2 Indicators
| Code | Indicator | Type / unit | Agg. | Dir. | Frequency | Sphere reference | Conf. |
|---|---|---|---|---|---|---|---|
| WASH-W-01 | Average litres of water per person per day at household level | Number, l/p/d | Average | Higher | Monthly | ≥ 15 | ✔ |
| WASH-W-02 | Households within 500 m of a water point | Percentage | Latest | Higher | Monthly | 100% within ≤ 500 m | ✔ |
| WASH-W-03 | Queuing time at water point | Number, minutes | Average | Lower | Monthly | ≤ 30 | ◐ |
| WASH-W-04 | People per water point (tap / hand pump / open well) | Ratio | Latest | Lower | Monthly | tap ≤ 250; hand pump ≤ 500; open well ≤ 400 | ◐ |
| WASH-W-05 | Water samples with 0 faecal coliforms per 100 ml at point of delivery | Percentage | Latest | Higher | Weekly | 100% | ◐ |
| WASH-W-06 | Chlorinated water points with free chlorine residual 0.2–0.5 mg/l and turbidity < 5 NTU | Percentage | Latest | Higher | Weekly | 100% | ◐ |
| WASH-W-07 | Sources with a completed sanitary survey and no high risk | Percentage | Latest | Higher | Quarterly | all | ◐ |
| WASH-W-08 | Households with 2 clean water containers (10–20 l) | Percentage | Latest | Higher | Distribution | all | ◐ |
| WASH-S-01 | People per functioning toilet | Ratio | Latest | Lower | Monthly | ≤ 20 | ✔ |
| WASH-S-02 | Toilets sex-separated, lockable, lit, within 50 m | Percentage | Latest | Higher | Quarterly | all | ◐ |
| WASH-S-03 | Toilet pits ≥ 30 m from groundwater sources, base ≥ 1.5 m above water table | Percentage | Latest | Higher | At construction | all | ◐ |
| WASH-S-04 | Households reporting open defecation | Percentage | Latest | Lower | Quarterly | 0 | ◐ |
| WASH-H-01 | Households with soap (or ash) and handwashing station seen | Percentage | Latest | Higher | Quarterly | all | ◐ |
| WASH-H-02 | People reached with hygiene promotion | Number | Sum | Higher | Monthly | – | – |
| WASH-H-03 | Households receiving a hygiene kit (bathing, laundry soap, menstrual materials) | Number | Sum | Higher | Distribution | per kit list | ◐ |
| WASH-H-04 | Women and girls with access to menstrual hygiene materials and a private space | Percentage | Latest | Higher | Quarterly | all | ◐ |
| WASH-V-01 | Households with vector breeding sites in or near the dwelling | Percentage | Latest | Lower | Quarterly | – | ◐ |
| WASH-X-01 | Households where waste is collected or disposed of safely (container ≈ 100 l per 10 households; none > 100 m from a communal pit) | Percentage | Latest | Higher | Monthly | ◐ | ◐ |
| WASH-I-01 | Health facilities meeting WASH minimums (water 5 l/outpatient, 40–60 l/inpatient; toilets 1 per 20 beds or 50 outpatients) | Percentage | Latest | Higher | Quarterly | all | ◐ |
| WASH-I-02 | Schools meeting WASH minimums (3 l/pupil/day; 1 toilet per 30 girls and per 60 boys; handwashing) | Percentage | Latest | Higher | Quarterly | all | ◐ |
| WASH-D-01 | Cases of acute watery diarrhoea / cholera among those served | Number | Sum | Lower | Weekly | – | – |

### 3.3 Logframe skeleton
- **Outcome:** People have equitable, safe and dignified access to water, sanitation and hygiene.
- **Outputs:** safe water supplied (2.1–2.3); safe toilets built and used (3.1–3.2); hygiene promoted and items provided (1.1–1.3); vectors and waste controlled (4, 5); WASH in health facilities and schools.
- **Activities:** water trucking, borehole/spring protection, chlorination, tap-stand construction, latrine construction/desludging, hygiene sessions, kit distribution, waste collection, vector control, water testing.

### 3.4 Data entry
- Water point register (id, location, type, status, flow, people served, last test)
- Water quality log (date, point, coliforms, chlorine, turbidity, result)
- Toilet register (id, location, users, sex-separated, lockable, distance, condition, date)
- Distribution list (household id, items, date, signature)
- Hygiene session register (date, place, topic, women, men, girls, boys)
- Household survey (water used, container, handwashing, open defecation)
- Safety audit (date, facility, findings, action)

### 3.5 Evidence expected
Water test results, sanitary survey forms, borehole completion reports, distribution lists with sign-off, photos of facilities, session registers.

### 3.6 Dashboards / infographic blocks
Litres per person per day by site over time (line, 15 l reference line); water points by status (donut); people per toilet by site (bar, 20 reference); water quality compliance (stacked by pass/fail); map of water points and toilets coloured by function; hygiene reach (people by sex and age); cholera/AWD cases by week (line) beside WASH coverage.

### 3.7 Suggested risks
Contaminated source; borehole failure; pit overflow in rainy season; fuel or chlorine supply gap; women's safety at water points and toilets; conflict over water.

---

## 4. Pack NUTRITION (food security and nutrition chapter, nutrition part)

### 4.1 Standards (2018)
- **Assessment:** food security and nutrition assessment (nutrition part)
- **Infant and young child feeding (IYCF):** 2.1 policy guidance and coordination; 2.2 basic and skilled support for caregivers
- **Management of acute malnutrition and micronutrient deficiencies:** 3.1 moderate acute malnutrition; 3.2 severe acute malnutrition; 3.3 micronutrient deficiencies

### 4.2 Indicators
| Code | Indicator | Type / unit | Agg. | Dir. | Frequency | Sphere reference | Conf. |
|---|---|---|---|---|---|---|---|
| NUT-A-01 | GAM prevalence, children 6–59 months (weight-for-height z-score < −2 and/or MUAC < 125 mm and/or oedema) | Percentage | Latest | Lower | Survey | WHO classes: < 5% acceptable, 5–9 poor, 10–14 serious, ≥ 15 critical | ◐ |
| NUT-A-02 | SAM prevalence, 6–59 months | Percentage | Latest | Lower | Survey | – | ◐ |
| NUT-A-03 | Acute malnutrition among pregnant and lactating women (MUAC) | Percentage | Latest | Lower | Survey | – | ◐ |
| NUT-T-01 | Children 6–59 months admitted for SAM treatment | Number | Sum | – | Monthly | – | – |
| NUT-T-02 | Children admitted for MAM treatment | Number | Sum | – | Monthly | – | – |
| NUT-T-03 | SAM cure/recovery rate | Percentage | Latest | Higher | Monthly | > 75% | ◐ |
| NUT-T-04 | SAM death rate | Percentage | Latest | Lower | Monthly | < 10% | ◐ |
| NUT-T-05 | SAM default (drop-out) rate | Percentage | Latest | Lower | Monthly | < 15% | ◐ |
| NUT-T-06 | Treatment coverage | Percentage | Latest | Higher | Survey | > 50% rural, > 70% urban, > 90% camp | ◐ |
| NUT-F-01 | Infants 0–5 months exclusively breastfed | Percentage | Latest | Higher | Survey | – | ◐ |
| NUT-F-02 | Children 6–23 months with minimum acceptable diet | Percentage | Latest | Higher | Survey | – | ◐ |
| NUT-F-03 | Caregivers reached with IYCF counselling | Number | Sum | Higher | Monthly | – | – |
| NUT-F-04 | Breast-milk substitutes distributed outside the national/International Code framework | Number | Sum | Lower | Monthly | 0 | ◐ |
| NUT-M-01 | Children and women receiving micronutrient supplements (e.g. vitamin A, iron-folate) | Number | Sum | Higher | Monthly | – | – |
| NUT-M-02 | Children 6–59 months receiving vitamin A | Percentage | Latest | Higher | Campaign | – | ◐ |
| NUT-S-01 | Facilities / outreach sites with no stock-out of RUTF/RUSF | Percentage | Latest | Higher | Monthly | all | ◐ |

### 4.3 Logframe skeleton
- **Outcome:** Acute malnutrition and its risk are reduced among children, pregnant and lactating women.
- **Outputs:** acute malnutrition detected (screening); treated (SAM/MAM); infants and young children fed appropriately (IYCF support); micronutrient deficiencies prevented.
- **Activities:** MUAC screening, outpatient therapeutic programme, supplementary feeding, stabilisation centre referral, IYCF counselling, supplements, nutrition surveys, supply management.

### 4.4 Data entry
MUAC screening sheet (child, age, sex, MUAC, oedema, outcome, referral); admission/discharge register (case id, date, type, outcome); monthly programme report (admissions, cured, died, defaulted, non-responder, transferred); stock record; survey results (sample, GAM, SAM, method); IYCF counselling log.

### 4.5 Evidence expected
Survey reports, admission registers, monthly reports, stock records, referral slips, training attendance.

### 4.6 Dashboards / infographic blocks
GAM/SAM trend with WHO class bands; admissions by month (stacked SAM/MAM); programme performance (cure/death/default vs 75/10/15 reference); coverage by site; map of sites with GAM level; IYCF indicators by age group; stock-out heat grid by site and month.

### 4.7 Suggested risks
Pipeline break (RUTF); access/insecurity; seasonal peaks (hunger gap); high default due to distance; breast-milk-substitute donations; epidemic (measles, cholera) raising mortality.

---

## 5. Pack FOOD_SECURITY (food assistance and livelihoods)

### 5.1 Standards (2018)
- **Assessment:** food security assessment
- **General food security:** access to food and income
- **Food assistance:** in-kind, cash and voucher assistance; food quality, handling, storage; appropriate and safe food use
- **Livelihoods:** 6.1 primary production; 6.2 income and employment; 6.3 access to markets

### 5.2 Indicators
| Code | Indicator | Type / unit | Agg. | Dir. | Frequency | Sphere reference | Conf. |
|---|---|---|---|---|---|---|---|
| FS-A-01 | Food Consumption Score: households with acceptable score | Percentage | Latest | Higher | Quarterly | – | ◐ |
| FS-A-02 | Household Dietary Diversity Score (mean) | Number | Average | Higher | Quarterly | – | ◐ |
| FS-A-03 | Reduced Coping Strategies Index (mean) | Number | Average | Lower | Quarterly | – | ◐ |
| FS-A-04 | Households with moderate or severe hunger (Household Hunger Scale) | Percentage | Latest | Lower | Quarterly | – | ◐ |
| FS-D-01 | People receiving food assistance | Number | Sum | Higher | Monthly | – | – |
| FS-D-02 | Rations delivered as planned (quantity and date) | Percentage | Latest | Higher | Distribution | 100% | – |
| FS-D-03 | Ration energy content (kcal per person per day), with protein 10–12% and fat ≥ 17% of energy | Number, kcal | Average | Higher | Distribution | 2,100 kcal planning figure | ◐ |
| FS-D-04 | People receiving cash or vouchers | Number | Sum | Higher | Monthly | – | – |
| FS-D-05 | Transfer value as a share of the minimum expenditure basket | Percentage | Latest | Higher | Monthly | – | ◐ |
| FS-D-06 | Food samples meeting quality/safety checks | Percentage | Latest | Higher | Distribution | 100% | – |
| FS-L-01 | Households supported with agricultural inputs, tools or training | Number | Sum | Higher | Season | – | – |
| FS-L-02 | Households with increased income or production (against baseline) | Percentage | Latest | Higher | Annual | – | – |
| FS-L-03 | People in income-generating or employment support | Number | Sum | Higher | Monthly | – | – |
| FS-L-04 | Market price of key commodities against baseline | Number | Latest | Lower | Monthly | – | – |

### 5.3 Logframe skeleton
- **Outcome:** People can meet their food needs safely and protect or restore their livelihoods.
- **Outputs:** food/cash/vouchers delivered on time and appropriately; food quality and safety assured; livelihood assets and skills provided; market access supported.
- **Activities:** registration and targeting, distribution, post-distribution monitoring, market monitoring, input distribution, training, livestock support.

### 5.4 Data entry
Beneficiary register; distribution record (site, date, quantity, signatures); post-distribution monitoring survey; market price sheet (item, market, price, date); cash payment log; livelihood training register; household baseline.

### 5.5 Evidence expected
Distribution reports with signed lists, PDM reports, market monitoring reports, payment confirmations, quality test certificates.

### 5.6 Dashboards / infographic blocks
Food Consumption Score distribution (acceptable/borderline/poor); coping strategies trend; people assisted by month, sex and age; planned vs delivered quantity; market price lines by commodity; cash transfer value vs expenditure basket; map of distribution sites; livelihoods participants by group.

### 5.7 Suggested risks
Pipeline breaks; market price spikes; diversion/fraud; insecurity on routes; beneficiary exclusion; payment-provider failure.

---

## 6. Pack SHELTER (shelter, settlement and household items)

### 6.1 Standards (2018)
- Strategic planning
- Settlement planning (location, services, tenure)
- Covered living space
- Construction
- Environmental sustainability
- Household items (clothing, bedding, cooking and eating, stoves, fuel, lighting, tools)

### 6.2 Indicators
| Code | Indicator | Type / unit | Agg. | Dir. | Frequency | Sphere reference | Conf. |
|---|---|---|---|---|---|---|---|
| SH-S-01 | People with a minimum covered living area | Percentage | Latest | Higher | Quarterly | ≥ 3.5 m² per person (more in cold climates) | ◐ |
| SH-S-02 | Households receiving shelter assistance (kit, repair, rental, transitional shelter) | Number | Sum | Higher | Monthly | – | – |
| SH-S-03 | Shelters completed and passing a quality check | Number | Sum | Higher | Monthly | all | – |
| SH-S-04 | Households with secure tenure or occupancy agreement for the period of need | Percentage | Latest | Higher | Quarterly | all | ◐ |
| SH-S-05 | Households in shelters safe from known hazards (flood, landslide, fire) | Percentage | Latest | Higher | Quarterly | all | ◐ |
| SH-P-01 | Site/settlement with access to water, sanitation, health, schooling and markets within reasonable distance | Percentage | Latest | Higher | Quarterly | all | ◐ |
| SH-P-02 | Settlement fire-safety measures in place (spacing, breaks, escape routes) | Percentage | Latest | Higher | Quarterly | all | ◐ |
| SH-P-03 | Collective centres meeting minimum conditions | Percentage | Latest | Higher | Quarterly | – | – |
| SH-N-01 | Households receiving the planned household-item kit | Number | Sum | Higher | Distribution | per kit list | – |
| SH-N-02 | Households with adequate bedding, cooking set and clothing | Percentage | Latest | Higher | Quarterly | – | ◐ |
| SH-N-03 | Households with access to safe fuel / stove | Percentage | Latest | Higher | Quarterly | – | ◐ |
| SH-E-01 | Shelter materials sourced sustainably (share of timber certified or reused) | Percentage | Latest | Higher | Quarterly | – | ◐ |
| SH-T-01 | Households trained or given technical assistance for safe build | Number | Sum | Higher | Monthly | – | – |

### 6.3 Logframe skeleton
- **Outcome:** People have safe, dignified and adequate shelter and a functioning settlement.
- **Outputs:** shelters provided/repaired; settlement planned and serviced; household items delivered; technical assistance and tenure support; environmental impact limited.
- **Activities:** damage and needs assessment, site planning, shelter kit distribution, transitional shelter construction, repair support, rental/cash support, NFI distribution, tenure documentation, builder training.

### 6.4 Data entry
Household shelter register (household, members, shelter type, area m², condition, tenure, hazards); damage assessment form; distribution list (kit/NFI items, date, signature); construction progress sheet (stage, checks, photos); site map and service register; tenure document tracker.

### 6.5 Evidence expected
Assessment forms, distribution lists, bills of quantities, construction quality inspection, tenure/occupancy agreements, site plans, photos.

### 6.6 Dashboards / infographic blocks
Households by shelter type; area per person distribution against 3.5 m²; completion funnel (assessed → assisted → completed → quality-checked); NFI coverage by item; site map with service access; materials and environmental footprint.

### 6.7 Suggested risks
Eviction or tenure dispute; materials supply and price; seasonal hazards (flood, winter); construction quality; protection risks in collective centres; environmental damage from timber.

---

## 7. Pack HEALTH

### 7.1 Standards (2018)
- **Health systems:** 1.1 health service delivery; 1.2 health workforce; 1.3 medicines and medical supplies; 1.4 health financing; 1.5 health information management; 1.6 leadership and coordination
- **Essential health services:** 2.1 prioritising health services; communicable diseases; child health; sexual and reproductive health; injury and trauma care; mental health; non-communicable diseases; palliative care

### 7.2 Indicators
| Code | Indicator | Type / unit | Agg. | Dir. | Frequency | Sphere reference | Conf. |
|---|---|---|---|---|---|---|---|
| HLT-S-01 | Qualified health workers (doctors, nurses, midwives) per 10,000 people | Ratio | Latest | Higher | Quarterly | ≥ 22 | ◐ |
| HLT-S-02 | Health facilities per population (basic unit per 10,000; health centre per 50,000; hospital per 250,000) | Ratio | Latest | Higher | Quarterly | as listed | ◐ |
| HLT-S-03 | Inpatient beds per 10,000 | Ratio | Latest | Higher | Quarterly | ≥ 10 | ◐ |
| HLT-S-04 | Outpatient visits per person per year | Ratio | Latest | – | Monthly | 1–4 | ◐ |
| HLT-S-05 | Facilities with no stock-out of tracer essential medicines | Percentage | Latest | Higher | Monthly | all | ◐ |
| HLT-S-06 | Facilities reporting weekly through health information system | Percentage | Latest | Higher | Weekly | all | ◐ |
| HLT-M-01 | Crude mortality rate (per 10,000 per day) | Ratio | Latest | Lower | Weekly | alert > 1.0 | ◐ |
| HLT-M-02 | Under-5 mortality rate (per 10,000 per day) | Ratio | Latest | Lower | Weekly | alert > 2.0 | ◐ |
| HLT-C-01 | Children 6 months–15 years vaccinated against measles | Percentage | Latest | Higher | Campaign / Quarterly | ≥ 95% | ◐ |
| HLT-C-02 | Outbreak alerts investigated within 48 hours | Percentage | Latest | Higher | Monthly | 100% | ◐ |
| HLT-C-03 | Cholera case fatality | Percentage | Latest | Lower | Weekly | < 1% | ◐ |
| HLT-C-04 | Sick children 0–59 months treated under IMCI / iCCM | Number | Sum | – | Monthly | – | – |
| HLT-R-01 | Births attended by a skilled birth attendant | Percentage | Latest | Higher | Monthly | – | ◐ |
| HLT-R-02 | Basic and comprehensive emergency obstetric care facilities per 500,000 | Ratio | Latest | Higher | Quarterly | 4 basic + 1 comprehensive | ◐ |
| HLT-R-03 | Caesarean section rate | Percentage | Latest | – | Monthly | 5–15% | ◐ |
| HLT-R-04 | Survivors of sexual violence receiving clinical care in time (PEP ≤ 72 h; emergency contraception ≤ 120 h) | Percentage | Latest | Higher | Monthly | 100% | ◐ |
| HLT-R-05 | Women using modern contraception | Percentage | Latest | Higher | Quarterly | – | – |
| HLT-N-01 | People with mental-health or psychosocial support contacts | Number | Sum | Higher | Monthly | – | – |
| HLT-N-02 | People with chronic conditions (e.g. diabetes, hypertension) continuing treatment | Number | Sum | Higher | Monthly | – | – |
| HLT-T-01 | Trauma cases treated within the expected time | Percentage | Latest | Higher | Monthly | – | – |
| HLT-A-01 | Facilities charging fees at the point of care | Number | Latest | Lower | Quarterly | 0 | ◐ |
| HLT-A-02 | Attacks on health care recorded | Number | Sum | Lower | Monthly | 0 | – |

### 7.3 Logframe skeleton
- **Outcome:** Excess morbidity and mortality are reduced and people have access to essential health services.
- **Outputs:** health system functional (workforce, supplies, information); communicable diseases prevented and treated; child health services; reproductive, maternal and newborn services; injury and trauma care; mental health and chronic disease care.
- **Activities:** mobile clinics, facility support, disease surveillance, vaccination, case management, antenatal/delivery/postnatal care, clinical care for survivors, MHPSS, medicine supply, training of health workers.

### 7.4 Data entry
Weekly surveillance report (disease, age, sex, cases, deaths); outpatient register (diagnosis, age, sex, new/revisit); inpatient/discharge register; vaccination register; antenatal and delivery register; stock card (item, balance, stock-outs); staff register (cadre, number); referral log; GBV clinical care log (confidential, minimal data).

### 7.5 Evidence expected
Surveillance bulletins, facility supervision checklists, stock reports, vaccination campaign reports, training attendance, outbreak investigation reports.

### 7.6 Dashboards / infographic blocks
Weekly disease trend with outbreak alert thresholds; mortality rates vs 1.0 and 2.0 reference lines; consultations by sex, age and diagnosis; vaccination coverage by site; facility coverage map with service gaps; staffing against 22 per 10,000; medicine availability heat grid; reproductive-health cascade (ANC → skilled birth → postnatal).

### 7.7 Suggested risks
Outbreaks; medicine stock-outs; staff loss; attacks on health care; access/insecurity; user fees; referral failure; patient-data privacy.

---

## 8. Pack PROTECTION_AAP (attached to every sector pack)

### 8.1 Protection Principles (2018) as compliance statements
1. Avoid exposing people to further harm
2. Ensure access to assistance by need, impartially, without discrimination
3. Protect people from physical and psychological harm from violence and coercion
4. Assist people to claim their rights, access remedies and recover from abuse

### 8.2 Core Humanitarian Standard commitments as compliance statements
1 Appropriate and relevant; 2 Effective and timely; 3 Strengthens local capacities and avoids harm; 4 Communication, participation and feedback; 5 Complaints welcomed and addressed; 6 Coordinated and complementary; 7 Learning and improving; 8 Staff supported; 9 Resources managed responsibly

### 8.3 Indicators
| Code | Indicator | Type / unit | Agg. | Dir. | Frequency | Conf. |
|---|---|---|---|---|---|---|
| PRO-01 | People consulted in design/monitoring, by sex, age, disability | Number | Sum | Higher | Quarterly | – |
| PRO-02 | Feedback or complaints received | Number | Sum | – | Monthly | – |
| PRO-03 | Complaints answered within the stated time | Percentage | Latest | Higher | Monthly | – |
| PRO-04 | Sexual exploitation and abuse reports referred according to procedure | Percentage | Latest | Higher | Monthly | – |
| PRO-05 | People reporting they feel safe using facilities/distributions (safety audit) | Percentage | Latest | Higher | Quarterly | – |
| PRO-06 | People who say aid reached those most in need | Percentage | Latest | Higher | Annual | – |
| PRO-07 | Staff who completed code-of-conduct and PSEA training | Percentage | Latest | Higher | Annual | – |
| PRO-08 | Projects with a documented context analysis and a do-no-harm review | Percentage | Latest | Higher | Annual | – |

### 8.4 Disaggregation set (every pack)
Sex; age bands 0–4, 5–17, 18–59, 60+; disability (Washington Group short set); displacement status (IDP, refugee, returnee, host); location (admin level); and, where relevant, pregnant/lactating women and female-headed households.

---

## 9. Project creation guidance by sector (what the wizard asks)

| Sector | Assessment facts to state at creation | Checks the wizard offers |
|---|---|---|
| WASH | population by site; water sources and current litres per person; toilet count; hygiene practices; disease risk; groundwater depth; rainy season | suggested targets from Sphere (15 l, 500 m, 20 per toilet); flag a plan with no water testing; flag no hygiene item list |
| NUTRITION | children 6–59 months and PLW counts; latest GAM/SAM; programme coverage; supply line for RUTF/RUSF; IYCF practice | suggested performance thresholds (75/10/15); flag a plan with no screening and referral pathway |
| FOOD_SECURITY | food insecurity level; market functionality; transfer modality; targeting criteria; prior assistance | cash plans must name the expenditure basket; flag a ration with no kcal/protein/fat statement |
| SHELTER | displaced households; damage; tenure situation; hazards; climate (covered area figure); host/settlement type | flag no tenure statement; covered-area target by climate; household item list |
| HEALTH | population; facilities and staff; disease burden; vaccination coverage; supply chain; referral pathways | staffing and facility ratios; surveillance plan; confidentiality plan for clinical GBV data |
| Every sector | context analysis; vulnerable groups; feedback and complaints channel; safeguarding contact; consent and data protection | CHS commitments and Protection Principles as compliance statements |

---

## 10. How this maps to DonorDesk concepts

| Pack part | DonorDesk place |
|---|---|
| Indicators | Logframe indicators (`aggregation`, direction, type PERCENTAGE/RATIO/NUMBER, disaggregations, frequency) |
| Sphere reference standard | A new "reference standard" field on the indicator definition; shown in the entry grid and dashboards; never judged as target unless the user confirms it as one |
| Rates and ratios | Existing rate rules: never summed, no "% of target", shown as recorded |
| Entry forms | Collection forms (draft, never published automatically), Entry Sheet columns, offline pack |
| Evidence types | Evidence tags and checklists per sector |
| Compliance statements | Compliance/attestation items (Protection, CHS) |
| Dashboards | Dashboard templates with roles; reference lines from the standard |
| Infographics | Infographic/Canvas templates by sector (starter set in §3.6 to §7.6) |
| Report sections | Blueprint titles per sector (avoid "Overview"/"Abstract") |
| Setup packs | Organisation default packs by sector (existing `SetupDefaultPack`) |

### Build order suggestion
1. Verify every ◐ figure against the 2018 Handbook or io, then freeze a `sphere-2018` data file (one JSON per sector, with edition and page/standard ref per indicator).
2. Add the reference-standard field to indicators and render it in the entry sheet and charts.
3. Ship the five sector packs plus `PROTECTION_AAP` as built-in packs that fill only empty fields.
4. Add sector dashboard/infographic templates that use roles, not indicator ids.
5. Add wizard assessment questions and checks (§9).

---

## 11. Open questions
- Which sub-sector packs are wanted? The five above follow the 2018 chapters.
- Whether to ship Sphere reference lines on charts by default.
- Whether companion standards (CPMS, INEE, LEGS, MERS) should be added later as their own packs.

Sources: [Sphere](https://spherestandards.org/), [Sphere Q1 2026 roundup](https://spherestandards.org/sphere-handbook-revision-starts-in-earnest-and-thats-not-all-spheres-q1-2026-roundup/), [Sphere interactive standards](https://interactive.spherestandards.org/), [Sphere FAQs](https://spherestandards.org/faqs/).
