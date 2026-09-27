#!/usr/bin/env node
/**
 * Demo script: creates a WASH project end to end from a real donor PDF
 * template — project, a large logframe (5 goals / 8 outcomes / 8 outputs,
 * one indicator per output), a donor report template uploaded from the PDF
 * file and extracted/reviewed/approved through the real pipeline, a
 * reporting profile, and a quarter-1 reporting period with indicator
 * updates, activities and evidence — then generates and polls the quarter-1
 * AI report.
 *
 * Talks to a running DonorDesk API over plain HTTP with a bearer token —
 * it does not touch the database directly, so it exercises the exact same
 * validation, readiness gates and business logic a real user goes through.
 *
 * Usage:
 *   API_URL=http://127.0.0.1:4001 TOKEN=<bearer token> \
 *     TEMPLATE_FILE="/path/to/donor-template.pdf" \
 *     node scripts/demo-wash-pdf-template.mjs
 *
 * Get a token by logging in through the web app and reading the `dd_session`
 * cookie (its value is the bearer token DonorDesk's API accepts directly).
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const API_URL = process.env.API_URL ?? "http://127.0.0.1:4001";
const TOKEN = process.env.TOKEN;
const TEMPLATE_FILE = process.env.TEMPLATE_FILE;
if (!TOKEN) {
  console.error("Set TOKEN=<dd_session cookie value> (see script header for how to get one).");
  process.exit(1);
}
if (!TEMPLATE_FILE) {
  console.error("Set TEMPLATE_FILE=/path/to/donor-template.pdf");
  process.exit(1);
}

const START_DATE = process.env.START_DATE ?? "2027-01-01";
const PROJECT_TITLE = process.env.PROJECT_TITLE ?? "Integrated WASH Access & Resilience Programme";
const PROJECT_CODE = process.env.PROJECT_CODE ?? `WASH-${Date.now().toString(36).toUpperCase()}`;

function addMonths(iso, months) {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}
function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
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

// --------------------------------------------------------------------------- #
// WASH logframe content: 5 goals, 8 outcomes (spread across the goals),
// 8 outputs (one per outcome), one indicator per output.
// --------------------------------------------------------------------------- #
const GOALS = [
  { code: "G1", title: "Increased access to safe drinking water for crisis-affected populations" },
  { code: "G2", title: "Improved access to safe sanitation facilities" },
  { code: "G3", title: "Strengthened hygiene practices at household and community level" },
  { code: "G4", title: "Improved WASH infrastructure resilience in health and education facilities" },
  { code: "G5", title: "Strengthened community-level WASH governance and sustainability" },
];

// Each outcome names the goal (by index, 0-based) it sits under.
const OUTCOMES = [
  { code: "O1", goal: 0, title: "Households have reliable access to a safe water source within 500m" },
  { code: "O2", goal: 0, title: "Water trucking gaps in displacement sites are closed" },
  { code: "O3", goal: 1, title: "Households use improved, gender-appropriate sanitation facilities" },
  { code: "O4", goal: 1, title: "Open defecation is eliminated in targeted communities" },
  { code: "O5", goal: 2, title: "Households adopt key hygiene practices, including handwashing with soap" },
  { code: "O6", goal: 3, title: "Health and education facilities have functional WASH infrastructure" },
  { code: "O7", goal: 4, title: "Community WASH committees manage and maintain infrastructure sustainably" },
  { code: "O8", goal: 4, title: "Local authorities have the capacity to monitor WASH service delivery" },
];

// Each output names the outcome (by index) it sits under, plus its indicator.
const OUTPUTS = [
  {
    code: "OP1", outcome: 0, title: "Water points rehabilitated or newly constructed",
    indicator: { code: "IND-1", name: "Number of water points rehabilitated or newly constructed", type: "NUMBER", baseline: "12", target: "40", unit: "water points", frequency: "Quarterly", dataSource: "Engineering completion certificates" },
  },
  {
    code: "OP2", outcome: 1, title: "Water trucking delivered to displacement sites",
    indicator: { code: "IND-2", name: "Litres of safe water trucked per week to displacement sites", type: "NUMBER", baseline: "80000", target: "250000", unit: "litres/week", frequency: "Monthly", dataSource: "Water trucking delivery logs" },
  },
  {
    code: "OP3", outcome: 2, title: "Household latrines constructed",
    indicator: { code: "IND-3", name: "Number of household latrines constructed", type: "NUMBER", baseline: "30", target: "300", unit: "latrines", frequency: "Quarterly", dataSource: "Latrine construction verification forms", disaggregationRequired: true },
  },
  {
    code: "OP4", outcome: 3, title: "Communities certified open-defecation-free",
    indicator: { code: "IND-4", name: "Number of communities certified open-defecation-free (ODF)", type: "NUMBER", baseline: "0", target: "15", unit: "communities", frequency: "Quarterly", dataSource: "ODF certification reports" },
  },
  {
    code: "OP5", outcome: 4, title: "Households reached with hygiene promotion sessions",
    indicator: { code: "IND-5", name: "Number of households reached with hygiene promotion sessions", type: "NUMBER", baseline: "200", target: "1800", unit: "households", frequency: "Monthly", dataSource: "Hygiene promotion attendance registers", disaggregationRequired: true },
  },
  {
    code: "OP6", outcome: 5, title: "Health/education facilities with functional WASH infrastructure",
    indicator: { code: "IND-6", name: "Number of health and education facilities with functional WASH infrastructure", type: "NUMBER", baseline: "3", target: "20", unit: "facilities", frequency: "Quarterly", dataSource: "Facility WASH assessment checklists" },
  },
  {
    code: "OP7", outcome: 6, title: "Community WASH committees trained and functional",
    indicator: { code: "IND-7", name: "Number of community WASH committees trained and functional", type: "NUMBER", baseline: "2", target: "18", unit: "committees", frequency: "Quarterly", dataSource: "Committee training and monitoring records" },
  },
  {
    code: "OP8", outcome: 7, title: "Local authority staff trained on WASH service monitoring",
    indicator: { code: "IND-8", name: "Number of local authority staff trained on WASH service monitoring", type: "NUMBER", baseline: "0", target: "25", unit: "staff", frequency: "Quarterly", dataSource: "Training attendance sheets" },
  },
];

async function main() {
  const projectStart = new Date(START_DATE);
  const projectEnd = addMonths(START_DATE, 12);
  projectEnd.setUTCDate(projectEnd.getUTCDate() - 1); // 12 full months

  // 1. Project ------------------------------------------------------------
  log("Creating project", PROJECT_TITLE);
  const project = await api("POST", "/v1/projects", {
    title: PROJECT_TITLE,
    projectCode: PROJECT_CODE,
    donorName: "USAID Bureau for Humanitarian Assistance",
    implementingOrganization: "Acme Humanitarian NGO",
    partnerOrganization: "Local WASH Consortium",
    country: "South Sudan",
    region: "Unity State",
    district: "Bentiu",
    sector: "WASH",
    startDate: iso(projectStart),
    endDate: iso(projectEnd),
    budgetAmount: 3800000,
    budgetCurrency: "USD",
    reportingFrequency: "QUARTERLY",
    description: "An integrated WASH response improving access to safe water, sanitation and hygiene for crisis-affected and host communities in Unity State, including water infrastructure rehabilitation, sanitation promotion, hygiene behaviour change, WASH-in-institutions upgrades, and community-level governance and sustainability.",
    primaryContactName: "Grace Nyandeng",
  });
  const projectId = project.id;
  console.log("projectId:", projectId);
  await api("PUT", `/v1/projects/${projectId}`, { status: "ACTIVE" });

  // 2. Logframe: 5 goals, 8 outcomes, 8 outputs ----------------------------
  log("Creating logframe", "5 goals / 8 outcomes / 8 outputs");
  const goalItems = [];
  for (const g of GOALS) {
    const item = await api("POST", "/v1/logframe-items", { projectId, level: "GOAL", code: g.code, title: g.title });
    goalItems.push(item);
    console.log(`  GOAL ${g.code}: ${g.title}`);
  }
  const outcomeItems = [];
  for (const o of OUTCOMES) {
    const item = await api("POST", "/v1/logframe-items", { projectId, parentId: goalItems[o.goal].id, level: "OUTCOME", code: o.code, title: o.title });
    outcomeItems.push(item);
    console.log(`  OUTCOME ${o.code} (under ${GOALS[o.goal].code}): ${o.title}`);
  }
  const outputItems = [];
  for (const o of OUTPUTS) {
    const item = await api("POST", "/v1/logframe-items", { projectId, parentId: outcomeItems[o.outcome].id, level: "OUTPUT", code: o.code, title: o.title });
    outputItems.push(item);
    console.log(`  OUTPUT ${o.code} (under ${OUTCOMES[o.outcome].code}): ${o.title}`);
  }

  // 3. Indicators (one per output) ------------------------------------------
  log("Creating indicators");
  const indicators = [];
  for (let i = 0; i < OUTPUTS.length; i++) {
    const def = OUTPUTS[i].indicator;
    const created = await api("POST", "/v1/indicators", { projectId, logframeItemId: outputItems[i].id, ...def });
    indicators.push({ ...def, id: created.id, outputIndex: i });
    console.log(`  ${def.code}: ${def.name}`);
  }

  // 4. Donor template — uploaded from the real PDF file ----------------------
  log("Uploading donor template file", TEMPLATE_FILE);
  const fileBuffer = await readFile(TEMPLATE_FILE);
  const fileName = basename(TEMPLATE_FILE);
  const form = new FormData();
  form.set("file", new Blob([fileBuffer], { type: "application/pdf" }), fileName);
  const parsed = await api("POST", "/v1/templates/parse-file", form);
  console.log("parsed:", parsed.format, "headings:", parsed.headingCount, "tables:", parsed.tableCount, "pages:", parsed.pageCount, "text length:", parsed.text.length);

  let template = await api("POST", "/v1/templates", {
    projectId,
    templateName: "BE NOFO Quarterly Performance Report",
    donorName: "USAID Bureau for Humanitarian Assistance",
    reportType: "QUARTERLY",
    language: "en",
    requiredAnnexes: [],
    sections: [],
    extractedRawText: parsed.text,
    originalFileKey: parsed.fileKey,
  });
  console.log("templateId:", template.id, "status:", template.status);

  // Extraction runs in the background; poll until it's out of EXTRACTING.
  for (let i = 0; i < 20 && template.status === "EXTRACTING"; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    template = await api("GET", `/v1/templates/${template.id}`);
  }
  console.log("extraction status:", template.status, "sections:", template.sections.length, "method:", template.extractionMeta?.method, "warnings:", template.extractionMeta?.warnings);
  const reportable = template.sections.filter((s) => s.includeInReport);
  const guidance = template.sections.filter((s) => !s.includeInReport);
  console.log(`  ${reportable.length} report section(s), ${guidance.length} guidance section(s) excluded`);

  // Accept every section, then approve the template.
  const reviewedSections = template.sections.map((s) => ({ ...s, reviewStatus: "REVIEWED" }));
  const saved = await api("PUT", `/v1/templates/${template.id}/sections`, { sections: reviewedSections, expectedVersion: template.version });
  const approved = await api("POST", `/v1/templates/${template.id}/review`, {});
  console.log("template approved:", approved.status, "version:", saved.version);

  // 5. Reporting profile ----------------------------------------------------
  log("Setting reporting profile");
  await api("PUT", `/v1/projects/${projectId}/reporting-profile`, {
    defaultTemplateId: template.id,
    language: "en",
    tone: "FORMAL",
    formattingRules: [],
    specialRequirements: [],
    sectionOverrides: {},
  });

  // 6. Reporting period for quarter 1 --------------------------------------
  log("Creating quarter-1 reporting period");
  const q1Start = projectStart;
  const q1End = addMonths(q1Start, 3);
  q1End.setUTCDate(q1End.getUTCDate() - 1);
  const deadline = addDays(q1End, 21);
  const period = await api("POST", "/v1/reporting-periods", {
    projectId,
    donorTemplateId: template.id,
    reportType: "QUARTERLY",
    startDate: iso(q1Start),
    endDate: iso(q1End),
    deadline: iso(deadline),
  });
  const periodId = period.id;
  console.log("periodId:", periodId);

  // 7. Quarter-1 indicator data ---------------------------------------------
  log("Recording quarter-1 indicator updates");
  const quarterData = [
    { code: "IND-1", period: "9", cumulative: "9", comments: "Rehabilitation of two boreholes completed; construction of three new water points ongoing in Bentiu East." },
    { code: "IND-2", period: "165000", cumulative: "165000", comments: "Water trucking maintained daily deliveries to the two largest displacement sites; a third site was added mid-quarter." },
    { code: "IND-3", period: "58", cumulative: "58", comments: "Latrine construction accelerated after the rainy season delay in month one." },
    { code: "IND-4", period: "2", cumulative: "2", comments: "Two communities reached ODF certification following community-led total sanitation triggering." },
    { code: "IND-5", period: "410", cumulative: "410", comments: "Hygiene promotion sessions reached households across six target communities." },
    { code: "IND-6", period: "5", cumulative: "5", comments: "WASH infrastructure upgrades completed at three health posts and two primary schools." },
    { code: "IND-7", period: "6", cumulative: "6", comments: "Six community WASH committees completed training and are conducting routine maintenance." },
    { code: "IND-8", period: "8", cumulative: "8", comments: "Local water authority staff completed the first monitoring training cohort." },
  ];
  for (const row of quarterData) {
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

  // 8. Quarter-1 activities ---------------------------------------------------
  log("Recording quarter-1 activities");
  const activityDefs = [
    {
      activityTitle: "Borehole rehabilitation — Bentiu East",
      activityDate: iso(addDays(q1Start, 20)),
      location: "Bentiu East",
      outputId: outputItems[0].id,
      indicatorId: indicators[0].id,
      participantsTotal: 1200,
      participantsMale: 550,
      participantsFemale: 650,
      summary: "Rehabilitated two non-functional boreholes serving an estimated 1,200 people in Bentiu East, restoring year-round access to safe water.",
      achievements: "Both boreholes now yield above the WHO minimum standard of 15 litres/person/day; community water committees were re-activated to manage the sites.",
      challenges: "Spare parts for one borehole pump were delayed at the border for two weeks.",
      lessonsLearned: "Pre-positioning a stock of common spare parts would avoid similar delays in future quarters.",
      nextSteps: "Begin construction of the three additional water points planned for quarter 2.",
    },
    {
      activityTitle: "Community-led total sanitation (CLTS) triggering",
      activityDate: iso(addDays(q1Start, 45)),
      location: "Rubkona and Guit communities",
      outputId: outputItems[2].id,
      indicatorId: indicators[2].id,
      participantsTotal: 340,
      participantsMale: 150,
      participantsFemale: 190,
      summary: "Conducted CLTS triggering sessions in two communities, resulting in household commitments to construct and use latrines.",
      achievements: "58 household latrines constructed following the triggering sessions; two communities are on track for ODF certification.",
      challenges: "Heavy rains in month one delayed latrine construction in low-lying areas.",
      lessonsLearned: "Scheduling triggering sessions before the rainy season would allow construction to start earlier.",
      nextSteps: "Support remaining households to complete latrine construction and conduct ODF verification visits.",
    },
    {
      activityTitle: "WASH-in-schools infrastructure handover",
      activityDate: iso(addDays(q1Start, 70)),
      location: "Bentiu and Rubkona primary schools",
      outputId: outputItems[5].id,
      indicatorId: indicators[5].id,
      participantsTotal: 2100,
      participantsChildren: 1900,
      summary: "Completed and handed over rehabilitated WASH facilities (latrine blocks and handwashing stations) at two primary schools and one health post.",
      achievements: "Three facilities now have functional, gender-segregated latrines and handwashing stations serving over 1,900 schoolchildren.",
      challenges: "Handover to the county education office was delayed by one week pending a joint inspection.",
      lessonsLearned: "Scheduling the joint inspection earlier in the construction timeline would prevent handover delays.",
      nextSteps: "Complete the remaining two facility upgrades planned for quarter 2 and begin hygiene club activities at the handed-over schools.",
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
    { title: "Borehole rehabilitation completion certificate — Bentiu East", evidenceType: "APPROVAL_DOCUMENT", activityId: activities[0].id, content: "Borehole ID,Yield (L/min),Status\nBH-014,42,Rehabilitated\nBH-021,38,Rehabilitated\n" },
    { title: "CLTS triggering attendance register — Rubkona and Guit", evidenceType: "ATTENDANCE_SHEET", activityId: activities[1].id, content: "Community,Households represented,Date\nRubkona,112,2027-02-15\nGuit,98,2027-02-16\n" },
    { title: "WASH-in-schools joint inspection report", evidenceType: "MONITORING_REPORT", activityId: activities[2].id, content: "Facility,Latrines,Handwashing stations,Status\nBentiu Primary,6,2,Functional\nRubkona Primary,6,2,Functional\n" },
    { title: "Quarter-1 indicator performance tracking table", evidenceType: "MONITORING_REPORT", indicatorId: indicators[0].id, content: "Indicator,Baseline,Target,Actual\nWater points rehabilitated/constructed,12,40,9\n" },
  ];
  for (const def of evidenceDefs) {
    const evForm = new FormData();
    evForm.set("file", new Blob([def.content], { type: "text/csv" }), `${def.title.replace(/\W+/g, "-").toLowerCase()}.csv`);
    evForm.set("projectId", projectId);
    evForm.set("title", def.title);
    evForm.set("evidenceType", def.evidenceType);
    evForm.set("reportingPeriodId", periodId);
    if (def.activityId) evForm.set("activityId", def.activityId);
    if (def.indicatorId) evForm.set("indicatorId", def.indicatorId);
    const ev = await api("POST", "/v1/evidence/upload", evForm);
    await api("POST", `/v1/evidence/${ev.id}/verify`, {});
    console.log("  evidence:", def.title, "(verified)");
  }

  // 10. Compliance checklist ---------------------------------------------------
  log("Running compliance checklist");
  const checklist = await api("POST", `/v1/reporting-periods/${periodId}/detect-missing`, {});
  console.log("checklist items created:", checklist.created);

  const readiness = await api("GET", `/v1/reporting-periods/${periodId}/readiness`);
  console.log("readiness:", JSON.stringify(readiness));

  // 11. Generate the quarter-1 report ---------------------------------------------
  log("Generating quarter-1 report draft");
  const generated = await api("POST", `/v1/reporting-periods/${periodId}/generate-draft`, {});
  console.log("draftId:", generated.draftId, "sectionIds:", generated.sectionIds?.length);

  let draft;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    draft = await api("GET", `/v1/reporting-periods/${periodId}/draft`);
    const statuses = (draft.sections ?? []).map((s) => s.status);
    const pending = statuses.filter((s) => s === "NOT_STARTED" || s === "GENERATING").length;
    console.log(`  poll ${i + 1}: ${statuses.join(", ")}`);
    if (pending === 0) break;
  }

  console.log("\n=== DONE ===");
  console.log("Project:", `https://donordesk.online/projects/${projectId}`);
  console.log("Templates:", `https://donordesk.online/projects/${projectId}/templates/${template.id}`);
  console.log("Report:", `https://donordesk.online/projects/${projectId}/reports/${periodId}`);
}

main().catch((e) => {
  console.error("\nFAILED:", e.message);
  process.exit(1);
});
