import { z } from "zod";
import { DisaggregationEntrySchema } from "@donordesk/contracts";

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
  isDemo: z.boolean().optional(),
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
  isDemo: z.boolean().optional(),
  /** Admin setting: false hides the work plan screens (the data is kept). */
  showWorkPlanning: z.boolean().optional(),
  /** Optional IANA zone for this project's own "today"; absent means the organisation's. */
  timeZone: z.string().optional(),
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
  timeZone: z.string().optional(),
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
  timeZone: z.string().optional(),
  logoUrl: z.string().optional(),
  mainOfficeLocation: z.string().optional(),
  donorTypesServed: z.string().optional(),
  dataResidency: z.string(),
  aiEnabled: z.boolean().optional(),
  storageProvider: z.string().optional(),
  reportingDefaults: OrganizationReportingDefaultsSchema.optional(),
  /** Agent Memory (Phase 21) tenant self-service toggle. */
  agentMemoryEnabled: z.boolean().optional(),
  /** Platform-wide rollout flag; the Settings tab is hidden entirely when false. */
  agentMemoryPlatformEnabled: z.boolean().optional(),
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
  external: z.boolean().default(false),
  mfaEnabled: z.boolean().default(false),
});

export const TeamResponseSchema = z.object({ items: z.array(TeamMemberSchema) });

export const PendingInvitationSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
  invitedAt: z.string(),
  expiresAt: z.string(),
  expired: z.boolean(),
  acceptPath: z.string(),
});
export type PendingInvitation = z.infer<typeof PendingInvitationSchema>;
export const PendingInvitationsResponseSchema = z.object({ items: z.array(PendingInvitationSchema) });

const SourceRefSchema = z.object({ excerpt: z.string(), page: z.number().optional(), headingPath: z.array(z.string()).optional() });

export const TemplateSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(""),
  inputType: z.enum(["NARRATIVE", "TABLE", "CHART", "ANNEX", "INDICATOR_TABLE", "COMPLIANCE"]).catch("NARRATIVE"),
  required: z.boolean().default(true),
  evidenceNeeded: z
    .union([z.string(), z.array(z.string())])
    .default([])
    .transform((v) => (typeof v === "string" ? v.split(/[;\n]+/).map((x) => x.trim()).filter(Boolean) : v)),
  relatedLogframeElement: z.string().optional(),
  reviewStatus: z.enum(["DRAFT", "REVIEWED"]).default("DRAFT"),
  minWords: z.number().int().optional(),
  maxWords: z.number().int().optional(),
  pageLimit: z.number().int().optional(),
  parentId: z.string().optional(),
  level: z.number().int().default(1),
  numbering: z.string().optional(),
  instructions: z.string().optional(),
  mandatoryQuestions: z.array(z.string()).default([]),
  requiredTables: z.array(z.object({ title: z.string(), columns: z.array(z.string()).default([]), notes: z.string().optional() })).default([]),
  authorInstructions: z.string().optional(),
  includeInReport: z.boolean().default(true),
  source: SourceRefSchema.optional(),
  confidence: z.number().optional(),
});
export type TemplateSectionView = z.infer<typeof TemplateSectionSchema>;

export const TemplateRequirementsSchema = z.object({
  reportTitle: z.string().optional(),
  reportingFrequency: z.string().optional(),
  submission: z.object({ instructions: z.array(z.string()).default([]), deadlineRule: z.string().optional(), deadlineOffsetDays: z.number().optional(), channel: z.string().optional(), format: z.string().optional() }).default({}),
  formatting: z.object({ rules: z.array(z.string()).default([]), maxPages: z.number().optional(), font: z.string().optional() }).default({}),
  annexes: z.array(z.object({ id: z.string().optional(), name: z.string(), required: z.boolean().default(true), description: z.string().optional(), source: SourceRefSchema.optional() })).default([]),
  indicatorRequirements: z.array(z.object({ id: z.string().optional(), text: z.string(), disaggregation: z.array(z.string()).default([]), source: SourceRefSchema.optional() })).default([]),
  compliance: z.array(z.object({ id: z.string().optional(), text: z.string(), severity: z.enum(["INFO", "WARN", "BLOCK"]).default("WARN"), source: SourceRefSchema.optional() })).default([]),
  generalInstructions: z.array(z.string()).default([]),
});
export type TemplateRequirementsView = z.infer<typeof TemplateRequirementsSchema>;

export const TemplateStatusSchema = z.enum(["EXTRACTING", "NEEDS_REVIEW", "REVIEWED", "EXTRACTION_FAILED"]).catch("REVIEWED");
export type TemplateStatus = z.infer<typeof TemplateStatusSchema>;

export const ExtractionMetaSchema = z.object({
  method: z.enum(["LLM", "HEURISTIC", "CANONICAL", "MANUAL"]).catch("HEURISTIC"),
  model: z.string().optional(),
  promptVersion: z.string().optional(),
  warnings: z.array(z.string()).default([]),
  extractedAt: z.string().optional(),
  durationMs: z.number().optional(),
});

export const TemplateListItemSchema = z.object({
  id: z.string(),
  projectId: z.string().optional(),
  templateName: z.string(),
  donorName: z.string(),
  reportType: z.string(),
  language: z.string().optional(),
  notes: z.string().optional(),
  version: z.number().optional(),
  status: TemplateStatusSchema.default("REVIEWED"),
  sections: z.array(TemplateSectionSchema).default([]),
  requirements: TemplateRequirementsSchema.default({}),
  requiredAnnexes: z.array(z.string()).default([]),
  extractionMeta: ExtractionMetaSchema.optional(),
  originalFile: z.object({ name: z.string().optional(), mimeType: z.string().optional(), available: z.boolean() }).optional(),
  hasExtractedText: z.boolean().default(false),
  isLibrary: z.boolean().default(false),
  sourceTemplateId: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type TemplateListItem = z.infer<typeof TemplateListItemSchema>;

export const TemplateDetailSchema = TemplateListItemSchema.extend({
  extractedRawText: z.string().optional(),
  versions: z.array(z.object({ version: z.number(), createdAt: z.string(), createdById: z.string(), changeNote: z.string().optional() })).default([]),
});
export type TemplateDetail = z.infer<typeof TemplateDetailSchema>;

export const TemplateVersionSnapshotSchema = z.object({
  version: z.number(),
  sections: z.array(TemplateSectionSchema),
  requirements: TemplateRequirementsSchema,
});

export const TemplateBriefPreviewSchema = z.object({
  version: z.number(),
  template: z.string(),
  sections: z.array(z.object({ templateSectionId: z.string(), title: z.string(), brief: z.string() })),
});

export const ParsedTemplateFileSchema = z.object({
  text: z.string(),
  fileKey: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  format: z.string(),
  headingCount: z.number(),
  tableCount: z.number(),
  pageCount: z.number().optional(),
});

export const DefaultTemplatesResponseSchema = z.object({
  types: z.record(
    z.string(),
    z.object({ source: z.string(), templateId: z.string().optional(), templateName: z.string().optional(), status: z.string().optional() }),
  ),
});

export const TemplatesResponseSchema = z.object({ items: z.array(TemplateListItemSchema) });

export const TemplateRegionSchema = z.object({
  id: z.string(),
  kind: z.enum(["HEADING", "TABLE"]),
  level: z.number().int().optional(),
  text: z.string(),
  order: z.number().int(),
});

export const DetectTemplateRegionsResponseSchema = z.object({
  mappingId: z.string(),
  version: z.number().int(),
  regions: z.array(TemplateRegionSchema),
  autoMappedCount: z.number().int(),
  unmappedCount: z.number().int(),
  warnings: z.array(z.string()),
});

export const TemplateRegionMappingSchema = z.object({
  regionId: z.string(),
  templateSectionId: z.string(),
  placeholderKey: z.string(),
  mappedBy: z.enum(["AUTO", "MANUAL"]),
  status: z.enum(["DRAFT", "REVIEWED", "APPROVED"]),
});

export const DonorTemplateMappingDtoSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  version: z.number().int(),
  regions: z.array(TemplateRegionMappingSchema),
  detectedRegions: z.array(TemplateRegionSchema),
  approvedById: z.string().nullable(),
  approvedAt: z.string().nullable(),
  templatedFileUrl: z.string().nullable(),
});

