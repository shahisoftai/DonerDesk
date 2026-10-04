"use server";

import { CreateReportingPeriodSchema, UpdateSectionSchema, CreateReportSectionSchema, ResolveReportClaimSchema, BulkResolveReportClaimSchema, UpdateReportingPeriodStorySchema, UpdateReportingPeriodScopeSchema, SavePeriodFinanceSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import {
  DetectMissingResponseSchema,
  DraftPollResponseSchema,
  GeneratedDraftResponseSchema,
  IdResponseSchema,
  OkResponseSchema,
  UpdateSectionResponseSchema,
  UpdateSectionChartResponseSchema,
  RewriteSectionResponseSchema,
  ReorderSectionsResponseSchema,
  CancelGenerationResponseSchema,
  StoryContextResponseSchema,
  SmartReviewSummarySchema,
  PeriodValuePreviewResponseSchema,
  PeriodValueConfirmResponseSchema,
  FieldReportExtractionResponseSchema,
  FieldReportApplyResponseSchema,
  BulkResolveResponseSchema,
  RewritePreviewResponseSchema,
  RegenerateSectionResponseSchema,
  ClaimSuggestionResponseSchema,
  ApplyClaimSuggestionResponseSchema,
  SectionRevisionsResponseSchema,
  ReassessSectionResponseSchema,
  ResolveClaimResponseSchema,
  ScopeUpdateResponseSchema,
  PeriodFinanceResponseSchema,
  FinanceImportPreviewResponseSchema,
  type PeriodFinanceShape,
  type FinanceImportPreviewShape,
} from "./_schemas";

export type CreateReportingPeriodResult = Result<{ id: string }, AppError>;

export async function createReportingPeriodAction(input: unknown): Promise<CreateReportingPeriodResult> {
  const context = await requireSession();
  const parsed = CreateReportingPeriodSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest("/v1/reporting-periods", IdResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}

export type StoryContextShape = { achievements?: string; challenges?: string; varianceExplanations?: string; adaptations?: string; lessons?: string };

export type SmartReviewItemShape = {
  id: string;
  severity: "BLOCKING" | "WARNING";
  title: string;
  explanation: string;
  claimId?: string;
  sectionId?: string;
  evidenceId?: string;
  action: { type: string; label: string };
  blocksApproval: boolean;
};
export type SmartReviewSummaryShape = { issueCount: number; blockingCount: number; items: SmartReviewItemShape[] };

export async function getSmartReviewAction(periodId: string): Promise<Result<SmartReviewSummaryShape, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/reporting-periods/${periodId}/smart-review`, SmartReviewSummarySchema, context.token);
}

export type PeriodValuePreviewShape = {
  totalRows: number; readyRows: number; errorRows: number;
  rows: Array<{ rowIndex: number; indicatorCode: string; periodAchievement?: string; status: "ready" | "error"; error?: string; will: "create" | "update" | "unknown" }>;
};

export async function previewPeriodValuesAction(projectId: string, reportingPeriodId: string, rows: string[][]): Promise<Result<PeriodValuePreviewShape, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/reporting-periods/period-values/preview`, PeriodValuePreviewResponseSchema, context.token, { method: "POST", body: { projectId, reportingPeriodId, rows } });
}

export async function confirmPeriodValuesAction(projectId: string, reportingPeriodId: string, items: Array<{ indicatorCode: string; periodAchievement?: string }>): Promise<Result<{ created: number; updated: number; errors: string[] }, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/reporting-periods/period-values/confirm`, PeriodValueConfirmResponseSchema, context.token, { method: "POST", body: { projectId, reportingPeriodId, items } });
}

export async function proposeFieldReportAction(projectId: string, reportingPeriodId: string, text: string): Promise<Result<{ indicatorAchievements: Array<{ indicatorCode: string; value: string; certainty: string }>; activities: Array<{ title: string; certainty: string }>; story: Array<{ field: string; text: string }> }, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/reporting-periods/field-report/propose`, FieldReportExtractionResponseSchema, context.token, { method: "POST", body: { projectId, reportingPeriodId, text } });
}

