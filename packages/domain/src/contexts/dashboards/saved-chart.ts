/**
 * Saved charts (Phase 34.1): a chart the team keeps. It stores the specification only, never data: every figure is drawn from the
 * project's data sheet when it is opened. A saved chart is always about one project's data. The sharing rules are the dashboards' own
 * (one rule: who sees and who changes a shared thing), so a person never has to learn two.
 */
import { canEditDashboard, canSeeDashboard, type DashboardViewer } from "./dashboard.js";

export type SavedChartScope = "MINE" | "PROJECT";
export const SAVED_CHART_SCOPES: readonly SavedChartScope[] = ["MINE", "PROJECT"];

export interface SavedChartAccessFacts { scope: SavedChartScope; ownerId: string; projectId: string }

/** A personal chart is seen only by its owner; a project chart by anyone who can see the project (checked by the handler). */
export const canSeeSavedChart = (c: SavedChartAccessFacts, viewer: Pick<DashboardViewer, "userId">): boolean => canSeeDashboard(c, viewer);

/** Its owner always; a project chart also anyone who manages shared work. */
export const canEditSavedChart = (c: SavedChartAccessFacts, viewer: DashboardViewer): boolean => canEditDashboard(c, viewer);

export const MAX_CHART_NAME = 120;

/** An earlier version of a saved chart: when it was replaced, by whom, and what it was. */
export interface ChartVersion { at: string; by: string; name: string; spec: Record<string, unknown> }

export const MAX_CHART_VERSIONS = 10;

/**
 * The version list after a chart is changed: the version being replaced goes to the front, the list keeps the newest
 * `MAX_CHART_VERSIONS`, and a save that changes nothing adds nothing.
 */
export function pushChartVersion(versions: ReadonlyArray<ChartVersion>, replaced: ChartVersion, next: { name: string; spec: Record<string, unknown> }): ChartVersion[] {
  if (replaced.name === next.name && JSON.stringify(replaced.spec) === JSON.stringify(next.spec)) return [...versions];
  return [replaced, ...versions].slice(0, MAX_CHART_VERSIONS);
}
