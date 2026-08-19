import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
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

export const EXPORT_TYPES = [
  "WORD",
  "PDF",
  "EXCEL_INDICATORS",
  "EVIDENCE_CHECKLIST",
  "EVIDENCE_PACK_ZIP",
] as const;

/**
 * Composes an authoritative preflight for the export wizard: the exact report
 * version, allowed export types, blocking and overridable warnings, and which
 * evidence files are included or excluded by default (sensitive handling).
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
  ) {}

  async handle(ctx: AuthenticatedContext, reportingPeriodId: string): Promise<Result<unknown, DomainError>> {
    const periodResult = await this.periods.findById(reportingPeriodId, ctx.tenant.tenantId);
    if (!periodResult.ok) return periodResult;
    if (!periodResult.value) return { ok: false, error: DomainError.notFound("ReportingPeriod", reportingPeriodId) };

    const draftsResult = await this.drafts.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!draftsResult.ok) return draftsResult;
    const draft = draftsResult.value[0];

    const blocking: Array<{ code: string; message: string }> = [];
    const warnings: Array<{ code: string; message: string; overridable: boolean }> = [];

    if (!draft) {
      blocking.push({ code: "NO_DRAFT", message: "No report draft exists yet. Generate or create a draft before exporting." });
      return {
        ok: true,
        value: {
          draft: null,
          exportTypes: EXPORT_TYPES,
          blocking,
          warnings: [],
          evidence: [],
          sensitiveCount: 0,
          annexGapCount: 0,
          unverifiedIndicatorCount: 0,
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
    if (updatesResult.ok) {
      unverifiedIndicatorCount = updatesResult.value.filter((u) => u.verificationStatus !== "VERIFIED").length;
    }

    let openCriticalCount = 0;
    let annexGapCount = 0;
    const checklistResult = await this.checklist.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (checklistResult.ok) {
      for (const item of checklistResult.value) {
        const open = item.status !== "RESOLVED" && item.status !== "ACCEPTED_RISK" && item.status !== "NOT_APPLICABLE";
        if (!open) continue;
        if (item.severity === "CRITICAL" || item.severity === "HIGH") openCriticalCount += 1;
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
    let submissionGate: { approvalBlocked: boolean; submitBlocked: boolean; submitNeedsDecision: boolean; blockReasons: string[] } = {
      approvalBlocked: false,
      submitBlocked: false,
      submitNeedsDecision: false,
      blockReasons: [],
    };
    const gateResult = await this.gate.evaluateGate(ctx, reportingPeriodId, draft.id);
    if (gateResult.ok) {
      submissionGate = gateResult.value;
      if (submissionGate.submitBlocked || submissionGate.approvalBlocked) {
        for (const reason of submissionGate.blockReasons) {
          blocking.push({ code: "SUBMISSION_GATE", message: reason });
        }
      } else if (submissionGate.submitNeedsDecision) {
        warnings.push({
          code: "SUBMISSION_NEEDS_DECISION",
          message: "Submission requires an authorized limitation, exclusion, or human decision.",
          overridable: false,
        });
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