export async function applyFieldReportAction(projectId: string, reportingPeriodId: string, payload: { indicatorAchievements?: Array<{ indicatorCode: string; value: string }>; activities?: Array<{ title: string }>; story?: StoryContextShape }): Promise<Result<{ ok: boolean }, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/reporting-periods/field-report/apply`, FieldReportApplyResponseSchema, context.token, { method: "POST", body: { projectId, reportingPeriodId, ...payload } });
}

export type StoryResult = Result<{ ok: boolean } | { storyContext?: StoryContextShape }, AppError>;

export async function getReportingPeriodStoryAction(periodId: string): Promise<Result<{ storyContext?: StoryContextShape }, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/reporting-periods/${periodId}/story`, StoryContextResponseSchema, context.token);
}

export async function updateReportingPeriodStoryAction(periodId: string, storyContext: StoryContextShape): Promise<Result<{ ok: boolean }, AppError>> {
  const context = await requireSession();
  const parsed = UpdateReportingPeriodStorySchema.safeParse({ storyContext });
  if (!parsed.success) {
    return { ok: false, error: { kind: "validation", message: "Please check the story fields.", fields: flattenZodFields(parsed.error) } };
  }
  return gatewayRequest(`/v1/reporting-periods/${periodId}/story`, OkResponseSchema, context.token, {
    method: "PUT",
    body: parsed.data,
  });
}

export type UpdateScopeResult = Result<{ changed: boolean; staleSections: number }, AppError>;

/** Changes what an activity / situation / custom report covers; the server re-validates it. */
export async function updateReportingPeriodScopeAction(periodId: string, scope: unknown): Promise<UpdateScopeResult> {
  const context = await requireSession();
  const parsed = UpdateReportingPeriodScopeSchema.safeParse({ scope });
  if (!parsed.success) {
    return { ok: false, error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) } };
  }
  const result = await gatewayRequest(`/v1/reporting-periods/${periodId}/scope`, ScopeUpdateResponseSchema, context.token, { method: "PUT", body: parsed.data });
  return result.ok ? { ok: true, value: { changed: result.value.changed, staleSections: result.value.staleSections } } : result;
}

export type PeriodFinanceResult = Result<PeriodFinanceShape, AppError>;

export async function savePeriodFinanceAction(periodId: string, input: unknown): Promise<PeriodFinanceResult> {
  const context = await requireSession();
  const parsed = SavePeriodFinanceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) } };
  }
  return gatewayRequest(`/v1/reporting-periods/${periodId}/finance`, PeriodFinanceResponseSchema, context.token, { method: "PUT", body: parsed.data });
}

export async function previewFinanceImportAction(periodId: string, rows: string[][]): Promise<Result<FinanceImportPreviewShape, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/reporting-periods/${periodId}/finance/import-preview`, FinanceImportPreviewResponseSchema, context.token, { method: "POST", body: { rows } });
}

export async function verifyPeriodFinanceAction(periodId: string): Promise<PeriodFinanceResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/reporting-periods/${periodId}/finance/verify`, PeriodFinanceResponseSchema, context.token, { method: "POST", body: {} });
}

export type CreateReportSectionResult = Result<{ id: string }, AppError>;

export async function createReportSectionAction(reportDraftId: string, sectionTitle: string): Promise<CreateReportSectionResult> {
  const context = await requireSession();
  const parsed = CreateReportSectionSchema.safeParse({ reportDraftId, sectionTitle });
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please enter a section title.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest("/v1/report-sections", IdResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}

export type DeleteReportSectionResult = Result<undefined, AppError>;

export async function deleteReportSectionAction(sectionId: string): Promise<DeleteReportSectionResult> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/report-sections/${sectionId}`, OkResponseSchema, context.token, {
    method: "DELETE",
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export type ReorderReportSectionsResult = Result<{ sectionIds: string[] }, AppError>;

export async function reorderReportSectionsAction(
  draftId: string,
  sectionIds: string[],
): Promise<ReorderReportSectionsResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/report-drafts/${draftId}/sections-order`, ReorderSectionsResponseSchema, context.token, {
    method: "PUT",
    body: { sectionIds },
  });
}

export type GenerateDraftResult = Result<
  {
    draftId: string;
    sectionIds: string[];
    generating?: boolean;
    totalSections?: number;
    fallbackUsed?: boolean;
    fallbackReason?: string;
    generatorId?: string;
    generatorModelVersion?: string;
    generatorPromptVersion?: number;
  },
  AppError
>;

