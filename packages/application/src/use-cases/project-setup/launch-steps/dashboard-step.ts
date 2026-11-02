import { SECTOR_TEMPLATES, ok, suggestRoleMapping } from "@donordesk/domain";
import type { ISetupLaunchStep, SetupDashboardWriter } from "../../../ports/project-setup-launch.js";

/**
 * Makes the starting dashboard the person chose. Which indicator answers each of its roles is only suggested, by the words they
 * share, and never guessed: a role with no clear match stays empty and its charts are named as left out. A dashboard with nothing
 * it can draw is a note, not a failure.
 */
export class DashboardStep implements ISetupLaunchStep {
  readonly key = "DASHBOARD";
  constructor(private readonly writer: SetupDashboardWriter) {}
  async run(...[ctx, projectId, draft]: Parameters<ISetupLaunchStep["run"]>) {
    const templateId = draft.extras.dashboardTemplate;
    if (!templateId) return ok({ done: 0, notes: [] });
    const template = SECTOR_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return ok({ done: 0, notes: ["The dashboard you chose is no longer offered, so none was made."] });
    const indicators = await this.writer.indicators(ctx, projectId);
    if (!indicators.ok) return indicators;
    const mapping = suggestRoleMapping(template.roles, indicators.value);
    const made = await this.writer.apply(ctx, templateId, { projectId, name: template.title, mapping });
    if (!made.ok) return ok({ done: 0, notes: [`The starting dashboard was not made: ${made.error.message}`] });
    return ok({ done: 1, notes: made.value.chartsLeftOut.map((c) => `“${c.title}” was left out: no indicator clearly answers ${c.missingRoles.join(", ")}. Choose one on the dashboard.`) });
  }
}