export const LogframeItemSchema = z.object({
  id: z.string(),
  level: z.string(),
  parentId: z.string().nullable().optional(),
  code: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
  /** ACTIVITY nodes only: what recorded activities have delivered against this node. */
  delivery: z
    .object({ recordedCount: z.number(), acceptedCount: z.number(), lastActivityDate: z.string().nullable(), participantsTotal: z.number() })
    .optional(),
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
  responsibleUserId: z.string().nullish(),
  disaggregationRequired: z.boolean().optional(),
  /** Targets per breakdown category (phase 28.1-B). */
  targetBreakdowns: z.array(z.object({ dimension: z.string(), category: z.string(), value: z.string() })).default([]),
  /** The cumulative target due by each date; empty = the project target applies. */
  targetSchedule: z.array(z.object({ asOf: z.string(), target: z.string() })).default([]),
  /** Counted by another project too: left out of the portfolio totals. */
  countedElsewhere: z.boolean().default(false),
  semantics: z
    .object({
      aggregation: z.string(),
      direction: z.string(),
      reportingBasis: z.string(),
      numeratorIndicatorId: z.string().optional(),
      denominatorIndicatorId: z.string().optional(),
      status: z.string(),
    })
    .nullish(),
  /** How the report treats this indicator, in plain language (server-computed from the effective semantics). */
  semanticsDescription: z
    .object({ aggregationLabel: z.string(), evaluationLabel: z.string(), summary: z.string(), needsReview: z.boolean(), reasons: z.array(z.string()) })
    .optional(),
});

export const ArchivedIndicatorsResponseSchema = z.object({
  items: z.array(z.object({ id: z.string(), code: z.string(), name: z.string(), logframeItemId: z.string(), archivedAt: z.string() })),
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
  reviewNote: z.string().optional(),
  dataSource: z.string().optional(),
  verificationStatus: z.string(),
  verifiedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  attachedEvidenceIds: z.array(z.string()).optional(),
  disaggregation: z.array(DisaggregationEntrySchema).optional(),
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
  breakdownMustSum: z.boolean().optional(),
  requiresDenominator: z.boolean(),
  /** False when the indicator's frequency says no value is expected in this period (and none is recorded). */
  dueThisPeriod: z.boolean().optional(),
  /** When the value is due and who collects it. */
  collection: z.object({ dueBy: z.string(), state: z.enum(["RECORDED", "DUE", "OVERDUE", "NOT_DUE"]), ownerId: z.string().optional() }).optional(),
  participantsHint: z.string().optional(),
  aggregation: z.string().default("LATEST"),
  previous: z
    .object({ periodAchievement: z.string(), cumulativeAchievement: z.string(), dataSource: z.string().optional(), periodEnd: z.string() })
    .optional(),
  logframeLevel: z.string().nullable(),
  logframeCode: z.string().nullable(),
  logframeTitle: z.string().nullable(),
  update: PeriodIndicatorUpdateSchema.nullable(),
});
export type PeriodIndicatorRow = z.infer<typeof PeriodIndicatorRowSchema>;

export const PeriodIndicatorsResponseSchema = z.object({
  periodId: z.string(),
  projectId: z.string(),
  /** Rows are scoped to the report: an activity report lists its activities' indicators, a situation report none. */
  reportType: z.string().optional(),
  indicators: z.array(PeriodIndicatorRowSchema),
  scope: z.object({ activityCount: z.number(), acceptedActivityCount: z.number() }).optional(),
});

