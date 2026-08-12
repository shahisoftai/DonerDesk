import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const DATABASE_URL = process.env.DATABASE_ADMIN_URL ?? "postgresql://donordesk:donordesk-dev@localhost:5432/donordesk";

console.log("Seeding dummy projects...");

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

const tenantId = "faed0177-5f2d-4a42-864f-e4c254e6d247";

async function createDummyProjects() {
  await prisma.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, false)`;

  const existingProjects = await prisma.project.count({ where: { tenantId } });
  if (existingProjects > 0) {
    console.log(`Found ${existingProjects} existing projects. Skipping project creation.`);
    return;
  }

  const projects = [
    {
      id: randomUUID(),
      title: "Primary Healthcare Improvement Project",
      projectCode: "PHC-2024-001",
      donorName: "World Health Organization",
      implementingOrganization: "Acme Humanitarian NGO",
      partnerOrganization: "Ministry of Health Pakistan",
      country: "Pakistan",
      region: "Sindh",
      district: "Karachi",
      sector: "HEALTH",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2026-12-31"),
      budgetAmount: 2500000,
      budgetCurrency: "USD",
      reportingFrequency: "QUARTERLY",
      description: "Improving access to quality primary healthcare services for underserved communities in Karachi through mobile health units, community health worker training, and health facility rehabilitation.",
      primaryContactName: "Dr. Sarah Ahmed",
      status: "ACTIVE",
      logframe: {
        goal: { code: "G1", title: "Improved health outcomes in target communities", description: "Reduce maternal and child mortality rates by 30% in project areas" },
        outcomes: [
          { code: "O1", title: "Increased utilization of health services", description: "50% increase in facility-based deliveries" },
          { code: "O2", title: "Improved disease prevention knowledge", description: "70% of households adopt preventive health practices" },
        ],
        outputs: [
          { code: "OC1", title: "Mobile health units operational", description: "4 mobile health units providing weekly services" },
          { code: "OC2", title: "Community health workers trained", description: "200 CHWs trained and deployed" },
          { code: "OC3", title: "Health facilities rehabilitated", description: "10 primary health centers upgraded" },
        ],
        activities: [
          { code: "A1.1", title: "Deploy mobile health units to remote areas" },
          { code: "A1.2", title: "Conduct weekly health camps" },
          { code: "A2.1", title: "Train community health workers" },
          { code: "A2.2", title: "Establish health education sessions" },
          { code: "A3.1", title: "Rehabilitate health facilities" },
          { code: "A3.2", title: "Procure medical equipment" },
        ],
      },
      indicators: [
        { code: "IND-H-001", name: "Maternal mortality rate", type: "NUMBER", unit: "per 100,000 live births", baseline: "350", target: "245", disaggregation: true },
        { code: "IND-H-002", name: "Under-5 mortality rate", type: "NUMBER", unit: "per 1,000 live births", baseline: "85", target: "60", disaggregation: true },
        { code: "IND-H-003", name: "Facility-based delivery rate", type: "PERCENTAGE", baseline: "45", target: "70", disaggregation: true },
        { code: "IND-H-004", name: "Immunization coverage", type: "PERCENTAGE", baseline: "55", target: "85", disaggregation: true },
        { code: "IND-H-005", name: "Number of mobile health camps conducted", type: "NUMBER", unit: "camps", baseline: "0", target: "208", disaggregation: false },
        { code: "IND-H-006", name: "Community health workers trained", type: "NUMBER", unit: "CHWs", baseline: "0", target: "200", disaggregation: true },
        { code: "IND-H-007", name: "Health facilities rehabilitated", type: "NUMBER", unit: "facilities", baseline: "0", target: "10", disaggregation: false },
        { code: "IND-H-008", name: "Number of beneficiaries reached", type: "NUMBER", unit: "people", baseline: "0", target: "50000", disaggregation: true },
        { code: "IND-H-009", name: "Disease prevention knowledge score", type: "PERCENTAGE", baseline: "30", target: "70", disaggregation: false },
        { code: "IND-H-010", name: "Referral system functional", type: "YES_NO", baseline: "No", target: "Yes", disaggregation: false },
      ],
    },
    {
      id: randomUUID(),
      title: "Integrated Nutrition Security Program",
      projectCode: "NUT-2024-001",
      donorName: "UNICEF",
      implementingOrganization: "Acme Humanitarian NGO",
      partnerOrganization: "National Nutrition Program",
      country: "Pakistan",
      region: "Punjab",
      district: "Lahore",
      sector: "NUTRITION",
      startDate: new Date("2024-03-01"),
      endDate: new Date("2027-02-28"),
      budgetAmount: 4200000,
      budgetCurrency: "USD",
      reportingFrequency: "QUARTERLY",
      description: "Addressing malnutrition among children under 5 and pregnant/lactating women through integrated approaches including supplementary feeding, nutrition education, and capacity building of health workers.",
      primaryContactName: "Dr. Fatima Khan",
      status: "ACTIVE",
      logframe: {
        goal: { code: "G1", title: "Reduced malnutrition among vulnerable groups", description: "Decrease stunting and wasting rates in children under 5" },
        outcomes: [
          { code: "O1", title: "Improved nutritional status of children", description: "30% reduction in stunting among children 6-23 months" },
          { code: "O2", title: "Enhanced nutrition practices", description: "80% of mothers practicing exclusive breastfeeding for 6 months" },
        ],
        outputs: [
          { code: "OC1", title: "Supplementary feeding program operational", description: "5000 children receiving supplementary feeding" },
          { code: "OC2", title: "Mother support groups established", description: "150 support groups operational" },
          { code: "OC3", title: "Nutrition screening conducted", description: "100% of target children screened" },
        ],
        activities: [
          { code: "A1.1", title: "Distribute ready-to-use therapeutic food" },
          { code: "A1.2", title: "Conduct nutrition assessments" },
          { code: "A2.1", title: "Establish mother support groups" },
          { code: "A2.2", title: "Provide nutrition counseling" },
          { code: "A3.1", title: "Train health workers on nutrition" },
          { code: "A3.2", title: "Procure and distribute micronutrient supplements" },
        ],
      },
      indicators: [
        { code: "IND-N-001", name: "Stunting prevalence", type: "PERCENTAGE", unit: "%", baseline: "38", target: "27", disaggregation: true },
        { code: "IND-N-002", name: "Wasting prevalence", type: "PERCENTAGE", unit: "%", baseline: "12", target: "5", disaggregation: true },
        { code: "IND-N-003", name: "Exclusive breastfeeding rate", type: "PERCENTAGE", baseline: "48", target: "80", disaggregation: true },
        { code: "IND-N-004", name: "Children receiving supplementary feeding", type: "NUMBER", unit: "children", baseline: "0", target: "5000", disaggregation: true },
        { code: "IND-N-005", name: "Mother support groups formed", type: "NUMBER", unit: "groups", baseline: "0", target: "150", disaggregation: false },
        { code: "IND-N-006", name: "Children screened for malnutrition", type: "NUMBER", unit: "children", baseline: "0", target: "25000", disaggregation: true },
        { code: "IND-N-007", name: "Health workers trained in nutrition", type: "NUMBER", unit: "workers", baseline: "0", target: "300", disaggregation: true },
        { code: "IND-N-008", name: "Micronutrient supplement coverage", type: "PERCENTAGE", baseline: "35", target: "85", disaggregation: true },
        { code: "IND-N-009", name: "Weight-for-age improvement", type: "PERCENTAGE", baseline: "0", target: "25", disaggregation: true },
        { code: "IND-N-010", name: "Nutrition counseling sessions conducted", type: "NUMBER", unit: "sessions", baseline: "0", target: "1200", disaggregation: false },
      ],
    },
    {
      id: randomUUID(),
      title: "WASH Emergency Response Program",
      projectCode: "WASH-2024-001",
      donorName: "UNHCR",
      implementingOrganization: "Acme Humanitarian NGO",
      partnerOrganization: "PDMA Punjab",
      country: "Pakistan",
      region: "Punjab",
      district: "Multan",
      sector: "WASH",
      startDate: new Date("2024-06-01"),
      endDate: new Date("2025-12-31"),
      budgetAmount: 1800000,
      budgetCurrency: "USD",
      reportingFrequency: "MONTHLY",
      description: "Providing emergency water, sanitation, and hygiene services to flood-affected communities including installation of water points, construction of latrines, and hygiene promotion activities.",
      primaryContactName: "Eng. Muhammad Ali",
      status: "ACTIVE",
      logframe: {
        goal: { code: "G1", title: "Reduced waterborne disease incidence", description: "Decrease diarrhea cases by 50% in target communities" },
        outcomes: [
          { code: "O1", title: "Safe water access ensured", description: "90% of households have access to safe drinking water" },
          { code: "O2", title: "Improved sanitation facilities", description: "80% of households use improved latrines" },
          { code: "O3", title: "Hygiene practices improved", description: "75% of households practice proper handwashing" },
        ],
        outputs: [
          { code: "OC1", title: "Water points installed", description: "25 new water points constructed" },
          { code: "OC2", title: "Household latrines constructed", description: "2000 household latrines built" },
          { code: "OC3", title: "Hygiene kits distributed", description: "5000 hygiene kits distributed" },
        ],
        activities: [
          { code: "A1.1", title: "Drill boreholes for water points" },
          { code: "A1.2", title: "Install water filtration systems" },
          { code: "A2.1", title: "Construct household latrines" },
          { code: "A2.2", title: "Train community sanitation committees" },
          { code: "A3.1", title: "Distribute hygiene kits" },
          { code: "A3.2", title: "Conduct hygiene promotion sessions" },
        ],
      },
      indicators: [
        { code: "IND-W-001", name: "Diarrhea incidence rate", type: "NUMBER", unit: "cases/1000/month", baseline: "45", target: "22", disaggregation: true },
        { code: "IND-W-002", name: "Households with safe water access", type: "PERCENTAGE", baseline: "40", target: "90", disaggregation: true },
        { code: "IND-W-003", name: "Households with improved latrines", type: "PERCENTAGE", baseline: "30", target: "80", disaggregation: true },
        { code: "IND-W-004", name: "Handwashing practice adoption", type: "PERCENTAGE", baseline: "25", target: "75", disaggregation: true },
        { code: "IND-W-005", name: "Water points installed", type: "NUMBER", unit: "points", baseline: "0", target: "25", disaggregation: false },
        { code: "IND-W-006", name: "Household latrines constructed", type: "NUMBER", unit: "latrines", baseline: "0", target: "2000", disaggregation: false },
        { code: "IND-W-007", name: "Hygiene kits distributed", type: "NUMBER", unit: "kits", baseline: "0", target: "5000", disaggregation: true },
        { code: "IND-W-008", name: "People trained on hygiene promotion", type: "NUMBER", unit: "people", baseline: "0", target: "500", disaggregation: true },
        { code: "IND-W-009", name: "Water quality compliance", type: "PERCENTAGE", baseline: "50", target: "95", disaggregation: false },
        { code: "IND-W-010", name: "Community sanitation committees formed", type: "NUMBER", unit: "committees", baseline: "0", target: "50", disaggregation: false },
      ],
    },
    {
      id: randomUUID(),
      title: "Emergency Education Response Project",
      projectCode: "EDU-2024-001",
      donorName: "Education Cannot Wait",
      implementingOrganization: "Acme Humanitarian NGO",
      partnerOrganization: "Punjab Education Foundation",
      country: "Pakistan",
      region: "Khyber Pakhtunkhwa",
      district: "Peshawar",
      sector: "EDUCATION",
      startDate: new Date("2024-04-01"),
      endDate: new Date("2026-03-31"),
      budgetAmount: 3200000,
      budgetCurrency: "USD",
      reportingFrequency: "QUARTERLY",
      description: "Providing access to quality education for out-of-school children in conflict-affected areas through establishment of temporary learning centers, teacher training, and provision of learning materials.",
      primaryContactName: "Ms. Najia Parvez",
      status: "ACTIVE",
      logframe: {
        goal: { code: "G1", title: "Improved educational outcomes", description: "Increase enrollment and retention of out-of-school children" },
        outcomes: [
          { code: "O1", title: "Increased school enrollment", description: "10000 out-of-school children enrolled" },
          { code: "O2", title: "Improved learning outcomes", description: "70% of students show grade-level competency" },
          { code: "O3", title: "Safe learning environment", description: "100% of learning centers meet safety standards" },
        ],
        outputs: [
          { code: "OC1", title: "Temporary learning centers established", description: "50 learning centers operational" },
          { code: "OC2", title: "Teachers trained", description: "300 teachers trained on accelerated learning" },
          { code: "OC3", title: "Learning materials distributed", description: "10000 student kits distributed" },
        ],
        activities: [
          { code: "A1.1", title: "Establish temporary learning centers" },
          { code: "A1.2", title: "Conduct community mobilization for enrollment" },
          { code: "A2.1", title: "Train teachers on accelerated learning" },
          { code: "A2.2", title: "Provide ongoing teacher mentoring" },
          { code: "A3.1", title: "Develop and distribute learning materials" },
          { code: "A3.2", title: "Establish child-friendly spaces" },
        ],
      },
      indicators: [
        { code: "IND-E-001", name: "Out-of-school children enrolled", type: "NUMBER", unit: "children", baseline: "0", target: "10000", disaggregation: true },
        { code: "IND-E-002", name: "School attendance rate", type: "PERCENTAGE", baseline: "60", target: "90", disaggregation: true },
        { code: "IND-E-003", name: "Students achieving grade-level competency", type: "PERCENTAGE", baseline: "40", target: "70", disaggregation: true },
        { code: "IND-E-004", name: "Learning centers operational", type: "NUMBER", unit: "centers", baseline: "0", target: "50", disaggregation: false },
        { code: "IND-E-005", name: "Teachers trained", type: "NUMBER", unit: "teachers", baseline: "0", target: "300", disaggregation: true },
        { code: "IND-E-006", name: "Student learning kits distributed", type: "NUMBER", unit: "kits", baseline: "0", target: "10000", disaggregation: true },
        { code: "IND-E-007", name: "Learning centers meeting safety standards", type: "PERCENTAGE", baseline: "0", target: "100", disaggregation: false },
        { code: "IND-E-008", name: "Dropout rate", type: "PERCENTAGE", baseline: "25", target: "10", disaggregation: true },
        { code: "IND-E-009", name: "Child-friendly spaces established", type: "NUMBER", unit: "spaces", baseline: "0", target: "25", disaggregation: false },
        { code: "IND-E-010", name: "Parent community engagement", type: "NUMBER", unit: "parents", baseline: "0", target: "3000", disaggregation: true },
      ],
    },
  ];

  for (const projectData of projects) {
    const { logframe, indicators, ...projectInfo } = projectData;

    const project = await prisma.project.create({
      data: {
        ...projectInfo,
        organization: { connect: { tenantId } },
      },
    });
    console.log(`Created project: ${project.title} (${project.projectCode})`);

    const goalItem = await prisma.logframeItem.create({
      data: {
        id: randomUUID(),
        tenantId,
        projectId: project.id,
        level: "GOAL",
        code: logframe.goal.code,
        title: logframe.goal.title,
        description: logframe.goal.description,
      },
    });

    const outcomeItems = [];
    for (const outcome of logframe.outcomes) {
      const item = await prisma.logframeItem.create({
        data: {
          id: randomUUID(),
          tenantId,
          projectId: project.id,
          parentId: goalItem.id,
          level: "OUTCOME",
          code: outcome.code,
          title: outcome.title,
          description: outcome.description,
        },
      });
      outcomeItems.push(item);
    }

    const outputItems = [];
    for (const output of logframe.outputs) {
      const parentOutcome = outcomeItems[logframe.outputs.indexOf(output) % outcomeItems.length]!;
      const item = await prisma.logframeItem.create({
        data: {
          id: randomUUID(),
          tenantId,
          projectId: project.id,
          parentId: parentOutcome.id,
          level: "OUTPUT",
          code: output.code,
          title: output.title,
          description: output.description,
        },
      });
      outputItems.push(item);
    }

    for (const activity of logframe.activities) {
      const parentOutput = outputItems[logframe.activities.indexOf(activity) % outputItems.length]!;
      await prisma.logframeItem.create({
        data: {
          id: randomUUID(),
          tenantId,
          projectId: project.id,
          parentId: parentOutput.id,
          level: "ACTIVITY",
          code: activity.code,
          title: activity.title,
        },
      });
    }
    console.log(`  Created logframe structure for ${project.projectCode}`);

    for (const ind of indicators) {
      const targetLogframeItem = outputItems[0]!;
      await prisma.indicator.create({
        data: {
          id: randomUUID(),
          tenantId,
          projectId: project.id,
          logframeItemId: targetLogframeItem.id,
          code: ind.code,
          name: ind.name,
          type: ind.type,
          baseline: ind.baseline,
          target: ind.target,
          unit: ind.unit,
          disaggregationRequired: ind.disaggregation,
          meansOfVerification: "Project records, surveys, government reports",
          dataSource: "Field reports, HMIS data, household surveys",
          frequency: "Quarterly",
        },
      });
    }
    console.log(`  Created ${indicators.length} indicators for ${project.projectCode}`);
  }

  console.log("\n✅ Successfully created 4 dummy projects with full logframe and indicators!");
  console.log("\nProjects created:");
  console.log("1. PHC-2024-001 - Primary Healthcare Improvement Project (HEALTH)");
  console.log("2. NUT-2024-001 - Integrated Nutrition Security Program (NUTRITION)");
  console.log("3. WASH-2024-001 - WASH Emergency Response Program (WASH)");
  console.log("4. EDU-2024-001 - Emergency Education Response Project (EDUCATION)");
}

createDummyProjects()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
