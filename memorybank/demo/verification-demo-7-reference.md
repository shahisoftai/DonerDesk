# Demo 7 — quick reference: a 12-month EU-funded health programme in Ghana (2026-10-07)

Everything needed to run and score the demo without searching. Run notes and findings go in `verification-demo-7.md` (create when the run starts). Scripts: `scripts/demo-health-gh/`; generated inputs and downloads: `memorybank/demo/verification-demo-7-artifacts/`.
Follows demos 1-6 (`verification-demo-5.md`, `baseline-phase25.md`). Demo 6 was stopped early, so its unscored items (second-approver block, bulk attest, failure drills) are folded into section 9.

**Main goal:** DonorDesk produces the highest-quality AI-written donor reports with the least effort from the user. Every step is judged on (a) ease of use, (b) code or data issues, (c) relevance to a real NGO, and above all (d) report quality (section 8).

## 1. Ground rules

- Real production, as a tenant would: `https://donordesk.online`, tenant GEC, user `mnpiracha@gmail.com` (Admin / project manager). **The password is given in the chat and passed only through `DEMO_PASSWORD` in the env of the one command. It is never written to a file, log or memory.**
- UI only: one visible Chromium (`--remote-debugging-port=9333`), attached over CDP by every script, never closed or relaunched per step. No API calls, no DB writes. Reading server logs over `ssh contabo` is allowed to diagnose a failure; **a production deploy needs the user's explicit allowance**.
- Scripts longer than ~100 s are backgrounded and polled. One script per page at a time (`scripts/demo-ui/lib.mjs` run lock). Decide a run is finished from the UI, not from a label that may not change. Kill helpers by pid, never `pkill -f`.
- Every created record is prefixed `[DEMO-7]`. Log each friction/bug the moment it happens (section 10).
- Fictional throughout: organisations, people, grant number and figures. Real names are used only for Ghana's public institutions, places and systems (GHS, NHIA, DHIMS2, CHPS, districts).

## 2. The project