export const IndicatorUpdateHistoryRowSchema = PeriodIndicatorUpdateSchema.extend({
  reportingPeriodId: z.string(),
  periodReportType: z.string().nullable(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
});
export type IndicatorUpdateHistoryRow = z.infer<typeof IndicatorUpdateHistoryRowSchema>;

export const IndicatorUpdateHistoryResponseSchema = z.object({
  indicatorId: z.string(),
  projectId: z.string(),
  updates: z.array(IndicatorUpdateHistoryRowSchema),
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
  /** One entry per accepted row, so a caller can verify without a second lookup. */
  updates: z.array(z.object({ indicatorId: z.string(), updateId: z.string(), changed: z.boolean() })).default([]),
});

export const SemanticsDescriptionSchema = z.object({
  aggregationLabel: z.string(),
  evaluationLabel: z.string(),
  summary: z.string(),
  needsReview: z.boolean(),
  reasons: z.array(z.string()),
});

export const CreateIndicatorResponseSchema = z.object({
  id: z.string(),
  semanticsDescription: SemanticsDescriptionSchema.optional(),
});

export const ConfirmSemanticsResponseSchema = z.object({
  confirmed: z.array(z.string()),
  failed: z.array(z.object({ indicatorId: z.string(), code: z.string().optional(), message: z.string() })),
});

export const VerifyAllResponseSchema = z.object({
  verified: z.number(),
  failed: z.array(z.object({ updateId: z.string(), indicatorCode: z.string(), message: z.string() })),
});

export const ActivityItemSchema = z.object({
  id: z.string(),
  reportingPeriodId: z.string().optional(),
  supersededById: z.string().optional(),
  activityTitle: z.string(),
  activityDate: z.string(),
  activityEndDate: z.string().optional(),
  location: z.string().optional(),
  participantsTotal: z.number().optional(),
  logframeActivityId: z.string().optional(),
  status: z.string(),
  attachedEvidenceIds: z.array(z.string()).optional(),
});

export const ActivitiesResponseSchema = z.object({ items: z.array(ActivityItemSchema) });

export const ActivityDetailSchema = z.object({
  id: z.string(),
  reportingPeriodId: z.string(),
  projectId: z.string(),
  activityTitle: z.string(),
  activityDate: z.string(),
  activityEndDate: z.string().optional(),
  location: z.string().optional(),
  outputId: z.string().optional(),
  logframeActivityId: z.string().optional(),
  /** The planned activity this completed activity delivers. */
  plannedActivityId: z.string().optional(),
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
  supersededById: z.string().optional(),
  status: z.string(),
  submittedById: z.string().optional(),
  createdAt: z.string().optional(),
});
export type ActivityDetail = z.infer<typeof ActivityDetailSchema>;

export const EvidenceItemSchema = z.object({
  id: z.string(),
  projectId: z.string().optional(),
  reportingPeriodId: z.string().nullable().optional(),
  activityId: z.string().nullable().optional(),
  indicatorId: z.string().nullable().optional(),
  indicatorUpdateId: z.string().nullable().optional(),
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
  uploadedAt: z.string().optional(),
  uploadedById: z.string().optional(),
  verificationStatus: z.string(),
  confidentialityLevel: z.string(),
  notes: z.string().optional(),
  aiSummary: z.string().optional(),
  /** EXTRACTED, EMPTY, FAILED or UNSUPPORTED; absent while reading has not been attempted. */
  textExtractionStatus: z.string().optional(),
  textExtractionNote: z.string().optional(),
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
  /** Who is responsible for this report. */
  responsibleOfficerId: z.string().nullish(),
  /** A cancelled period keeps its data but is out of the calendar; it is listed apart so it can be restored. */
  /** An approved, exported or sent report exists: the period cannot be cancelled or converted. */
  releasedReport: z.boolean().optional(),
  cancelled: z.boolean().optional(),
  cancelledAt: z.string().nullish(),
  cancelReason: z.string().nullish(),
  /** Focus of an activity / situation / custom report; empty for cadence reports. */
  scope: z.object({
    activityIds: z.array(z.string()).optional(),
    eventName: z.string().optional(),
    location: z.string().optional(),
    situationDate: z.string().optional(),
    eventStartDate: z.string().optional(),
    summary: z.string().optional(),
    title: z.string().optional(),
    purpose: z.string().optional(),
    affectedPopulation: z.array(z.object({ group: z.string(), figure: z.string(), source: z.string().optional(), asOf: z.string().optional() })).optional(),
    needs: z.array(z.string()).optional(),
    sections: z.array(z.object({ title: z.string(), guidance: z.string().optional() })).optional(),
  }).optional(),
});

export const ReportingPeriodsResponseSchema = z.object({ items: z.array(ReportingPeriodItemSchema) });

const PlannedPeriodSchema = z.object({ startDate: z.string(), endDate: z.string() });
export const PeriodsPlanSchema = z.object({
  reportType: z.string().nullable(),
  plan: z.object({ periods: z.array(PlannedPeriodSchema), closing: PlannedPeriodSchema.nullable() }),
  note: z.string().optional(),
});
export const CreateAllPeriodsResponseSchema = z.object({
  created: z.array(z.object({ id: z.string(), startDate: z.string(), endDate: z.string() })),
  failed: z.array(z.object({ startDate: z.string(), endDate: z.string(), error: z.string() })),
});

export const EnsureAutoPeriodResponseSchema = z.object({ created: z.boolean(), periodId: z.string().optional() });

export const ChartConfigSchema = z.object({
  type: z.enum(["BAR", "LINE", "PIE", "AREA", "RADAR", "GAUGE"]),
  dataBinding: z.enum(["INDICATOR_PROGRESS", "INDICATOR_COMPARISON", "INDICATOR_ACHIEVEMENT", "STATUS_DISTRIBUTION"]),
  options: z.record(z.string(), z.unknown()).optional(),
});
export type ChartConfig = z.infer<typeof ChartConfigSchema>;

export const ReportSectionSchema = z.object({
  id: z.string(),
  sectionTitle: z.string(),
  sectionOrder: z.number(),
  /** 1 = section, 2-4 = sub-sections (absent on drafts from older APIs). */
  level: z.number().int().min(1).max(4).optional(),
  numbering: z.string().nullable().optional(),
  content: z.string().optional(),
  sourceReferences: z
    .array(z.object({ type: z.string(), id: z.string(), label: z.string().optional(), evidenceTitle: z.string().optional() }))
    .optional(),
  unsupportedClaims: z.array(z.string()).optional(),
  status: z.string(),
  chartConfig: ChartConfigSchema.nullable().optional(),
  updatedAt: z.string(),
  generatedWithAi: z.boolean().nullable().optional(),
  /** Why the text was not written by the AI (stored at generation time) and the action the banner offers. */
  generationFallback: z
    .object({ reason: z.string(), detail: z.string().nullable().optional(), action: z.enum(["RETRY", "RETRY_RECORDED_FIGURES_ONLY", "OPEN_SETTINGS"]) })
    .nullable()
    .optional(),
  /** Assurance of the section's current revision (CURRENT = checked and approvable). */
  assuranceState: z.string().nullable().optional(),
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
  createdAt: z.string().optional(),
});
export type ReportDraft = z.infer<typeof ReportDraftSchema>;

export const ReportClaimSourceSchema = z.object({
  evidenceId: z.string(),
  chunkId: z.string(),
  sourceText: z.string(),
  evidenceHash: z.string().optional(),
  evidenceUpdatedAt: z.string().optional(),
  chunkerVersion: z.string().optional(),
  /** Evidence file title (or "Restricted evidence"), never a raw id. */
  evidenceTitle: z.string().optional(),
});

export const ReportClaimSchema = z.object({
  id: z.string(),
  sectionId: z.string(),
  text: z.string(),
  type: z.string(),
  sources: z.array(ReportClaimSourceSchema).optional(),
  verificationResult: z.string(),
  verificationDetail: z.string(),
  verificationReasonCode: z.string().nullable().optional(),
  /** MATERIAL claims gate approval; NOT_MATERIAL ones never do. */
  materiality: z.string().nullable().optional(),
  /** "Your report is wrong" (REPORT_ERROR) vs "our checker could not confirm" (UNCONFIRMED); presentation only. */
  flagClass: z.enum(["REPORT_ERROR", "NEEDS_DECISION", "UNCONFIRMED"]).optional(),
  /** Span of the statement in the section markdown when it was checked. */
  charStart: z.number().int().nonnegative().nullable().optional(),
  charEnd: z.number().int().nonnegative().nullable().optional(),
  resolutionNotes: z.string().nullable().optional(),
  resolvedById: z.string().optional(),
  resolvedAt: z.string().optional(),
});
export type ReportClaim = z.infer<typeof ReportClaimSchema>;

/**
 * AI Reporter typed artifact (table, chart, list, key/value, Q&A, period
 * delta). Payload shapes are validated at the API boundary; the web renders
 * them defensively in `SectionArtifacts`.
 */
export const ReportArtifactSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(["TABLE", "CHART", "LIST", "KEY_VALUE", "QA", "DELTA"]),
  ordinal: z.number(),
  caption: z.string().nullable().optional(),
  payload: z.record(z.string(), z.unknown()),
});
export type ReportArtifact = z.infer<typeof ReportArtifactSchema>;

