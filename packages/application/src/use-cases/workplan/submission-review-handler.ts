import { DomainError, Permissions, err, ok, parseSubmissions, reviewRows, type Result, type Role, type SubmissionMapping } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IBeneficiaryRepository, IPlanContextReader, IProjectSubmissionMappingRepository } from "../../ports/workplan.js";

/**
 * Reads a file without saving anything: which rows are fine, which case codes are already used (refused), and which rows look like
 * someone already on the register (listed for a person to decide). The same reading rules as the import.
 */
export class PreviewSubmissionsHandler {
  constructor(private readonly repo: IBeneficiaryRepository, private readonly context: IPlanContextReader, private readonly mappings?: IProjectSubmissionMappingRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string, csv: string, mapping?: SubmissionMapping): Promise<Result<{ ready: number; problems: Array<{ line: number; message: string }>; clashes: Array<{ line: number; caseCode: string }>; likely: Array<{ line: number; caseCode: string; looksLike: string[] }> }, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "activity.create")) return err(DomainError.forbidden("You cannot add people to this project"));
    if (ctx.tenant.role !== "ADMIN") {
      const members = await this.context.activeMemberIds(projectId, ctx.tenant.tenantId);
      if (!members.ok) return members;
      if (!members.value.has(ctx.tenant.userId)) return err(DomainError.forbidden("You are not on this project"));
    }
    let chosen = mapping;
    if (!chosen && this.mappings) {
      const saved = await this.mappings.find(projectId, ctx.tenant.tenantId);
      if (!saved.ok) return saved;
      chosen = (saved.value ?? undefined) as SubmissionMapping | undefined;
    }
    const parsed = parseSubmissions(csv, chosen);
    if (!parsed.ok) return parsed;
    const existing = await this.repo.findByProject(projectId, ctx.tenant.tenantId);
    if (!existing.ok) return existing;
    const review = reviewRows(parsed.value.rows, existing.value);
    return ok({
      ready: parsed.value.rows.length - review.clashes.length,
      problems: parsed.value.problems,
      clashes: review.clashes,
      likely: review.likely,
    });
  }
}
