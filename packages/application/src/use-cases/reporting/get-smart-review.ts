import type { Result } from "@donordesk/domain";
import { DomainError, summarizeSmartReview, type SmartReviewSummary } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type {
  IReportDraftRepository,
  IReportClaimRepository,
  IReportSectionRepository,
} from "../../ports/reporting.js";
import { ApproveReportHandler } from "./approve-report.js";

/**
 * Smart Review — a thin read over the authoritative gate.
 *
 * It calls the same `evaluateGate` used for approval/preflight/export (no
 * second verifier, no second source of truth), then runs `summarizeSmartReview`
 * to group the gate's blocking issues into plain-language, deduped items. The
 * user acts on these via the existing claim/section workflows; the underlying
 * gate state is unchanged and remains authoritative.
 */
export class GetSmartReviewHandler {
  constructor(
    private readonly drafts: IReportDraftRepository,
    private readonly approveGate: ApproveReportHandler,
    private readonly claims: IReportClaimRepository,
    private readonly sections: IReportSectionRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, reportingPeriodId: string): Promise<Result<SmartReviewSummary, DomainError>> {
    const draftsResult = await this.drafts.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!draftsResult.ok) return draftsResult;
    const draft = draftsResult.value.find((d) => !d.isSuperseded) ?? null;
    if (!draft) return { ok: true, value: { issueCount: 0, blockingCount: 0, items: [] } };

    const gate = await this.approveGate.evaluateGate(ctx, reportingPeriodId, draft.id);
    if (!gate.ok) return gate;

    const [claimsResult, sectionsResult] = await Promise.all([
      this.claims.findByDraft(draft.id, ctx.tenant.tenantId),
      this.sections.findByReportDraft(draft.id, ctx.tenant.tenantId),
    ]);
    const claimTextById = new Map<string, string>();
    if (claimsResult.ok) {
      for (const c of claimsResult.value) claimTextById.set(c.id, c.text);
    }
    const sectionTitleById = new Map<string, string>();
    if (sectionsResult.ok) {
      for (const s of sectionsResult.value) sectionTitleById.set(s.id, s.sectionTitle);
    }

    const summary = summarizeSmartReview({
      blockingIssues: gate.value.blockingIssues,
      claimTextById,
      sectionTitleById,
    });
    return { ok: true, value: summary };
  }
}