export const ReportDraftResponseSchema = z.object({
  draft: ReportDraftSchema.nullable(),
  sections: z.array(ReportSectionSchema).optional(),
  /** Typed artifacts keyed by section id. */
  artifacts: z.record(z.string(), z.array(ReportArtifactSchema)).optional(),
  claims: z.array(ReportClaimSchema).optional(),
  versions: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        status: z.string(),
        version: z.number(),
        generatedByAi: z.boolean().optional(),
        createdById: z.string().optional(),
        approvedById: z.string().optional(),
        approvedAt: z.string().nullable().optional(),
        supersededAt: z.string().nullable().optional(),
        createdAt: z.string(),
      }),
    )
    .optional(),
  /** Sections the AI is rewriting right now (single-section regenerate). */
  regeneratingSectionIds: z.array(z.string()).optional(),
  /** Executive summary / conclusion sections older than a substantial change elsewhere. */
  summaryStaleSectionIds: z.array(z.string()).optional(),
  /** Open comments per section id. */
  commentCounts: z.record(z.string(), z.number().int().nonnegative()).optional(),
  /** When and why the current draft was reopened after approval (shown until it is approved again). */
  reopened: z.object({ at: z.string(), byId: z.string(), reason: z.string(), previousStatus: z.string() }).nullable().optional(),
  /** Indicator values / evidence changed after this draft was written. */
  inputsChangedSince: z
    .object({ indicators: z.number().int().nonnegative(), evidence: z.number().int().nonnegative(), sectionIds: z.array(z.string()) })
    .nullable()
    .optional(),
});
export type ReportDraftResponse = z.infer<typeof ReportDraftResponseSchema>;

export const UpdateSectionResponseSchema = z.object({ version: z.string() });

export const ReadinessSchema = z.object({
  overall: z.number(),
  sectionsScore: z.number(),
  indicatorsScore: z.number(),
  evidenceScore: z.number(),
  checklistScore: z.number(),
  approvalScore: z.number(),
  qualityScore: z.number().optional(),
  dataQualityBlockers: z.number().optional(),
  dataQualityPenalty: z.number().optional(),
  stage: z.enum(["DRAFTING", "IN_REVIEW", "SUBMISSION"]).optional(),
  totalSections: z.number().optional(),
  /** What changed in the last day that moves this score, in words. */
  recentChanges: z.array(z.string()).optional(),
  topBlockers: z
    .array(z.object({ key: z.string(), label: z.string(), detail: z.string(), points: z.number(), action: z.object({ kind: z.string(), label: z.string() }) }))
    .optional(),
  weights: z
    .object({ sections: z.number(), indicators: z.number(), evidence: z.number(), checklist: z.number(), approval: z.number() })
    .optional(),
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
  reportingPeriodId: z.string().optional(),
  exportType: z.string(),
  fileUrl: z.string(),
  /** Readable download name (project, report kind, period, version); absent for old rows the API cannot name. */
  fileName: z.string().optional(),
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
  /** Bytes; absent from older API responses. */
  fileSize: z.number().optional(),
});

export const ExportPreflightItemSchema = z.object({
  id: z.string(),
  kind: z.string(),
  message: z.string(),
  claimId: z.string().optional(),
  sectionId: z.string().optional(),
  evidenceId: z.string().optional(),
  navigateTo: z.string().nullable(),
  resolution: z.enum(["ACCEPT_WITH_LIMITATION", "EXCLUDE", "NONE"]),
});
export type ExportPreflightItem = z.infer<typeof ExportPreflightItemSchema>;

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
  blockingItems: z.array(ExportPreflightItemSchema),
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
  warnings: z.array(z.object({ code: z.string(), label: z.string(), href: z.string().optional(), count: z.number() })).optional(),
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

// Project workspace (Google Drive / local mirror) file listing.
export const WorkspaceFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number().optional(),
  modifiedTime: z.string().optional(),
  webViewLink: z.string().optional(),
});
export type WorkspaceFile = z.infer<typeof WorkspaceFileSchema>;

export const WorkspaceFolderSchema = z.object({
  role: z.string(),
  label: z.string(),
  files: z.array(WorkspaceFileSchema),
});

export const WorkspaceFilesResponseSchema = z.object({
  folders: z.array(WorkspaceFolderSchema),
  deepLink: z.string().optional(),
});
export type WorkspaceFilesResponse = z.infer<typeof WorkspaceFilesResponseSchema>;

export const ImportedLogframeItemSchema = z.object({
  id: z.string(),
  level: z.string(),
  code: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  parentId: z.string().optional(),
});
export type ImportedLogframeItem = z.infer<typeof ImportedLogframeItemSchema>;

export const ImportLogframeResponseSchema = z.object({
  created: z.number(),
  skipped: z.number(),
  warnings: z.array(z.string()),
  items: z.array(ImportedLogframeItemSchema),
});
export type ImportLogframeResponse = z.infer<typeof ImportLogframeResponseSchema>;

export const ImportedIndicatorSchema = z.object({
  id: z.string(),
  logframeItemId: z.string(),
  code: z.string(),
  name: z.string(),
  type: z.string(),
  baseline: z.string(),
  target: z.string(),
  unit: z.string().optional(),
});

export const ImportIndicatorsResponseSchema = z.object({
  created: z.number(),
  skipped: z.number(),
  warnings: z.array(z.string()),
  items: z.array(ImportedIndicatorSchema),
});
export type ImportIndicatorsResponse = z.infer<typeof ImportIndicatorsResponseSchema>;

export const ImportedActivitySchema = z.object({
  id: z.string(),
  activityTitle: z.string(),
  activityDate: z.string(),
});

export const ImportActivitiesResponseSchema = z.object({
  created: z.number(),
  skipped: z.number(),
  warnings: z.array(z.string()),
  items: z.array(ImportedActivitySchema),
});
export type ImportActivitiesResponse = z.infer<typeof ImportActivitiesResponseSchema>;

export const ImportedEvidenceSchema = z.object({
  id: z.string(),
  title: z.string(),
  fileName: z.string(),
  fileUrl: z.string(),
  evidenceType: z.string(),
});

export const ImportEvidenceResponseSchema = z.object({
  created: z.number(),
  skipped: z.number(),
  warnings: z.array(z.string()),
  items: z.array(ImportedEvidenceSchema),
});
export type ImportEvidenceResponse = z.infer<typeof ImportEvidenceResponseSchema>;

