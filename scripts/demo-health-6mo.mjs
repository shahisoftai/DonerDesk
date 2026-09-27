#!/usr/bin/env node
/**
 * Demo script: creates a 6-month health project end to end — project,
 * logframe (goal/outcomes/outputs), indicators, a reviewed donor template,
 * reporting profile, month-1 reporting period with indicator/activity data
 * and evidence, a compliance checklist pass, then generates the month-1
 * report draft.
 *
 * Talks to a running DonorDesk API over plain HTTP with a bearer token —
 * it does not touch the database directly, so it exercises the exact same
 * validation, readiness gates and business logic a real user goes through.
 *
 * Usage:
 *   API_URL=http://127.0.0.1:4001 TOKEN=<bearer token> node scripts/demo-health-6mo.mjs
 *
 * Get a token by logging in through the web app and reading the `dd_session`
 * cookie (its value is the bearer token DonorDesk's API accepts directly).
 */

const API_URL = process.env.API_URL ?? "http://127.0.0.1:4001";
const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error("Set TOKEN=<dd_session cookie value> (see script header for how to get one).");
  process.exit(1);
}

const START_DATE = process.env.START_DATE ?? "2027-01-01";
const PROJECT_TITLE = process.env.PROJECT_TITLE ?? "Maternal & Child Health Access Project";
const PROJECT_CODE = process.env.PROJECT_CODE ?? `MCH-${Date.now().toString(36).toUpperCase()}`;

function addMonths(iso, months) {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}
function iso(d) {
  return new Date(d).toISOString();
}

