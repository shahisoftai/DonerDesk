import { z } from "zod";

export const ProjectListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  projectCode: z.string(),
  donorName: z.string(),
  country: z.string(),
  sector: z.string().optional(),
  status: z.string(),
  reportingFrequency: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  daysRemaining: z.number(),
});

export const ProjectsResponseSchema = z.object({ items: z.array(ProjectListItemSchema) });
export type ProjectListItem = z.infer<typeof ProjectListItemSchema>;

export const ProjectDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  projectCode: z.string(),
  donorName: z.string(),
  implementingOrganization: z.string().optional(),
  partnerOrganization: z.string().optional(),
  country: z.string(),
  region: z.string().optional(),
  district: z.string().optional(),
  sector: z.string(),
  status: z.string(),
  reportingFrequency: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  daysRemaining: z.number(),
  budget: z.object({ amount: z.number().optional(), currency: z.string().optional() }).optional(),
  description: z.string().optional(),
  primaryContactName: z.string().optional(),
  projectManagerId: z.string().optional(),
  meOfficerId: z.string().optional(),
  reportingOfficerId: z.string().optional(),
  workspaceRootId: z.string().optional(),
});
export type ProjectDetail = z.infer<typeof ProjectDetailSchema>;

export const ProjectMemberSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  userId: z.string(),
  role: z.string(),
  status: z.string(),
  assignedById: z.string(),
  assignedAt: z.string(),
});
export type ProjectMember = z.infer<typeof ProjectMemberSchema>;

export const ProjectMembersResponseSchema = z.object({ items: z.array(ProjectMemberSchema) });

export const OrganizationSchema = z.object({
  id: z.string().optional(),
  name: z.string().default(""),
  aiEnabled: z.boolean().optional(),
  storageProvider: z.string().default("LOCAL"),
});

export const OrganizationReportingDefaultsSchema = z
  .object({
    tone: z.enum(["FORMAL", "CONCISE", "NARRATIVE", "TECHNICAL"]).default("FORMAL"),
    formattingRules: z.array(z.string()).default([]),
    deadlineOffsetDays: z.number().optional(),
    autoPeriodCreation: z.boolean().default(false),
  })
  .partial();
export type OrganizationReportingDefaults = z.infer<typeof OrganizationReportingDefaultsSchema>;

export const OrganizationProfileSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  organizationType: z.string(),
  country: z.string(),
  sectors: z.array(z.string()).optional(),
  contactName: z.string(),
  contactEmail: z.string(),
  website: z.string().optional(),
  defaultLanguage: z.string(),
  logoUrl: z.string().optional(),
  mainOfficeLocation: z.string().optional(),
  donorTypesServed: z.string().optional(),
  dataResidency: z.string(),
  aiEnabled: z.boolean().optional(),
  storageProvider: z.string().optional(),
  reportingDefaults: OrganizationReportingDefaultsSchema.optional(),
});
export type OrganizationProfile = z.infer<typeof OrganizationProfileSchema>;

export const LegalConsentSchema = z.object({
  accepted: z.boolean(),
  termsVersion: z.string(),
  privacyVersion: z.string(),
  acceptedAt: z.string().optional(),
  actorId: z.string().optional(),
  source: z.string().optional(),
});
export type LegalConsent = z.infer<typeof LegalConsentSchema>;

export const AuditLogSchema = z.object({
  id: z.string(),
  actorId: z.string(),
  eventType: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  projectId: z.string().optional(),
  oldValue: z.string().optional(),
  newValue: z.string().optional(),
  ipAddress: z.string().optional(),
  systemNote: z.string().optional(),
  prevHash: z.string().optional(),
  hash: z.string().optional(),
  createdAt: z.string(),
});

export const AuditLogResponseSchema = z.object({ items: z.array(AuditLogSchema) });
export type AuditLog = z.infer<typeof AuditLogSchema>;

export const NotificationItemSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  title: z.string().default(""),
  message: z.string().default(""),
  read: z.boolean().default(false),
  createdAt: z.string().optional(),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.string().optional(),
});

export const NotificationsResponseSchema = z.object({ items: z.array(NotificationItemSchema) });

export const TeamMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  status: z.string(),
});

export const TeamResponseSchema = z.object({ items: z.array(TeamMemberSchema) });