export async function generateDraftAction(periodId: string): Promise<GenerateDraftResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/reporting-periods/${periodId}/generate-draft`, GeneratedDraftResponseSchema, context.token, {
    method: "POST",
    body: {},
    // Section-wise generation returns as soon as the draft skeleton is
    // created; individual sections are drafted in a background loop. The
    // timeout covers creating the plan + skeleton (fast) so a conservative
    // generous ceiling is fine.
    timeoutMs: 60_000,
  });
}

export type GetReportDraftResult = Result<
  {
    draft: {
      id: string;
      title: string;
      status: string;
      version: number;
      generatedByAi?: boolean;
    } | null;
    sections?: Array<{
      id: string;
      sectionTitle: string;
      sectionOrder: number;
      content: string;
      status: string;
      updatedAt: string;
    }>;
    /** Sections the AI is rewriting right now (single-section regenerate). */
    regeneratingSectionIds?: string[];
  },
  AppError
>;

export async function getReportDraftAction(periodId: string): Promise<GetReportDraftResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/reporting-periods/${periodId}/draft`, DraftPollResponseSchema, context.token, {
    method: "GET",
  });
}

export type DetectMissingResult = Result<{ created: number }, AppError>;

export async function detectMissingAction(periodId: string): Promise<DetectMissingResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/reporting-periods/${periodId}/detect-missing`, DetectMissingResponseSchema, context.token, {
    method: "POST",
    body: {},
  });
}

export type UpdateSectionInput = {
  content: string;
  sourceReferences?: Array<{ type: "evidence" | "activity" | "indicator" | "template"; id: string; label?: string }>;
  unsupportedClaims?: string[];
  expectedVersion?: string;
  /** What produced the text: manual typing (default), an accepted AI suggestion, or a restored revision. */
  changeOrigin?: "MANUAL_EDIT" | "REWRITE" | "RESTORE";
};

export type UpdateSectionResult = Result<{ version: string }, AppError>;

export async function updateReportSectionAction(
  sectionId: string,
  input: UpdateSectionInput,
): Promise<UpdateSectionResult> {
  const context = await requireSession();
  const parsed = UpdateSectionSchema.safeParse({
    content: input.content,
    // Omitted = the api keeps the section's current sources.
    sourceReferences: input.sourceReferences,
    unsupportedClaims: input.unsupportedClaims,
    expectedVersion: input.expectedVersion,
    changeOrigin: input.changeOrigin,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest(`/v1/report-sections/${sectionId}`, UpdateSectionResponseSchema, context.token, {
    method: "PUT",
    body: parsed.data,
  });
}

export type ChartConfigInput = {
  type: "BAR" | "LINE" | "PIE" | "AREA" | "RADAR" | "GAUGE";
  dataBinding: "INDICATOR_COMPARISON" | "INDICATOR_ACHIEVEMENT" | "STATUS_DISTRIBUTION";
  options?: Record<string, unknown>;
};

export type UpdateSectionChartResult = Result<{ version: string; chartConfig: ChartConfigInput | null }, AppError>;

export async function updateReportSectionChartAction(
  sectionId: string,
  chartConfig: ChartConfigInput | null,
  expectedVersion?: string,
): Promise<UpdateSectionChartResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/report-sections/${sectionId}/chart`, UpdateSectionChartResponseSchema, context.token, {
    method: "PATCH",
    body: { chartConfig, expectedVersion },
  });
}

export type SubmitForReviewResult = Result<undefined, AppError>;

