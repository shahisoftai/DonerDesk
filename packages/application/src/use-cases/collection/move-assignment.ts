import { DomainError, checkAssignmentMove, type Result } from "@donordesk/domain";
import type { MoveAssignmentInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { ICollectionAssignmentRepository } from "../../ports/collection.js";
import { can, fail, ok } from "./assessment-common.js";

/** The assessor (or a designer) moves a facility along: started, or not visited with the reason. DONE is only reached by submitting the record. */
export class MoveAssignmentHandler {
  constructor(private readonly assignments: ICollectionAssignmentRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, assignmentId: string, input: MoveAssignmentInput): Promise<Result<void, DomainError>> {
    const found = await this.assignments.findById(assignmentId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const a = found.value;
    if (!a) return fail(DomainError.notFound("Assignment", assignmentId));
    const mine = a.assigneeId === ctx.tenant.userId;
    if (!(mine && can(ctx, "collection.submit")) && !can(ctx, "project.edit")) return fail(DomainError.forbidden("This facility is not yours"));
    if (input.status === "DONE") return fail(DomainError.validation("A facility is done when its assessment is submitted."));
    const move = checkAssignmentMove(a.status, input.status, input.reason);
    if (!move.ok) return fail(move.refusal === "REASON_NEEDED" ? DomainError.validation("Say why this facility was not visited.") : DomainError.conflict("This facility cannot move that way."));
    const { reason: _drop, ...rest } = a;
    const saved = await this.assignments.update({ ...rest, status: input.status, ...(input.status === "NOT_VISITED" && input.reason?.trim() ? { reason: input.reason.trim() } : {}), updatedAt: this.clock.now() });
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: `collection.assignment.${input.status.toLowerCase()}`, entityType: "collection_assignment", entityId: assignmentId, projectId: a.projectId });
    return ok(undefined);
  }
}
