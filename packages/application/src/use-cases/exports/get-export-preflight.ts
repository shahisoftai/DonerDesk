import type { Result, ReportingPeriod } from "@donordesk/domain";
import { DomainError, type GateKind } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type {
  IReportingPeriodRepository,
  IReportDraftRepository,
  IReportSectionRepository,
} from "../../ports/reporting.js";
import type { IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IChecklistRepository } from "../../ports/compliance.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { ApproveReportHandler } from "../reporting/approve-report.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import { periodIndicatorScope, inIndicatorScope } from "../../services/period-activities.js";

export const EXPORT_TYPES = [
  "WORD",
  "PDF",
  "EXCEL_INDICATORS",
  "EVIDENCE_CHECKLIST",
  "EVIDENCE_PACK_ZIP",
] as const;

/**
 * One blocking issue surfaced to the export wizard. The IDs (when present)
 * allow the wizard to render a "Fix" link to the exact page that produced the
 * issue, and an "Override" button that calls POST /v1/report-claims/:id/resolve
 * for claim-scoped issues.
 */
export interface ExportPreflightItem {
  /** Stable identifier for React keys and any caller that needs to dedupe. */
  id: string;
  /** Mirrors GateKind so the wizard can group, badge, and route by category. */
  kind: GateKind;
  /** Human-readable detail (the underlying verifier detail). */
  message: string;
  /** Claim id when this issue originated from a single ReportClaim row. */
  claimId?: string;
  /** Section id when this issue is scoped to a report section. */
  sectionId?: string;
  /** Evidence id when this issue is an evidence-hash mismatch or similar. */
  evidenceId?: string;
  /**
   * Best-effort link to the page where the user can fix the issue without an
   * override. `null` when no specific page applies (e.g. open critical
   * checklist items already on the workspace).
   */
  navigateTo: string | null;
  /**
   * What kind of manual resolution the user can apply from this row:
   * - `ACCEPT_WITH_LIMITATION` — claim has failed verification; user accepts
   *   the claim with a written note. Requires `report.resolve-claim`.
   * - `EXCLUDE` — claim cites a confidential source; user excludes it from
   *   the export. Requires `report.override-confidentiality` only when the
   *   claim is confidentiality-scoped; otherwise `NONE`.
   * - `NONE` — the issue is not claim-scoped and can only be fixed by
   *   visiting `navigateTo`.
   */
  resolution: "ACCEPT_WITH_LIMITATION" | "EXCLUDE" | "NONE";
}

/**
 * Composes an authoritative preflight for the export wizard: the exact report
 * version, allowed export types, blocking and overridable warnings, per-issue
 * blockers with navigate/override metadata, and which evidence files are
 * included or excluded by default (sensitive handling).
 */
export class GetExportPreflightHandler {
  constructor(
    private readonly periods: IReportingPeriodRepository,
    private readonly drafts: IReportDraftRepository,
    private readonly sections: IReportSectionRepository,
    private readonly updates: IIndicatorUpdateRepository,
    private readonly checklist: IChecklistRepository,
    private readonly evidence: IEvidenceRepository,
    private readonly gate: ApproveReportHandler,
    private readonly activities?: IActivityUpdateRepository,
  ) {}