export async function submitReportForReviewAction(draftId: string): Promise<SubmitForReviewResult> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/report-drafts/${draftId}/submit-for-review`, OkResponseSchema, context.token, {
    method: "POST",
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export type ApproveReportResult = Result<undefined, AppError>;

export async function approveReportAction(draftId: string): Promise<ApproveReportResult> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/report-drafts/${draftId}/approve`, OkResponseSchema, context.token, {
    method: "POST",
    body: { decision: "APPROVE" },
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export type ApproveSectionResult = Result<undefined, AppError>;

export async function approveReportSectionAction(sectionId: string): Promise<ApproveSectionResult> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/report-sections/${sectionId}/approve`, OkResponseSchema, context.token, {
    method: "POST",
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export type RewriteSectionResult = Result<
  {
    version: string;
    content: string;
    revisionId?: string;
    revisionNumber?: number;
    contentHash?: string;
    assuranceState?: string;
    generationRunId?: string;
    fallbackUsed?: boolean;
    fallbackReason?: string;
  },
  AppError
>;

export async function rewriteReportSectionAction(
  sectionId: string,
  input: { mode?: "REWRITE" | "SHORTEN"; audience?: "DONOR" | "INTERNAL" | "GENERAL"; instructions?: string },
): Promise<RewriteSectionResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/report-sections/${sectionId}/rewrite`, RewriteSectionResponseSchema, context.token, {
    method: "POST",
    body: input,
    // LLM rewrites also require more than the 15s default gateway timeout;
    // MiniMax measured at 46-54s for a full draft and the rewrite has a
    // similar latency profile on the same provider.
    timeoutMs: 180_000,
  });
}

/** `claimId`: the statement's id after the decision (re-checks re-create statements). */
export type ResolveReportClaimResult = Result<{ claimId: string }, AppError>;
/**
 * Resolves a single ReportClaim with an authorized limitation or exclusion.
 * The api enforces the capability:
 * - `ACCEPT_WITH_LIMITATION` requires `report.resolve-claim` and a non-empty note.
 * - `EXCLUDED` requires `report.override-confidentiality` when the claim cites
 *   a confidential source.
 *
 * Used by the export wizard to override one issue row at a time and refresh
 * the preflight. The caller is expected to refetch the preflight after a
 * successful resolution so the row disappears.
 */
export async function resolveReportClaimAction(
  claimId: string,
  input: { resolution: "ACCEPTED_WITH_LIMITATION" | "EXCLUDED"; notes?: string },
): Promise<ResolveReportClaimResult> {
  const context = await requireSession();
  const parsed = ResolveReportClaimSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  const result = await gatewayRequest(`/v1/report-claims/${claimId}/resolve`, ResolveClaimResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
  if (!result.ok) return result;
  return { ok: true, value: { claimId: result.value.claimId ?? claimId } };
}

export type BulkResolveReportClaimsResult = Result<{ resolved: number; skipped: number }, AppError>;

/**
 * Applies one decision to several failed claims in one call, so a report
 * with many similar findings (e.g. a batch of activity-level statements
 * missing the same evidence) doesn't require resolving each one by hand.
 */
export async function bulkResolveReportClaimsAction(input: {
  claimIds: string[];
  resolution: "ACCEPTED_WITH_LIMITATION" | "EXCLUDED";
  notes?: string;
}): Promise<BulkResolveReportClaimsResult> {
  const context = await requireSession();
  const parsed = BulkResolveReportClaimSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest("/v1/report-claims/bulk-resolve", BulkResolveResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}

export type CancelReportGenerationResult = Result<{ cancelled: boolean }, AppError>;

/**
 * Stops an in-flight background section-wise generation for a reporting
 * period by superseding the current working draft. Drafted sections already
 * committed are retained in the superseded draft; a fresh generation creates
 * a new draft.
 */
export async function cancelReportGenerationAction(periodId: string): Promise<CancelReportGenerationResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/reporting-periods/${periodId}/cancel-generation`, CancelGenerationResponseSchema, context.token, {
    method: "POST",
  });
}

export type ActivateReportDraftResult = Result<{ id: string }, AppError>;

/**
 * Reactivates a superseded working draft as the current draft for its
 * reporting period (draft versions archive).
 */
export async function activateReportDraftAction(draftId: string): Promise<ActivateReportDraftResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/report-drafts/${draftId}/activate`, IdResponseSchema, context.token, {
    method: "POST",
  });
}

// ---------------------------------------------------------------------------
// Report Editor v2 (P3–P5)
// ---------------------------------------------------------------------------

export type ReassessSectionResult = Result<{ assuranceState: string; blocked: boolean }, AppError>;

