#!/usr/bin/env node
/**
 * Demo script: builds a fully completed 6-month EDUCATION project end to end.
 *
 *  - project, logframe (goal / outcomes / outputs / activity nodes), 6 indicators with explicit semantics
 *  - a monthly and a final donor template (LLM-extracted, reviewed, approved) and a reporting profile with typed finance
 *  - months 1-5 are MONTHLY periods; month 6 is the FINAL period (the closing period of the cadence: it states
 *    life-of-project totals from every earlier period and carries the verified project finance)
 *  - every period has sex-disaggregated, verified indicator data, 5 activities (reviewed ACCEPTED, so the final
 *    report rolls them up), narrative evidence (verified, tagged AND attached to its activity / indicator update)
 *
 * It generates NO AI report: the final report is generated from the UI.
 * Talks to a running DonorDesk API over HTTP (bearer token) — no direct database access.
 *
 * Usage (credentials come from the environment, never from this file):
 *   API_URL=http://127.0.0.1:4001 DEMO_EMAIL=... DEMO_PASSWORD=... node scripts/demo-education-6mo.mjs
 *   Re-link evidence on an existing project:  LINK_PROJECT_ID=<id> ... node scripts/demo-education-6mo.mjs
 */

const API_URL = process.env.API_URL ?? "http://127.0.0.1:4001";
const { DEMO_EMAIL, DEMO_PASSWORD } = process.env;
if (!DEMO_EMAIL || !DEMO_PASSWORD) {
  console.error("Set DEMO_EMAIL and DEMO_PASSWORD.");
  process.exit(1);
}
const START = new Date(process.env.START_DATE ?? "2026-03-01T00:00:00Z");
const PROJECT_TITLE = process.env.PROJECT_TITLE ?? "[DEMO] Learning Recovery for Displaced Children";
const PROJECT_CODE = process.env.PROJECT_CODE ?? `EDU-LR-${Date.now().toString(36).toUpperCase()}`;
const MONTHS = 6;

