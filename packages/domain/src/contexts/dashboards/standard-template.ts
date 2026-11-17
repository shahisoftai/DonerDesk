/**
 * The shape of a starter dashboard (Phase 34.0), shared by the hand-written sector templates and the templates built from the
 * sector library (Phase 46): a role helper and `standardTemplate`, so a new source of templates does not copy the layout.
 */
import type { IndicatorRole, DashboardTemplate, SectorKey, TemplateAudience, TemplateWidget } from "./dashboard-templates.js";

export const role = (key: string, label: string, hint: string, keywords: string[], o: { types?: IndicatorRole["types"]; required?: boolean; libraryIds?: readonly string[] } = {}): IndicatorRole => ({
  key,
  label,
  hint,
  keywords,
  types: o.types ?? ["COUNT"],
  required: o.required ?? true,
  ...(o.libraryIds?.length ? { libraryIds: o.libraryIds } : {}),
});

/**
 * The standard shape of a results dashboard: progress of every role against target, the first two over time, the third against its
 * baseline and target and the fourth by period. Positions are on the 12-column grid. (Phase 60.4: the "how much of the data is
 * verified" pie is gone, because it is an internal data-quality view that does not belong on a donor- or coordination-facing page;
 * the verified/unverified mark stays on every figure.)
 */
export function standardTemplate(input: { id: string; sector: SectorKey; title: string; description: string; audience: TemplateAudience; roles: IndicatorRole[] }): DashboardTemplate {
  const [r1, r2, r3, r4] = input.roles;
  const allKeys = input.roles.map((r) => r.key);
  const chart = (id: string, title: string, x: number, y: number, w: number, h: number, c: NonNullable<TemplateWidget["chart"]>): TemplateWidget => ({ id, kind: "CHART", title, x, y, w, h, chart: c });
  const widgets: TemplateWidget[] = [
    chart("progress", "Progress against targets", 0, 0, 12, 4, { kind: "BAR", template: "INDICATORS_PROGRESS", roleKeys: allKeys, measure: "PERCENT_OF_TARGET", showTarget: false }),
    chart("trend-1", r1!.label, 0, 4, 6, 4, { kind: "LINE", template: "INDICATOR_OVER_TIME", roleKeys: [r1!.key], measure: "CUMULATIVE", showTarget: true }),
    chart("trend-2", r2!.label, 6, 4, 6, 4, { kind: "LINE", template: "INDICATOR_OVER_TIME", roleKeys: [r2!.key], measure: "CUMULATIVE", showTarget: true }),
    chart("vs-target", `${r3!.label}: baseline, target and result`, 0, 8, 6, 4, { kind: "BAR", template: "INDICATOR_VS_TARGET", roleKeys: [r3!.key], measure: "CUMULATIVE", showTarget: false }),
    chart("by-period", `${r4!.label} by period`, 6, 8, 6, 4, { kind: "BAR", template: "INDICATOR_OVER_TIME", roleKeys: [r4!.key], measure: "PERIOD", showTarget: false }),
  ];
  return { id: input.id, sector: input.sector, title: input.title, description: input.description, audience: input.audience, status: "DRAFT", origin: "BUILT_IN", revision: 1, roles: input.roles, widgets };
}