/** Re-checks a section's statements against the current evidence (no text change). */
export async function reassessSectionAction(sectionId: string): Promise<ReassessSectionResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/report-sections/${sectionId}/reassess`, ReassessSectionResponseSchema, context.token, {
    method: "POST",
    body: {},
    timeoutMs: 60_000,
  });
}

export type RequestChangesResult = Result<undefined, AppError>;

const REQUEST_CHANGES_MAX = 2000;

/** Returns a report under review to the writers with a required comment. */
export async function requestChangesAction(draftId: string, notes: string): Promise<RequestChangesResult> {
  const context = await requireSession();
  const trimmed = notes.trim();
  if (!trimmed) {
    return { ok: false, error: { kind: "validation", message: "Say what needs to change.", fields: { notes: ["Required"] } } };
  }
  if (trimmed.length > REQUEST_CHANGES_MAX) {
    return { ok: false, error: { kind: "validation", message: `Keep the comment under ${REQUEST_CHANGES_MAX} characters.`, fields: { notes: ["Too long"] } } };
  }
  const result = await gatewayRequest(`/v1/report-drafts/${draftId}/reject`, OkResponseSchema, context.token, {
    method: "POST",
    body: { notes: trimmed },
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export type ReopenClaimResult = Result<undefined, AppError>;

/** Undoes a keep-with-note / leave-out decision. */
export async function reopenReportClaimAction(claimId: string): Promise<ReopenClaimResult> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/report-claims/${claimId}/reopen`, OkResponseSchema, context.token, { method: "POST", body: {} });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export type ClaimSuggestionResult = Result<{ suggestion: { from: string; to: string; evidenceId: string } | null }, AppError>;

/** The evidence value that would correct a mismatched number, when unambiguous. */
export async function getClaimSuggestionAction(claimId: string): Promise<ClaimSuggestionResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/report-claims/${claimId}/suggestion`, ClaimSuggestionResponseSchema, context.token, { method: "GET" });
}

export type ApplyClaimSuggestionResult = Result<{ sectionId: string; version: string; previousContent: string }, AppError>;

/** Replaces the mismatched number with the evidence value and re-checks the section. */
export async function applyClaimSuggestionAction(claimId: string, expectedVersion: string): Promise<ApplyClaimSuggestionResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/report-claims/${claimId}/apply-suggestion`, ApplyClaimSuggestionResponseSchema, context.token, {
    method: "POST",
    body: { expectedVersion },
    timeoutMs: 60_000,
  });
}

export type RegenerateSectionResult = Result<{ sectionId: string; runId: string }, AppError>;

const INSTRUCTION_MAX = 500;

/** Starts redrafting one section in the background (optionally steered by an instruction). */
export async function regenerateReportSectionAction(sectionId: string, instruction?: string): Promise<RegenerateSectionResult> {
  const context = await requireSession();
  const trimmed = instruction?.trim() || undefined;
  if (trimmed && trimmed.length > INSTRUCTION_MAX) {
    return { ok: false, error: { kind: "validation", message: `Keep the instruction under ${INSTRUCTION_MAX} characters.`, fields: { instruction: ["Too long"] } } };
  }
  return gatewayRequest(`/v1/report-sections/${sectionId}/regenerate`, RegenerateSectionResponseSchema, context.token, {
    method: "POST",
    body: trimmed ? { instruction: trimmed } : {},
    timeoutMs: 60_000,
  });
}

export type SectionRevision = {
  id: string;
  revisionNumber: number;
  changeOrigin: string;
  createdAt: string;
  byAi: boolean;
  isCurrent: boolean;
  content: string;
};

export type ListSectionRevisionsResult = Result<{ items: SectionRevision[] }, AppError>;

export async function listSectionRevisionsAction(sectionId: string): Promise<ListSectionRevisionsResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/report-sections/${sectionId}/revisions`, SectionRevisionsResponseSchema, context.token, { method: "GET" });
}

export type RewritePreviewResult = Result<
  { preview: true; content: string; selection: { from: number; to: number }; fallbackUsed: boolean; fallbackReason?: string },
  AppError
>;

/** "Ask AI" on a selection: returns a suggestion for the selected text without saving it. */
export async function rewriteSelectionPreviewAction(
  sectionId: string,
  input: { mode: "REWRITE" | "SHORTEN"; audience: "DONOR" | "INTERNAL" | "GENERAL"; instructions?: string; selection: { from: number; to: number } },
): Promise<RewritePreviewResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/report-sections/${sectionId}/rewrite`, RewritePreviewResponseSchema, context.token, {
    method: "POST",
    body: { ...input, preview: true },
    // Same latency profile as a whole-section rewrite.
    timeoutMs: 180_000,
  });
}