let TOKEN;
const iso = (d) => new Date(d).toISOString();
const addMonths = (d, n) => { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + n); return x; };
const addDays = (d, n) => new Date(new Date(d).getTime() + n * 86400000);
const log = (s, d = "") => console.log(`\n== ${s}${d ? " — " + d : ""}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, body) {
  const headers = {};
  if (TOKEN) headers.authorization = `Bearer ${TOKEN}`;
  let payload = body;
  if (body && !(body instanceof FormData)) { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
  const res = await fetch(`${API_URL}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : undefined; } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${typeof json === "string" ? json : JSON.stringify(json)}`);
  return json;
}

// ---- data plan -------------------------------------------------------------
const SITES = ["Majengo Camp", "Kalobeyei Settlement", "Nakuprat Village", "Lokichar Ward", "Napuu Community", "Katilu Sub-location"];
const MONTH_NAMES = ["March", "April", "May", "June", "July", "August"];
const PERIOD = {
  enrolled:   [150, 180, 230, 240, 220, 240],   // target 1,200 -> 1,260
  teachers:   [10, 10, 12, 10, 10, 8],          // target 60
  spaces:     [1, 2, 3, 3, 2, 1],               // target 12
  kits:       [200, 250, 250, 200, 150, 150],   // target 1,200
  caregivers: [30, 50, 60, 60, 50, 50],         // target 300
  attendance: [68, 72, 76, 79, 82, 86],         // rate %, target 85, baseline 62
};
const SHARE = { enrolled: 0.52, teachers: 0.55, caregivers: 0.7 }; // female share
const UNITS = ["children", "teachers", "learning spaces", "kits", "caregivers", "%"];
const TARGETS = ["1200", "60", "12", "1200", "300", "85"];
const cum = (arr, m) => arr.slice(0, m + 1).reduce((a, b) => a + b, 0);
const split = (v, share) => { const f = Math.round(v * share); return [f, v - f]; };
const BUDGET_LINES = [["Teacher training", 60000], ["Learning space rehabilitation", 150000], ["Learning kits", 60000], ["Community engagement", 40000], ["Programme management & MEAL", 110000]];
const SPENT_SHARE = 0.97; // a completed project closes with a small unspent balance

const CHALLENGES = {
  enrolled: ["Some families initially hesitated to enrol girls; outreach through community elders was needed.", "Heavy rains cut off one settlement for three days.", "Documentation gaps delayed registration of 12 children.", "Seasonal herding migration reduced turnout at two sites.", "Long queues at the registration desk on day one.", "Late arrivals from a newly settled area needed catch-up placement."],
  teachers: ["Two trainees arrived a day late because of transport delays.", "The projector failed, so sessions ran with printed handouts.", "Trainers needed extra time on child-centred methods.", "One trainee was absent through illness and caught up later.", "The venue was double-booked, so training moved to a second school.", "The final assessment overlapped with school exams."],
  spaces: ["Cement delivery was delayed by two days.", "A contractor shortage during the rainy season slowed work.", "Roof sheeting arrived with minor damage and was replaced.", "Water for construction was limited at one site.", "Painting was delayed by humidity.", "The final inspection required one minor snag fix."],
  kits: ["The packing list needed correction before dispatch.", "A truck breakdown delayed deliveries to one site.", "Mismatched kit counts at one school were reconciled.", "Storage space was limited at the smallest school.", "Distribution day clashed with market day.", "The last kits were delivered to a late-enrolling cohort."],
  caregivers: ["Turnout among fathers was low at the first session.", "Sessions were rescheduled around harvest labour.", "The venue was too small, so the session moved outdoors.", "Interpretation was needed for two language groups.", "Attendance improved after reminders through school committees.", "A session coincided with a community funeral and was rescheduled."],
};

const TYPES = [
  { key: "enrolled", code: "A1.1", out: 0, ind: 0, evType: "BENEFICIARY_LIST", title: (s) => `A1.1 — Back-to-school enrolment drive, ${s}` },
  { key: "teachers", code: "A2.1", out: 1, ind: 1, evType: "TRAINING_RECORD", title: (s) => `A2.1 — Teacher training on child-centred pedagogy, ${s}` },
  { key: "spaces", code: "A3.1", out: 2, ind: 2, evType: "FIELD_VISIT_REPORT", title: (s) => `A3.1 — Rehabilitation of learning spaces, ${s}` },
  { key: "kits", code: "A3.2", out: 2, ind: 3, evType: "DISTRIBUTION_LIST", title: (s) => `A3.2 — Learning kit distribution, ${s}` },
  { key: "caregivers", code: "A4.1", out: 3, ind: 4, evType: "ATTENDANCE_SHEET", title: (s) => `A4.1 — Caregiver and school-committee sessions, ${s}` },
];

function buildActivity(t, m, ids) {
  const v = PERIOD[t.key][m];
  const site = SITES[(m + TYPES.indexOf(t)) % SITES.length];
  const month = MONTH_NAMES[m];
  const texts = {
    enrolled: { summary: `Community mobilisers and head teachers ran a ${month} enrolment drive at ${site}, registering out-of-school children aged 6-14 and placing them in age-appropriate classes.`, achievements: `${v} children enrolled in ${month}; cumulative enrolment reached ${cum(PERIOD.enrolled, m)}.`, lessonsLearned: "Door-to-door visits with community elders raise girls' enrolment." },
    teachers: { summary: `${v} teachers completed a ${month} training block on child-centred methods, foundational literacy and numeracy, and psychosocial support at ${site}.`, achievements: `${v} teachers trained and certified; cumulative teachers trained ${cum(PERIOD.teachers, m)}.`, lessonsLearned: "Short follow-up classroom coaching consolidates training better than one-off workshops." },
    spaces: { summary: `Contractors and community labour rehabilitated ${v} learning space(s) at ${site} in ${month}: roofing, floors, windows, desks and safe latrine access.`, achievements: `${v} learning space(s) completed and handed over; cumulative spaces rehabilitated ${cum(PERIOD.spaces, m)}.`, lessonsLearned: "Pre-ordering materials before the rains avoids construction delays." },
    kits: { summary: `${v} learning kits (exercise books, pens, slates, reading primers and a school bag) were distributed to enrolled children at ${site} in ${month}.`, achievements: `${v} kits distributed; cumulative kits distributed ${cum(PERIOD.kits, m)}.`, lessonsLearned: "Distributing kits on enrolment day improves first-week attendance." },
    caregivers: { summary: `${v} caregivers and school-committee members attended ${month} sessions on school attendance, safe learning and positive parenting at ${site}.`, achievements: `${v} caregivers reached; cumulative caregivers trained ${cum(PERIOD.caregivers, m)}.`, lessonsLearned: "Holding sessions after market hours increases attendance, especially among fathers." },
  };
  const a = {
    activityTitle: t.title(site), location: `${site}, Turkana West`, outputId: ids.outputs[t.out], indicatorId: ids.indicators[t.ind],
    activityDate: iso(addDays(addMonths(START, m), 4 + TYPES.indexOf(t) * 5)),
    ...texts[t.key], challenges: CHALLENGES[t.key][m],
    nextSteps: m < 5 ? `Continue ${t.title("").split("—")[1].split(",")[0].trim().toLowerCase()} in ${MONTH_NAMES[m + 1]}.` : "Hand over to the school management committees and the county education office.",
  };
  if (SHARE[t.key] !== undefined) { const [f, ml] = split(v, SHARE[t.key]); Object.assign(a, { participantsTotal: v, participantsFemale: f, participantsMale: ml }); }
  if (t.key === "kits") a.participantsTotal = v;
  return a;
}

/** A short field report in prose: evidence a reader (and the verifier) can match against the claims made from it. */
function evidenceNarrative(t, m, a) {
  const v = PERIOD[t.key][m];
  const site = a.location.split(",")[0];
  const month = MONTH_NAMES[m];
  const head = `${a.activityTitle.split("—")[1].trim()} — field report, ${month} 2026\nDate: ${a.activityDate.slice(0, 10)} | Location: ${a.location}\n\n`;
  const body = {
    enrolled: () => { const [f, ml] = split(v, SHARE.enrolled); return `Community mobilisers and head teachers registered ${v} out-of-school children at ${site} in ${month}: ${f} girls and ${ml} boys. Children were placed in age-appropriate classes and given a first-day orientation. ${a.challenges}`; },
    teachers: () => { const [f, ml] = split(v, SHARE.teachers); return `${v} teachers (${f} women and ${ml} men) completed the ${month} training block on child-centred pedagogy, foundational literacy and numeracy, and psychosocial support at ${site}. All ${v} passed the competency assessment. ${a.challenges}`; },
    spaces: () => `${v} learning space(s) at ${site} were rehabilitated in ${month}, with new roofing, floors, windows, desks and safe latrine access. The engineer inspected and handed over ${v} space(s) to the school committee. ${a.challenges}`,
    kits: () => `${v} learning kits, each with exercise books, pens, a slate, a reading primer and a school bag, were distributed to enrolled children at ${site} in ${month}. Every child or caregiver signed the distribution list. ${a.challenges}`,
    caregivers: () => { const [f, ml] = split(v, SHARE.caregivers); return `${v} caregivers and school-committee members (${f} mothers or female caregivers and ${ml} fathers or male caregivers) attended the ${month} sessions at ${site} on school attendance, safe learning and positive parenting. ${a.challenges}`; },
  };
  return head + body[t.key]() + "\n";
}

// ---- steps -------------------------------------------------------------------
/**
 * Explicit indicator semantics. The defaults leave every indicator "Descriptive only"; counts are SUMmed and the
 * directly reported attendance rate is its LATEST value (a PERCENTAGE aggregation needs a numerator/denominator).
 */
async function configureSemantics(inds) {
  for (const i of inds) {
    await api("PUT", `/v1/indicators/${i.id}/semantics`, { aggregation: i.code === "IND-6" ? "LATEST" : "SUM", direction: "HIGHER_IS_BETTER", reportingBasis: "PERIOD" });
  }
  console.log("  indicator semantics configured (counts SUM, attendance LATEST, higher is better)");
}

/**
 * Uploading evidence with activityId / indicatorId tags it; attaching also puts it on the activity (attachedEvidenceIds)
 * and on the indicator update. Idempotent: attaching rewrites evidence.indicatorId to the update id, so evidence whose
 * indicatorId is already an update id is skipped.
 */
async function linkEvidence(projectId) {
  const items = [];
  for (let page = 1; ; page++) {
    const found = await api("POST", "/v1/evidence/search", { projectId, page, pageSize: 200 });
    items.push(...found.items);
    if (items.length >= found.total || found.items.length === 0) break;
  }
  const lf = await api("GET", `/v1/projects/${projectId}/logframe`);
  const updateIds = new Set();
  const updatesByIndicator = new Map();
  for (const ind of lf.indicators) {
    const { updates } = await api("GET", `/v1/indicators/${ind.id}/updates`);
    updatesByIndicator.set(ind.id, updates);
    for (const u of updates) updateIds.add(u.id);
  }
  let activities = 0, indicators = 0;
  for (const ev of items) {
    if (ev.activityId) { await api("POST", "/v1/activities/attach-evidence", { evidenceId: ev.id, activityId: ev.activityId }); activities++; }
    if (!ev.indicatorId || updateIds.has(ev.indicatorId)) continue;
    const update = (updatesByIndicator.get(ev.indicatorId) ?? []).find((u) => u.reportingPeriodId === ev.reportingPeriodId);
    if (update) { await api("POST", "/v1/activities/attach-evidence", { evidenceId: ev.id, indicatorId: update.id }); indicators++; }
  }
  console.log(`  evidence attached: ${activities} to activities, ${indicators} to indicator updates (of ${items.length} files)`);
}

async function upload(projectId, periodId, { title, evidenceType, content, fileName, activityId, indicatorId, location, activityDate }) {
  const form = new FormData();
  form.set("file", new Blob([content], { type: "text/plain" }), fileName);
  form.set("projectId", projectId); form.set("title", title); form.set("evidenceType", evidenceType); form.set("reportingPeriodId", periodId);
  if (activityId) form.set("activityId", activityId);
  if (indicatorId) form.set("indicatorId", indicatorId);
  if (location) form.set("location", location);
  if (activityDate) form.set("activityDate", activityDate);
  const ev = await api("POST", "/v1/evidence/upload", form);
  await api("POST", `/v1/evidence/${ev.id}/verify`, {});
}

/** The reporting officer's "Tell the Story" answers for a period; consistent with the data entered for it. */
function storyFor(m, isFinal) {
  if (isFinal) {
    return {
      achievements: "Over six months 1,260 out-of-school children were enrolled against a target of 1,200, 60 teachers were trained, 12 learning spaces were rehabilitated, 1,200 learning kits were distributed and 300 caregivers and committee members were reached. Average attendance rose from 62% to 86%.",
      challenges: "Rainy-season access, supply delays and late arrivals of newly settled families were the main challenges; each was managed through early ordering of materials and flexible scheduling.",
      varianceExplanations: "Expenditure closed at 97% of budget. The small unspent balance reflects negotiated savings on roofing materials and a lower-than-budgeted cost for the final inspection.",
      adaptations: "Sessions moved to early mornings and after market hours, and distribution moved to enrolment day, which raised attendance.",
      lessons: "Community ownership, door-to-door outreach with elders and early ordering of materials were the strongest drivers of delivery on time.",
    };
  }
  return {
    achievements: `In ${MONTH_NAMES[m]}: ${PERIOD.enrolled[m]} children enrolled, ${PERIOD.teachers[m]} teachers trained, ${PERIOD.spaces[m]} learning space(s) rehabilitated, ${PERIOD.kits[m]} kits distributed and ${PERIOD.caregivers[m]} caregivers reached; average attendance was ${PERIOD.attendance[m]}%.`,
    challenges: [CHALLENGES.enrolled[m], CHALLENGES.spaces[m]].join(" "),
    adaptations: "Activities were rescheduled and venues changed where access or timing made the original plan unworkable.",
    lessons: "Early planning with school committees avoids avoidable delays.",
  };
}

async function main() {
  log("Login", DEMO_EMAIL);
  TOKEN = (await api("POST", "/v1/auth/login", { email: DEMO_EMAIL, password: DEMO_PASSWORD })).token;

  if (process.env.LINK_PROJECT_ID) { await linkEvidence(process.env.LINK_PROJECT_ID); return; }

  const end = addDays(addMonths(START, MONTHS), -1);

  log("Project", PROJECT_TITLE);
  const project = await api("POST", "/v1/projects", {
    title: PROJECT_TITLE, projectCode: PROJECT_CODE,
    donorName: "Global Education Partnership Fund", implementingOrganization: "Acme Humanitarian NGO",
    country: "Kenya", region: "Turkana", district: "Turkana West", sector: "EDUCATION",
    startDate: iso(START), endDate: iso(end), budgetAmount: 420000, budgetCurrency: "USD", reportingFrequency: "MONTHLY",
    description: "A 6-month education recovery project enrolling out-of-school and displaced children in Turkana West, training teachers, rehabilitating learning spaces, distributing learning kits and engaging caregivers so that children return to and stay in school.",
    primaryContactName: "Dr. Amina Yusuf",
  });
  const projectId = project.id;
  console.log("projectId:", projectId);
  await api("PUT", `/v1/projects/${projectId}`, { status: "ACTIVE" });
  try { await api("POST", `/v1/projects/${projectId}/setup/acknowledge`, { acknowledged: true }); } catch (e) { console.log("setup acknowledge:", e.message.slice(0, 160)); }

  log("Logframe");
  const lf = (b) => api("POST", "/v1/logframe-items", { projectId, ...b });
  const goal = await lf({ level: "GOAL", code: "G1", title: "Displaced and out-of-school children in Turkana West learn in safe, quality classrooms", description: "Contribute to improved access to, and retention in, quality basic education for displaced and host-community children." });
  const o1 = await lf({ parentId: goal.id, level: "OUTCOME", code: "O1", title: "Increased enrolment, attendance and retention of out-of-school children" });
  const o2 = await lf({ parentId: goal.id, level: "OUTCOME", code: "O2", title: "Improved teaching quality and community support for learning" });
  const outs = [
    await lf({ parentId: o1.id, level: "OUTPUT", code: "OP1", title: "Out-of-school children enrolled and attending regularly" }),
    await lf({ parentId: o2.id, level: "OUTPUT", code: "OP2", title: "Teachers trained in child-centred pedagogy" }),
    await lf({ parentId: o1.id, level: "OUTPUT", code: "OP3", title: "Safe learning spaces rehabilitated and equipped with learning kits" }),
    await lf({ parentId: o2.id, level: "OUTPUT", code: "OP4", title: "Caregivers and school committees engaged in children's learning" }),
  ];
  for (const [o, code, title] of [[0, "A1.1", "Conduct back-to-school enrolment drives"], [0, "A1.2", "Monitor weekly attendance and follow up absentees"], [1, "A2.1", "Train teachers in child-centred pedagogy"], [2, "A3.1", "Rehabilitate learning spaces"], [2, "A3.2", "Distribute learning kits"], [3, "A4.1", "Hold caregiver and school-committee sessions"]]) {
    await lf({ parentId: outs[o].id, level: "ACTIVITY", code, title });
  }

  log("Indicators");
  const indDefs = [
    { logframeItemId: outs[0].id, code: "IND-1", name: "Number of out-of-school children enrolled", type: "NUMBER", baseline: "0", unit: "children", dataSource: "School enrolment registers", disaggregationRequired: true },
    { logframeItemId: outs[1].id, code: "IND-2", name: "Number of teachers trained in child-centred pedagogy", type: "NUMBER", baseline: "0", unit: "teachers", dataSource: "Training attendance sheets and competency assessments", disaggregationRequired: true },
    { logframeItemId: outs[2].id, code: "IND-3", name: "Number of learning spaces rehabilitated", type: "NUMBER", baseline: "0", unit: "learning spaces", dataSource: "Engineer inspection and handover certificates" },
    { logframeItemId: outs[2].id, code: "IND-4", name: "Number of learning kits distributed", type: "NUMBER", baseline: "0", unit: "kits", dataSource: "Signed distribution lists" },
    { logframeItemId: outs[3].id, code: "IND-5", name: "Number of caregivers and committee members trained", type: "NUMBER", baseline: "0", unit: "caregivers", dataSource: "Session attendance sheets", disaggregationRequired: true },
    { logframeItemId: outs[0].id, code: "IND-6", name: "Average attendance rate of enrolled children", type: "PERCENTAGE", baseline: "62", unit: "%", dataSource: "Weekly class attendance registers" },
  ].map((d, i) => ({ ...d, target: TARGETS[i], frequency: "Monthly" }));
  const inds = [];
  for (const d of indDefs) { const c = await api("POST", "/v1/indicators", { projectId, ...d }); inds.push({ ...d, id: c.id }); console.log("  ", d.code, d.name); }
  const ids = { outputs: outs.map((o) => o.id), indicators: inds.map((i) => i.id) };
  await configureSemantics(inds);

  log("Donor templates");
  const monthlyText = [
    "Global Education Partnership Fund — Monthly Progress Report", "",
    "1. Executive Summary", "Summarise progress this month against plan in no more than 250 words.", "",
    "2. Indicator Progress", "Provide an indicator table with period and cumulative achievement against baseline and target. Disaggregate by sex where applicable.", "",
    "3. Activities Implemented", "Describe the activities implemented this month, including location and participants.", "",
    "4. Challenges and Lessons Learned", "Describe challenges, mitigation measures and lessons learned.", "",
    "5. Child Safeguarding and Visibility", "Report any child-safeguarding incident within 48 hours. Confirm the Global Education Partnership Fund is acknowledged on all materials.", "",
    "Annex A: Indicator tracking table", "Annex B: Evidence log",
  ].join("\n");
  const finalText = [
    "Global Education Partnership Fund — Final Project Report", "",
    "1. Executive Summary", "Summarise the project's overall results, achievement of targets and key lessons in no more than 400 words.", "",
    "2. Project Background and Context", "Describe the context, target population and project design.", "",
    "3. Results Against the Logframe", "Report life-of-project achievement for every indicator against baseline and target, disaggregated by sex where applicable.", "",
    "4. Activities and Outputs Delivered", "Summarise activities delivered by output across the six months, with locations and participants.", "",
    "5. Financial Summary", "Report budget, expenditure and burn rate for the project.", "",
    "6. Challenges, Risks and Lessons Learned", "Describe challenges, how they were mitigated and the lessons learned.", "",
    "7. Sustainability and Recommendations", "Describe how results will be sustained and recommend next steps.", "",
    "8. Child Safeguarding and Visibility", "Confirm child-safeguarding compliance and donor visibility.", "",
    "Annex A: Indicator performance table", "Annex B: Evidence log",
  ].join("\n");
  const makeTemplate = async (name, reportType, text) => {
    let t = await api("POST", "/v1/templates", { projectId, templateName: name, donorName: "Global Education Partnership Fund", reportType, language: "en", requiredAnnexes: [], sections: [], extractedRawText: text });
    for (let i = 0; i < 40 && t.status === "EXTRACTING"; i++) { await sleep(3000); t = await api("GET", `/v1/templates/${t.id}`); }
    console.log("  ", name, "sections:", t.sections.length, "method:", t.extractionMeta?.method);
    await api("PUT", `/v1/templates/${t.id}/sections`, { sections: t.sections.map((s) => ({ ...s, reviewStatus: "REVIEWED" })), expectedVersion: t.version });
    await api("POST", `/v1/templates/${t.id}/review`, {});
    return t;
  };
  const monthlyTpl = await makeTemplate("Global Education Partnership Fund Monthly Report", "MONTHLY", monthlyText);
  const finalTpl = await makeTemplate("Global Education Partnership Fund Final Report", "FINAL", finalText);

  log("Reporting profile");
  await api("PUT", `/v1/projects/${projectId}/reporting-profile`, {
    defaultTemplateId: monthlyTpl.id, language: "en", tone: "FORMAL", formattingRules: [],
    specialRequirements: ["Disaggregate beneficiary figures by sex.", "Acknowledge the Global Education Partnership Fund as the donor.", "Never name individual children in any report."],
    sectionOverrides: {}, financeDataMode: "TYPED",
  });

  const periods = [];
  for (let m = 0; m < MONTHS; m++) {
    const isFinal = m === MONTHS - 1;
    const mStart = addMonths(START, m);
    const mEnd = addDays(addMonths(START, m + 1), -1);
    log(`Month ${m + 1}`, `${MONTH_NAMES[m]}${isFinal ? " (FINAL period)" : ""}`);
    const period = await api("POST", "/v1/reporting-periods", { projectId, donorTemplateId: isFinal ? finalTpl.id : monthlyTpl.id, reportType: isFinal ? "FINAL" : "MONTHLY", startDate: iso(mStart), endDate: iso(mEnd), deadline: iso(addDays(mEnd, isFinal ? 30 : 10)) });
    periods.push(period.id);
    await api("PUT", `/v1/reporting-periods/${period.id}/story`, { storyContext: storyFor(m, isFinal) });

    // verified indicator data (sex split on the people indicators)
    const keys = ["enrolled", "teachers", "spaces", "kits", "caregivers", "attendance"];
    const updates = keys.map((k, i) => ({
      indicatorId: inds[i].id,
      periodAchievement: String(PERIOD[k][m]),
      cumulativeAchievement: k === "attendance" ? String(PERIOD[k][m]) : String(cum(PERIOD[k], m)),
      dataSource: inds[i].dataSource,
      comments: k === "attendance" ? `Average attendance across all sites in ${MONTH_NAMES[m]}.` : `${MONTH_NAMES[m]}: ${PERIOD[k][m]} ${UNITS[i]}; cumulative ${cum(PERIOD[k], m)} of target ${TARGETS[i]}.`,
      ...(SHARE[k] !== undefined ? { disaggregation: (([f, ml]) => [{ dimension: "SEX", category: "Female", value: String(f) }, { dimension: "SEX", category: "Male", value: String(ml) }])(split(PERIOD[k][m], SHARE[k])) } : {}),
    }));
    await api("POST", "/v1/indicator-updates/bulk", { reportingPeriodId: period.id, updates });
    for (const ind of inds) {
      const row = (await api("GET", `/v1/indicators/${ind.id}/updates`)).updates.find((r) => r.reportingPeriodId === period.id);
      if (!row) throw new Error(`no update row for ${ind.code} in month ${m + 1}`);
      await api("POST", `/v1/indicator-updates/${row.id}/verify`, {});
    }
    console.log("  6 indicator updates saved + verified");

    // activities (reviewed ACCEPTED so a final report rolls them up) + narrative evidence
    for (const t of TYPES) {
      const a = buildActivity(t, m, ids);
      const act = await api("POST", "/v1/activities", { projectId, reportingPeriodId: period.id, ...a });
      await api("POST", "/v1/activities/review", { activityId: act.id, decision: "ACCEPT" });
      await upload(projectId, period.id, { title: `${t.code} ${MONTH_NAMES[m]} — field report (${a.location.split(",")[0]})`, evidenceType: t.evType, content: evidenceNarrative(t, m, a), fileName: `${t.code}-m${m + 1}-${t.key}.txt`, activityId: act.id, indicatorId: ids.indicators[t.ind], location: a.location, activityDate: a.activityDate });
    }
    await upload(projectId, period.id, { title: `Weekly attendance register summary — ${MONTH_NAMES[m]}`, evidenceType: "MONITORING_REPORT", fileName: `attendance-m${m + 1}.txt`, indicatorId: ids.indicators[5], content: `Attendance summary — ${MONTH_NAMES[m]} 2026\nAverage attendance of enrolled children across the ${SITES.length} sites was ${PERIOD.attendance[m]}%, against a baseline of 62% and a target of 85%.\n` });
    console.log("  5 activities (accepted) + 6 evidence files (verified)");

    if (isFinal) {
      // The closing period carries the project's verified finance: the full budget and cumulative spend.
      const lines = BUDGET_LINES.map(([name, total]) => ({ budgetLine: name, budget: String(total), expenditure: String(Math.round(total * SPENT_SHARE)) }));
      await api("PUT", `/v1/reporting-periods/${period.id}/finance`, { currency: "USD", sourceNote: "Project finance ledger, cumulative to 31 August 2026", lines });
      await api("POST", `/v1/reporting-periods/${period.id}/finance/verify`, {});
      console.log("  project finance saved + verified");
      await upload(projectId, period.id, { title: "End-of-project attendance and learning review", evidenceType: "MONITORING_REPORT", fileName: "end-of-project-review.txt", indicatorId: ids.indicators[5], content: "End-of-project attendance and learning review\nAverage attendance of enrolled children rose from a baseline of 62% to 86% by August 2026, against a target of 85%. Enrolment reached 1,260 children against a target of 1,200.\n" });
      await upload(projectId, period.id, { title: "Project closure and handover certificate", evidenceType: "APPROVAL_DOCUMENT", fileName: "closure-handover.txt", content: "Project closure and handover certificate\nAll 12 rehabilitated learning spaces were handed over to the school management committees. Assets were transferred and the county education office signed off the handover.\n" });
    }
    console.log("  checklist created:", (await api("POST", `/v1/reporting-periods/${period.id}/detect-missing`, {})).created);
  }

  log("Linking evidence to activities and indicator updates");
  await linkEvidence(projectId);

  const finalPeriodId = periods[MONTHS - 1];
  console.log("  final readiness:", JSON.stringify(await api("GET", `/v1/reporting-periods/${finalPeriodId}/readiness`)));
  console.log("\n=== BUILD DONE (no AI report generated) ===");
  console.log(JSON.stringify({ projectId, monthlyTemplateId: monthlyTpl.id, finalTemplateId: finalTpl.id, periods, finalPeriodId }, null, 2));
  console.log("Final report:", `https://donordesk.online/projects/${projectId}/reports/${finalPeriodId}`);
}

main().catch((e) => { console.error("\nFAILED:", e.message); process.exit(1); });
