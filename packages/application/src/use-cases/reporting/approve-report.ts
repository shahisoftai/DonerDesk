import type { Result } from "@donordesk/domain";
import { DomainError, evaluateReportGate, type GateKind } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportDraftRepository, IReportingPeriodRepository, IReportClaimRepository } from "../../ports/reporting.js";
import type { IChecklistRepository } from "../../ports/compliance.js";
import type { IAuditLogger } from "../../ports/core.js";

/**
 * Approves a report only when the gate policy passes. The gate evaluates
 * checklist items (UNSUPPORTED_REPORT_CLAIM, SENSITIVE_DATA_WARNING), claim
 * verification results, and unresolved indicator semantics before
 * `draft.approve()`. Numeric contradictions, confidentiality violations, and
 * unresolved semantics block approval; unsupported claims warn.
 */
export class ApproveReportHandler {
  constructor(
    private readonly drafts: IReportDraftRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly checklist: IChecklistRepository,
    private readonly claims: IReportClaimRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, draftId: string): Promise<Result<void, DomainError>> {
    const r = await this.drafts.findById(draftId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("ReportDraft", draftId) };
    const draft = r.value;

    const gate = await this.evaluateGate(ctx, draft.reportingPeriodId, draftId);
    if (!gate.ok) return gate;
    if (gate.value.approvalBlocked) {
      return {
        ok: false,
        error: DomainError.reportGateBlocked("Report cannot be approved until gate blockers are resolved", {
          blockers: gate.value.blockReasons,
        }),
      };
    }

    draft.approve(ctx.tenant.userId);
    const saved = await this.drafts.update(draft);
    if (!saved.ok) return saved;

    const periodResult = await this.periods.findById(draft.reportingPeriodId, ctx.tenant.tenantId);
    if (periodResult.ok && periodResult.value) {
      const period = periodResult.value;
      period.transitionTo(period.status);
      const savedPeriod = await this.periods.update(period);
      if (!savedPeriod.ok) return savedPeriod;
    }

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.approved",
      entityType: "report_draft",
      entityId: draftId,
      projectId: draft.projectId,
      newValue: JSON.stringify({ gate: gate.value }),
    });
    return { ok: true, value: undefined };
  }

  private async evaluateGate(
    ctx: AuthenticatedContext,
    reportingPeriodId: string,
    draftId: string,
  ): Promise<Result<{ approvalBlocked: boolean; blockReasons: string[] }, DomainError>> {
    const checklistResult = await this.checklist.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!checklistResult.ok) return checklistResult;
    const openSensitive = checklistResult.value.filter(
      (i) => i.type === "SENSITIVE_DATA_WARNING" && (i.status === "OPEN" || i.status === "IN_PROGRESS"),
    );

    const claimsResult = await this.claims.findByDraft(draftId, ctx.tenant.tenantId);
    if (!claimsResult.ok) return claimsResult;
    const claims = claimsResult.value;

    const claimOutcomes: Array<{ kind: GateKind; detail: string }> = [];
    let unresolvedSemantics = 0;
    let numericContradictions = 0;
    for (const claim of claims) {
      if (claim.verificationResult === "PASSED") {
        claimOutcomes.push({ kind: "VERIFIED", detail: claim.verificationDetail });
        continue;
      }
      if (claim.verificationResult === "ACCEPTED_WITH_LIMITATION" || claim.verificationResult === "EXCLUDED") {
        continue;
      }
      const detail = claim.verificationDetail.toLowerCase();
      if (detail.includes("unresolved semantics")) {
        unresolvedSemantics++;
        continue;
      }
      if (detail.includes("contradict")) {
        numericContradictions++;
        claimOutcomes.push({ kind: "NUMERIC_CONTRADICTION", detail: claim.verificationDetail });
        continue;
      }
      if (claim.type === "NUMERIC" || claim.type === "CAUSAL") {
        claimOutcomes.push({ kind: "UNSUPPORTED_MATERIAL_CLAIM", detail: claim.verificationDetail });
      }
    }

    for (const item of openSensitive) {
      claimOutcomes.push({ kind: "CONFIDENTIALITY_VIOLATION", detail: item.title });
    }

    const result = evaluateReportGate({ claimOutcomes, unresolvedSemantics: unresolvedSemantics + numericContradictions });
    return { ok: true, value: { approvalBlocked: result.approvalBlocked, blockReasons: result.blockReasons } };
  }
}
