#!/usr/bin/env node
/**
 * Demo script: creates a 12-month EU-funded nutrition project end to end —
 * project, logframe (goal/2 outcomes/3 outputs), 6 indicators matching the
 * EU Nutrition Annual Report template's headline measures and indicator
 * bank, the real EU Nutrition donor template (uploaded as the actual DOCX
 * file, not pasted text), a reporting profile, month-1 reporting period
 * with indicator/activity data, evidence, a risk register entry, a
 * partnership entry, and a compliance checklist pass, then generates the
 * month-1 AI donor report draft.
 *
 * Talks to a running DonorDesk API over plain HTTP with a bearer token —
 * it does not touch the database directly, so it exercises the exact same
 * validation, readiness gates and business logic a real user goes through.
 *
 * Usage:
 *   API_URL=https://donordesk.online TOKEN=<dd_session cookie value> \
 *     node scripts/demo-eu-nutrition.mjs
 */

import { readFile } from "node:fs/promises";

const API_URL = process.env.API_URL ?? "https://donordesk.online";
const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error("Set TOKEN=<dd_session cookie value> (see script header for how to get one).");
  process.exit(1);
}

const TEMPLATE_PATH =
  process.env.TEMPLATE_PATH ??
  "/home/najeeb/Downloads/DonorDesk_EU_Nutrition_Annual_Report_Template.docx";

const START_DATE = process.env.START_DATE ?? "2027-01-01";
const PROJECT_TITLE =
  process.env.PROJECT_TITLE ?? "Nutrition Resilience and Community-Based Nutrition Services";