  /** Evidence on file for the period, how much of it is sensitive, unverified indicator values and annex gaps. */
  private async loadInputCounts(
    ctx: AuthenticatedContext,
    period: ReportingPeriod,
  ): Promise<{
    evidenceRows: Array<{ id: string; title: string; confidentialityLevel: string; verificationStatus: string; defaultIncluded: boolean }>;
    sensitiveCount: number;
    unverifiedIndicatorCount: number;
    annexGapCount: number;
  }> {
    const evidenceRows: Array<{ id: string; title: string; confidentialityLevel: string; verificationStatus: string; defaultIncluded: boolean }> = [];
    let sensitiveCount = 0;
    const evidenceResult = await this.evidence.search({ reportingPeriodId: period.id, pageSize: 500 }, ctx.tenant.tenantId);
    if (evidenceResult.ok) {
      for (const e of evidenceResult.value.items) {
        const isSensitive = e.confidentialityLevel === "SENSITIVE" || e.confidentialityLevel === "HIGHLY_SENSITIVE";
        if (isSensitive) sensitiveCount += 1;
        evidenceRows.push({ id: e.id, title: e.title, confidentialityLevel: e.confidentialityLevel, verificationStatus: e.verificationStatus, defaultIncluded: !isSensitive });
      }
    }

    let unverifiedIndicatorCount = 0;
    const updatesResult = await this.updates.findByReportingPeriod(period.id, ctx.tenant.tenantId);
    const indicatorScope = await periodIndicatorScope(this.activities, period, ctx.tenant.tenantId);
    if (updatesResult.ok && indicatorScope.ok) {
      unverifiedIndicatorCount = updatesResult.value.filter((u) => inIndicatorScope(indicatorScope.value, u.indicatorId) && u.verificationStatus !== "VERIFIED").length;
    }

    let annexGapCount = 0;
    const checklistResult = await this.checklist.findByReportingPeriod(period.id, ctx.tenant.tenantId);
    if (checklistResult.ok) {
      for (const item of checklistResult.value) {
        const open = item.status !== "RESOLVED" && item.status !== "ACCEPTED_RISK" && item.status !== "NOT_APPLICABLE";
        if (open && item.type === "MISSING_ANNEX") annexGapCount += 1;
      }
    }
    return { evidenceRows, sensitiveCount, unverifiedIndicatorCount, annexGapCount };
  }

  async handle(ctx: AuthenticatedContext, reportingPeriodId: string): Promise<Result<unknown, DomainError>> {
    const periodResult = await this.periods.findById(reportingPeriodId, ctx.tenant.tenantId);
    if (!periodResult.ok) return periodResult;
    if (!periodResult.value) return { ok: false, error: DomainError.notFound("ReportingPeriod", reportingPeriodId) };
    const period = periodResult.value;
    const projectId = period.projectId;

    const draftsResult = await this.drafts.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!draftsResult.ok) return draftsResult;
    const draft = draftsResult.value[0];

    const blocking: Array<{ code: string; message: string }> = [];
    const blockingItems: ExportPreflightItem[] = [];
    const warnings: Array<{ code: string; message: string; overridable: boolean }> = [];

    if (!draft) {
      blocking.push({ code: "NO_DRAFT", message: "No report draft exists yet. Generate or create a draft before exporting." });
      blockingItems.push({
        id: "NO_DRAFT",
        kind: "ASSERTION_COVERAGE_GAP",
        message: "No report draft exists yet. Generate or create a draft before exporting.",
        navigateTo: `/projects/${projectId}/reports/${reportingPeriodId}`,
        resolution: "NONE",
      });
      // The inputs panel before the first draft still needs the real counts (evidence on file, unverified values).
      const inputs = await this.loadInputCounts(ctx, period);
      return {
        ok: true,
        value: {
          draft: null,
          exportTypes: EXPORT_TYPES,
          blocking,
          blockingItems,
          warnings: [],
          evidence: inputs.evidenceRows,
          sensitiveCount: inputs.sensitiveCount,
          annexGapCount: inputs.annexGapCount,
          unverifiedIndicatorCount: inputs.unverifiedIndicatorCount,
        },
      };
    }

    let approvedSections = 0;
    let totalSections = 0;
    const sectionsResult = await this.sections.findByReportDraft(draft.id, ctx.tenant.tenantId);
    if (sectionsResult.ok) {
      totalSections = sectionsResult.value.length;
      approvedSections = sectionsResult.value.filter((s) => s.status === "APPROVED").length;
    }
    const incompleteSections = totalSections - approvedSections;

    let unverifiedIndicatorCount = 0;
    const updatesResult = await this.updates.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    const indicatorScope = await periodIndicatorScope(this.activities, period, ctx.tenant.tenantId);
    if (updatesResult.ok && indicatorScope.ok) {
      unverifiedIndicatorCount = updatesResult.value.filter((u) => inIndicatorScope(indicatorScope.value, u.indicatorId) && u.verificationStatus !== "VERIFIED").length;
    }

