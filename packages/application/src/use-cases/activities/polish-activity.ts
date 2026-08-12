import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IActivityUpdateRepository, IActivityPolisher } from "../../ports/activities.js";

export class PolishActivityHandler {
  constructor(private readonly repo: IActivityUpdateRepository, private readonly polisher: IActivityPolisher) {}

  async handle(ctx: AuthenticatedContext, activityId: string): Promise<Result<{ narrative: string; model: string }, DomainError>> {
    const r = await this.repo.findById(activityId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("ActivityUpdate", activityId) };
    const a = r.value;
    const out = await this.polisher.polish({
      roughSummary: a.summary,
      achievements: a.achievements,
      challenges: a.challenges,
      lessonsLearned: a.lessonsLearned,
    });
    a.setPolishedNarrative(out.narrative);
    const saved = await this.repo.update(a);
    if (!saved.ok) return saved;
    return { ok: true, value: { narrative: out.narrative, model: out.model } };
  }
}
