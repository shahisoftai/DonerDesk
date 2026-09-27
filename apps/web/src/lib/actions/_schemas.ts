import { z } from "zod";

export const IdResponseSchema = z.object({ id: z.string() });

export const OkResponseSchema = z.object({ ok: z.boolean() });

export const UploadResponseSchema = z.object({ id: z.string(), fileUrl: z.string() });

export const PolishActivityResponseSchema = z.object({
  narrative: z.string(),
  model: z.string(),
});

export const TemplateCreatedResponseSchema = z.object({
  id: z.string(),
  sections: z.array(z.unknown()),
  summary: z.unknown().optional(),
});

export const GeneratedDraftResponseSchema = z.object({
  draftId: z.string(),
  sectionIds: z.array(z.string()),
  generating: z.boolean().optional(),
  totalSections: z.number().int().optional(),
  fallbackUsed: z.boolean().optional(),
  fallbackReason: z.string().optional(),
  generatorId: z.string().optional(),
  generatorModelVersion: z.string().optional(),
  generatorPromptVersion: z.number().int().optional(),
});

export const DraftPollResponseSchema = z.object({
  draft: z
    .object({
      id: z.string(),
      title: z.string(),
      status: z.string(),
      version: z.number(),
      generatedByAi: z.boolean().optional(),
    })
    .nullable(),
  sections: z
    .array(
      z.object({
        id: z.string(),
        sectionTitle: z.string(),
        sectionOrder: z.number(),
        content: z.string(),
        status: z.string(),
        updatedAt: z.string(),
      }),
    )
    .optional(),
  regeneratingSectionIds: z.array(z.string()).optional(),
});

export const DetectMissingResponseSchema = z.object({ created: z.number().int().nonnegative() });

export const BulkResolveResponseSchema = z.object({ resolved: z.number().int().nonnegative(), skipped: z.number().int().nonnegative() });

export const UpdateSectionResponseSchema = z.object({ version: z.string() });
export const CancelGenerationResponseSchema = z.object({ cancelled: z.boolean() });
export const UpdateSectionChartResponseSchema = z.object({
  version: z.string(),
  chartConfig: z
    .object({
      type: z.enum(["BAR", "LINE", "PIE", "AREA", "RADAR", "GAUGE"]),
      dataBinding: z.enum(["INDICATOR_COMPARISON", "INDICATOR_ACHIEVEMENT", "STATUS_DISTRIBUTION"]),
      options: z.record(z.string(), z.unknown()).optional(),
    })
    .nullable(),
});

export const ReorderSectionsResponseSchema = z.object({
  sectionIds: z.array(z.string()),
});

export const RewriteSectionResponseSchema = z.object({
  version: z.string(),
  content: z.string(),
  revisionId: z.string().optional(),
  revisionNumber: z.number().int().nonnegative().optional(),
  contentHash: z.string().optional(),
  assuranceState: z.string().optional(),
  generationRunId: z.string().optional(),
  fallbackUsed: z.boolean().optional(),
  fallbackReason: z.string().optional(),
});

export const RewritePreviewResponseSchema = z.object({
  preview: z.literal(true),
  content: z.string(),
  selection: z.object({ from: z.number().int(), to: z.number().int() }),
  fallbackUsed: z.boolean(),
  fallbackReason: z.string().optional(),
});

export const ResolveClaimResponseSchema = z.object({ ok: z.boolean(), claimId: z.string().optional() });

export const RegenerateSectionResponseSchema = z.object({ sectionId: z.string(), runId: z.string() });

export const ClaimSuggestionResponseSchema = z.object({
  suggestion: z.object({ from: z.string(), to: z.string(), evidenceId: z.string() }).nullable(),
});

export const ApplyClaimSuggestionResponseSchema = z.object({
  sectionId: z.string(),
  version: z.string(),
  previousContent: z.string(),
});

export const SectionRevisionsResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      revisionNumber: z.number().int(),
      changeOrigin: z.string(),
      createdAt: z.string(),
      byAi: z.boolean(),
      isCurrent: z.boolean(),
      content: z.string(),
    }),
  ),
});

export const ReassessSectionResponseSchema = z.object({
  assuranceState: z.string(),
  blocked: z.boolean(),
});

export const InviteUserResponseSchema = z.object({
  invitationId: z.string(),
  token: z.string(),
});

export const StoryContextResponseSchema = z.object({
  storyContext: z
    .object({
      achievements: z.string().optional(),
      challenges: z.string().optional(),
      varianceExplanations: z.string().optional(),
      adaptations: z.string().optional(),
      lessons: z.string().optional(),
    })
    .optional(),
});

export const SmartReviewSummarySchema = z.object({
  issueCount: z.number(),
  blockingCount: z.number(),
  items: z.array(
    z.object({
      id: z.string(),
      severity: z.enum(["BLOCKING", "WARNING"]),
      title: z.string(),
      explanation: z.string(),
      claimId: z.string().optional(),
      sectionId: z.string().optional(),
      evidenceId: z.string().optional(),
      action: z.object({ type: z.string(), label: z.string() }),
      blocksApproval: z.boolean(),
    }),
  ),
});

export const PeriodValuePreviewRowSchema = z.object({
  rowIndex: z.number(),
  indicatorCode: z.string(),
  indicatorId: z.string().optional(),
  periodAchievement: z.string().optional(),
  cumulativeAchievement: z.string().optional(),
  status: z.enum(["ready", "error"]),
  error: z.string().optional(),
  will: z.enum(["create", "update", "unknown"]),
});

export const PeriodValuePreviewResponseSchema = z.object({
  totalRows: z.number(),
  readyRows: z.number(),
  errorRows: z.number(),
  rows: z.array(PeriodValuePreviewRowSchema),
});

export const FieldReportExtractionResponseSchema = z.object({
  indicatorAchievements: z.array(z.object({ indicatorCode: z.string(), value: z.string(), certainty: z.enum(["FOUND", "SUGGESTED"]), excerpt: z.string() })),
  activities: z.array(z.object({ title: z.string(), date: z.string().optional(), certainty: z.enum(["FOUND", "SUGGESTED"]) })),
  story: z.array(z.object({ field: z.string(), text: z.string(), certainty: z.enum(["FOUND", "SUGGESTED"]) })),
});

export const PeriodValueConfirmResponseSchema = z.object({
  created: z.number(),
  updated: z.number(),
  errors: z.array(z.string()),
});

export const FieldReportApplyResponseSchema = z.object({ ok: z.boolean() });

export const EvidenceLinkSuggestionsResponseSchema = z.object({
  suggestions: z.array(
    z.object({
      evidenceId: z.string(),
      targetType: z.enum(["activity", "indicator"]),
      targetId: z.string(),
      targetLabel: z.string(),
      score: z.number(),
    }),
  ),
});