export const DriveImportResponseSchema = z.union([
  z.object({ kind: z.literal("template"), id: z.string(), templateName: z.string() }),
  z.object({ kind: z.literal("data"), text: z.string(), name: z.string() }),
  z.object({
    kind: z.literal("logframe"),
    name: z.string(),
    created: z.number(),
    skipped: z.number(),
    warnings: z.array(z.string()),
    items: z.array(ImportedLogframeItemSchema),
  }),
]);
export type DriveImportResponse = z.infer<typeof DriveImportResponseSchema>;

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
  financeDataMode: z.enum(["DISABLED", "TYPED", "IMPORT"]).default("DISABLED"),
  /** The template explicitly made the default for each report type. */
  defaultTemplateByType: z.record(z.string()).default({}),
  requireSecondApprover: z.boolean().default(false),
  requireEvidenceForVerification: z.boolean().default(false),
  standingStatements: z.record(z.string()).default({}),
  version: z.number(),
  createdAt: z.string(),
});
export type ReportingProfile = z.infer<typeof ReportingProfileSchema>;

export const ReportingProfileResponseSchema = z.object({
  profile: ReportingProfileSchema.nullable(),
});

/** Files that support an activity or indicator, and the report statements citing each. */
export const EvidenceSupportResponseSchema = z.object({
  files: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      fileName: z.string(),
      verificationStatus: z.string(),
      attached: z.boolean(),
      citedBy: z.array(z.object({ claimId: z.string(), sectionId: z.string(), sectionTitle: z.string(), text: z.string() })),
    }),
  ),
});
export type EvidenceSupport = z.infer<typeof EvidenceSupportResponseSchema>;

/** The "what you can create" catalog for a project's reporting periods. */
export const PeriodOptionsResponseSchema = z.object({
  projectStatus: z.string(),
  types: z.array(
    z.object({
      type: z.string(),
      label: z.string(),
      what: z.string(),
      available: z.boolean(),
      why: z.string().optional(),
      nextAction: z.string().optional(),
      financeAvailable: z.boolean(),
      suggestedDates: z.object({ startDate: z.string(), endDate: z.string() }).optional(),
    }),
  ),
});

/** The guided path to a project's closing report. */
export const ClosingPlanSchema = z.object({
  canStart: z.boolean(),
  blockedReason: z.string().optional(),
  existingFinalId: z.string().optional(),
  suggestedPeriod: z.object({ startDate: z.string(), endDate: z.string() }).optional(),
  todoCount: z.number(),
  steps: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      status: z.string(),
      detail: z.string(),
      action: z.object({ kind: z.string(), label: z.string() }).optional(),
    }),
  ),
});
export type ClosingPlan = z.infer<typeof ClosingPlanSchema>;

/** An administrator's view of the AI writer's recent section runs. */
export const AiSectionRunsResponseSchema = z.object({
  counts: z.object({ WRITTEN: z.number(), RECOVERED: z.number(), STUB: z.number(), NO_INPUT: z.number() }),
  alert: z.object({ stubs: z.number(), runs: z.number(), reason: z.string() }).nullable().optional(),
  runs: z.array(
    z.object({
      id: z.string(),
      at: z.string(),
      sectionTitle: z.string().nullable(),
      outcome: z.enum(["WRITTEN", "RECOVERED", "STUB", "NO_INPUT"]),
      reason: z.string().nullable(),
      detail: z.string().nullable(),
      attempts: z.number(),
      latencyMs: z.number(),
      tokens: z.number(),
      costUsd: z.number().default(0),
    }),
  ),
  monthCostUsd: z.number().default(0),
});
export type AiSectionRunsResponse = z.infer<typeof AiSectionRunsResponseSchema>;

export const DataSheetResponseSchema = z.object({
  projectId: z.string(),
  financeEnabled: z.boolean(),
  periods: z.array(z.object({ id: z.string(), label: z.string(), start: z.string(), end: z.string(), reportType: z.string(), locked: z.boolean(), reportStatus: z.string().optional() })),
  indicators: z.array(
    z.object({
      id: z.string(),
      code: z.string(),
      name: z.string(),
      level: z.string().nullable(),
      type: z.string(),
      unit: z.string().nullish().transform((v) => v ?? undefined),
      baseline: z.string(),
      target: z.string(),
      isRate: z.boolean(),
      targetSchedule: z.array(z.object({ asOf: z.string(), target: z.string() })).optional(),
    }),
  ),
  cells: z.array(
    z.object({
      indicatorId: z.string(),
      periodId: z.string(),
      periodValue: z.string(),
      cumulativeValue: z.string(),
      dataSource: z.string().optional(),
      comments: z.string().optional(),
      status: z.string(),
    }),
  ),
  finance: z.array(
    z.object({
      periodId: z.string(),
      currency: z.string(),
      budget: z.string(),
      expenditure: z.string(),
      committed: z.string().optional(),
      balance: z.string(),
      burnRatePercent: z.string().optional(),
      verified: z.boolean(),
    }),
  ),
});
export type DataSheetResponse = z.infer<typeof DataSheetResponseSchema>;

export const DataSheetImportResponseSchema = z.object({
  saved: z.number(),
  preview: z.object({
    missingColumns: z.array(z.string()),
    changed: z.number(),
    unchanged: z.number(),
    skipped: z.number().default(0),
    errors: z.number(),
    rows: z.array(
      z.object({
        rowNumber: z.number(),
        indicatorCode: z.string(),
        periodLabel: z.string(),
        status: z.enum(["CHANGED", "UNCHANGED", "SKIPPED", "ERROR"]),
        error: z.string().optional(),
        periodValue: z.string().optional(),
        cumulativeValue: z.string().optional(),
        previousPeriodValue: z.string().optional(),
        previousCumulativeValue: z.string().optional(),
      }),
    ),
  }),
});
export type DataSheetImportResponse = z.infer<typeof DataSheetImportResponseSchema>;

export const SectionDataChartSchema = z.object({
  id: z.string(),
  caption: z.string(),
  title: z.string(),
  spec: z.object({
    template: z.enum(["INDICATOR_OVER_TIME", "INDICATOR_VS_TARGET", "INDICATORS_PROGRESS", "INDICATORS_OVER_TIME", "STATUS_DISTRIBUTION", "FINANCE_BUDGET_VS_SPEND", "FINANCE_BURN_RATE"]),
    indicatorIds: z.array(z.string()),
    measure: z.enum(["PERIOD", "CUMULATIVE", "PERCENT_OF_TARGET"]),
    type: z.enum(["BAR", "LINE", "PIE", "AREA", "RADAR", "GAUGE"]),
    fromPeriodId: z.string().optional(),
    toPeriodId: z.string().optional(),
    showTarget: z.boolean(),
    title: z.string().optional(),
    colors: z.array(z.string()).optional(),
  }),
  builtAt: z.string(),
  points: z.number(),
  unverified: z.number(),
  notes: z.array(z.string()),
  stale: z.boolean(),
  broken: z.string().optional(),
});
export type SectionDataChart = z.infer<typeof SectionDataChartSchema>;
export const SectionDataChartsResponseSchema = z.object({ items: z.array(SectionDataChartSchema) });

