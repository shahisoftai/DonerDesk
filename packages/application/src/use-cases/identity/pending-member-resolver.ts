import { readResponsibilities, describeResponsibility } from "@donordesk/domain";
import type { IAuditLogger } from "../../ports/core.js";
import type { IPendingMemberRepository, SetupActingContext, SetupMemberAssigner } from "../../ports/project-setup-launch.js";
import { applyResponsibilities, type IResponsibilityApplier } from "../project-setup/launch-steps/responsibility-appliers.js";

export interface PendingResolution {
  /** Projects the person was added to or already belonged to, with what they now own. */
  resolved: number;
  /** Sentences for anything that could not be done; the record is kept for those. */
  notes: string[];
}

/**
 * When someone named in a project setup joins (by any invitation to the same email), they become a member of that project and
 * get what the setup gave them. It acts with the authority of the person who launched the project, never with the new user's.
 * It never stops the person joining: whatever cannot be done is returned as sentences, and that record stays for next time.
 */
export class PendingMemberResolver {
  constructor(
    private readonly pending: IPendingMemberRepository,
    private readonly members: SetupMemberAssigner,
    private readonly acting: SetupActingContext,
    private readonly appliers: ReadonlyArray<IResponsibilityApplier>,
    private readonly audit: IAuditLogger,
  ) {}

  async resolve(input: { tenantId: string; userId: string; email: string }): Promise<PendingResolution> {
    const out: PendingResolution = { resolved: 0, notes: [] };
    const list = await this.pending.listByEmail(input.tenantId, input.email.trim().toLowerCase());
    if (!list.ok) return { resolved: 0, notes: [list.error.message] };
    for (const record of list.value) {
      const ctx = await this.acting.asUser(input.tenantId, record.createdById);
      if (!ctx) { out.notes.push(`The person who started ${record.projectId} can no longer act, so ${record.name}'s responsibilities were not set.`); continue; }
      const joined = await this.members.assign(ctx, record.projectId, input.userId, record.role);
      if (!joined.ok) { out.notes.push(`${record.name} could not be added to the project: ${joined.error.message}`); continue; }
      const applied = await applyResponsibilities(this.appliers, ctx, record.projectId, input.userId, readResponsibilities(record.responsibilitiesJson));
      for (const f of applied.failed) out.notes.push(`${record.name} ${describeResponsibility(f.responsibility)}: ${f.reason}`);
      if (applied.failed.length === 0) {
        await this.pending.delete(record.id, input.tenantId);
        out.resolved += 1;
        await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: input.userId, eventType: "setup.pending_member.resolved", entityType: "project", entityId: record.projectId, newValue: JSON.stringify({ responsibilities: applied.done }) });
      }
    }
    return out;
  }
}