| Field | Value |
|---|---|
| Title | **[DEMO-7] Northern Ghana Maternal, Newborn & Child Health Resilience Programme (MNCH-R)** |
| Donor | European Union (Delegation of the European Union to Ghana), Global Gateway: human development |
| Grant / contract no. (fictional) | `EU-GH/2025/HD/0417` |
| Implementer (the tenant's organisation) | Northern Ghana Health Alliance (NGHA); local partner: Tamale Community Health Network (TCHN) |
| Country / area | Ghana, Northern Region: districts **Tolon, Kumbungu, Savelugu, Nanton, Karaga** (5 districts, 40 health facilities incl. 24 CHPS compounds) |
| Dates | **2025-10-01 → 2026-09-30** (12 months, all in the past so every month can be entered) |
| Budget | **EUR 1,800,000** (EU 90% = 1,620,000; NGHA co-financing 10% = 180,000) |
| Sector / SDG | Health; SDG 3 (3.1 maternal, 3.2 newborn and child) |
| Reporting | Monthly progress reports (Oct 2025 - Aug 2026), **Final narrative report** = the closing period (Sep 2026) |
| Beneficiaries | ~42,000 women of reproductive age, ~21,000 children under 5; 5 District Health Management Teams (DHMTs); 300 community health volunteers (CHVs) |
| Languages / format | English; EU wording ("Action", "Results", "Intervention logic", OECD-DAC criteria in the final) |

**Story of the year (drives the monthly narrative; the AI must write from the records, not invent):**
- Oct-Nov: start-up, baseline, recruitment, first trainings.
- Dec: harmattan and holiday slowdown; fewer ANC visits.
- Feb: **national Penta vaccine stock-out** for ~3 weeks: Penta3 and tracer-drug availability dip.
- Mar: solar vaccine fridges installed (4 CHPS).
- May: **nurses'/CHO industrial action (~2 weeks)**: outreach and training fall.
- Jul-Aug: **floods and lean season** cut road access in Savelugu and Nanton; outreach slows; two CHPS closed for days.
- Aug: customs delay holds the last delivery kits (one equipment target missed by 1).
- Sep: close-out, scorecards, end-line survey, final report. The impact indicator (maternal mortality ratio) improves but **misses its target**: the final report must say so honestly.

## 3. Team (invite through the UI; accept by invite link)

| Person (fictional) | Role in DonorDesk | Does |
|---|---|---|
| Admin: `mnpiracha@gmail.com` | Project manager, sign-off | Project, logframe, periods, templates, approvals |
| Kwame Mensah `kwame.mensah.demo@example.org` | M&E officer | Indicator values, verifies, report review |
| Ama Boateng `ama.boateng.demo@example.org` | Field officer | Activity records, evidence upload |
| Esi Owusu `esi.owusu.demo@example.org` | Finance officer | Final-period finance summary |

Passwords for the new users are chosen at accept time and kept only in the session scratchpad. Use the earlier demo users only if they still exist.

## 4. Logframe (import from CSV, goal by hand as in demo 5)

**Impact (Goal) G1:** Reduced maternal and child mortality and improved health outcomes of women and children in Northern Ghana.

**Outcome O1:** Increased use of quality maternal, newborn and child health services in 40 facilities in 5 districts.
- Output 1.1 Health workers (CHOs, midwives, nurses) competent in EmONC, IMNCI and essential newborn care. Activity: A1.1 clinical training and mentoring.
- Output 1.2 Facilities equipped for safe delivery and cold chain. Activity: A1.2 equipment procurement and installation.
- Output 1.3 CHVs trained and active in community case finding and referral. Activity: A1.3 CHV training and refreshers.
- Output 1.4 Outreach clinics delivered in hard-to-reach communities. Activity: A1.4 integrated outreach clinics.
- Output 1.5 Women reached with community education on ANC, delivery and danger signs. Activity: A1.5 community education sessions.

**Outcome O2:** Strengthened district health governance, data use and health financing.
- Output 2.1 DHMT staff competent in data use (DHIMS2, scorecards). Activity: A2.1 data-use training.
- Output 2.2 Supportive supervision delivered to facilities. Activity: A2.2 supportive supervision visits.
- Output 2.3 Quarterly district scorecards produced and reviewed. Activity: A2.3 quarterly review meetings.
- Output 2.4 Households helped to enrol/renew NHIS. Activity: A2.4 NHIS enrolment drives.
- Output 2.5 Facility managers trained in respectful maternity care (cross-cutting: gender and rights). Activity: A2.5 RMC training.

## 5. Indicators (CSV import with the *Logframe Code* column)

Frequency M = monthly, Q = quarterly (value at Dec, Mar, Jun, Sep), A = annual (final month only). Source for all: DHIMS2/GHS records unless stated.

| Code | Indicator | Type / unit | Baseline | Target | Freq | Level |
|---|---|---|---|---|---|---|
| MR-IMP1 | Institutional maternal mortality ratio per 100,000 live births, supported facilities | Number | 168 | 120 | A | G1 |
| MR-OC1a | % pregnant women with 4+ ANC visits | % | 52 | 70 | M | O1 |
| MR-OC1b | % deliveries attended by a skilled birth attendant | % | 58 | 75 | M | O1 |
| MR-OC1c | % children under 1 year receiving Penta3 | % | 71 | 88 | M | O1 |
| MR-OC1d | % newborns with a postnatal check within 48 h | % | 34 | 60 | M | O1 |
| MR-OC1e | % facilities with no stock-out of tracer MNCH medicines | % | 55 | 85 | M | O1 |
| MR-OC2a | % facilities submitting complete, timely DHIMS2 reports | % | 71 | 95 | M | O2 |
| MR-OC2b | % target households covered by active NHIS membership (survey) | % | 48 | 65 | Q | O2 |
| MR-OC2c | % women satisfied with respectful maternity care (exit survey) | % | 62 | 80 | Q | O2 |
| MR-OP1.1 | Health workers trained in EmONC/IMNCI (F/M) | Number | 0 | 240 | M | 1.1 |
| MR-OP1.2 | Facilities equipped (delivery kit, solar fridge) | Number | 0 | 24 | M | 1.2 |
| MR-OP1.3 | CHVs trained and active (F/M) | Number | 0 | 300 | M | 1.3 |
| MR-OP1.4 | Outreach clinics held | Number | 0 | 360 | M | 1.4 |
| MR-OP1.5 | Women reached by community education | Number | 0 | 18,000 | M | 1.5 |
| MR-OP2.1 | DHMT staff trained in data use (F/M) | Number | 0 | 60 | M | 2.1 |
| MR-OP2.2 | Supportive supervision visits | Number | 0 | 120 | M | 2.2 |
| MR-OP2.3 | Quarterly district scorecards produced | Number | 0 | 20 | Q | 2.3 |
| MR-OP2.4 | Households assisted with NHIS enrolment/renewal | Number | 0 | 6,000 | M | 2.4 |
| MR-OP2.5 | Facility managers trained in respectful maternity care (F/M) | Number | 0 | 40 | M | 2.5 |

19 indicators; sex breakdown on 1.1, 1.3, 2.1, 2.5. Add one indicator by hand to exercise the form (MR-OP1.5 or MR-OC2c).

## 6. Monthly data (M1 = Oct 2025 ... M12 = Sep 2026)

Counts are **this month's** values (the system accumulates). A dash = no value recorded that month (never 0; tests the missing-value rule).

| Code | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 | M9 | M10 | M11 | M12 | Life of project |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| MR-IMP1 | - | - | - | - | - | - | - | - | - | - | - | 131 | 131 (target 120: **missed**) |
| MR-OC1a % | 53 | 54 | 53 | 56 | 57 | 59 | 61 | 59 | 62 | 61 | 60 | 66 | |
| MR-OC1b % | 59 | 60 | 60 | 62 | 63 | 65 | 67 | 66 | 68 | 69 | 68 | 72 | |
| MR-OC1c % | 72 | 73 | 74 | 75 | **70** | 72 | 76 | 78 | 80 | 82 | 81 | 86 | |
| MR-OC1d % | 36 | 38 | 39 | 41 | 43 | 45 | 48 | 46 | 50 | 52 | 52 | 57 | |
| MR-OC1e % | 58 | 60 | 62 | 65 | **60** | 68 | 72 | 70 | 76 | 78 | 77 | 83 | |
| MR-OC2a % | 74 | 77 | 78 | 82 | 84 | 86 | 89 | 86 | 90 | 92 | 91 | 95 | |
| MR-OC2b % (Q) | - | - | 51 | - | - | 55 | - | - | 59 | - | - | 63 | |
| MR-OC2c % (Q) | - | - | 65 | - | - | 70 | - | - | 74 | - | - | 78 | |
| MR-OP1.1 | - | 40 | - | 45 | - | 30 | 40 | - | 35 | 30 | - | 20 | **240** |
| MR-OP1.2 | - | 2 | 3 | 2 | - | 4 | 3 | 2 | - | 3 | 2 | 2 | **23** (target 24) |
| MR-OP1.3 | 50 | 50 | - | 50 | 50 | - | 50 | - | 30 | 20 | - | - | **300** |
| MR-OP1.4 | 20 | 28 | 26 | 30 | 32 | 32 | 33 | **18** | 31 | 26 | 24 | 34 | **334** (93%) |
| MR-OP1.5 | 900 | 1300 | 1250 | 1500 | 1600 | 1650 | 1700 | 900 | 1650 | 1400 | 1300 | 1850 | **17,000** (94%) |
| MR-OP2.1 | - | 15 | - | - | 15 | - | 15 | - | - | 15 | - | - | **60** |
| MR-OP2.2 | 6 | 8 | 8 | 10 | 10 | 11 | 11 | 6 | 11 | 10 | 9 | 12 | **112** (93%) |
| MR-OP2.3 (Q) | - | - | 5 | - | - | 5 | - | - | 5 | - | - | 5 | **20** |
| MR-OP2.4 | 300 | 400 | 450 | 500 | 520 | 560 | 600 | 350 | 560 | 520 | 480 | 760 | **6,000** |
| MR-OP2.5 | - | - | 10 | - | - | 10 | - | 10 | - | 10 | - | - | **40** |

Sex splits (F/M) for the trained indicators: use about 70/30 for health workers and DHMT, 60/40 for CHVs, 55/45 for facility managers. Numbers must add up to the total entered.

## 7. Inputs to prepare (generated, then entered through the UI)

- **Activity records** (about 4-6 a month, ~55 in the year): one per output activity actually done that month (dates inside the month, district, participants, short factual summary written as a field officer would, including problems). Months with an event (section 2) carry a record that describes it.
- **Evidence** (about 8 a month, ~100): attendance sheets (XLSX/PDF), photos (JPG), DHIMS2 extracts (CSV), training reports (DOCX), supervision checklists, delivery notes, scorecard minutes. Files are synthetic and carry the month's real figures. Attach **while creating the activity or the indicator value** (Phase 24 R11 route); verify as the M&E officer. One file is a **sensitive** item (maternal death review summary): it must stay out of every export.
- **Story answers** (five a month): what went well, what did not, lessons, risks, next month's focus. They carry the event of the month and the compliance facts (gender, environment/climate, visibility, do-no-harm).
- **Visibility facts:** EU flag and "Funded by the European Union" on all banners and kits; one press event (Nov) and one radio series (Mar-Jun).
- **Finance (final period only; finance exists for non-monthly reports):**

| Budget line | Budget EUR | Spent EUR |
|---|---|---|
| Personnel | 520,000 | 505,000 |
| Training and capacity building | 310,000 | 298,000 |
| Equipment and supplies | 420,000 | 395,000 |
| Community outreach and education | 190,000 | 184,000 |
| Travel and supportive supervision | 110,000 | 109,200 |
| Local office and operations | 100,000 | 98,300 |
| Monitoring, evaluation, visibility, audit | 60,000 | 36,900 |
| Indirect costs | 90,000 | 86,000 |
| **Total** | **1,800,000** | **1,712,400 (95.1%)** |

Monthly spend for narrative colour only (not entered): 95.0, 120.0, 140.0, 150.0, 150.0, 165.0, 170.0, 130.0, 175.0, 160.0, 150.0, 107.4 (EUR thousand). Underspend of 87,600 is explained by the delayed evaluation and the customs hold.

## 8. Donor templates (DOCX, uploaded, extracted, reviewed, approved)

**EU Monthly Progress Report (8 sections)** — never title a section "Overview" or "Abstract":
1 Summary of the Month; 2 Progress Against Expected Results; 3 Activities Implemented; 4 Outcome Indicators and Data Quality; 5 Challenges, Risks and Mitigation; 6 Cross-Cutting Issues: Gender, Environment and Do-No-Harm; 7 Visibility and Communication; 8 Plan for the Next Month.

**EU Final Narrative Report (11 sections, 2 nested levels)** — Annex V style, OECD-DAC:
1 Executive Summary (max 400 words); 2 Context and Description of the Action (2.1 Context update, 2.2 Intervention logic); 3 Assessment of Implementation (3.1 Impact and outcome results, 3.2 Output delivery, 3.3 Activities, 3.4 Deviations from plan and variance); 4 Assessment against evaluation criteria (4.1 Relevance, 4.2 Effectiveness, 4.3 Efficiency, 4.4 Sustainability, 4.5 Impact); 5 Cross-Cutting Issues (gender, climate/environment, rights-based approach); 6 Risks and Assumptions; 7 Visibility and Communication; 8 Lessons Learned; 9 Sustainability and Exit Strategy; 10 Financial Summary; 11 Recommendations.

Each section carries donor instructions, a mandatory question or two, a page/word limit on a few, and required tables (monthly: results table; final: indicator table with baseline, target, achieved, % of target; finance table).

## 9. Run plan (order of work)

| Stage | Steps | Done when |
|---|---|---|
| 0 Prep | Check prod is up and which release runs; build the CSVs, evidence files, two DOCX templates, per-month JSON from sections 4-8 | Files in artifacts folder; manifest written |
| 1 Setup | New project, dates, budget, donor, partner; invite team; logframe CSV; indicators CSV (+1 by hand); templates uploaded and approved; reporting profile (language, defaults, attribution section = Visibility) | Project setup check is green; no hand workaround |
| 2 Month 1 | Activities, indicator values (sex splits), evidence, story; checklist; **generate the report**, read it fully, fix/regenerate, approve, export donor copy | Month 1 report approved; quality score recorded |
| 3 Months 2-11 | Same loop. Use different routes on purpose: M2-M4 activity form, M5-M8 evidence form, M9-M11 bulk import of the field report. Months with an event test honest narration; M5 and M8 test dips; M11 tests missing quarterly data | Each month scored |
| 4 Final | Convert/start the closing report (M12), final values, finance verified, closing plan, generate, resolve flags, approve (second-approver rule: author must not self-approve if the M&E officer can), export donor copy and evidence pack | Final approved and exported |
| 5 Drills (demo 6 leftovers) | Second approver blocks the author; bulk verify/attest; an ungrounded figure typed into a section; a worker timeout; delete-proof checks (cancelled period) | Behaviour recorded |
| 6 Score | Fill section 11 table and `verification-demo-7.md`; list Phase 26 items | Written |

## 10. Report-quality rubric (score every generated report 0-2 per row; target >= 20/24)

1 **Grounding:** every number in the text is in the records; none invented; cumulative and % of target correct. 2 **Honesty:** shortfalls, dips and the missed impact target stated plainly with the recorded cause. 3 **Template fit:** every template section present, in order, numbering and word limits kept. 4 **EU register:** formal, results-oriented, "the Action", no NGO slang, no first person. 5 **Specificity:** names districts, facilities, dates and counts from activities, not generalities. 6 **No leaks:** no ids, file names, codes, workflow words, "Written without AI". 7 **Tables and charts:** results/indicator tables correct, units right, missing values shown as "not measured", charts one per table. 8 **Gender and cross-cutting:** facts from the story answers used, not generic. 9 **Month-to-month continuity:** no repetition of earlier text, deltas versus last month right, lessons carried forward. 10 **Visibility attribution** in exactly one section. 11 **Flags:** at most 1 figure flag per report that needs a note; plain-language reasons. 12 **Edit effort:** minutes a reviewer needs to reach "approved".

Also score the Phase 25 measures (`baseline-phase25.md`): stub sections, manual workarounds to approve, needless flags, dead ends, checklist scans, clicks per month, server-log reads, raw ids or codes.

## 11. Findings log format (`verification-demo-7.md`)

`# | Sev (H blocks/misleads, M friction, L polish) | Step | What happened | Expected | Status (Open/Fixed + commit)`. Record time per stage and clicks per month. Known open items from demo 5 to re-check first: billing page validation error, writer leaking ids, compliance-section input route, no redirect after create/upload (flaky), bulk evidence verify, silent regeneration, unlabeled selects, PDF en dash and narrow table columns.

## 12. Commands

```bash
# visible browser, once (stays open all session)
chromium --remote-debugging-port=9333 --user-data-dir=/tmp/dd-demo7-profile https://donordesk.online/login &
# log in: password only in the env of this one command
DEMO_EMAIL=mnpiracha@gmail.com DEMO_PASSWORD=... node scripts/demo-health-gh/login.mjs
# shared harness: scripts/demo-ui/lib.mjs (attach, waitForUi, step); demo-5 scripts in scripts/demo-health-ui/ are the starting point
ssh contabo 'journalctl -u donordesk-api --since "30 min ago" | grep -i -E "fallback|VALIDATOR|error"'
```

Useful ids: tenant GEC; app `donordesk.online`; API worker `127.0.0.1:8092` (AI Reporter, `AI_REPORTER_ENABLED=1`); Settings -> AI usage shows stubs and retries per run.