export const TemplateSectionSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  description: z.string().default(""),
  inputType: z.string(),
  required: z.boolean().default(true),
  evidenceNeeded: z.string().default(""),
  reviewStatus: z.enum(["DRAFT", "REVIEWED"]).default("DRAFT"),
  minWords: z.number().int().optional(),
  maxWords: z.number().int().optional(),
});

export const TemplateListItemSchema = z.object({
  id: z.string(),
  templateName: z.string(),
  donorName: z.string(),
  reportType: z.string(),
  language: z.string().optional(),
  version: z.number().optional(),
  sections: z.array(TemplateSectionSchema).default([]),
});

export const TemplatesResponseSchema = z.object({ items: z.array(TemplateListItemSchema) });

export const LogframeItemSchema = z.object({
  id: z.string(),
  level: z.string(),
  parentId: z.string().nullable().optional(),
  code: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
});

export const IndicatorItemSchema = z.object({
  id: z.string(),
  logframeItemId: z.string().optional(),
  code: z.string(),
  name: z.string(),
  type: z.string().optional(),
  baseline: z.string(),
  target: z.string(),
  unit: z.string().optional(),
  meansOfVerification: z.string().optional(),
  dataSource: z.string().optional(),
  frequency: z.string().optional(),
  disaggregationRequired: z.boolean().optional(),
});

export const IndicatorUpdateItemSchema = z.object({
  id: z.string(),
  indicatorId: z.string(),
  reportingPeriodId: z.string(),
  periodAchievement: z.string().default(""),
  cumulativeAchievement: z.string().default(""),
  status: z.string().optional(),
});

export const LogframeResponseSchema = z.object({
  items: z.array(LogframeItemSchema),
  indicators: z.array(IndicatorItemSchema),
});

export const PeriodIndicatorUpdateSchema = z.object({
  id: z.string(),
  periodAchievement: z.string(),
  cumulativeAchievement: z.string(),
  comments: z.string().optional(),
  dataSource: z.string().optional(),
  verificationStatus: z.string(),
  verifiedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PeriodIndicatorRowSchema = z.object({
  id: z.string(),
  logframeItemId: z.string(),
  code: z.string(),
  name: z.string(),
  type: z.string(),
  baseline: z.string(),
  target: z.string(),
  unit: z.string().optional(),
  dataSource: z.string().optional(),
  frequency: z.string().optional(),
  disaggregationRequired: z.boolean(),
  logframeLevel: z.string().nullable(),
  logframeCode: z.string().nullable(),
  logframeTitle: z.string().nullable(),
  update: PeriodIndicatorUpdateSchema.nullable(),
});
export type PeriodIndicatorRow = z.infer<typeof PeriodIndicatorRowSchema>;

export const PeriodIndicatorsResponseSchema = z.object({
  periodId: z.string(),
  projectId: z.string(),
  indicators: z.array(PeriodIndicatorRowSchema),
});

export const ParsedIndicatorRowSchema = z.object({
  indicatorId: z.string().nullable(),
  code: z.string(),
  name: z.string().nullable(),
  periodAchievement: z.string(),
  cumulativeAchievement: z.string(),
  comments: z.string(),
  dataSource: z.string(),
  matched: z.boolean(),
});

export const ParseIndicatorSheetResponseSchema = z.object({
  rows: z.array(ParsedIndicatorRowSchema),
  warnings: z.array(z.string()),
});

export const BulkUpsertResponseSchema = z.object({
  saved: z.number(),
  skipped: z.number(),
});

export const ActivityItemSchema = z.object({
  id: z.string(),
  activityTitle: z.string(),
  activityDate: z.string(),
  location: z.string().optional(),
  participantsTotal: z.number().optional(),
  status: z.string(),
});

export const ActivitiesResponseSchema = z.object({ items: z.array(ActivityItemSchema) });

export const ActivityDetailSchema = z.object({
  id: z.string(),
  reportingPeriodId: z.string(),
  projectId: z.string(),
  activityTitle: z.string(),
  activityDate: z.string(),
  location: z.string().optional(),
  outputId: z.string().optional(),
  indicatorId: z.string().optional(),
  participantsTotal: z.number().optional(),
  participantsMale: z.number().optional(),
  participantsFemale: z.number().optional(),
  participantsChildren: z.number().optional(),
  participantsDisability: z.number().optional(),
  participantsOther: z.string().optional(),
  summary: z.string(),
  achievements: z.string().optional(),
  challenges: z.string().optional(),
  lessonsLearned: z.string().optional(),
  nextSteps: z.string().optional(),
  polishedNarrative: z.string().optional(),
  attachedEvidenceIds: z.array(z.string()).optional(),
  status: z.string(),
  submittedById: z.string().optional(),
  createdAt: z.string().optional(),
});
export type ActivityDetail = z.infer<typeof ActivityDetailSchema>;

export const EvidenceItemSchema = z.object({
  id: z.string(),
  projectId: z.string().optional(),
  fileName: z.string(),
  title: z.string(),
  evidenceType: z.string(),
  verificationStatus: z.string(),
  confidentialityLevel: z.string(),
  aiSuggestedTags: z
    .array(
      z.object({
        field: z.string(),
        value: z.string(),
        confidence: z.string().optional(),
        accepted: z.boolean().default(false),
      }),
    )
    .default([]),
});

export const EvidenceDetailSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  reportingPeriodId: z.string().optional(),
  activityId: z.string().optional(),
  indicatorId: z.string().optional(),
  fileName: z.string(),
  title: z.string(),
  fileUrl: z.string(),
  fileType: z.string(),
  fileSize: z.number(),
  storageProvider: z.string().default("LOCAL"),
  driveWebLink: z.string().optional(),
  evidenceType: z.string(),
  location: z.string().optional(),
  activityDate: z.string().optional(),
  uploadedById: z.string().optional(),
  verificationStatus: z.string(),
  confidentialityLevel: z.string(),
  notes: z.string().optional(),
  aiSummary: z.string().optional(),
  aiSuggestedTags: z
    .array(
      z.object({
        field: z.string(),
        value: z.string(),
        confidence: z.string().optional(),
        accepted: z.boolean().optional(),
      }),
    )
    .optional(),
  sensitivityWarning: z.string().optional(),
});
export type EvidenceDetail = z.infer<typeof EvidenceDetailSchema>;