// ---- Work plan (Phase 28) ----
export const WorkPlanRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.enum(["ACTIVITY", "MILESTONE"]),
  plannedStart: z.string(),
  plannedEnd: z.string(),
  originalStart: z.string().optional(),
  originalEnd: z.string().optional(),
  status: z.enum(["PLANNED", "IN_PROGRESS", "DONE", "CANCELLED"]),
  state: z.string(),
  signal: z.enum(["ON_TIME", "LATE", "DONE", "CANCELLED"]),
  signalLabel: z.string(),
  signalReason: z.string().optional(),
  ownerUserId: z.string().optional(),
  supportUserIds: z.array(z.string()),
  logframeActivityId: z.string().optional(),
  outputId: z.string().optional(),
  location: z.string().optional(),
  targetCount: z.number().optional(),
  /** How heavy it is for its lead, 1 to 5. */
  effort: z.number().default(1),
  deliveredCount: z.number(),
  completedActivities: z.number(),
  suggestedStatus: z.enum(["IN_PROGRESS", "DONE"]).optional(),
  seriesId: z.string().optional(),
  /** Kinds of file that should prove it, and the ones no completed activity has shown yet. */
  requiredFiles: z.array(z.string()).default([]),
  stillNeeded: z.array(z.string()).default([]),
  reasonRequired: z.boolean(),
  /** "Comes after" (must finish first) and "Comes before" (waits for this one); "waitingFor" = unfinished ones. */
  comesAfter: z.array(z.object({ id: z.string(), title: z.string(), finished: z.boolean() })).default([]),
  comesBefore: z.array(z.object({ id: z.string(), title: z.string() })).default([]),
  waitingFor: z.array(z.object({ id: z.string(), title: z.string(), finished: z.boolean() })).default([]),
});
export type WorkPlanRow = z.infer<typeof WorkPlanRowSchema>;
export const WorkPlanResponseSchema = z.object({ items: z.array(WorkPlanRowSchema) });

export const CreatedPlannedActivitiesSchema = z.object({ ids: z.array(z.string()), capped: z.boolean() });

export const PlanPreviewSchema = z.object({
  preview: z.object({
    rows: z.array(
      z.object({
        logframeActivityId: z.string(),
        title: z.string(),
        outputId: z.string().optional(),
        plannedStart: z.string(),
        plannedEnd: z.string(),
        repeats: z.object({ every: z.enum(["WEEK", "MONTH"]), interval: z.number(), until: z.string() }).optional(),
        ownerUserId: z.string().optional(),
      }),
    ),
    total: z.number(),
    repeating: z.number(),
  }),
  createdIds: z.array(z.string()).optional(),
});
export type PlanPreviewResponse = z.infer<typeof PlanPreviewSchema>;

export const PlanRevisionSchema = z.object({
  id: z.string(),
  changes: z.record(z.string(), z.object({ from: z.unknown(), to: z.unknown() })),
  reason: z.string().optional(),
  changedById: z.string(),
  changedAt: z.string(),
});
export const PlanRevisionsResponseSchema = z.object({ items: z.array(PlanRevisionSchema) });

export const ProjectPeopleResponseSchema = z.object({ items: z.array(z.object({ userId: z.string(), name: z.string(), role: z.string() })) });

export const ImportWorkPlanResponseSchema = z.object({
  applied: z.boolean(),
  created: z.number(),
  skipped: z.number(),
  warnings: z.array(z.string()),
  problems: z.array(z.string()),
  items: z.array(z.object({ id: z.string().optional(), title: z.string(), plannedStart: z.string(), plannedEnd: z.string() })),
});
export type ImportWorkPlanResponse = z.infer<typeof ImportWorkPlanResponseSchema>;

export const MyWeekSchema = z.object({
  today: z.string(),
  weekStart: z.string(),
  planned: z.array(WorkPlanRowSchema.omit({ reasonRequired: true }).extend({ projectId: z.string(), projectTitle: z.string() })),
  sentBack: z.array(z.object({ id: z.string(), projectId: z.string(), projectTitle: z.string(), title: z.string(), activityDate: z.string(), status: z.enum(["NEEDS_REVISION", "REJECTED"]) })),
});
export type MyWeek = z.infer<typeof MyWeekSchema>;

// ---- Requests, assignments, team work (Phase 28.3) ----
const AssignmentSchema = z.object({
  key: z.string(),
  kind: z.enum(["PLAN_ITEM", "TASK", "CHECKLIST_ITEM", "REPORT_DEADLINE", "EVIDENCE_REVIEW", "ACTIVITY_REVIEW", "ACTIVITY_FIX", "INDICATOR_VALUE"]),
  projectId: z.string(),
  projectTitle: z.string(),
  title: z.string(),
  assigneeId: z.string(),
  dueDate: z.string().optional(),
  state: z.enum(["OPEN", "LATE"]),
  urgent: z.boolean(),
  href: z.string(),
  urgency: z.number(),
  because: z.string().optional(),
  askedById: z.string().optional(),
  manual: z.boolean().optional(),
});
export type AssignmentItem = z.infer<typeof AssignmentSchema>;
export const AssignmentsResponseSchema = z.object({
  today: z.string(),
  userId: z.string(),
  total: z.number(),
  groups: z.array(z.object({ key: z.enum(["LATE", "TODAY", "THIS_WEEK", "LATER", "NO_DATE"]), label: z.string(), items: z.array(AssignmentSchema) })),
});
export type AssignmentsResponse = z.infer<typeof AssignmentsResponseSchema>;
export const TeamWorkResponseSchema = z.object({
  today: z.string(),
  rows: z.array(z.object({ assigneeId: z.string(), open: z.number(), late: z.number(), dueThisWeek: z.number() })),
});

export const NotificationPreferencesSchema = z.object({ emailSummaryMode: z.enum(["DAILY_SUMMARY", "URGENT_ONLY", "NEVER"]) });

// ---- Delivery health (Phase 28.4): a label with reasons, never a score ----
export const DeliveryHealthSchema = z.object({
  projectId: z.string(),
  band: z.enum(["ON_TRACK", "AT_RISK", "OFF_TRACK", "NO_PLAN"]),
  label: z.string(),
  reasons: z.array(z.string()),
  health: z.object({ planned: z.number(), done: z.number(), doneLate: z.number(), overdue: z.number(), lateStart: z.number(), dueSoon: z.number(), valuesOverdue: z.number(), valuesDue: z.number(), valuesRecorded: z.number() }),
});
export type DeliveryHealthResponse = z.infer<typeof DeliveryHealthSchema>;
export const PortfolioHealthSchema = z.object({
  items: z.array(z.object({ projectId: z.string(), title: z.string(), band: z.enum(["ON_TRACK", "AT_RISK", "OFF_TRACK", "NO_PLAN"]), label: z.string(), reasons: z.array(z.string()) })),
});

export const FileNeedsSchema = z.object({ required: z.array(z.string()), provided: z.array(z.string()), stillNeeded: z.array(z.string()) });