    let openCriticalCount = 0;
    let annexGapCount = 0;
    let openCriticalItems: Array<{ id: string; title: string; type: string; severity: string }> = [];
    const checklistResult = await this.checklist.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (checklistResult.ok) {
      for (const item of checklistResult.value) {
        const open = item.status !== "RESOLVED" && item.status !== "ACCEPTED_RISK" && item.status !== "NOT_APPLICABLE";
        if (!open) continue;
        if (item.severity === "CRITICAL" || item.severity === "HIGH") {
          openCriticalCount += 1;
          openCriticalItems.push({ id: item.id, title: item.title, type: item.type, severity: item.severity });
        }
        if (item.type === "MISSING_ANNEX") annexGapCount += 1;
      }
    }

    const evidenceRows: Array<{
      id: string;
      title: string;
      confidentialityLevel: string;
      verificationStatus: string;
      defaultIncluded: boolean;
    }> = [];
    let sensitiveCount = 0;
    const evidenceResult = await this.evidence.search({ reportingPeriodId, pageSize: 500 }, ctx.tenant.tenantId);
    if (evidenceResult.ok) {
      for (const e of evidenceResult.value.items) {
        const isSensitive = e.confidentialityLevel === "SENSITIVE" || e.confidentialityLevel === "HIGHLY_SENSITIVE";
        if (isSensitive) sensitiveCount += 1;
        const defaultIncluded = !(e.confidentialityLevel === "HIGHLY_SENSITIVE" || e.confidentialityLevel === "SENSITIVE");
        evidenceRows.push({
          id: e.id,
          title: e.title,
          confidentialityLevel: e.confidentialityLevel,
          verificationStatus: e.verificationStatus,
          defaultIncluded,
        });
      }
    }

    if (draft.status !== "APPROVED" && draft.status !== "EXPORTED" && draft.status !== "SUBMITTED") {
      warnings.push({
        code: "DRAFT_NOT_APPROVED",
        message: "The report has not been approved. Exports of unapproved reports are for internal review only.",
        overridable: true,
      });
    }

    // Single gate evaluator: identical decision to approval/submission, so the
    // export wizard can never disagree with the review surface.
    let submissionGate: {
      approvalBlocked: boolean;
      submitBlocked: boolean;
      submitNeedsDecision: boolean;
      blockReasons: string[];
      blockingIssues: Array<{ kind: GateKind; detail: string; claimId?: string; sectionId?: string; evidenceId?: string }>;
    } = {
      approvalBlocked: false,
      submitBlocked: false,
      submitNeedsDecision: false,
      blockReasons: [],
      blockingIssues: [],
    };
    const gateResult = await this.gate.evaluateGate(ctx, reportingPeriodId, draft.id);
    if (gateResult.ok) {
      submissionGate = gateResult.value;
      if (submissionGate.submitBlocked || submissionGate.approvalBlocked) {
        for (const reason of submissionGate.blockReasons) {
          blocking.push({ code: "SUBMISSION_GATE", message: reason });
        }
        for (const issue of submissionGate.blockingIssues) {
          blockingItems.push(toPreflightItem(issue, { projectId, reportingPeriodId }));
        }
      } else if (submissionGate.submitNeedsDecision) {
        warnings.push({
          code: "SUBMISSION_NEEDS_DECISION",
          message: "Submission requires an authorized limitation, exclusion, or human decision.",
          overridable: false,
        });
        for (const issue of submissionGate.blockingIssues) {
          blockingItems.push(toPreflightItem(issue, { projectId, reportingPeriodId }));
        }
      }
    }
    if (incompleteSections > 0) {
      warnings.push({
        code: "INCOMPLETE_SECTIONS",
        message: `${incompleteSections} of ${totalSections} section(s) are not approved.`,
        overridable: true,
      });
    }
    if (unverifiedIndicatorCount > 0) {
      warnings.push({
        code: "UNVERIFIED_INDICATORS",
        message: `${unverifiedIndicatorCount} indicator update(s) are not verified.`,
        overridable: true,
      });
    }
    if (openCriticalCount > 0) {
      warnings.push({
        code: "OPEN_CRITICAL_CHECKLIST",
        message: `${openCriticalCount} critical/high checklist item(s) remain open.`,
        overridable: true,
      });
      // Per-row items for the open checklist so the wizard can deep-link each one.
      const alreadyListed = new Set(blockingItems.map((b) => b.message));
      for (const item of openCriticalItems) {
        // The submission gate already lists these (as unsatisfied requirements); listing them twice doubles every one.
        if (alreadyListed.has(`Open ${item.severity.toLowerCase()} checklist item: ${item.title}`)) continue;
        blockingItems.push({
          id: `checklist:${item.id}`,
          kind: "REQUIREMENT_UNSATISFIED",
          message: `Open ${item.severity.toLowerCase()} checklist item: ${item.title}`,
          navigateTo: `/projects/${projectId}/reports/${reportingPeriodId}?checklist=${item.id}`,
          resolution: "NONE",
        });
      }
    }
    if (sensitiveCount > 0) {
      warnings.push({
        code: "SENSITIVE_EVIDENCE_EXCLUDED",
        message: `${sensitiveCount} sensitive file(s) are excluded by default and will only be included if you opt in.`,
        overridable: true,
      });
    }
    if (annexGapCount > 0) {
      warnings.push({
        code: "MISSING_ANNEXES",
        message: `${annexGapCount} required annex(es) are not attached.`,
        overridable: true,
      });
    }

