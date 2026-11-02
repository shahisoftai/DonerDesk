import { describeResponsibility, ok, responsibilitiesOf, type Responsibility } from "@donordesk/domain";
import type { IPendingMemberRepository, ISetupLaunchStep, SetupMemberAssigner, SetupUserDirectory } from "../../../ports/project-setup-launch.js";
import { applyResponsibilities, type IResponsibilityApplier } from "./responsibility-appliers.js";

/**
 * Puts the named team on the project and gives them what they own. Someone who already has an account becomes a member now and
 * gets their responsibilities now. Someone who does not is remembered, with their responsibilities, and gets them the moment
 * they join. A person with no email cannot be remembered, so they are named in the report. Safe to run again.
 */
export class ResponsibilitiesStep implements ISetupLaunchStep {
  readonly key = "RESPONSIBILITIES";
  constructor(
    private readonly users: SetupUserDirectory,
    private readonly members: SetupMemberAssigner,
    private readonly pending: IPendingMemberRepository,
    private readonly appliers: ReadonlyArray<IResponsibilityApplier>,
    private readonly now: () => Date,
    private readonly newId: () => string,
  ) {}

  async run(...[ctx, projectId, draft]: Parameters<ISetupLaunchStep["run"]>) {
    const emails = draft.extras.team.flatMap((p) => (p.email ? [p.email.trim().toLowerCase()] : []));
    const known = emails.length > 0 ? await this.users.idsByEmail(ctx, emails) : ok(new Map<string, string>());
    if (!known.ok) return known;
    let done = 0;
    const notes: string[] = [];
    for (const person of draft.extras.team) {
      const mine = responsibilitiesOf(draft, person.key);
      const email = person.email?.trim().toLowerCase();
      if (!email) {
        if (mine.length > 0) notes.push(`${person.name} has no email address, so ${mine.map(describeResponsibility).join(" and ")} could not be kept for them. Choose someone who has joined, once they have.`);
        continue;
      }
      const userId = known.value.get(email);
      if (!userId) {
        const kept = await this.keep(ctx.tenant.tenantId.toString(), projectId, ctx.tenant.userId, person, email, mine);
        if (!kept.ok) return kept;
        done += 1;
        continue;
      }
      const joined = await this.members.assign(ctx, projectId, userId, person.role);
      if (!joined.ok) { notes.push(`${person.name} could not be added to the project: ${joined.error.message}`); continue; }
      const applied = await applyResponsibilities(this.appliers, ctx, projectId, userId, mine);
      done += 1;
      for (const f of applied.failed) notes.push(`${person.name} ${describeResponsibility(f.responsibility)}: ${f.reason}`);
    }
    return ok({ done, notes });
  }

  private async keep(tenantId: string, projectId: string, launchedBy: string, person: { name: string; role: string }, email: string, mine: Responsibility[]) {
    const existing = await this.pending.find(tenantId, projectId, email);
    if (!existing.ok) return existing;
    if (existing.value) return ok(undefined);
    return this.pending.create({ id: this.newId(), tenantId, projectId, email, name: person.name, role: person.role, createdById: launchedBy, responsibilitiesJson: JSON.stringify(mine), createdAt: this.now() });
  }
}