// ---- Problems and risks (Phase 28.7) ----
export const RiskSchema = z.object({
  id: z.string(),
  kind: z.enum(["PROBLEM", "RISK", "ASSUMPTION", "DECISION", "DEPENDENCY"]),
  title: z.string(),
  seriousness: z.enum(["HIGH", "MEDIUM", "LOW"]),
  ownerId: z.string().optional(),
  action: z.string(),
  status: z.enum(["OPEN", "CLOSED"]),
  closedNote: z.string().optional(),
  plannedActivityId: z.string().optional(),
  raisedById: z.string(),
  reviewBy: z.string().optional(),
  canChange: z.boolean(),
});
export type RiskItem = z.infer<typeof RiskSchema>;
export const RisksResponseSchema = z.object({ items: z.array(RiskSchema) });

/** The fields of one planned activity and the values filled so far (phase 28.1-C). */
export const PlanItemFieldsSchema = z.object({
  fields: z.array(z.object({
    id: z.string(),
    key: z.string(),
    label: z.string(),
    type: z.enum(["TEXT", "NUMBER", "DATE", "CHOICE"]),
    choices: z.array(z.string()).default([]),
  })),
  values: z.record(z.string(), z.string()),
});
export type PlanItemFields = z.infer<typeof PlanItemFieldsSchema>;

/** Indicators summed across the projects a person can see, per donor and code (phase 28.1-F). */
export const PortfolioIndicatorsSchema = z.object({
  items: z.array(z.object({
    donorName: z.string(),
    indicatorCode: z.string(),
    indicatorName: z.string(),
    unit: z.string().nullable(),
    total: z.number().nullable(),
    targetTotal: z.number().nullable(),
    percentOfTarget: z.number().nullable(),
    projects: z.array(z.object({ projectId: z.string(), projectTitle: z.string(), value: z.number().nullable(), target: z.number().nullable(), asOf: z.string().nullable() })),
    mismatched: z.array(z.object({ projectId: z.string(), projectTitle: z.string(), value: z.number().nullable(), target: z.number().nullable(), asOf: z.string().nullable() })),
    countedElsewhere: z.array(z.object({ projectId: z.string(), projectTitle: z.string(), value: z.number().nullable(), target: z.number().nullable(), asOf: z.string().nullable() })).default([]),
    possibleOverlap: z.object({ projects: z.array(z.string()), message: z.string() }).nullable().default(null),
  })),
});

/** The budget of one planned activity: each line, what is spent, and where it stands (phase 28.1-D). */
export const PlanItemBudgetSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    code: z.string(),
    category: z.enum(["PERSONNEL", "TRAVEL", "SUPPLIES", "EQUIPMENT", "SERVICES", "OTHER"]),
    description: z.string(),
    donorName: z.string(),
    currency: z.string(),
    position: z.object({
      budgetedMinor: z.number().nullable(),
      spentMinor: z.number(),
      remainingMinor: z.number().nullable(),
      spentPercent: z.number().nullable(),
      overspent: z.boolean(),
      state: z.enum(["NO_BUDGET", "NOT_STARTED", "UNDER_SPENT", "FULLY_SPENT", "OVERSPENT"]),
    }),
    expenses: z.array(z.object({ id: z.string(), date: z.string(), amountMinor: z.number(), description: z.string() })),
  })),
});
export type PlanItemBudget = z.infer<typeof PlanItemBudgetSchema>;

/** What a bulk change would do (preview), or how many it did (apply) (phase 28.1-L). */
export const BulkPlanResultSchema = z.object({
  preview: z.array(z.object({ id: z.string(), title: z.string(), before: z.string(), after: z.string() })),
  applied: z.number(),
  /** The steps that put each activity back; sent to the undo endpoint as they are. */
  undo: z.array(z.object({ id: z.string(), action: z.record(z.string(), z.unknown()) })).default([]),
});
export type BulkPlanResult = z.infer<typeof BulkPlanResultSchema>;

/** Planned activities each person leads, week by week, against their limit (phase 28.1-J). */
export const WorkloadResponseSchema = z.object({
  weeks: z.array(z.string()),
  rows: z.array(z.object({
    userId: z.string(),
    capacity: z.number().nullable(),
    weeks: z.array(z.object({ weekStart: z.string(), load: z.number(), capacity: z.number().nullable(), over: z.boolean() })),
  })),
});

export type WorkloadResponse = z.infer<typeof WorkloadResponseSchema>;
export type AutomationRulesResponse = z.infer<typeof AutomationRulesResponseSchema>;

/** The automation rules of a project and whether each is on (phase 28.1-K). */
export const AutomationRulesResponseSchema = z.object({
  items: z.array(z.object({
    ruleKey: z.string(),
    label: z.string(),
    enabled: z.boolean(),
    /** The numbers the project may adjust for this rule, each with its range and the value now in force. */
    settings: z.array(z.object({ name: z.string(), label: z.string(), min: z.number(), max: z.number(), default: z.number(), value: z.number() })).default([]),
  })),
});

/** What the automations sent for a project, newest first (phase 28.1-K). */
export const AutomationHistorySchema = z.object({
  items: z.array(z.object({ sentOn: z.string(), rule: z.string(), activity: z.string(), recipientId: z.string() })),
});
export type AutomationHistory = z.infer<typeof AutomationHistorySchema>;

/** People a project reaches, by case code, with counts by sex and age group (phase 28.1-G). */
export const BeneficiariesResponseSchema = z.object({
  items: z.array(z.object({ id: z.string(), caseCode: z.string(), sex: z.string(), ageGroup: z.string(), location: z.string(), enrolledOn: z.string() })),
  counts: z.object({ total: z.number(), bySex: z.record(z.string(), z.number()), byAgeGroup: z.record(z.string(), z.number()) }),
});
export type BeneficiariesResponse = z.infer<typeof BeneficiariesResponseSchema>;

/** The progress log of one planned activity: its breakdown fields, entries, and the indicators it reports on. */
export const ProgressResponseSchema = z.object({
  fields: z.array(z.object({ key: z.string(), label: z.string(), usedBy: z.array(z.string()) })),
  indicatorIds: z.array(z.string()),
  entries: z.array(z.object({
    id: z.string(),
    kind: z.enum(["DAILY", "WEEKLY", "MONTHLY", "END"]),
    from: z.string(),
    to: z.string(),
    values: z.object({ total: z.number().nullable(), breakdowns: z.record(z.string(), z.number().nullable()), sessions: z.number().nullable(), unique: z.number().nullable() }),
    narrative: z.object({ notes: z.string(), summary: z.string(), achievements: z.string(), challenges: z.string(), nextSteps: z.string(), lessons: z.string() }),
    absorbedById: z.string().nullable(),
  })),
});
export type ProgressResponse = z.infer<typeof ProgressResponseSchema>;