export const EvidenceResponseSchema = z.object({
  items: z.array(EvidenceItemSchema),
  total: z.number(),
});

export const ReportingPeriodItemSchema = z.object({
  id: z.string(),
  reportType: z.string(),
  status: z.string(),
  readinessScore: z.number(),
  deadline: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  internalReviewDeadline: z.string().nullable().optional(),
  daysUntilDeadline: z.number(),
  donorTemplateId: z.string().nullish(),
});

export const ReportingPeriodsResponseSchema = z.object({ items: z.array(ReportingPeriodItemSchema) });

export const ReportSectionSchema = z.object({
  id: z.string(),
  sectionTitle: z.string(),
  sectionOrder: z.number(),
  content: z.string().optional(),
  sourceReferences: z
    .array(z.object({ type: z.string(), id: z.string(), label: z.string().optional() }))
    .optional(),
  unsupportedClaims: z.array(z.string()).optional(),
  status: z.string(),
  updatedAt: z.string(),
});
export type ReportSection = z.infer<typeof ReportSectionSchema>;

export const ReportDraftSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  version: z.number(),
  generatedByAi: z.boolean().optional(),
  createdById: z.string().optional(),
  approvedById: z.string().optional(),
  approvedAt: z.string().optional(),
});
export type ReportDraft = z.infer<typeof ReportDraftSchema>;

export const ReportDraftResponseSchema = z.object({
  draft: ReportDraftSchema.nullable(),
  sections: z.array(ReportSectionSchema).optional(),
});

export const UpdateSectionResponseSchema = z.object({ version: z.string() });

export const ReadinessSchema = z.object({
  overall: z.number(),
  sectionsScore: z.number(),
  indicatorsScore: z.number(),
  evidenceScore: z.number(),
  checklistScore: z.number(),
  approvalScore: z.number(),
});

export const ChecklistItemSchema = z.object({
  id: z.string(),
  reportingPeriodId: z.string().optional(),
  type: z.string(),
  title: z.string(),
  description: z.string().optional(),
  severity: z.string(),
  status: z.string(),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  resolutionNotes: z.string().nullable().optional(),
});

export const ChecklistResponseSchema = z.object({ items: z.array(ChecklistItemSchema) });

