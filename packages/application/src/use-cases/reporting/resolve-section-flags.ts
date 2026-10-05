import type { Result } from "@donordesk/domain";
import { DomainError, Permissions, isBulkAcceptable, type FlagClass, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportClaimRepository, IReportSectionRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";
import { flagClassOf } from "../../services/flag-class.js";
import type { ResolveReportClaimHandler } from "./resolve-report-claim.js";
import type { ApproveReportSectionHandler } from "./approve-report-section.js";

export interface ResolveSectionFlagsInput {
  sectionId: string;
  /** The one explained decision, applied to every statement accepted. */
  note: string;
  /** Also approve the section once nothing else blocks it. */
  approve?: boolean;
}

export interface ResolveSectionFlagsOutcome {
  resolved: number;
  approved: boolean;
  /** Open statements this action must not decide, each with why a person has to look. */
  remaining: Array<{ claimId: string; flagClass: FlagClass; text: string }>;
}

const MIN_NOTE = 10;

/**
 * "Accept what the checker could not confirm, with one explained decision, and approve."
 * Orchestration only: every claim is resolved by `ResolveReportClaimHandler` (permission,
 * confidentiality gate, per-claim audit, assurance reconciliation) and the section is approved
 * by `ApproveReportSectionHandler` (whose gate is unchanged). Figure errors and decisions the
 * reviewer must make are never touched; they come back in `remaining`.
 */
export class ResolveSectionFlagsHandler {
  constructor(
    private readonly sections: IReportSectionRepository,
    private readonly claims: IReportClaimRepository,
    private readonly resolveClaim: ResolveReportClaimHandler,
    private readonly approveSection: ApproveReportSectionHandler,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, input: ResolveSectionFlagsInput): Promise<Result<ResolveSectionFlagsOutcome, DomainError>> {
    const note = input.note.trim();
    if (note.length < MIN_NOTE) {
      return { ok: false, error: DomainError.validation(`Explain your decision in at least ${MIN_NOTE} characters; it is recorded with each accepted statement.`) };
    }
    if (input.approve && !Permissions.can(ctx.tenant.role as Role, "report.approve")) {
      return { ok: false, error: DomainError.forbidden("Only approvers can approve a section", { capability: "report.approve" }) };
    }
    const section = await this.sections.findById(input.sectionId, ctx.tenant.tenantId);
    if (!section.ok) return section;
    if (!section.value) return { ok: false, error: DomainError.notFound("ReportSection", input.sectionId) };

    let resolved = 0;
    // Resolving re-creates the section's claims, so the open set is re-read after every decision.
    for (let guard = 0; guard < 500; guard++) {
      const next = await this.nextAcceptable(ctx, input.sectionId);
      if (!next.ok) return next;
      if (!next.value) break;
      const r = await this.resolveClaim.handle(ctx, next.value, { resolution: "ACCEPTED_WITH_LIMITATION", notes: note });
      if (!r.ok) return r;
      resolved += 1;
    }

    const open = await this.openClaims(ctx, input.sectionId);
    if (!open.ok) return open;
    const remaining = open.value
      .map((c) => ({ claimId: c.id, flagClass: classify(c).class, text: c.text }))
      .filter((c) => !isBulkAcceptable(c.flagClass));

    let approved = false;
    if (input.approve && remaining.length === 0) {
      const a = await this.approveSection.handle(ctx, input.sectionId);
      if (!a.ok) return a;
      approved = true;
    }

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.section.flags_resolved",
      entityType: "report_section",
      entityId: input.sectionId,
      newValue: `resolved=${resolved};approved=${approved}`,
      systemNote: note,
    });
    return { ok: true, value: { resolved, approved, remaining } };
  }

  private async openClaims(ctx: AuthenticatedContext, sectionId: string) {
    const all = await this.claims.findBySection(sectionId, ctx.tenant.tenantId);
    if (!all.ok) return all;
    return { ok: true as const, value: all.value.filter((c) => c.verificationResult === "FAILED" && c.resolvedById === undefined) };
  }

  private async nextAcceptable(ctx: AuthenticatedContext, sectionId: string): Promise<Result<string | undefined, DomainError>> {
    const open = await this.openClaims(ctx, sectionId);
    if (!open.ok) return open;
    return { ok: true, value: open.value.find((c) => isBulkAcceptable(classify(c).class))?.id };
  }
}

function classify(c: Parameters<typeof flagClassOf>[0]) {
  return { class: flagClassOf(c) };
}
