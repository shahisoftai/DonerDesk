import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const DATABASE_URL = process.env.DATABASE_ADMIN_URL ?? "postgresql://donordesk_migrator:KpPBXNNhtTF41JfjV5lMZlCd@127.0.0.1:5432/donordesk";

console.log("Seeding Emergency Education Response Programme for tenant mnpiracha@gmail.com...");

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

const TENANT_ID = "faed0177-5f2d-4a42-864f-e4c254e6d247";

async function main() {
  await prisma.$executeRaw`SELECT set_config('app.current_tenant', ${TENANT_ID}, false)`;

  const org = await prisma.organization.findUnique({ where: { tenantId: TENANT_ID } });
  if (!org) {
    console.log("Organization not found. Please ensure tenant mnpiracha@gmail.com exists first.");
    console.log("You may need to create the organization through the DonorDesk signup process.");
    process.exit(1);
  }
  console.log(`Organization found: ${org.name}`);

  const existingProject = await prisma.project.findFirst({
    where: { tenantId: TENANT_ID, projectCode: "EERP-2026" },
  });

  if (existingProject) {
    console.log("Project EERP-2026 already exists, skipping creation.");
    return;
  }

  const projectId = randomUUID();

  await prisma.project.create({
    data: {
      id: projectId,
      tenantId: TENANT_ID,
      title: "Emergency Education Response Programme",
      projectCode: "EERP-2026",
      donorName: "USAID",
      implementingOrganization: "Humanity Aid Network",
      partnerOrganization: "Cox's Bazar Education Department",
      country: "Bangladesh",
      region: "Chittagong",
      district: "Cox's Bazar",
      sector: "EDUCATION",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      budgetAmount: 4500000,
      budgetCurrency: "USD",
      reportingFrequency: "QUARTERLY",
      description: "Improving access to quality education for 15,000 crisis-affected children (6-14 years) in Cox's Bazar host communities through establishment of learning centres, teacher training, and provision of learning materials.",
      primaryContactName: "Fatima Ahmed",
      status: "ACTIVE",
    },
  });
  console.log("Created project: Emergency Education Response Programme (EERP-2026)");

  const goalItem = await prisma.logframeItem.create({
    data: {
      id: randomUUID(),
      tenantId: TENANT_ID,
      projectId: projectId,
      level: "GOAL",
      code: "G1",
      title: "Improved access to quality education for 15,000 crisis-affected children (6-14 years) in Cox's Bazar host communities by December 2026",
      description: "The programme aims to provide access to quality formal and non-formal education for crisis-affected children, focusing on literacy, numeracy, and psychosocial support.",
    },
  });

  const outcome1 = await prisma.logframeItem.create({
    data: {
      id: randomUUID(),
      tenantId: TENANT_ID,
      projectId: projectId,
      parentId: goalItem.id,
      level: "OUTCOME",
      code: "O1",
      title: "8,000 children enrolled and attending formal/non-formal education centres",
      description: "Children access and regularly attend age-appropriate education programmes.",
    },
  });

  const outcome2 = await prisma.logframeItem.create({
    data: {
      id: randomUUID(),
      tenantId: TENANT_ID,
      projectId: projectId,
      parentId: goalItem.id,
      level: "OUTCOME",
      code: "O2",
      title: "Improved learning outcomes in literacy and numeracy for 10,000 students",
      description: "Students demonstrate measurable improvements in basic literacy and numeracy skills through structured assessments.",
    },
  });

  const outcome3 = await prisma.logframeItem.create({
    data: {
      id: randomUUID(),
      tenantId: TENANT_ID,
      projectId: projectId,
      parentId: goalItem.id,
      level: "OUTCOME",
      code: "O3",
      title: "Enhanced protective learning environment for 12,000 children",
      description: "Learning centres implement child safeguarding protocols and community monitoring ensures safe learning spaces.",
    },
  });

  console.log("Created Goal and 3 Outcomes");

  const output1_1 = await prisma.logframeItem.create({
    data: {
      id: randomUUID(),
      tenantId: TENANT_ID,
      projectId: projectId,
      parentId: outcome1.id,
      level: "OUTPUT",
      code: "OC1.1",
      title: "120 Learning Centres established and operational",
      description: "Community-based learning centres providing access to education for out-of-school children.",
    },
  });

  const output1_2 = await prisma.logframeItem.create({
    data: {
      id: randomUUID(),
      tenantId: TENANT_ID,
      projectId: projectId,
      parentId: outcome1.id,
      level: "OUTPUT",
      code: "OC1.2",
      title: "240 teachers trained in accelerated learning methodologies",
      description: "Teachers equipped with skills to deliver accelerated learning programmes for crisis-affected children.",
    },
  });

  const output2_1 = await prisma.logframeItem.create({
    data: {
      id: randomUUID(),
      tenantId: TENANT_ID,
      projectId: projectId,
      parentId: outcome2.id,
      level: "OUTPUT",
      code: "OC2.1",
      title: "85% of assessed students demonstrate improved literacy skills",
      description: "Students show measurable improvement in reading and writing abilities.",
    },
  });

  const output2_2 = await prisma.logframeItem.create({
    data: {
      id: randomUUID(),
      tenantId: TENANT_ID,
      projectId: projectId,
      parentId: outcome2.id,
      level: "OUTPUT",
      code: "OC2.2",
      title: "75% of assessed students demonstrate improved numeracy skills",
      description: "Students show measurable improvement in basic numeracy and mathematical reasoning.",
    },
  });

  const output3_1 = await prisma.logframeItem.create({
    data: {
      id: randomUUID(),
      tenantId: TENANT_ID,
      projectId: projectId,
      parentId: outcome3.id,
      level: "OUTPUT",
      code: "OC3.1",
      title: "120 Learning Centres implementing child safeguarding protocols",
      description: "All learning centres have functioning child safeguarding committees and referral pathways.",
    },
  });

  const output3_2 = await prisma.logframeItem.create({
    data: {
      id: randomUUID(),
      tenantId: TENANT_ID,
      projectId: projectId,
      parentId: outcome3.id,
      level: "OUTPUT",
      code: "OC3.2",
      title: "200 community volunteers engaged in school safety monitoring",
      description: "Community members trained and active in monitoring learning centre safety.",
    },
  });

  console.log("Created 6 Outputs");

  const activities = [
    { code: "A1.1.1", title: "Establish 120 learning centres in host communities", outputId: output1_1.id },
    { code: "A1.1.2", title: "Procure and distribute learning materials (15,000 kits)", outputId: output1_1.id },
    { code: "A1.1.3", title: "Recruit and deploy 240 teachers/facilitators", outputId: output1_1.id },
    { code: "A1.2.1", title: "Conduct 5-day teacher training on accelerated learning methodologies", outputId: output1_2.id },
    { code: "A1.2.2", title: "Provide ongoing coaching and mentoring support to teachers", outputId: output1_2.id },
    { code: "A2.1.1", title: "Conduct baseline learning assessments for all enrolled children", outputId: output2_1.id },
    { code: "A2.1.2", title: "Implement remedial support sessions for struggling students", outputId: output2_1.id },
    { code: "A2.2.1", title: "Deploy numeracy flashcard and game-based learning activities", outputId: output2_2.id },
    { code: "A2.2.2", title: "Conduct quarterly learning assessments to track progress", outputId: output2_2.id },
    { code: "A3.1.1", title: "Train all teachers on child safeguarding and protection protocols", outputId: output3_1.id },
    { code: "A3.1.2", title: "Establish referral pathways for child protection cases", outputId: output3_1.id },
    { code: "A3.2.1", title: "Train 200 community volunteers on safety monitoring", outputId: output3_2.id },
    { code: "A3.2.2", title: "Establish community feedback mechanisms for safety concerns", outputId: output3_2.id },
    { code: "A1.1.4", title: "Conduct community mobilization for enrolment drives", outputId: output1_1.id },
    { code: "A2.1.3", title: "Conduct midline learning assessments", outputId: output2_1.id },
  ];

  for (const activity of activities) {
    await prisma.logframeItem.create({
      data: {
        id: randomUUID(),
        tenantId: TENANT_ID,
        projectId: projectId,
        parentId: activity.outputId,
        level: "ACTIVITY",
        code: activity.code,
        title: activity.title,
      },
    });
  }

  console.log(`Created ${activities.length} Activities`);

  const indicators = [
    { code: "OUT-1", name: "Number of learning centres established", type: "NUMBER", unit: "centres", baseline: "0", target: "120", logframeItemId: output1_1.id, disaggregation: false },
    { code: "OUT-2", name: "Number of learning material kits distributed", type: "NUMBER", unit: "kits", baseline: "0", target: "15000", logframeItemId: output1_1.id, disaggregation: true },
    { code: "OUT-3", name: "Number of teachers recruited and deployed", type: "NUMBER", unit: "teachers", baseline: "0", target: "240", logframeItemId: output1_1.id, disaggregation: true },
    { code: "OUT-4", name: "Number of children enrolled", type: "NUMBER", unit: "children", baseline: "0", target: "8000", logframeItemId: output1_1.id, disaggregation: true },
    { code: "OUT-5", name: "Number of children attending regularly (80%+ attendance)", type: "NUMBER", unit: "children", baseline: "0", target: "6400", logframeItemId: output1_1.id, disaggregation: true },
    { code: "OUT-6", name: "Number of children assessed for literacy", type: "NUMBER", unit: "children", baseline: "0", target: "10000", logframeItemId: output2_1.id, disaggregation: true },
    { code: "OUT-7", name: "Percentage of assessed students demonstrating improved literacy", type: "PERCENTAGE", unit: "%", baseline: "0", target: "85", logframeItemId: output2_1.id, disaggregation: true },
    { code: "OUT-8", name: "Number of children assessed for numeracy", type: "NUMBER", unit: "children", baseline: "0", target: "10000", logframeItemId: output2_2.id, disaggregation: true },
    { code: "OUT-9", name: "Percentage of assessed students demonstrating improved numeracy", type: "PERCENTAGE", unit: "%", baseline: "0", target: "75", logframeItemId: output2_2.id, disaggregation: true },
    { code: "OUT-10", name: "Number of teachers trained on accelerated learning", type: "NUMBER", unit: "teachers", baseline: "0", target: "240", logframeItemId: output1_2.id, disaggregation: true },
    { code: "OUT-11", name: "Number of teachers trained on child safeguarding", type: "NUMBER", unit: "teachers", baseline: "0", target: "240", logframeItemId: output3_1.id, disaggregation: true },
    { code: "OUT-12", name: "Number of community volunteers trained on safety monitoring", type: "NUMBER", unit: "volunteers", baseline: "0", target: "200", logframeItemId: output3_2.id, disaggregation: true },
    { code: "OUT-13", name: "Gross enrolment rate in supported learning centres", type: "PERCENTAGE", unit: "%", baseline: "0", target: "100", logframeItemId: outcome1.id, disaggregation: true },
    { code: "OUT-14", name: "Retention rate at 6 months", type: "PERCENTAGE", unit: "%", baseline: "0", target: "90", logframeItemId: outcome1.id, disaggregation: true },
    { code: "OUT-15", name: "Student attendance rate", type: "PERCENTAGE", unit: "%", baseline: "0", target: "85", logframeItemId: outcome1.id, disaggregation: true },
    { code: "OUT-16", name: "Proportion of children meeting literacy benchmarks", type: "PERCENTAGE", unit: "%", baseline: "0", target: "80", logframeItemId: outcome2.id, disaggregation: true },
    { code: "OUT-17", name: "Proportion of children meeting numeracy benchmarks", type: "PERCENTAGE", unit: "%", baseline: "0", target: "70", logframeItemId: outcome2.id, disaggregation: true },
    { code: "OUT-18", name: "Number of learning centres with functioning safeguarding committee", type: "NUMBER", unit: "centres", baseline: "0", target: "120", logframeItemId: output3_1.id, disaggregation: false },
    { code: "OUT-19", name: "Number of reported safety incidents at learning centres", type: "NUMBER", unit: "incidents", baseline: "0", target: "0", logframeItemId: output3_1.id, disaggregation: false },
    { code: "OUT-20", name: "Community satisfaction score with education services", type: "PERCENTAGE", unit: "%", baseline: "0", target: "75", logframeItemId: outcome3.id, disaggregation: false },
  ];

  for (const ind of indicators) {
    await prisma.indicator.create({
      data: {
        id: randomUUID(),
        tenantId: TENANT_ID,
        projectId: projectId,
        logframeItemId: ind.logframeItemId,
        code: ind.code,
        name: ind.name,
        type: ind.type,
        baseline: ind.baseline,
        target: ind.target,
        unit: ind.unit,
        disaggregationRequired: ind.disaggregation,
        meansOfVerification: "Project records, assessments, attendance registers, government reports",
        dataSource: "Field reports, HMIS data, learning assessments, community surveys",
        frequency: "Quarterly",
      },
    });
  }

  console.log(`Created ${indicators.length} Indicators`);

  await prisma.donorTemplate.create({
    data: {
      id: randomUUID(),
      tenantId: TENANT_ID,
      projectId: projectId,
      templateName: "USAID Emergency Education Response Report Template",
      donorName: "USAID",
      reportType: "QUARTERLY",
      language: "en",
      requiredAnnexes: JSON.stringify([
        "Attendance sheets",
        "Training records",
        "Assessment reports",
        "Photos with consent forms",
        "Distribution lists",
        "Field visit reports",
      ]),
      notes: "Standard USAID emergency education response quarterly report format",
      sectionsJson: JSON.stringify([
        { id: "1", title: "Executive Summary", description: "Brief overview of programme progress", inputType: "NARRATIVE", required: true, evidenceNeeded: "Activity summaries", order: 0, reviewStatus: "REVIEWED", minWords: 200, maxWords: 400 },
        { id: "2", title: "Programme Overview", description: "Description of programme activities", inputType: "NARRATIVE", required: true, evidenceNeeded: "Project description", order: 1, reviewStatus: "REVIEWED" },
        { id: "3", title: "Progress Against Indicators", description: "Performance against logframe indicators", inputType: "INDICATOR_TABLE", required: true, evidenceNeeded: "Indicator values with evidence", order: 2, reviewStatus: "REVIEWED" },
        { id: "4", title: "Activities Completed", description: "Summary of activities implemented", inputType: "NARRATIVE", required: true, evidenceNeeded: "Activity narratives, attendance sheets", order: 3, reviewStatus: "REVIEWED" },
        { id: "5", title: "Challenges and Mitigations", description: "Challenges faced and actions taken", inputType: "NARRATIVE", required: true, evidenceNeeded: "Field visit reports", order: 4, reviewStatus: "REVIEWED" },
        { id: "6", title: "Lessons Learned", description: "Key lessons from implementation", inputType: "NARRATIVE", required: true, evidenceNeeded: "Activity summaries", order: 5, reviewStatus: "REVIEWED" },
        { id: "7", title: "Plan for Next Period", description: "Planned activities for upcoming period", inputType: "NARRATIVE", required: true, evidenceNeeded: "Work plan", order: 6, reviewStatus: "REVIEWED" },
        { id: "8", title: "Annex A: Indicator Performance Table", description: "Detailed indicator performance data", inputType: "TABLE", required: true, evidenceNeeded: "Indicator values", order: 7, reviewStatus: "REVIEWED" },
        { id: "9", title: "Annex B: Evidence Checklist", description: "List of attached evidence documents", inputType: "ANNEX", required: true, evidenceNeeded: "Evidence inventory", order: 8, reviewStatus: "REVIEWED" },
      ]),
      uploadedById: "system",
    },
  });

  console.log("Created USAID Donor Template");

  console.log("\n✅ Emergency Education Response Programme seeded successfully!");
  console.log("\nProject Summary:");
  console.log("- Project: Emergency Education Response Programme (EERP-2026)");
  console.log("- Donor: USAID");
  console.log("- Period: January 2026 - December 2026");
  console.log("- Goal: 1");
  console.log("- Outcomes: 3");
  console.log("- Outputs: 6");
  console.log("- Activities: 15");
  console.log("- Indicators: 20");
  console.log("- Template: USAID Emergency Education Response Report Template");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });