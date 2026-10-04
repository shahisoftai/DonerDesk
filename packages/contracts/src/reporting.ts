import { z } from "zod";
import { ReportTypeSchema } from "./templates.js";

export const ReportStatusSchema = z.enum([
  "NOT_STARTED",
  "IN_PROGRESS",
  "EVIDENCE_COLLECTION",
  "DRAFT_GENERATED",
  "UNDER_REVIEW",
  "APPROVED",
  "SUBMITTED",
  "CLOSED",
]);

/** What an ACTIVITY / SITUATION / CUSTOM report covers (see domain `ReportScope`). */
export const ReportScopeSchema = z.object({
  activityIds: z.array(z.string().min(1)).max(200).optional(),
  eventName: z.string().trim().max(300).optional(),
  location: z.string().trim().max(300).optional(),
  situationDate: z.string().trim().max(40).optional(),
  summary: z.string().trim().max(2000).optional(),
  affectedPopulation: z
    .array(z.object({ group: z.string().trim().min(1).max(100), figure: z.string().trim().min(1).max(40), source: z.string().trim().max(200).optional(), asOf: z.string().trim().max(40).optional() }))
    .max(20)
    .optional(),
  needs: z.array(z.string().trim().min(1).max(200)).max(15).optional(),
  title: z.string().trim().max(300).optional(),
  purpose: z.string().trim().max(2000).optional(),
  sections: z.array(z.object({ title: z.string().trim().min(1).max(200), guidance: z.string().trim().max(1000).optional() })).max(25).optional(),
});
export type ReportScopeInput = z.infer<typeof ReportScopeSchema>;

export const CreateReportingPeriodSchema = z
  .object({
    projectId: z.string().min(1),
    donorTemplateId: z.string().optional(),
    reportType: ReportTypeSchema,
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    deadline: z.string().datetime(),
    internalReviewDeadline: z.string().datetime().optional(),
    responsibleOfficerId: z.string().optional(),
    scope: ReportScopeSchema.optional(),
  })
  .superRefine((d, ctx) => {
    if (new Date(d.endDate).getTime() < new Date(d.startDate).getTime()) {
      ctx.addIssue({ code: "custom", message: "endDate must be on or after startDate", path: ["endDate"] });
    }
    const scope = d.scope ?? {};
    if (d.reportType === "ACTIVITY" && !scope.activityIds?.length) {
      ctx.addIssue({ code: "custom", message: "Select at least one activity for an activity report", path: ["scope", "activityIds"] });
    }
    if (d.reportType === "SITUATION") {
      if (!scope.eventName?.trim()) ctx.addIssue({ code: "custom", message: "Name the event or situation", path: ["scope", "eventName"] });
      if (!scope.situationDate?.trim()) ctx.addIssue({ code: "custom", message: "Enter the situation date", path: ["scope", "situationDate"] });
    }
    if (d.reportType === "CUSTOM" && !scope.title?.trim()) {
      ctx.addIssue({ code: "custom", message: "Give the report a title", path: ["scope", "title"] });
    }
  });
export type CreateReportingPeriodInput = z.infer<typeof CreateReportingPeriodSchema>;

/** Replaces the scope of an activity / situation / custom report (the server re-validates it). */
export const UpdateReportingPeriodScopeSchema = z.object({ scope: ReportScopeSchema });
export type UpdateReportingPeriodScopeInput = z.infer<typeof UpdateReportingPeriodScopeSchema>;

export const StoryContextFieldSchema = z.enum(["achievements", "challenges", "varianceExplanations", "adaptations", "lessons"]);

export const StoryContextSchema = z
  .object({
    achievements: z.string().max(5000).optional(),
    challenges: z.string().max(5000).optional(),
    varianceExplanations: z.string().max(5000).optional(),
    adaptations: z.string().max(5000).optional(),
    lessons: z.string().max(5000).optional(),
  })
  .partial();
export type StoryContextInput = z.infer<typeof StoryContextSchema>;

export const UpdateReportingPeriodStorySchema = z.object({
  storyContext: StoryContextSchema,
});
export type UpdateReportingPeriodStoryInput = z.infer<typeof UpdateReportingPeriodStorySchema>;

export const SmartReviewActionSchema = z.object({
  type: z.string(),
  label: z.string(),
});

export const SmartReviewItemSchema = z.object({
  id: z.string(),
  severity: z.enum(["BLOCKING", "WARNING"]),
  title: z.string(),
  explanation: z.string(),
  claimId: z.string().optional(),
  sectionId: z.string().optional(),
  evidenceId: z.string().optional(),
  action: SmartReviewActionSchema,
  blocksApproval: z.boolean(),
});

export const SmartReviewSummarySchema = z.object({
  issueCount: z.number(),
  blockingCount: z.number(),
  items: z.array(SmartReviewItemSchema),
});

export const PeriodValueImportRowsSchema = z.array(z.array(z.string()));

export const PreviewPeriodValuesSchema = z.object({
  projectId: z.string().min(1),
  reportingPeriodId: z.string().min(1),
  rows: PeriodValueImportRowsSchema,
});

export const ConfirmedPeriodValueSchema = z.object({
  indicatorCode: z.string().min(1),
  periodAchievement: z.string().optional(),
  cumulativeAchievement: z.string().optional(),
});

export const ConfirmPeriodValuesSchema = z.object({
  projectId: z.string().min(1),
  reportingPeriodId: z.string().min(1),
  items: z.array(ConfirmedPeriodValueSchema),
});

export const ProposeFieldReportExtractionSchema = z.object({
  projectId: z.string().min(1),
  reportingPeriodId: z.string().min(1),
  text: z.string().min(1),
});

export const ApplyFieldReportExtractionSchema = z.object({
  projectId: z.string().min(1),
  reportingPeriodId: z.string().min(1),
  indicatorAchievements: z.array(z.object({ indicatorCode: z.string(), value: z.string() })).optional(),
  activities: z.array(z.object({ title: z.string(), date: z.string().optional(), participants: z.string().optional() })).optional(),
  story: z.object({
    achievements: z.string().optional(),
    challenges: z.string().optional(),
    varianceExplanations: z.string().optional(),
    adaptations: z.string().optional(),
    lessons: z.string().optional(),
  }).optional(),
});

export const GenerateDraftSchema = z
  .object({
    reportingPeriodId: z.string().min(1).optional(),
    templateId: z.string().optional(),
    includeSections: z.array(z.string()).optional(),
  })
  .strict();

export const UpdateSectionSchema = z.object({
  content: z.string(),
  sourceReferences: z
    .array(
      z.object({
        type: z.enum(["evidence", "activity", "indicator", "template"]),
        id: z.string(),
        label: z.string().optional(),
      }),
    )
    .optional(),
  /** Omitted = keep the section's current sources / unsupported claims. */
  unsupportedClaims: z.array(z.string()).optional(),
  /**
   * Optimistic concurrency token. When provided, the update is rejected with a
   * conflict if the section changed on the server after this token was issued.
   */
  expectedVersion: z.string().optional(),
  /**
   * What produced this text, for the revision history. Defaults to a manual
   * edit; `REWRITE` = an accepted "Ask AI" suggestion, `RESTORE` = an earlier
   * revision brought back.
   */
  changeOrigin: z.enum(["MANUAL_EDIT", "REWRITE", "RESTORE"]).optional(),
});

/** POST /v1/report-claims/:id/apply-suggestion — use the evidence value (Report Editor B5). */
export const ApplyClaimSuggestionSchema = z.object({
  expectedVersion: z.string().optional(),
});

/** POST /v1/report-sections/:id/regenerate — redraft one section (Report Editor B7). */
export const RegenerateSectionSchema = z.object({
  instruction: z.string().max(500).optional(),
});
export type RegenerateSectionInput = z.infer<typeof RegenerateSectionSchema>;

export const CreateReportSectionSchema = z.object({
  reportDraftId: z.string().min(1),
  sectionTitle: z.string().min(1).max(300),
  /** Optional explicit position; defaults to the end of the draft when omitted. */
  sectionOrder: z.number().int().nonnegative().optional(),
});
export type CreateReportSectionInput = z.infer<typeof CreateReportSectionSchema>;

export const ReorderReportSectionsSchema = z.object({
  /** The complete section ordering for the draft, first to last. */
  sectionIds: z.array(z.string().min(1)).min(1),
});
export type ReorderReportSectionsInput = z.infer<typeof ReorderReportSectionsSchema>;

export const ReviewReportSchema = z.object({
  decision: z.enum(["APPROVE", "RETURN"]),
  notes: z.string().max(2000).optional(),
});

export const RejectReportSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const ResolveReportClaimSchema = z.object({
  resolution: z.enum(["ACCEPTED_WITH_LIMITATION", "EXCLUDED"]),
  notes: z.string().max(2000).optional(),
});

export const BulkResolveReportClaimSchema = z.object({
  claimIds: z.array(z.string().min(1)).min(1).max(200),
  resolution: z.enum(["ACCEPTED_WITH_LIMITATION", "EXCLUDED"]),
  notes: z.string().max(2000).optional(),
});
export type BulkResolveReportClaimInput = z.infer<typeof BulkResolveReportClaimSchema>;

export const GenerateReportRunSchema = z.object({
  draftId: z.string().min(1),
});

export const ChartConfigSchema = z.object({
  type: z.enum(["BAR", "LINE", "PIE", "AREA", "RADAR", "GAUGE"]),
  dataBinding: z.enum(["INDICATOR_COMPARISON", "INDICATOR_ACHIEVEMENT", "STATUS_DISTRIBUTION"]),
  options: z.record(z.string(), z.unknown()).optional(),
});
export type ChartConfigInput = z.infer<typeof ChartConfigSchema>;

export const UpdateSectionChartSchema = z.object({
  chartConfig: ChartConfigSchema.nullable(),
  expectedVersion: z.string().optional(),
});

export const RequirementKindSchema = z.enum([
  "SECTION",
  "QUESTION",
  "FIELD",
  "INDICATOR",
  "ANNEX",
  "DECLARATION",
  "FINANCIAL",
  "SAFEGUARD",
  "APPROVAL",
  "DEADLINE",
  "FORMAT",
]);

export const RequirementSourceTypeSchema = z.enum([
  "AWARD",
  "AWARD_AMENDMENT",
  "SCHEDULE",
  "TEMPLATE",
  "MECHANISM",
  "DONOR_PACK",
  "ORGANIZATION_PROFILE",
  "BASELINE",
]);

export const ReportingRequirementSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  kind: RequirementKindSchema,
  required: z.boolean(),
  severity: z.enum(["INFO", "WARNING", "BLOCKING"]),
  condition: z
    .object({
      field: z.string(),
      operator: z.enum(["equals", "not_equals"]),
      value: z.union([z.string(), z.boolean(), z.number()]),
    })
    .optional(),
  evidenceRule: z
    .object({
      verifiedRequired: z.boolean(),
      confidentialityPolicy: z.enum(["ANY", "NON_CONFIDENTIAL"]),
    })
    .optional(),
  wordLimit: z
    .object({ min: z.number().int().nonnegative().optional(), max: z.number().int().positive().optional() })
    .optional(),
  sourceReference: z.object({
    sourceType: RequirementSourceTypeSchema,
    sourceId: z.string().min(1),
    documentHash: z.string().optional(),
    effectiveFrom: z.string().optional(),
    effectiveTo: z.string().optional(),
    version: z.number().int().nonnegative(),
    label: z.string(),
  }),
  guidance: z.string().optional(),
});
export type ReportingRequirementInput = z.infer<typeof ReportingRequirementSchema>;

export const UpsertRequirementPackSchema = z.object({
  id: z.string().optional(),
  donorKey: z.string().min(4),
  mechanismKey: z.string().min(1),
  reportType: z.string().min(1),
  name: z.string().min(1),
  language: z.string().optional(),
  requirements: z.array(ReportingRequirementSchema).min(1),
});

export const UpsertAwardOverrideSchema = z.object({
  id: z.string().optional(),
  awardId: z.string().min(1),
  projectId: z.string().min(1),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
  documentHash: z.string().optional(),
  requirements: z.array(ReportingRequirementSchema).min(1),
  sourceReference: z.object({
    sourceType: RequirementSourceTypeSchema,
    sourceId: z.string().min(1),
    documentHash: z.string().optional(),
    effectiveFrom: z.string().optional(),
    effectiveTo: z.string().optional(),
    version: z.number().int().nonnegative(),
    label: z.string(),
  }),
});

export const ReassessRevisionSchema = z.object({
  revisionId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// AI Reporter 2 — Artifact, QA, Chart, Delta wire-format (additive)
// ---------------------------------------------------------------------------

export const ArtifactKindSchema = z.enum(["TABLE", "CHART", "LIST", "KEY_VALUE", "QA", "DELTA"]);
export type ArtifactKind = z.infer<typeof ArtifactKindSchema>;

const ArtifactSourceRefSchema = z.object({
  type: z.enum(["evidence", "activity", "indicator", "template"]),
  id: z.string().min(1),
  label: z.string().optional(),
});

const TableColumnSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  unit: z.string().optional(),
});

const TableRowSchema = z.object({
  cells: z.array(z.union([z.string(), z.number(), z.null()])).min(1),
  sourceReferences: z.array(ArtifactSourceRefSchema).default([]),
});

const TablePayloadSchema = z.object({
  columns: z.array(TableColumnSchema).min(1),
  rows: z.array(TableRowSchema).min(1),
});

const ChartSeriesSchema = z.object({
  name: z.string().min(1),
  data: z.array(z.union([z.string(), z.number(), z.null()])).min(1),
  sourceReferences: z.array(ArtifactSourceRefSchema).default([]),
});

const ChartPayloadSchema = z.object({
  type: z.enum(["BAR", "LINE", "PIE", "AREA", "RADAR", "GAUGE"]),
  dataBinding: z.enum(["INDICATOR_COMPARISON", "INDICATOR_ACHIEVEMENT", "STATUS_DISTRIBUTION"]),
  unit: z.string().optional(),
  title: z.string().min(1),
  caption: z.string().min(1),
  categories: z.array(z.string()).min(1),
  series: z.array(ChartSeriesSchema).min(1),
  sourceReferences: z.array(ArtifactSourceRefSchema).default([]),
});

const ListItemSchema = z.object({
  text: z.string().min(1),
  sourceReferences: z.array(ArtifactSourceRefSchema).default([]),
});

const ListPayloadSchema = z.object({
  ordered: z.boolean().default(false),
  items: z.array(ListItemSchema).min(1),
});

const KeyValueEntrySchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
  sourceReferences: z.array(ArtifactSourceRefSchema).default([]),
});

const KeyValuePayloadSchema = z.object({
  entries: z.array(KeyValueEntrySchema).min(1),
});

const QaPayloadSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  sourceReferences: z.array(ArtifactSourceRefSchema).min(1),
});

const DeltaPayloadSchema = z.object({
  metric: z.string().min(1),
  fromValue: z.string().min(1),
  toValue: z.string().min(1),
  direction: z.enum(["UP", "DOWN", "FLAT"]),
  evidenceSummary: z.string().min(1),
  sourceReferences: z.array(ArtifactSourceRefSchema).min(1),
});

export const ReportArtifactSchema = z.object({
  kind: ArtifactKindSchema,
  caption: z.string().optional(),
  ordinal: z.number().int().nonnegative(),
  payload: z.union([
    TablePayloadSchema,
    ChartPayloadSchema,
    ListPayloadSchema,
    KeyValuePayloadSchema,
    QaPayloadSchema,
    DeltaPayloadSchema,
  ]),
  sourceReferences: z.array(ArtifactSourceRefSchema).default([]),
});
export type ReportArtifactInput = z.infer<typeof ReportArtifactSchema>;

export const ReportArtifactListSchema = z.array(ReportArtifactSchema);

export const ReportDeltaFromPriorSchema = DeltaPayloadSchema;
export type ReportDeltaFromPrior = z.infer<typeof ReportDeltaFromPriorSchema>;

export const ReportQaItemSchema = QaPayloadSchema;
export type ReportQaItem = z.infer<typeof ReportQaItemSchema>;

export const ReportQaListSchema = z.array(ReportQaItemSchema);

export const ReportChartSpecSchema = ChartPayloadSchema;
export type ReportChartSpec = z.infer<typeof ReportChartSpecSchema>;