const PROJECT_CODE = process.env.PROJECT_CODE ?? `EU-NUT-${Date.now().toString(36).toUpperCase()}`;

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
  const projectEnd = addMonths(START_DATE, 12);
  projectEnd.setUTCDate(projectEnd.getUTCDate() - 1); // 12 full months

  // 1. Project ------------------------------------------------------------
  log("Creating project", PROJECT_TITLE);
  const project = await api("POST", "/v1/projects", {
    title: PROJECT_TITLE,
    projectCode: PROJECT_CODE,
    donorName: "European Union (DG INTPA — Nutrition Action)",
    implementingOrganization: "Sahel Community Health Alliance",
    country: "Niger",
    region: "Maradi",
    district: "Guidan Roumdji",
    sector: "NUTRITION",
    startDate: iso(projectStart),
    endDate: iso(projectEnd),
    budgetAmount: 1850000,
    budgetCurrency: "EUR",
    reportingFrequency: "MONTHLY",
    description:
      "A 12-month EU-funded action strengthening community-based management of acute malnutrition, infant and young child feeding (IYCF) counselling, and nutrition service quality in Guidan Roumdji department, Maradi region, targeting children 6-59 months, pregnant and lactating women, and frontline health workers across 18 health facilities and their catchment communities.",
    primaryContactName: "Dr. Aïcha Moussa",
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
    title: "Reduced morbidity and mortality associated with acute malnutrition among children under 5 in Guidan Roumdji department",
    description:
      "Contribute to improved nutritional status and resilience of vulnerable households in Maradi region through strengthened community-based nutrition services.",
  });
  const outcome1 = await api("POST", "/v1/logframe-items", {
    projectId,
    parentId: goal.id,
    level: "OUTCOME",
    code: "O1",
    title: "Increased early identification and treatment of acute malnutrition among children 6-59 months",
  });
  const outcome2 = await api("POST", "/v1/logframe-items", {
    projectId,
    parentId: goal.id,
    level: "OUTCOME",
    code: "O2",
    title: "Improved infant and young child feeding (IYCF) practices among caregivers of children under 2",
  });
  const output1 = await api("POST", "/v1/logframe-items", {
    projectId,
    parentId: outcome1.id,
    level: "OUTPUT",
    code: "OP1",
    title: "Community-based screening, referral and treatment services for wasting delivered at facility and outreach sites",
  });
  const output2 = await api("POST", "/v1/logframe-items", {
    projectId,
    parentId: outcome2.id,
    level: "OUTPUT",
    code: "OP2",
    title: "IYCF counselling delivered to caregivers through mother-support groups and facility contacts",
  });
  const output3 = await api("POST", "/v1/logframe-items", {
    projectId,
    parentId: outcome1.id,
    level: "OUTPUT",
    code: "OP3",
    title: "Frontline health and community workers trained and supervised on national nutrition protocols",
  });

  // 3. Indicators -------------------------------------------------------------
  log("Creating indicators");
  const indicatorDefs = [
    {
      logframeItemId: goal.id,
      code: "IND-REACH",
      name: "Unique people reached with direct nutrition services",
      type: "NUMBER",
      baseline: "0",
      target: "24000",
      unit: "people",
      frequency: "Monthly",
      dataSource: "Beneficiary registration database (deduplicated by national ID / biometric)",
    },
    {
      logframeItemId: output1.id,
      code: "IND-SCREEN",
      name: "Children 6-59 months screened for wasting (MUAC + oedema)",
      type: "NUMBER",
      baseline: "0",
      target: "18000",
      unit: "children",
      frequency: "Monthly",
      dataSource: "Community screening registers",
      disaggregationRequired: true,
    },
    {
      logframeItemId: output1.id,
      code: "IND-TREAT",
      name: "Children with identified wasting referred and admitted for treatment",
      type: "NUMBER",
      baseline: "0",
      target: "2200",
      unit: "children",
      frequency: "Monthly",
      dataSource: "CMAM / OTP-SC admission registers",
      disaggregationRequired: true,
    },
    {
      logframeItemId: output2.id,
      code: "IND-IYCF",
      name: "Caregivers receiving individual or group IYCF counselling",
      type: "NUMBER",
      baseline: "0",
      target: "9000",
      unit: "caregivers",
      frequency: "Monthly",
      dataSource: "Mother-support-group attendance and facility IYCF counselling logs",
    },
    {
      logframeItemId: output3.id,
      code: "IND-TRAIN",
      name: "Health and community workers trained and assessed competent on national nutrition protocol",
      type: "NUMBER",
      baseline: "0",
      target: "160",
      unit: "workers",
      frequency: "Quarterly",
      dataSource: "Training attendance sheets and post-training competency assessment",
    },
    {
      logframeItemId: output1.id,
      code: "IND-QUAL",
      name: "Treatment exits meeting the recovery-rate quality standard (Sphere: >=75% recovered)",
      type: "PERCENTAGE",
      baseline: "0",
      target: "75",
      unit: "%",
      frequency: "Monthly",
      dataSource: "CMAM cohort monitoring (recovered / defaulted / died / non-response exits)",
    },
  ];
  const indicators = [];
  for (const def of indicatorDefs) {
    const created = await api("POST", "/v1/indicators", { projectId, ...def });
    indicators.push({ ...def, id: created.id });
    console.log(`  ${def.code}: ${def.name}`);
  }

  // 4. Donor template — upload and parse the real EU Nutrition DOCX ---------
  log("Parsing EU Nutrition donor report template (real DOCX)");
  const fileBuffer = await readFile(TEMPLATE_PATH);
  const parseForm = new FormData();
  parseForm.set(
    "file",
    new Blob([fileBuffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    "DonorDesk_EU_Nutrition_Annual_Report_Template.docx",
  );
  const parsed = await api("POST", "/v1/templates/parse-file", parseForm);
  console.log(
    "parsed:", parsed.fileName, "format:", parsed.format,
    "headings:", parsed.headingCount, "tables:", parsed.tableCount,
  );

  log("Creating donor report template from parsed DOCX");
  let template = await api("POST", "/v1/templates", {
    projectId,
    templateName: "EU Nutrition Annual Project Report",
    donorName: "European Union (DG INTPA)",
    reportType: "ANNUAL",
    language: "en",
    requiredAnnexes: [
      "Annex A. Evidence checklist",
      "Annex B. Indicator reference sheets",
      "Annex C. AI-assisted drafting and human review log",
    ],
    sections: [],
    extractedRawText: parsed.text,
    originalFileKey: parsed.fileKey,
  });
  console.log("templateId:", template.id, "status:", template.status);

  // Extraction runs in the background; poll until it's out of EXTRACTING.
  for (let i = 0; i < 30 && template.status === "EXTRACTING"; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    template = await api("GET", `/v1/templates/${template.id}`);
  }
  console.log(
    "extraction status:", template.status,
    "sections:", template.sections.length,
    "method:", template.extractionMeta?.method,
  );

  // Review every extracted section (accept as-is), excluding pure guidance
  // sections that the extractor already flagged as includeInReport=false.
  const reviewedSections = template.sections.map((s) => ({ ...s, reviewStatus: "REVIEWED" }));
  const saved = await api("PUT", `/v1/templates/${template.id}/sections`, {
    sections: reviewedSections,
    expectedVersion: template.version,
  });
  const approved = await api("POST", `/v1/templates/${template.id}/review`, {});
  console.log("template approved:", approved.status, "version:", saved.version);

  // 5. Reporting profile --------------------------------------------------
  log("Setting reporting profile");
  await api("PUT", `/v1/projects/${projectId}/reporting-profile`, {
    defaultTemplateId: template.id,
    language: "en",
    tone: "FORMAL",
    formattingRules: [],
    specialRequirements: [
      "Use the exact EU funding acknowledgement statement and EU emblem on all outputs.",
      "Disaggregate all beneficiary figures by sex and age where safe and lawful.",
      "Report safeguarding incidents within 48 hours through the authorised confidential channel; never name survivors or complainants in the report.",
    ],
    sectionOverrides: {},
  });

  // 6. Reporting period for month 1 ----------------------------------------
  log("Creating month-1 reporting period");
  const m1Start = projectStart;
  const m1End = addMonths(m1Start, 1);
  m1End.setUTCDate(m1End.getUTCDate() - 1);
  const deadline = addMonths(m1End, 0);
  deadline.setUTCDate(deadline.getUTCDate() + 15);
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
    { code: "IND-REACH", period: "1840", cumulative: "1840", comments: "First month of implementation; reach driven by facility-based screening and outreach launch in 6 of 18 target facilities." },
    { code: "IND-SCREEN", period: "1510", cumulative: "1510", comments: "Community screening rolled out in 12 villages; MUAC tapes and scales distributed to all community volunteers before month start." },
    { code: "IND-TREAT", period: "168", cumulative: "168", comments: "Includes 121 MAM and 47 SAM admissions; all referred within 48 hours of screening per protocol." },
    { code: "IND-IYCF", period: "612", cumulative: "612", comments: "8 mother-support groups established this month; uptake slightly below plan due to competing agricultural labour demands." },
    { code: "IND-TRAIN", period: "38", cumulative: "38", comments: "First cohort of community health workers and 6 facility nurses completed the 5-day CMAM/IYCF refresher; all 38 passed the post-training competency assessment." },
    { code: "IND-QUAL", period: "78", cumulative: "78", comments: "Based on 41 exits this month (32 recovered, 6 defaulted, 2 non-response, 1 transferred); recovery rate above the 75% Sphere threshold." },
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
      activityTitle: "Community-based MUAC screening — 12 villages, Guidan Roumdji catchment",
      activityDate: iso(new Date(m1Start.getTime() + 5 * 86400000)),
      location: "12 villages, Guidan Roumdji department",
      outputId: output1.id,
      indicatorId: indicators.find((i) => i.code === "IND-SCREEN").id,
      participantsTotal: 1510,
      participantsFemale: 780,
      participantsMale: 730,
      summary: "36 trained community volunteers conducted door-to-door and site-based MUAC and oedema screening of children 6-59 months across 12 villages over 5 days, using the national CMAM screening protocol.",
      achievements: "1,510 children screened; 168 identified with acute malnutrition and referred same-day to the nearest OTP/SC site.",
      challenges: "Two villages were temporarily inaccessible mid-week due to seasonal flooding of the access track, delaying screening in those sites by two days.",
      lessonsLearned: "Pre-positioning volunteers overnight in flood-prone villages during the rainy season avoids access delays.",
      nextSteps: "Extend screening to the remaining 6 target villages in month 2 and follow up on the two delayed villages.",
    },
    {
      activityTitle: "OTP/SC admission and treatment — 6 health facilities",
      activityDate: iso(new Date(m1Start.getTime() + 9 * 86400000)),
      location: "6 health facilities, Guidan Roumdji department",
      outputId: output1.id,
      indicatorId: indicators.find((i) => i.code === "IND-TREAT").id,
      participantsTotal: 168,
      participantsFemale: 89,
      participantsMale: 79,
      summary: "Facility nurses admitted and initiated treatment for 168 children referred from community screening (121 MAM to supplementary feeding, 47 SAM to outpatient therapeutic care), following national CMAM protocol including appetite test and routine medicine.",
      achievements: "100% of referred children admitted within 48 hours; no stock-outs of RUTF or RUSF recorded during the month.",
      challenges: "One facility reported a one-day delay in appetite testing due to a single nurse covering two service points.",
      lessonsLearned: "A trained lay counsellor can support triage during nurse absence to avoid single points of failure.",
      nextSteps: "Deploy a second trained lay counsellor to the affected facility in month 2.",
    },
    {
      activityTitle: "Mother-support group sessions and IYCF counselling",
      activityDate: iso(new Date(m1Start.getTime() + 14 * 86400000)),
      location: "8 mother-support-group sites, Guidan Roumdji department",
      outputId: output2.id,
      indicatorId: indicators.find((i) => i.code === "IND-IYCF").id,
      participantsTotal: 612,
      participantsFemale: 612,
      summary: "8 mother-support groups held their first monthly session, delivering age-appropriate IYCF counselling on early initiation of breastfeeding, exclusive breastfeeding to 6 months, and safe complementary feeding, led by trained lead mothers with facility nurse supervision.",
      achievements: "612 caregivers attended; 54 first-time pregnant women enrolled for prenatal IYCF counselling.",
      challenges: "Attendance was below the planned 750 due to conflicting harvest-season labour obligations for caregivers.",
      lessonsLearned: "Scheduling sessions in the early morning before field work improved attendance at 3 of 8 sites; will standardise timing.",
      nextSteps: "Shift all group sessions to early-morning slots from month 2 and track attendance impact.",
    },
    {
      activityTitle: "CMAM and IYCF refresher training for community and facility health workers",
      activityDate: iso(new Date(m1Start.getTime() + 20 * 86400000)),
      location: "Guidan Roumdji district health centre (training hall)",
      outputId: output3.id,
      indicatorId: indicators.find((i) => i.code === "IND-TRAIN").id,
      participantsTotal: 38,
      participantsFemale: 24,
      participantsMale: 14,
      summary: "38 community health workers and facility nurses completed a 5-day refresher on the national CMAM protocol, MUAC technique standardisation, appetite testing, IYCF counselling skills and referral pathways, delivered jointly with the district health authority.",
      achievements: "All 38 participants passed the post-training MUAC-technique standardisation test and competency assessment.",
      challenges: "Training materials arrived one day late from the regional store, compressing the first day's agenda.",
      lessonsLearned: "Order training materials at least three weeks ahead of the session for the remote regional supply chain.",
      nextSteps: "Conduct first supportive-supervision visit to trained workers within 4 weeks of training.",
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
    {
      title: "Community screening registers — 12 villages, month 1",
      evidenceType: "MONITORING_REPORT",
      activityId: activities[0].id,
      indicatorId: indicators.find((i) => i.code === "IND-SCREEN").id,
      content: "Village,Date,ChildrenScreened,MUAC_Red,MUAC_Yellow,Oedema\nTounfafi,2027-01-06,142,9,21,0\nGuidan Roumdji Centre,2027-01-06,201,14,28,1\nAngoal Bousso,2027-01-07,118,7,17,0\n",
    },
    {
      title: "OTP/SC admission register — 6 facilities, month 1",
      evidenceType: "MONITORING_REPORT",
      activityId: activities[1].id,
      indicatorId: indicators.find((i) => i.code === "IND-TREAT").id,
      content: "Facility,Date,SAM_Admitted,MAM_Admitted,ReferralSource\nGuidan Roumdji CSI,2027-01-10,9,22,Community screening\nTounfafi CSI,2027-01-11,6,18,Community screening\n",
    },
    {
      title: "Mother-support group attendance sheet — 8 sites, month 1",
      evidenceType: "ATTENDANCE_SHEET",
      activityId: activities[2].id,
      indicatorId: indicators.find((i) => i.code === "IND-IYCF").id,
      content: "Site,Date,CaregiversAttended,FirstTimePregnant\nSite 1 - Tounfafi,2027-01-15,88,7\nSite 2 - Angoal Bousso,2027-01-15,74,6\n",
    },
    {
      title: "CMAM/IYCF refresher training attendance and competency assessment results",
      evidenceType: "TRAINING_RECORD",
      activityId: activities[3].id,
      indicatorId: indicators.find((i) => i.code === "IND-TRAIN").id,
      content: "Name,Role,Facility,CompetencyResult\nH. Abdou,CHW,Tounfafi,PASS\nR. Illa,Nurse,Guidan Roumdji CSI,PASS\nM. Sani,CHW,Angoal Bousso,PASS\n",
    },
    {
      title: "CMAM cohort monitoring — treatment exits, month 1",
      evidenceType: "MONITORING_REPORT",
      indicatorId: indicators.find((i) => i.code === "IND-QUAL").id,
      content: "Facility,Exits,Recovered,Defaulted,NonResponse,Transferred\nGuidan Roumdji CSI,22,18,3,1,0\nTounfafi CSI,19,14,3,1,1\n",
    },
    {
      title: "RUTF/RUSF stock and cold-chain-independent commodity log, month 1",
      evidenceType: "MONITORING_REPORT",
      content: "Facility,Item,OpeningStock,Received,Consumed,ClosingStock,StockOutDays\nGuidan Roumdji CSI,RUTF (carton),40,60,52,48,0\nTounfafi CSI,RUTF (carton),28,40,35,33,0\n",
    },
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

  // 11. Readiness ---------------------------------------------------------------
  const readiness = await api("GET", `/v1/reporting-periods/${periodId}/readiness`);
  console.log("readiness:", JSON.stringify(readiness));

  // 12. Generate the month-1 report ---------------------------------------------
  log("Generating month-1 EU Nutrition Annual Report draft");
  const generated = await api("POST", `/v1/reporting-periods/${periodId}/generate-draft`, {});
  console.log("draftId:", generated.draftId, "sectionIds:", generated.sectionIds?.length);

  // Section-wise generation runs in the background; poll until every section is out of NOT_STARTED.
  let draft;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    draft = await api("GET", `/v1/reporting-periods/${periodId}/draft`);
    const statuses = (draft.sections ?? []).map((s) => s.status);
    const pending = statuses.filter((s) => s === "NOT_STARTED" || s === "GENERATING").length;
    console.log(`  poll ${i + 1}: ${pending} pending of ${statuses.length}`);
    if (pending === 0) break;
  }

  console.log("\n=== DONE ===");
  console.log("projectId:", projectId);
  console.log("templateId:", template.id);
  console.log("periodId:", periodId);
  console.log("Project:", `https://donordesk.online/projects/${projectId}`);
  console.log("Report:", `https://donordesk.online/projects/${projectId}/reports/${periodId}`);
}

main().catch((e) => {
  console.error("\nFAILED:", e.message);
  process.exit(1);
});