export const ExportItemSchema = z.object({
  id: z.string(),
  exportType: z.string(),
  fileUrl: z.string(),
  version: z.number().optional(),
  exportedById: z.string().optional(),
  includedFiles: z.array(z.string()).optional(),
  createdAt: z.string(),
});

export const ExportsResponseSchema = z.object({ items: z.array(ExportItemSchema) });

export const ExportPreflightEvidenceSchema = z.object({
  id: z.string(),
  title: z.string(),
  confidentialityLevel: z.string(),
  verificationStatus: z.string(),
  defaultIncluded: z.boolean(),
});

export const ExportPreflightSchema = z.object({
  draft: z
    .object({
      id: z.string(),
      title: z.string(),
      status: z.string(),
      version: z.number(),
      generatedByAi: z.boolean().optional(),
    })
    .nullable(),
  exportTypes: z.array(z.string()),
  blocking: z.array(z.object({ code: z.string(), message: z.string() })),
  warnings: z.array(z.object({ code: z.string(), message: z.string(), overridable: z.boolean() })),
  evidence: z.array(ExportPreflightEvidenceSchema),
  sensitiveCount: z.number(),
  annexGapCount: z.number(),
  unverifiedIndicatorCount: z.number(),
});
export type ExportPreflight = z.infer<typeof ExportPreflightSchema>;

export const CommentItemSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  commentText: z.string(),
  authorId: z.string().optional(),
  mentionedUserId: z.string().optional(),
  status: z.string().default("OPEN"),
  createdAt: z.string().optional(),
});

export const CommentsResponseSchema = z.object({ items: z.array(CommentItemSchema) });

// Feature 18: project setup checklist read model.
export const SetupBlockerSchema = z.object({
  code: z.string(),
  label: z.string(),
  href: z.string().optional(),
  retryable: z.boolean().optional(),
});

export const ProjectReadinessSchema = z.object({
  ready: z.boolean(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "READY", "ACTION_REQUIRED"]),
  blockers: z.array(SetupBlockerSchema),
  nextAction: SetupBlockerSchema.optional(),
});

export type ProjectReadiness = z.infer<typeof ProjectReadinessSchema>;

export const ProjectReadinessSnapshotSchema = z.object({
  workspace: z.object({
    provisionStatus: z.string(),
    provisionError: z.string().optional(),
    deepLink: z.string().optional(),
    rootId: z.string().optional(),
  }),
  profile: z.object({
    exists: z.boolean(),
    version: z.number().optional(),
    defaultTemplateId: z.string().optional(),
    language: z.string().optional(),
    tone: z.string().optional(),
  }),
  template: z.object({
    exists: z.boolean(),
    id: z.string().optional(),
    name: z.string().optional(),
    reviewedRequiredSectionCount: z.number(),
  }),
  indicators: z.object({
    total: z.number(),
    reportable: z.number(),
    incomplete: z.number(),
  }),
  team: z.object({
    assigned: z.boolean(),
    memberCount: z.number(),
  }),
  acknowledgedAt: z.string().optional(),
  acknowledgedById: z.string().optional(),
});

export type ProjectReadinessSnapshot = z.infer<typeof ProjectReadinessSnapshotSchema>;

export const ProjectSetupResponseSchema = z.object({
  readiness: ProjectReadinessSchema,
  snapshot: ProjectReadinessSnapshotSchema,
  provisionStatus: z.string(),
  acknowledged: z.boolean(),
});
export type ProjectSetupResponse = z.infer<typeof ProjectSetupResponseSchema>;

export const ReportingProfileSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  projectId: z.string(),
  defaultTemplateId: z.string().optional(),
  language: z.string(),
  tone: z.string(),
  writingStyle: z.string().nullable().optional(),
  audienceNotes: z.string().nullable().optional(),
  formattingRules: z.array(z.string()).default([]),
  specialRequirements: z.array(z.string()).default([]),
  sectionOverrides: z.record(z.object({ min: z.number().optional(), max: z.number().optional() })).default({}),
  deadlineOffsetDays: z.number().nullable().optional(),
  autoPeriodCreation: z.boolean().default(false),
  version: z.number(),
  createdAt: z.string(),
});
export type ReportingProfile = z.infer<typeof ReportingProfileSchema>;

export const ReportingProfileResponseSchema = z.object({
  profile: ReportingProfileSchema.nullable(),
});
