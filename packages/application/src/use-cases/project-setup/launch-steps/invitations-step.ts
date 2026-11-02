import { ok } from "@donordesk/domain";
import type { ISetupLaunchStep, SetupInviter } from "../../../ports/project-setup-launch.js";

/**
 * Invites the people who were to be invited when the project starts, each to this project. Someone with an invitation already
 * waiting is skipped, so a repeat never invites twice. A person who cannot be invited (already has an account, role not
 * allowed) is named, not fatal.
 */
export class InvitationsStep implements ISetupLaunchStep {
  readonly key = "INVITATIONS";
  constructor(private readonly inviter: SetupInviter) {}
  async run(...[ctx, projectId, draft]: Parameters<ISetupLaunchStep["run"]>) {
    const people = draft.extras.team.filter((p) => p.invite === "NOW" && p.email);
    if (people.length === 0) return ok({ done: 0, notes: [] });
    const pending = await this.inviter.pendingEmails(ctx);
    if (!pending.ok) return pending;
    let done = 0;
    const notes: string[] = [];
    for (const p of people) {
      const email = p.email!.trim().toLowerCase();
      if (pending.value.has(email)) { notes.push(`${p.name} already has an invitation waiting.`); continue; }
      const sent = await this.inviter.invite(ctx, { email, role: p.role, projectIds: [projectId], external: p.external });
      if (sent.ok) done += 1;
      else notes.push(`${p.name}: ${sent.error.message}`);
    }
    return ok({ done, notes });
  }
}