/** What a form opens with for a kind and range: the sum of the live entries it covers, blank where nothing was recorded. */
export const PrepareProgressResponseSchema = z.object({
  from: z.string(),
  to: z.string(),
  fields: z.array(z.object({ key: z.string(), label: z.string(), usedBy: z.array(z.string()) })),
  values: z.object({
    total: z.number().nullable(),
    breakdowns: z.record(z.string(), z.number().nullable()),
    sessions: z.number().nullable(),
    unique: z.number().nullable(),
  }),
  sources: z.number(),
});
export type PrepareProgressResponse = z.infer<typeof PrepareProgressResponseSchema>;

/** The saved column mapping of a project, or none (phase 28.1-I). */
export const SubmissionMappingResponseSchema = z.object({ mapping: z.record(z.string(), z.string()).nullable() });

/** The people (by case code) an activity reached, each once, with counts by sex and age group. */
export const ActivityPeopleSchema = z.object({
  people: z.array(z.object({ id: z.string(), caseCode: z.string(), sex: z.string(), ageGroup: z.string() })),
  counts: z.object({ total: z.number(), bySex: z.record(z.string(), z.number()), byAgeGroup: z.record(z.string(), z.number()) }),
});
export type ActivityPeople = z.infer<typeof ActivityPeopleSchema>;

/** What an import would do, read from a file without saving (phase 28.1-I review). */
export const SubmissionReviewSchema = z.object({
  ready: z.number(),
  problems: z.array(z.object({ line: z.number(), message: z.string() })),
  clashes: z.array(z.object({ line: z.number(), caseCode: z.string() })),
  likely: z.array(z.object({ line: z.number(), caseCode: z.string(), looksLike: z.array(z.string()) })),
});
export type SubmissionReview = z.infer<typeof SubmissionReviewSchema>;

/** A project's budget against spending, per currency (never added across currencies) and per activity. */
export const ProjectBudgetSchema = z.object({
  items: z.array(z.object({
    currency: z.string(),
    budgetedMinor: z.number(),
    spentMinor: z.number(),
    remainingMinor: z.number(),
    overspentActivities: z.number(),
    byActivity: z.array(z.object({ activityId: z.string(), activityTitle: z.string(), budgetedMinor: z.number(), spentMinor: z.number(), remainingMinor: z.number(), overspent: z.boolean() })),
  })),
});
export type ProjectBudget = z.infer<typeof ProjectBudgetSchema>;

/** A project's custom fields and every activity's values (activity id -> field id -> value), for the plan list and the export. */
export const PlanFieldValuesSchema = z.object({
  fields: z.array(z.object({ id: z.string(), key: z.string(), label: z.string(), type: z.enum(["TEXT", "NUMBER", "DATE", "CHOICE"]), choices: z.array(z.string()).default([]) })),
  values: z.record(z.string(), z.record(z.string(), z.string())),
});

export const LogframeVersionsResponseSchema = z.object({
  items: z.array(z.object({ version: z.number(), summary: z.string(), createdAt: z.string(), createdById: z.string(), approvedAt: z.string().nullable(), approvedById: z.string().nullable() })),
});

export const LogframeChangesResponseSchema = z.object({
  from: z.number().nullable(),
  to: z.number(),
  changes: z.array(z.object({ text: z.string() })),
});

export const RequirementPacksResponseSchema = z.object({
  items: z.array(z.object({
    id: z.string(), name: z.string(), donorKey: z.string(), mechanismKey: z.string(), reportType: z.string(), status: z.string(), version: z.number(),
    requirements: z.array(z.object({ key: z.string(), kind: z.string(), required: z.boolean() })),
  })),
});


const FundedProjectSchema = z.object({
  id: z.string(), title: z.string(), status: z.string(),
  budget: z.object({ amount: z.union([z.number(), z.string()]), currency: z.string() }).optional(),
});
const FundingTotalsSchema = z.object({
  projectCount: z.number(), activeProjectCount: z.number(),
  budgetByCurrency: z.record(z.string(), z.number()), awardedByCurrency: z.record(z.string(), z.number()),
});
const GrantSchema = z.object({
  id: z.string(), title: z.string(), donorName: z.string(), awardNumber: z.string().optional(), amount: z.string().optional(), currency: z.string().optional(),
  startDate: z.string().optional(), endDate: z.string().optional(), status: z.string(), programmeId: z.string().optional(),
});
export const FundingResponseSchema = z.object({
  programmes: z.array(z.object({ id: z.string(), name: z.string(), code: z.string().optional(), description: z.string().optional(), status: z.string(), grants: z.array(GrantSchema), projects: z.array(FundedProjectSchema), totals: FundingTotalsSchema })),
  looseGrants: z.array(GrantSchema.extend({ projects: z.array(FundedProjectSchema), totals: FundingTotalsSchema })),
  unplacedProjects: z.array(FundedProjectSchema),
});
export type FundingResponse = z.infer<typeof FundingResponseSchema>;

export const MfaStatusSchema = z.object({ enabled: z.boolean(), enabledAt: z.string().nullable(), recoveryCodesLeft: z.number() });
export const MfaSetupSchema = z.object({ secret: z.string(), otpauthUri: z.string() });
export const MfaEnabledSchema = z.object({ recoveryCodes: z.array(z.string()) });

export const PortfolioOverviewSchema = z.object({
  totals: z.object({ projects: z.number(), behind: z.number(), needAttention: z.number(), openRisks: z.number(), highRisks: z.number(), reportsOverdue: z.number() }),
  rows: z.array(
    z.object({
      projectId: z.string(),
      title: z.string(),
      donorName: z.string(),
      country: z.string(),
      status: z.string(),
      delivery: z.object({ band: z.enum(["ON_TRACK", "AT_RISK", "OFF_TRACK", "NO_PLAN"]), label: z.string(), reason: z.string().nullable(), lateActivities: z.number(), valuesOverdue: z.number() }),
      risks: z.object({ open: z.number(), high: z.number(), reviewOverdue: z.number() }),
      reporting: z.object({ periodId: z.string(), deadline: z.string(), daysUntil: z.number(), status: z.string(), readinessScore: z.number() }).nullable(),
      reportsOverdue: z.number(),
    }),
  ),
});

/** The indicators a donor's template asks for, each with the project indicator that answers it (or why none does). */
export const DonorIndicatorMappingSchema = z.object({
  templateId: z.string(),
  indicators: z.array(z.object({ id: z.string(), code: z.string(), name: z.string() })),
  summary: z.object({ total: z.number(), mapped: z.number(), suggested: z.number(), unmapped: z.number(), notTracked: z.number() }),
  rows: z.array(z.object({
    requirementId: z.string(),
    text: z.string(),
    status: z.enum(["MAPPED", "SUGGESTED", "UNMAPPED", "NOT_TRACKED"]),
    indicatorId: z.string().nullable(),
    indicatorCode: z.string().nullable(),
    indicatorName: z.string().nullable(),
    basis: z.string(),
    alternatives: z.array(z.string()),
  })),
});