async function api(method, path, body, opts = {}) {
  const headers = { authorization: `Bearer ${TOKEN}`, ...opts.headers };
  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API_URL}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${typeof json === "string" ? json : JSON.stringify(json)}`);
  }
  return json;
}

function log(step, detail = "") {
  console.log(`\n== ${step}${detail ? " — " + detail : ""}`);
}

async function main() {
  const projectStart = new Date(START_DATE);
  const projectEnd = addMonths(START_DATE, 6);
  projectEnd.setUTCDate(projectEnd.getUTCDate() - 1); // 6 full months, end of month 6

  // 1. Project ------------------------------------------------------------
  log("Creating project", PROJECT_TITLE);
  const project = await api("POST", "/v1/projects", {
    title: PROJECT_TITLE,
    projectCode: PROJECT_CODE,
    donorName: "Global Health Fund",
    implementingOrganization: "Acme Humanitarian NGO",
    country: "Kenya",
    region: "Turkana",
    district: "Lodwar",
    sector: "HEALTH",
    startDate: iso(projectStart),
    endDate: iso(projectEnd),
    budgetAmount: 450000,
    budgetCurrency: "USD",
    reportingFrequency: "MONTHLY",
    description: "Improving access to maternal and child health services in Turkana County through mobile clinics, community health worker training, and facility-based service delivery over a 6-month pilot period.",
    primaryContactName: "Dr. Amina Yusuf",
  });
  const projectId = project.id;
  console.log("projectId:", projectId);
  await api("PUT", `/v1/projects/${projectId}`, { status: "ACTIVE" });

  // 2. Logframe -------------------------------------------------------------
  log("Creating logframe");
  const goal = await api("POST", "/v1/logframe-items", {
    projectId,
    level: "GOAL",
    code: "G1",
    title: "Improved maternal and child health outcomes in Turkana County",
    description: "Reduce preventable maternal and under-5 mortality through increased access to quality health services.",
  });
  const outcome1 = await api("POST", "/v1/logframe-items", {
    projectId,
    parentId: goal.id,
    level: "OUTCOME",
    code: "O1",
    title: "Increased utilisation of skilled maternal health services",
  });
  const outcome2 = await api("POST", "/v1/logframe-items", {
    projectId,
    parentId: goal.id,
    level: "OUTCOME",
    code: "O2",
    title: "Improved child immunisation coverage",
  });
  const output1 = await api("POST", "/v1/logframe-items", {
    projectId,
    parentId: outcome1.id,
    level: "OUTPUT",
    code: "OP1",
    title: "Mobile health clinics providing antenatal and delivery services",
  });
  const output2 = await api("POST", "/v1/logframe-items", {
    projectId,
    parentId: outcome2.id,
    level: "OUTPUT",
    code: "OP2",
    title: "Community health workers trained on routine immunisation",
  });

  // 3. Indicators -------------------------------------------------------------
  log("Creating indicators");
  const indicatorDefs = [
    { logframeItemId: output1.id, code: "IND-1", name: "Number of skilled birth attendances", type: "NUMBER", baseline: "40", target: "220", unit: "births", frequency: "Monthly", dataSource: "Facility delivery register" },
    { logframeItemId: output1.id, code: "IND-2", name: "Number of antenatal care visits (4th visit)", type: "NUMBER", baseline: "60", target: "300", unit: "visits", frequency: "Monthly", dataSource: "ANC register" },
    { logframeItemId: output2.id, code: "IND-3", name: "Children fully immunised under 1 year", type: "NUMBER", baseline: "50", target: "400", unit: "children", frequency: "Monthly", dataSource: "EPI register", disaggregationRequired: true },
    { logframeItemId: output2.id, code: "IND-4", name: "Community health workers trained and active", type: "NUMBER", baseline: "0", target: "30", unit: "CHWs", frequency: "Monthly", dataSource: "Training attendance sheets" },
  ];
  const indicators = [];
  for (const def of indicatorDefs) {
    const created = await api("POST", "/v1/indicators", { projectId, ...def });
    indicators.push({ ...def, id: created.id });
    console.log(`  ${def.code}: ${def.name}`);
  }

  // 4. Donor template ---------------------------------------------------------
  log("Creating donor report template");
  const templateText = [
    "Global Health Fund Monthly Progress Report Template",
    "",
    "1. Executive Summary",
    "Provide a narrative overview of progress this month (max 300 words).",
    "",
    "2. Indicator Progress",
    "Provide an indicator table with achievements against baseline and target. Indicators must be disaggregated by sex and age where applicable.",
    "",
    "3. Activities Implemented",
    "Describe the key activities implemented this month, including location and participants.",
    "",
    "4. Challenges and Mitigation",
    "Describe any challenges encountered and the mitigation measures taken.",
    "",
    "5. Compliance and Safeguarding",
    "Partners must report any safeguarding incidents to the Global Health Fund within 48 hours. Confirm compliance with the donor's visibility and branding guidelines.",
    "",
    "Annexes",
    "Annex A: Indicator performance tracking table",
    "Annex B: Evidence log",
  ].join("\n");

  let template = await api("POST", "/v1/templates", {
    projectId,
    templateName: "Global Health Fund Monthly Report",
    donorName: "Global Health Fund",
    reportType: "MONTHLY",
    language: "en",
    requiredAnnexes: [],
    sections: [],
    extractedRawText: templateText,
  });
  console.log("templateId:", template.id, "status:", template.status);

  // Extraction runs in the background; poll until it's out of EXTRACTING.
  for (let i = 0; i < 15 && template.status === "EXTRACTING"; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    template = await api("GET", `/v1/templates/${template.id}`);
  }
  console.log("extraction status:", template.status, "sections:", template.sections.length, "method:", template.extractionMeta?.method);

  // Accept every section, then approve the template.
  const reviewedSections = template.sections.map((s) => ({ ...s, reviewStatus: "REVIEWED" }));
  const saved = await api("PUT", `/v1/templates/${template.id}/sections`, { sections: reviewedSections, expectedVersion: template.version });
  const approved = await api("POST", `/v1/templates/${template.id}/review`, {});
  console.log("template approved:", approved.status, "version:", saved.version);

  // 5. Reporting profile --------------------------------------------------
  log("Setting reporting profile");
  await api("PUT", `/v1/projects/${projectId}/reporting-profile`, {
    defaultTemplateId: template.id,
    language: "en",
    tone: "FORMAL",
    formattingRules: [],
    specialRequirements: [],
    sectionOverrides: {},
  });

  // 6. Reporting period for month 1 ----------------------------------------
  log("Creating month-1 reporting period");
  const m1Start = projectStart;
  const m1End = addMonths(m1Start, 1);
  m1End.setUTCDate(m1End.getUTCDate() - 1);
  const deadline = addMonths(m1End, 0);
  deadline.setUTCDate(deadline.getUTCDate() + 10);
  const period = await api("POST", "/v1/reporting-periods", {
    projectId,
    donorTemplateId: template.id,
    reportType: "MONTHLY",
    startDate: iso(m1Start),
    endDate: iso(m1End),
    deadline: iso(deadline),
  });
  const periodId = period.id;
  console.log("periodId:", periodId);

  // 7. Month-1 indicator data ----------------------------------------------
  log("Recording month-1 indicator updates");
  const monthData = [
    { code: "IND-1", period: "38", cumulative: "38", comments: "Steady uptake at both mobile clinic sites." },
    { code: "IND-2", period: "52", cumulative: "52", comments: "ANC 4th-visit attendance slightly below target due to seasonal access constraints." },
    { code: "IND-3", period: "61", cumulative: "61", comments: "Immunisation outreach reached two additional villages this month." },
    { code: "IND-4", period: "12", cumulative: "12", comments: "First cohort of CHWs completed training and deployed." },
  ];
  for (const row of monthData) {
    const indicator = indicators.find((i) => i.code === row.code);
    const update = await api("POST", "/v1/indicator-updates", {
      indicatorId: indicator.id,
      reportingPeriodId: periodId,
      periodAchievement: row.period,
      cumulativeAchievement: row.cumulative,
      comments: row.comments,
      dataSource: indicator.dataSource,
    });
    await api("POST", `/v1/indicator-updates/${update.id}/verify`, {});
    console.log(`  ${row.code}: ${row.period} (verified)`);
  }

  // 8. Month-1 activities ---------------------------------------------------
  log("Recording month-1 activities");
  const activityDefs = [
    {
      activityTitle: "Mobile antenatal and delivery clinic — Lodwar East",
      activityDate: iso(new Date(m1Start.getTime() + 6 * 86400000)),
      location: "Lodwar East ward",
      outputId: output1.id,
      indicatorId: indicators.find((i) => i.code === "IND-1").id,
      participantsTotal: 64,
      participantsFemale: 64,
      summary: "A two-day mobile clinic provided antenatal check-ups and 9 supervised deliveries in Lodwar East ward.",
      achievements: "9 supervised deliveries with no maternal complications; 64 women received antenatal screening.",
      challenges: "One of the two clinic vehicles broke down on day two, reducing planned outreach hours.",
      lessonsLearned: "A backup vehicle arrangement is needed for future outreach days.",
      nextSteps: "Schedule a follow-up outreach day in month 2 to cover the missed catchment area.",
    },
    {
      activityTitle: "Community health worker immunisation training",
      activityDate: iso(new Date(m1Start.getTime() + 12 * 86400000)),
      location: "Lodwar health centre",
      outputId: output2.id,
      indicatorId: indicators.find((i) => i.code === "IND-4").id,
      participantsTotal: 12,
      participantsMale: 5,
      participantsFemale: 7,
      summary: "12 community health workers completed a 3-day training on routine immunisation tracking and referral.",
      achievements: "All 12 trainees passed the post-training competency assessment and were deployed to their assigned villages.",
      challenges: "Training was delayed by one day due to late arrival of training materials.",
      lessonsLearned: "Materials should be pre-positioned at least one week before future trainings.",
      nextSteps: "Deploy trained CHWs to support the month-2 immunisation outreach.",
    },
  ];
  const activities = [];
  for (const def of activityDefs) {
    const activity = await api("POST", "/v1/activities", { projectId, reportingPeriodId: periodId, ...def });
    activities.push(activity);
    console.log("  activity:", def.activityTitle);
  }

  // 9. Evidence ---------------------------------------------------------------
  log("Uploading evidence");
  const evidenceDefs = [
    { title: "Lodwar East mobile clinic attendance register", evidenceType: "ATTENDANCE_SHEET", activityId: activities[0].id, content: "Date,Name,Service\n2027-01-07,J. Doe,ANC visit\n2027-01-07,A. Lopez,Delivery\n" },
    { title: "CHW immunisation training attendance sheet", evidenceType: "TRAINING_RECORD", activityId: activities[1].id, content: "Name,Role,Village\nJ. Achieng,CHW,Kalobeyei\nP. Ekal,CHW,Nakwamekwi\n" },
    { title: "Month-1 indicator performance tracking table", evidenceType: "MONITORING_REPORT", indicatorId: indicators[0].id, content: "Indicator,Baseline,Target,Actual\nSkilled birth attendances,40,220,38\n" },
  ];
  for (const def of evidenceDefs) {
    const form = new FormData();
    form.set("file", new Blob([def.content], { type: "text/csv" }), `${def.title.replace(/\W+/g, "-").toLowerCase()}.csv`);
    form.set("projectId", projectId);
    form.set("title", def.title);
    form.set("evidenceType", def.evidenceType);
    form.set("reportingPeriodId", periodId);
    if (def.activityId) form.set("activityId", def.activityId);
    if (def.indicatorId) form.set("indicatorId", def.indicatorId);
    const ev = await api("POST", "/v1/evidence/upload", form);
    await api("POST", `/v1/evidence/${ev.id}/verify`, {});
    console.log("  evidence:", def.title, "(verified)");
  }

  // 10. Compliance checklist ---------------------------------------------------
  log("Running compliance checklist");
  const checklist = await api("POST", `/v1/reporting-periods/${periodId}/detect-missing`, {});
  console.log("checklist items created:", checklist.created);

  // 11. Readiness ---------------------------------------------------------------
  const readiness = await api("GET", `/v1/reporting-periods/${periodId}/readiness`);
  console.log("readiness:", JSON.stringify(readiness));

  // 12. Generate the month-1 report ---------------------------------------------
  log("Generating month-1 report draft");
  const generated = await api("POST", `/v1/reporting-periods/${periodId}/generate-draft`, {});
  console.log("draftId:", generated.draftId, "sectionIds:", generated.sectionIds?.length);

  // Section-wise generation runs in the background; poll until every section is out of NOT_STARTED.
  let draft;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    draft = await api("GET", `/v1/reporting-periods/${periodId}/draft`);
    const statuses = (draft.sections ?? []).map((s) => s.status);
    const pending = statuses.filter((s) => s === "NOT_STARTED" || s === "GENERATING").length;
    console.log(`  poll ${i + 1}: ${statuses.join(", ")}`);
    if (pending === 0) break;
  }

  console.log("\n=== DONE ===");
  console.log("Project:", `https://donordesk.online/projects/${projectId}`);
  console.log("Report:", `https://donordesk.online/projects/${projectId}/reports/${periodId}`);
}

main().catch((e) => {
  console.error("\nFAILED:", e.message);
  process.exit(1);
});
