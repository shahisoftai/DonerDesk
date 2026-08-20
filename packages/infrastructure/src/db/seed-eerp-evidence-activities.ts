import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const DATABASE_URL = process.env.DATABASE_ADMIN_URL ?? "postgresql://donordesk_migrator:KpPBXNNhtTF41JfjV5lMZlCd@127.0.0.1:5432/donordesk";

console.log("Seeding Evidence and Activities for Emergency Education Response Programme...");

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

const TENANT_ID = "faed0177-5f2d-4a42-864f-e4c254e6d247";
const PROJECT_ID = "0d0e3a2b-ad21-4b07-a2e1-b649d828e26f";
const TEMPLATE_ID = "109b6282-17bd-4b25-95a4-3f27b36ffc3c";

async function main() {
  await prisma.$executeRaw`SELECT set_config('app.current_tenant', ${TENANT_ID}, false)`;

  const setup = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "ProjectSetup" WHERE "projectId" = ${PROJECT_ID}
  `;
  if (setup.length === 0) {
    await prisma.$executeRaw`
      INSERT INTO "ProjectSetup" (
        id, "tenantId", "projectId", "workspaceProvisionStatus", "provisionAttemptCount",
        "lastProvisionAttemptAt", "acknowledgedAt", "acknowledgedById", "createdAt", "updatedAt"
      ) VALUES (
        ${randomUUID()}, ${TENANT_ID}, ${PROJECT_ID}, 'READY', 1,
        NOW(), NOW(), 'system', NOW(), NOW()
      )
    `;
    console.log("Created ProjectSetup with workspaceProvisionStatus=READY");
  }

  const profile = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "ReportingProfile" WHERE "projectId" = ${PROJECT_ID}
  `;
  if (profile.length === 0) {
    await prisma.$executeRaw`
      INSERT INTO "ReportingProfile" (
        id, "tenantId", "projectId", "defaultTemplateId", language, tone,
        "createdById", "updatedById", "createdAt", "updatedAt"
      ) VALUES (
        ${randomUUID()}, ${TENANT_ID}, ${PROJECT_ID}, ${TEMPLATE_ID}, 'en', 'FORMAL',
        'system', 'system', NOW(), NOW()
      )
    `;
    console.log("Created ReportingProfile with defaultTemplateId=USAID template");
  }

  const existingEvidence = await prisma.$queryRaw<[{ exists: boolean }]>`
    SELECT EXISTS(SELECT 1 FROM "EvidenceFile" WHERE "tenantId" = ${TENANT_ID} AND "projectId" = ${PROJECT_ID}) as exists
  `;

  if (existingEvidence[0]?.exists) {
    console.log("Evidence items already exist for this project, skipping.");
  } else {
    const evidenceItems = [
      {
        fileName: "teacher_training_attendance_q1.xlsx",
        title: "Teacher Training Attendance Sheet - Q1 2026",
        fileUrl: "/evidence/eerp/teacher_training_q1.xlsx",
        fileType: "xlsx",
        fileSize: 45000,
        evidenceType: "TRAINING_RECORD",
        location: "Cox's Bazar",
        activityDate: new Date("2026-01-15"),
        verificationStatus: "VERIFIED",
        confidentialityLevel: "INTERNAL",
        notes: "Attendance for 5-day teacher training on accelerated learning methodologies. 48 teachers attended.",
      },
      {
        fileName: "lc_establishment_photos_jan2026.zip",
        title: "Learning Centre Establishment Photos - January 2026",
        fileUrl: "/evidence/eerp/lc_photos_jan2026.zip",
        fileType: "zip",
        fileSize: 8500000,
        evidenceType: "PHOTO",
        location: "Cox's Bazar District",
        activityDate: new Date("2026-01-20"),
        verificationStatus: "VERIFIED",
        confidentialityLevel: "SENSITIVE",
        notes: "Photos of 15 newly established learning centres with teachers and community members. Consent forms obtained.",
      },
      {
        fileName: "materials_distribution_list_q1.pdf",
        title: "Learning Materials Distribution List - Q1 2026",
        fileUrl: "/evidence/eerp/materials_dist_q1.pdf",
        fileType: "pdf",
        fileSize: 120000,
        evidenceType: "DISTRIBUTION_LIST",
        location: "Cox's Bazar",
        activityDate: new Date("2026-02-01"),
        verificationStatus: "VERIFIED",
        confidentialityLevel: "INTERNAL",
        notes: "Distribution list for 3,500 learning material kits distributed to enrolled children.",
      },
      {
        fileName: "baseline_assessment_report_feb2026.pdf",
        title: "Baseline Learning Assessment Report - February 2026",
        fileUrl: "/evidence/eerp/baseline_assessment_feb2026.pdf",
        fileType: "pdf",
        fileSize: 450000,
        evidenceType: "FIELD_VISIT_REPORT",
        location: "Cox's Bazar",
        activityDate: new Date("2026-02-15"),
        verificationStatus: "VERIFIED",
        confidentialityLevel: "INTERNAL",
        notes: "Baseline assessment conducted for 5,200 enrolled children to establish starting literacy and numeracy levels.",
      },
      {
        fileName: "teacher_training_attendance_q2.xlsx",
        title: "Teacher Training Attendance Sheet - Q2 2026",
        fileUrl: "/evidence/eerp/teacher_training_q2.xlsx",
        fileType: "xlsx",
        fileSize: 48000,
        evidenceType: "TRAINING_RECORD",
        location: "Cox's Bazar",
        activityDate: new Date("2026-04-10"),
        verificationStatus: "VERIFIED",
        confidentialityLevel: "INTERNAL",
        notes: "Attendance for second batch of teacher training. 52 teachers attended.",
      },
      {
        fileName: "lc_photos_q2_mar2026.zip",
        title: "Learning Centre Photos - Q2 2026",
        fileUrl: "/evidence/eerp/lc_photos_q2.zip",
        fileType: "zip",
        fileSize: 12000000,
        evidenceType: "PHOTO",
        location: "Cox's Bazar District",
        activityDate: new Date("2026-03-20"),
        verificationStatus: "PENDING_REVIEW",
        confidentialityLevel: "SENSITIVE",
        notes: "Photos showing learning activities in 30 learning centres. Consent forms on file.",
      },
      {
        fileName: "safeguarding_training_attendance.xlsx",
        title: "Child Safeguarding Training Attendance",
        fileUrl: "/evidence/eerp/safeguarding_training.xlsx",
        fileType: "xlsx",
        fileSize: 38000,
        evidenceType: "TRAINING_RECORD",
        location: "Cox's Bazar",
        activityDate: new Date("2026-03-05"),
        verificationStatus: "VERIFIED",
        confidentialityLevel: "INTERNAL",
        notes: "Attendance for child safeguarding training. 180 teachers trained.",
      },
      {
        fileName: "community_volunteer_training_list.pdf",
        title: "Community Volunteer Training List",
        fileUrl: "/evidence/eerp/volunteer_training_list.pdf",
        fileType: "pdf",
        fileSize: 95000,
        evidenceType: "TRAINING_RECORD",
        location: "Cox's Bazar",
        activityDate: new Date("2026-03-12"),
        verificationStatus: "VERIFIED",
        confidentialityLevel: "INTERNAL",
        notes: "Training list for 120 community volunteers on safety monitoring.",
      },
      {
        fileName: "materials_distribution_q2.pdf",
        title: "Learning Materials Distribution List - Q2 2026",
        fileUrl: "/evidence/eerp/materials_dist_q2.pdf",
        fileType: "pdf",
        fileSize: 135000,
        evidenceType: "DISTRIBUTION_LIST",
        location: "Cox's Bazar",
        activityDate: new Date("2026-04-25"),
        verificationStatus: "VERIFIED",
        confidentialityLevel: "INTERNAL",
        notes: "Distribution list for additional 4,500 learning kits distributed in Q2.",
      },
      {
        fileName: "midline_assessment_report_jun2026.pdf",
        title: "Midline Learning Assessment Report - June 2026",
        fileUrl: "/evidence/eerp/midline_assessment_jun2026.pdf",
        fileType: "pdf",
        fileSize: 520000,
        evidenceType: "FIELD_VISIT_REPORT",
        location: "Cox's Bazar",
        activityDate: new Date("2026-06-20"),
        verificationStatus: "PENDING_REVIEW",
        confidentialityLevel: "INTERNAL",
        notes: "Midline assessment showing 72% of students demonstrating improved literacy skills.",
      },
      {
        fileName: "lc_inspection_report_may2026.pdf",
        title: "Learning Centre Inspection Report - May 2026",
        fileUrl: "/evidence/eerp/lc_inspection_may2026.pdf",
        fileType: "pdf",
        fileSize: 280000,
        evidenceType: "FIELD_VISIT_REPORT",
        location: "Cox's Bazar District",
        activityDate: new Date("2026-05-15"),
        verificationStatus: "VERIFIED",
        confidentialityLevel: "INTERNAL",
        notes: "Inspection report for 45 learning centres. All found to be operational with appropriate safeguarding measures.",
      },
      {
        fileName: "enrolment_campaign_photos.zip",
        title: "Enrolment Campaign Photos - March 2026",
        fileUrl: "/evidence/eerp/enrolment_campaign_photos.zip",
        fileType: "zip",
        fileSize: 9500000,
        evidenceType: "PHOTO",
        location: "Cox's Bazar",
        activityDate: new Date("2026-03-28"),
        verificationStatus: "VERIFIED",
        confidentialityLevel: "SENSITIVE",
        notes: "Photos from community enrolment campaign. Community leaders and parents participating.",
      },
      {
        fileName: "referral_pathway_doc.pdf",
        title: "Child Protection Referral Pathway Document",
        fileUrl: "/evidence/eerp/referral_pathway.pdf",
        fileType: "pdf",
        fileSize: 180000,
        evidenceType: "APPROVAL_DOCUMENT",
        location: "Cox's Bazar",
        activityDate: new Date("2026-02-28"),
        verificationStatus: "VERIFIED",
        confidentialityLevel: "INTERNAL",
        notes: "Signed referral pathway document agreed with Department of Social Services.",
      },
      {
        fileName: "numeracy_flashcards_photo.jpg",
        title: "Numeracy Flashcard Activity Photo",
        fileUrl: "/evidence/eerp/numeracy_flashcards.jpg",
        fileType: "jpg",
        fileSize: 1200000,
        evidenceType: "PHOTO",
        location: "Learning Centre LC-042, Cox's Bazar",
        activityDate: new Date("2026-05-10"),
        verificationStatus: "VERIFIED",
        confidentialityLevel: "SENSITIVE",
        notes: "Photo of game-based numeracy activity. Child consent obtained.",
      },
      {
        fileName: "beneficiary_list_jun2026.xlsx",
        title: "Beneficiary List Update - June 2026",
        fileUrl: "/evidence/eerp/beneficiary_list_jun2026.xlsx",
        fileType: "xlsx",
        fileSize: 210000,
        evidenceType: "BENEFICIARY_LIST",
        location: "Cox's Bazar",
        activityDate: new Date("2026-06-30"),
        verificationStatus: "VERIFIED",
        confidentialityLevel: "SENSITIVE",
        notes: "Updated beneficiary list showing 7,850 children enrolled as of June 2026.",
      },
    ];

    for (const evidence of evidenceItems) {
      await prisma.$executeRaw`
        INSERT INTO "EvidenceFile" (
          id, "tenantId", "projectId", "fileName", title, "fileUrl", "fileType", "fileSize",
          "evidenceType", location, "activityDate", "verificationStatus", "confidentialityLevel",
          notes, "storageProvider", "uploadedById", "createdAt", "updatedAt"
        ) VALUES (
          ${randomUUID()},
          ${TENANT_ID},
          ${PROJECT_ID},
          ${evidence.fileName},
          ${evidence.title},
          ${evidence.fileUrl},
          ${evidence.fileType},
          ${evidence.fileSize},
          ${evidence.evidenceType},
          ${evidence.location},
          ${evidence.activityDate},
          ${evidence.verificationStatus},
          ${evidence.confidentialityLevel},
          ${evidence.notes},
          'LOCAL',
          'system',
          NOW(),
          NOW()
        )
      `;
    }
    console.log(`Created ${evidenceItems.length} Evidence items`);
  }

  const existingActivities = await prisma.$queryRaw<[{ exists: boolean }]>`
    SELECT EXISTS(SELECT 1 FROM "ActivityUpdate" WHERE "tenantId" = ${TENANT_ID} AND "projectId" = ${PROJECT_ID}) as exists
  `;

  if (existingActivities[0]?.exists) {
    console.log("Activity updates already exist for this project, skipping.");
  } else {
    const q1PeriodId = randomUUID();
    const q2PeriodId = randomUUID();

    await prisma.$executeRaw`
      INSERT INTO "ReportingPeriod" (
        id, "tenantId", "projectId", "reportType", "startDate", "endDate", "deadline", status, "createdAt", "updatedAt"
      ) VALUES (
        ${q1PeriodId}, ${TENANT_ID}, ${PROJECT_ID}, 'QUARTERLY',
        ${new Date("2026-01-01")}, ${new Date("2026-03-31")}, ${new Date("2026-04-15")},
        'SUBMITTED', NOW(), NOW()
      )
    `;

    await prisma.$executeRaw`
      INSERT INTO "ReportingPeriod" (
        id, "tenantId", "projectId", "reportType", "startDate", "endDate", "deadline", status, "createdAt", "updatedAt"
      ) VALUES (
        ${q2PeriodId}, ${TENANT_ID}, ${PROJECT_ID}, 'QUARTERLY',
        ${new Date("2026-04-01")}, ${new Date("2026-06-30")}, ${new Date("2026-07-15")},
        'IN_PROGRESS', NOW(), NOW()
      )
    `;

    console.log("Created Q1 and Q2 2026 Reporting Periods");

    const activities = [
      {
        reportingPeriodId: q1PeriodId,
        activityTitle: "Teacher Training on Accelerated Learning Methodologies - Batch 1",
        activityDate: new Date("2026-01-15"),
        location: "Cox's Bazar Training Centre",
        participantsTotal: 48,
        participantsMale: 20,
        participantsFemale: 28,
        summary: "Conducted 5-day intensive teacher training for 48 teachers on accelerated learning methodologies suitable for crisis-affected children.",
        achievements: "All 48 teachers completed training and received certificates. Teachers demonstrated competency in accelerated learning techniques.",
        challenges: "Some teachers had limited prior experience with interactive teaching methods. Additional coaching support planned.",
        lessonsLearned: "Need to incorporate more practical sessions in future training. Pairing experienced and new teachers beneficial.",
        nextSteps: "Provide ongoing coaching support. Schedule second batch training for remaining teachers.",
        status: "ACCEPTED",
      },
      {
        reportingPeriodId: q1PeriodId,
        activityTitle: "Establishment of 45 Learning Centres",
        activityDate: new Date("2026-01-20"),
        location: "Various host communities, Cox's Bazar",
        participantsTotal: 90,
        participantsMale: 35,
        participantsFemale: 55,
        summary: "Established and equipped 45 learning centres in host communities with furniture, learning materials, and child protection materials.",
        achievements: "45 learning centres established, each equipped with learning materials for 100 children. Child safeguarding posters displayed.",
        challenges: "Space constraints in some host communities. Worked with community leaders to identify suitable locations.",
        lessonsLearned: "Early community engagement critical for identifying suitable locations. Need dedicated follow-up for furnishing.",
        nextSteps: "Complete furnishing of remaining centres. Establish community management committees.",
        status: "ACCEPTED",
      },
      {
        reportingPeriodId: q1PeriodId,
        activityTitle: "Distribution of 3,500 Learning Material Kits",
        activityDate: new Date("2026-02-01"),
        location: "Cox's Bazar District",
        participantsTotal: 3500,
        participantsMale: 1750,
        participantsFemale: 1750,
        summary: "Distributed learning material kits to 3,500 enrolled children including notebooks, pencils, textbooks, and storybooks.",
        achievements: "Successfully distributed 3,500 kits. Each kit contains materials for 3 months of learning.",
        challenges: "Logistics in remote areas challenging. Used partner network for last-mile delivery.",
        lessonsLearned: "Pre-positioning materials closer to distribution points improves efficiency.",
        nextSteps: "Monitor material usage. Plan for replenishment in Q2.",
        status: "ACCEPTED",
      },
      {
        reportingPeriodId: q1PeriodId,
        activityTitle: "Baseline Learning Assessments",
        activityDate: new Date("2026-02-15"),
        location: "All 45 Learning Centres",
        participantsTotal: 3500,
        participantsMale: 1750,
        participantsFemale: 1750,
        summary: "Conducted baseline literacy and numeracy assessments for all 3,500 enrolled children using standardized tools.",
        achievements: "Baseline established. 35% of children showed age-appropriate literacy, 28% showed appropriate numeracy.",
        challenges: "Some children hesitant to participate in assessments. Used play-based approach to put children at ease.",
        lessonsLearned: "Play-based assessment more effective than written tests for this age group.",
        nextSteps: "Develop remedial support plans for children below benchmarks. Schedule midline for Q2.",
        status: "ACCEPTED",
      },
      {
        reportingPeriodId: q1PeriodId,
        activityTitle: "Child Safeguarding Training for Teachers",
        activityDate: new Date("2026-03-05"),
        location: "Cox's Bazar Training Centre",
        participantsTotal: 180,
        participantsMale: 72,
        participantsFemale: 108,
        summary: "Trained 180 teachers on child safeguarding, protection protocols, and referral pathways.",
        achievements: "All 180 teachers trained on identifying and reporting child protection concerns. Referral pathways established.",
        challenges: "Sensitive nature of topic required careful facilitation. External child protection expert engaged.",
        lessonsLearned: "Regular refresher training needed. Creating safe spaces for discussion important.",
        nextSteps: "Establish safeguarding committees in all centres. Develop reporting mechanism.",
        status: "ACCEPTED",
      },
      {
        reportingPeriodId: q2PeriodId,
        activityTitle: "Teacher Training on Accelerated Learning - Batch 2",
        activityDate: new Date("2026-04-10"),
        location: "Cox's Bazar Training Centre",
        participantsTotal: 52,
        participantsMale: 22,
        participantsFemale: 30,
        summary: "Conducted second batch of 5-day teacher training on accelerated learning for 52 additional teachers.",
        achievements: "52 teachers trained and certified. Total teachers trained to date: 100 (42% of target).",
        challenges: "Scheduling during Ramadan required adjustment. Some teachers requested evening sessions.",
        lessonsLearned: "Flexibility in timing improves attendance. Need to plan training calendar earlier.",
        nextSteps: "Continue with remaining teacher training batches. Provide refresher training for Batch 1.",
        status: "ACCEPTED",
      },
      {
        reportingPeriodId: q2PeriodId,
        activityTitle: "Community Mobilisation for Enrolment Campaign",
        activityDate: new Date("2026-03-28"),
        location: "Cox's Bazar host communities",
        participantsTotal: 450,
        participantsMale: 180,
        participantsFemale: 270,
        summary: "Community mobilisation campaign to identify and enrol out-of-school children in learning centres.",
        achievements: "Campaign reached 450 households. 2,100 new children identified and enrolled.",
        challenges: "Some parents hesitant due to concerns about safety and opportunity costs.",
        lessonsLearned: "Engaging community leaders as champions more effective than direct outreach.",
        nextSteps: "Continue community engagement. Address specific parent concerns through community meetings.",
        status: "ACCEPTED",
      },
      {
        reportingPeriodId: q2PeriodId,
        activityTitle: "Community Volunteer Training on Safety Monitoring",
        activityDate: new Date("2026-03-12"),
        location: "Cox's Bazar",
        participantsTotal: 120,
        participantsMale: 48,
        participantsFemale: 72,
        summary: "Trained 120 community volunteers on learning centre safety monitoring and feedback mechanisms.",
        achievements: "120 volunteers trained and deployed to monitor 45 learning centres.",
        challenges: "Volunteers had varying literacy levels. Used visual aids and practical demonstrations.",
        lessonsLearned: "Community volunteers are valuable eyes and ears. Need regular check-ins and support.",
        nextSteps: "Establish regular feedback meetings with volunteers. Develop simple reporting tools.",
        status: "ACCEPTED",
      },
      {
        reportingPeriodId: q2PeriodId,
        activityTitle: "Distribution of Additional 4,500 Learning Kits",
        activityDate: new Date("2026-04-25"),
        location: "Cox's Bazar District",
        participantsTotal: 4500,
        participantsMale: 2250,
        participantsFemale: 2250,
        summary: "Distributed additional 4,500 learning material kits to newly enrolled children.",
        achievements: "Total kits distributed to date: 8,000 (53% of 15,000 target).",
        challenges: "Supply chain delays affected delivery schedule. Worked with local supplier.",
        lessonsLearned: "Multiple suppliers reduce risk. Buffer stock should be maintained.",
        nextSteps: "Complete remaining kit distribution by Q3. Monitor material condition.",
        status: "ACCEPTED",
      },
      {
        reportingPeriodId: q2PeriodId,
        activityTitle: "Learning Centre Expansion to 75 Centres",
        activityDate: new Date("2026-04-30"),
        location: "Cox's Bazar District",
        participantsTotal: 150,
        participantsMale: 60,
        participantsFemale: 90,
        summary: "Expanded learning centre network from 45 to 75 centres to accommodate increased enrolment.",
        achievements: "30 new centres established and operational. All equipped with learning materials.",
        challenges: "Finding suitable spaces in densely populated areas. Worked with community leaders.",
        lessonsLearned: "Modular approach to centre establishment allows flexibility.",
        nextSteps: "Continue expansion towards 120 centre target. Recruit and train additional teachers.",
        status: "ACCEPTED",
      },
      {
        reportingPeriodId: q2PeriodId,
        activityTitle: "Establishment of Child Protection Referral Pathways",
        activityDate: new Date("2026-02-28"),
        location: "Cox's Bazar",
        participantsTotal: 25,
        participantsMale: 15,
        participantsFemale: 10,
        summary: "Formalised referral pathway with Department of Social Services for child protection cases.",
        achievements: "Signed agreement with DoSS. 5 referral pathway focal points identified and trained.",
        challenges: "Bureaucratic processes delayed formalisation. Maintained informal working relationships.",
        lessonsLearned: "Early engagement with government counterparts essential. Regular liaison meetings helpful.",
        nextSteps: "Conduct joint simulation exercise. Share referral data with DoSS quarterly.",
        status: "ACCEPTED",
      },
      {
        reportingPeriodId: q2PeriodId,
        activityTitle: "Midline Learning Assessments",
        activityDate: new Date("2026-06-20"),
        location: "All 75 Learning Centres",
        participantsTotal: 6200,
        participantsMale: 3100,
        participantsFemale: 3100,
        summary: "Conducted midline literacy and numeracy assessments for 6,200 students.",
        achievements: "72% of students demonstrate improved literacy (up from 35% at baseline). 65% show improved numeracy (up from 28%).",
        challenges: "Large number of students requiring assessment. Mobilised additional assessors.",
        lessonsLearned: "Sampling approach may be more efficient for large cohorts. Need standardized rubrics.",
        nextSteps: "Develop targeted remedial support for students below benchmarks. Plan endline for Q4.",
        status: "ACCEPTED",
      },
      {
        reportingPeriodId: q2PeriodId,
        activityTitle: "Game-Based Numeracy Activities Roll-out",
        activityDate: new Date("2026-05-10"),
        location: "All 75 Learning Centres",
        participantsTotal: 6200,
        participantsMale: 3100,
        participantsFemale: 3100,
        summary: "Rolled out numeracy flashcards and game-based learning activities across all learning centres.",
        achievements: "All 75 centres implementing game-based numeracy. Teachers trained on facilitation.",
        challenges: "Some centres lacked appropriate spaces for activities. Adapted activities for outdoor settings.",
        lessonsLearned: "Children respond well to play-based learning. Activity cards should be pictorial.",
        nextSteps: "Develop additional numeracy games. Monitor engagement levels.",
        status: "ACCEPTED",
      },
      {
        reportingPeriodId: q2PeriodId,
        activityTitle: "Quarterly Learning Centre Inspections",
        activityDate: new Date("2026-05-15"),
        location: "Cox's Bazar District",
        participantsTotal: 45,
        participantsMale: 0,
        participantsFemale: 45,
        summary: "Conducted quarterly inspections of 45 learning centres to assess safety, hygiene, and safeguarding compliance.",
        achievements: "All 45 inspected centres meet minimum standards. 38 centres rated as 'Good', 7 as 'Satisfactory'.",
        challenges: "Inspection team capacity limited. Prioritised centres with reported concerns.",
        lessonsLearned: "Self-assessment checklist complements external inspections. Community feedback valuable.",
        nextSteps: "Address minor issues identified in 7 centres. Schedule remaining 30 centre inspections.",
        status: "ACCEPTED",
      },
      {
        reportingPeriodId: q2PeriodId,
        activityTitle: "Remedial Support Sessions for Struggling Students",
        activityDate: new Date("2026-06-01"),
        location: "All 75 Learning Centres",
        participantsTotal: 1860,
        participantsMale: 930,
        participantsFemale: 930,
        summary: "Implemented targeted remedial support sessions for 1,860 students identified as struggling in midline assessments.",
        achievements: "30% of remedial students showed improvement after 4 weeks of targeted support.",
        challenges: "Teachers had limited time for individual support. Mobilised volunteer tutors.",
        lessonsLearned: "Early identification and intervention is critical. Small group support more effective than individual.",
        nextSteps: "Continue remedial support through Q3. Develop peer tutoring programme.",
        status: "ACCEPTED",
      },
    ];

    for (const activity of activities) {
      await prisma.$executeRaw`
        INSERT INTO "ActivityUpdate" (
          id, "tenantId", "projectId", "reportingPeriodId", "activityTitle", "activityDate",
          location, "participantsTotal", "participantsMale", "participantsFemale",
          summary, achievements, challenges, "lessonsLearned", "nextSteps",
          status, "submittedById", "createdAt", "updatedAt"
        ) VALUES (
          ${randomUUID()},
          ${TENANT_ID},
          ${PROJECT_ID},
          ${activity.reportingPeriodId},
          ${activity.activityTitle},
          ${activity.activityDate},
          ${activity.location},
          ${activity.participantsTotal},
          ${activity.participantsMale},
          ${activity.participantsFemale},
          ${activity.summary},
          ${activity.achievements},
          ${activity.challenges},
          ${activity.lessonsLearned},
          ${activity.nextSteps},
          ${activity.status},
          'system',
          NOW(),
          NOW()
        )
      `;
    }
    console.log(`Created ${activities.length} Activity updates`);
  }

  await linkEvidenceToActivitiesAndUpdates();

  console.log("\n✅ Evidence and Activities seeded successfully!");
}

