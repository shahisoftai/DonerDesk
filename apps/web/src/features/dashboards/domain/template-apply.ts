/**
 * What the template screens decide with no React in them (Phase 34.3): the role choices a person starts from, and whether a template can
 * make a dashboard yet. The rules themselves are the domain's (`suggestRoleMapping`, `applyTemplate`).
 */
import { applyTemplate, suggestRoleMapping, type DashboardTemplate, type ProjectIndicatorFacts } from "@donordesk/domain/contexts/dashboards/dashboard-templates.js";

export type RoleChoices = Record<string, string | null>;

/** The suggestion for each role (a match by shared words among indicators of a fitting kind), or null where nothing fits. Never a guess. */
export const initialChoices = (t: DashboardTemplate, indicators: ReadonlyArray<ProjectIndicatorFacts>): RoleChoices => suggestRoleMapping(t.roles, indicators);

/** One indicator answers one role: choosing it for a second role clears the first. */
export function choose(choices: RoleChoices, roleKey: string, indicatorId: string | null): RoleChoices {
  const next: RoleChoices = { ...choices };
  if (indicatorId !== null) for (const k of Object.keys(next)) if (k !== roleKey && next[k] === indicatorId) next[k] = null;
  next[roleKey] = indicatorId;
  return next;
}

export interface ApplyPreview { drawable: number; leftOut: Array<{ title: string; missingRoles: string[] }>; unmappedRequired: string[] }

/** What the dashboard would hold with these choices: how many charts can be drawn and which cannot, and the required roles still empty. */
export function previewApply(t: DashboardTemplate, choices: RoleChoices): ApplyPreview {
  const a = applyTemplate(t, choices);
  return {
    drawable: a.widgets.filter((w) => w.state === "READY").length,
    leftOut: a.widgets.filter((w) => w.state !== "READY").map((w) => ({ title: w.widget.title, missingRoles: w.missingRoles })),
    unmappedRequired: a.unmappedRequired,
  };
}