    return {
      ok: true,
      value: {
        draft: { id: draft.id, title: draft.title, status: draft.status, version: draft.version, generatedByAi: draft.generatedByAi },
        exportTypes: EXPORT_TYPES,
        blocking,
        blockingItems,
        warnings,
        evidence: evidenceRows,
        sensitiveCount,
        annexGapCount,
        unverifiedIndicatorCount,
        submissionGate,
      },
    };
  }
}

/**
 * Maps a gate issue (carrying claim/section/evidence IDs) to the wizard-facing
 * item. Decision logic for `navigateTo` and `resolution`:
 * - claim-scoped issues can be ACCEPT_WITH_LIMITATION (default) or EXCLUDE
 *   when the claim is confidentiality-scoped;
 * - section-scoped issues (assertion coverage gap, stale assurance) have no
 *   override; user must visit the report workspace and run a reassessment;
 * - evidence-scoped issues point at the evidence detail page;
 * - everything else falls back to the report workspace root.
 */
function toPreflightItem(
  issue: { kind: GateKind; detail: string; claimId?: string; sectionId?: string; evidenceId?: string },
  ctx: { projectId: string; reportingPeriodId: string },
): ExportPreflightItem {
  const { projectId, reportingPeriodId } = ctx;
  const baseId = issue.claimId ?? issue.sectionId ?? issue.evidenceId ?? issue.detail;
  const id = `${issue.kind}:${baseId}`;

  const workspaceHref = (anchor?: string) => {
    const search = anchor ? `?${anchor}` : "";
    return `/projects/${projectId}/reports/${reportingPeriodId}${search}`;
  };

  if (issue.claimId) {
    const isConfidential = issue.kind === "CONFIDENTIALITY_VIOLATION" || /confidential/i.test(issue.detail);
    return {
      id,
      kind: issue.kind,
      message: issue.detail,
      claimId: issue.claimId,
      sectionId: issue.sectionId,
      evidenceId: issue.evidenceId,
      navigateTo: workspaceHref(`section=${issue.sectionId ?? ""}&claim=${issue.claimId}`),
      resolution: isConfidential ? "EXCLUDE" : "ACCEPT_WITH_LIMITATION",
    };
  }

  if (issue.evidenceId) {
    return {
      id,
      kind: issue.kind,
      message: issue.detail,
      sectionId: issue.sectionId,
      evidenceId: issue.evidenceId,
      navigateTo: `/projects/${projectId}/evidence/${issue.evidenceId}`,
      resolution: "NONE",
    };
  }

  if (issue.sectionId) {
    return {
      id,
      kind: issue.kind,
      message: issue.detail,
      sectionId: issue.sectionId,
      navigateTo: workspaceHref(`section=${issue.sectionId}`),
      resolution: "NONE",
    };
  }

  return {
    id,
    kind: issue.kind,
    message: issue.detail,
    navigateTo: workspaceHref(),
    resolution: "NONE",
  };
}