/**
 * Links evidence files to activity updates and indicator updates by title
 * keywords, so AI report generation actually sees the evidence (without the
 * link, the evidence packages the narrator receives are empty).
 */
async function linkEvidenceToActivitiesAndUpdates(): Promise<void> {
  const evidenceRows = await prisma.$queryRaw<Array<{ id: string; title: string }>>`
    SELECT id, title FROM "EvidenceFile" WHERE "projectId" = ${PROJECT_ID}
  `;
  const evidence = new Map<string, string>(evidenceRows.map((e) => [e.id, e.title.toLowerCase()]));

  const activities = await prisma.$queryRaw<Array<{ id: string; activityTitle: string }>>`
    SELECT id, "activityTitle" FROM "ActivityUpdate" WHERE "projectId" = ${PROJECT_ID}
  `;

  const indicatorRows = await prisma.$queryRaw<Array<{ id: string; code: string }>>`
    SELECT id, code FROM "Indicator" WHERE "projectId" = ${PROJECT_ID}
  `;
  const codeById = new Map(indicatorRows.map((r) => [r.id, r.code]));
  const updates = await prisma.$queryRaw<Array<{ id: string; indicatorId: string }>>`
    SELECT id, "indicatorId" FROM "IndicatorUpdate"
    WHERE "indicatorId" IN (SELECT id FROM "Indicator" WHERE "projectId" = ${PROJECT_ID})
  `;

  const ACTIVITY_MAP: Array<{ match: string[]; substrings: string[] }> = [
    { match: ["teacher training"], substrings: ["teacher training attendance"] },
    { match: ["learning centre", "establishment"], substrings: ["learning centre establishment photos", "learning centre inspection"] },
    { match: ["learning centre", "expansion"], substrings: ["learning centre photos", "learning centre inspection"] },
    { match: ["distribution", "kit", "material"], substrings: ["learning materials distribution"] },
    { match: ["baseline", "assessment"], substrings: ["baseline learning assessment"] },
    { match: ["midline", "assessment"], substrings: ["midline learning assessment"] },
    { match: ["safeguarding", "protection", "referral"], substrings: ["child safeguarding training", "child protection referral"] },
    { match: ["volunteer"], substrings: ["community volunteer training"] },
    { match: ["enrolment", "mobilisation", "campaign"], substrings: ["enrolment campaign photos", "beneficiary list"] },
    { match: ["numeracy"], substrings: ["numeracy flashcard"] },
    { match: ["inspection"], substrings: ["learning centre inspection"] },
    { match: ["remedial", "support"], substrings: ["midline learning assessment", "baseline learning assessment"] },
  ];
  const INDICATOR_MAP: Array<{ code: string; substrings: string[] }> = [
    { code: "OUT-1", substrings: ["learning centre establishment photos", "learning centre inspection"] },
    { code: "OUT-2", substrings: ["learning materials distribution"] },
    { code: "OUT-3", substrings: ["teacher training attendance"] },
    { code: "OUT-4", substrings: ["beneficiary list", "enrolment campaign"] },
    { code: "OUT-5", substrings: ["beneficiary list", "attendance"] },
    { code: "OUT-6", substrings: ["baseline learning assessment", "midline learning assessment"] },
    { code: "OUT-7", substrings: ["baseline learning assessment", "midline learning assessment"] },
    { code: "OUT-8", substrings: ["numeracy flashcard", "baseline learning assessment", "midline learning assessment"] },
    { code: "OUT-9", substrings: ["numeracy flashcard", "midline learning assessment"] },
    { code: "OUT-10", substrings: ["teacher training attendance"] },
    { code: "OUT-11", substrings: ["child safeguarding training"] },
    { code: "OUT-12", substrings: ["community volunteer training"] },
    { code: "OUT-13", substrings: ["beneficiary list", "enrolment campaign"] },
    { code: "OUT-14", substrings: ["beneficiary list", "attendance"] },
    { code: "OUT-15", substrings: ["attendance"] },
    { code: "OUT-16", substrings: ["baseline learning assessment", "midline learning assessment"] },
    { code: "OUT-17", substrings: ["numeracy flashcard", "midline learning assessment"] },
    { code: "OUT-18", substrings: ["child safeguarding training", "child protection referral"] },
    { code: "OUT-19", substrings: ["child protection referral"] },
    { code: "OUT-20", substrings: ["beneficiary list", "community volunteer"] },
  ];

  const match = (title: string, entries: Array<{ code?: string; match?: string[]; substrings: string[] }>, mode: "code" | "activity"): string[] => {
    const t = title.toLowerCase();
    const hits: string[] = [];
    for (const e of entries) {
      const selected = mode === "code" ? e.code === t : e.match?.some((m) => t.includes(m));
      if (!selected) continue;
      for (const [id, evTitle] of evidence) {
        if (e.substrings.some((s) => evTitle.includes(s))) hits.push(id);
      }
    }
    return [...new Set(hits)].slice(0, 2);
  };

  let a = 0;
  for (const act of activities) {
    const ids = match(act.activityTitle, ACTIVITY_MAP, "activity");
    if (ids.length > 0) {
      await prisma.$executeRaw`
        UPDATE "ActivityUpdate" SET "attachedEvidenceIds" = ${JSON.stringify(ids)}::text, "updatedAt" = NOW() WHERE id = ${act.id}
      `;
      a += 1;
    }
  }
  let u = 0;
  for (const upd of updates) {
    const code = codeById.get(upd.indicatorId) ?? "";
    const ids = match(code, INDICATOR_MAP, "code");
    if (ids.length > 0) {
      await prisma.$executeRaw`
        UPDATE "IndicatorUpdate" SET "attachedEvidenceIds" = ${JSON.stringify(ids)}::text, "updatedAt" = NOW() WHERE id = ${upd.id}
      `;
      u += 1;
    }
  }
  console.log(`Linked evidence to ${a} activities and ${u} indicator updates.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });