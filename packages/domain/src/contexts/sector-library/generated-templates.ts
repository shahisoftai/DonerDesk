/**
 * Dashboards and canvases built from the library (Phase 46): one results dashboard and one results canvas for every sector whose
 * hand-written templates do not already cover it, made from its headline indicators. They name roles, never indicators, so applying
 * one asks the person to choose (or, for an adopted library indicator, finds it by name) and draws nothing from a guess.
 */
import type { DashboardTemplate, IndicatorRole, RoleIndicatorType } from "../dashboards/dashboard-templates.js";
import { role as dashboardRole, standardTemplate } from "../dashboards/standard-template.js";
import type { CanvasTemplate, TemplateRole } from "../canvas/template.js";
import { HOUSE_THEME, block, chart, kpi, page, role as canvasRole } from "../canvas/template-kit.js";
import { SECTOR_REGISTRY } from "./sectors.js";
import { BUILT_IN_CONTENT } from "./library.js";
import { canvasTemplateIdFor, dashboardTemplateIdFor, headlineIndicators } from "./headline.js";
import { LIBRARY_SECTOR_IDS } from "./model.js";
import { variantsOf } from "./generated-variants.js";
import type { LibraryIndicator, SectorContent } from "./model.js";

const TYPES: Readonly<Record<LibraryIndicator["kind"], RoleIndicatorType[]>> = { COUNT: ["COUNT"], RATE: ["PERCENTAGE"], RATIO: ["RATIO"], INDEX: ["RATIO"], BINARY: ["ANY"], QUALITATIVE: ["ANY"] };
const STOP = new Set(["the", "and", "with", "from", "that", "per", "for", "people"]);

const keywordsOf = (name: string): string[] => [...new Set(name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !STOP.has(w)))].slice(0, 5);

function dashboardRoles(c: SectorContent): IndicatorRole[] {
  return headlineIndicators(c).map((e, i) => dashboardRole(e.roleKey!, e.name, e.definition.slice(0, 160), keywordsOf(e.name), { types: TYPES[e.kind], required: i < 3, libraryIds: [e.id] }));
}

export function libraryDashboardTemplate(c: SectorContent): DashboardTemplate | null {
  const roles = dashboardRoles(c);
  // `headlineIndicators` lists counts first; the standard layout draws the first two over time as running totals, so a sector with fewer than two counts has no dashboard.
  if (roles.length < 4 || roles.slice(0, 2).some((r) => !r.types.includes("COUNT"))) return null;
  const def = SECTOR_REGISTRY[c.sectorId];
  return standardTemplate({ id: dashboardTemplateIdFor(c.sectorId), sector: def.templateSector, title: `${def.label}: results`, description: `Progress of ${def.label.toLowerCase()} results. ${c.summary}`.slice(0, 480), audience: "PROGRAMME", roles });
}

export function libraryCanvasTemplate(c: SectorContent): CanvasTemplate | null {
  const head = headlineIndicators(c);
  if (head.length < 4) return null;
  const [a, b, d, e] = head as [LibraryIndicator, LibraryIndicator, LibraryIndicator, LibraryIndicator];
  const roles: TemplateRole[] = head.map((h, i) => canvasRole(h.roleKey!, h.name, i === 0));
  const def = SECTOR_REGISTRY[c.sectorId];
  return {
    origin: "BUILT_IN", revision: 1, id: canvasTemplateIdFor(c.sectorId), title: `${def.label}: results at a glance`, family: "SECTOR_RESULTS",
    description: `The headline ${def.label.toLowerCase()} indicators, progress to target and one trend.`, roles,
    canvas: {
      profile: "LIVE_INTERNAL", mode: "LIVE", language: "en", themeId: HOUSE_THEME, pages: page([
        kpi("k1", [0, 0, 3, 2], a.roleKey!), kpi("k2", [3, 0, 3, 2], b.roleKey!), kpi("k3", [6, 0, 3, 2], d.roleKey!), kpi("k4", [9, 0, 3, 2], e.roleKey!),
        chart("trend", [0, 2, 8, 4], a.roleKey!, a.kind === "COUNT" ? "LINE" : "BAR", a.name),
        block("rings", "PROGRESS_RINGS", [8, 2, 4, 4], { indicatorIds: [`{{role:${a.roleKey}}}`, `{{role:${b.roleKey}}}`, `{{role:${d.roleKey}}}`], title: "Progress to target" }),
      ]),
    },
  };
}

const present = <T>(x: T | null): x is T => x !== null;

/** Sectors whose hand-written dashboard templates already cover them keep those; the rest get one built from the library. */
export const LIBRARY_DASHBOARD_TEMPLATES: readonly DashboardTemplate[] = LIBRARY_SECTOR_IDS
  .map((id) => BUILT_IN_CONTENT[id])
  .filter((c) => c.dashboardTemplates.length === 0)
  .map(libraryDashboardTemplate)
  .filter(present);

export const LIBRARY_CANVAS_TEMPLATES: readonly CanvasTemplate[] = LIBRARY_SECTOR_IDS.flatMap((id) => {
  const results = libraryCanvasTemplate(BUILT_IN_CONTENT[id]);
  return results ? [results, ...variantsOf(BUILT_IN_CONTENT[id])] : [];
});
