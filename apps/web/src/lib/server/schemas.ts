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
});

export const TeamResponseSchema = z.object({ items: z.array(TeamMemberSchema) });

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
});

export const ActivityItemSchema = z.object({
  id: z.string(),
  activityTitle: z.string(),
  activityDate: z.string(),
  location: z.string().optional(),
  participantsTotal: z.number().optional(),
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
  reportingPeriodId: z.string().nullable().optional(),
  activityId: z.string().nullable().optional(),
  indicatorId: z.string().nullable().optional(),
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

export const EnsureAutoPeriodResponseSchema = z.object({ created: z.boolean(), periodId: z.string().optional() });

export const ChartConfigSchema = z.object({
  type: z.enum(["BAR", "LINE", "PIE", "AREA", "RADAR", "GAUGE"]),
  dataBinding: z.enum(["INDICATOR_COMPARISON", "INDICATOR_ACHIEVEMENT", "STATUS_DISTRIBUTION"]),
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
  version: z.number(),
  createdAt: z.string(),
});
export type ReportingProfile = z.infer<typeof ReportingProfileSchema>;

export const ReportingProfileResponseSchema = z.object({
  profile: ReportingProfileSchema.nullable(),
});
