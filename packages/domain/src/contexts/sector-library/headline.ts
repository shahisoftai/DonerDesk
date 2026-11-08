/**
 * The headline indicators of a sector (Phase 46): the ones marked with a role key, which dashboards and canvases bind to. Ordered
 * so counts come first (the standard dashboard puts two over time first), at most six, one per role key. Ids of the templates built
 * from them follow one naming rule, so a pack can name a template without importing the code that builds it.
 */
import type { LibraryIndicator, LibrarySectorId, SectorContent } from "./model.js";

const ROLE_KEY = /^[a-z][a-z0-9_]{1,39}$/;

export function headlineIndicators(c: SectorContent): LibraryIndicator[] {
  const seen = new Set<string>();
  const withRole = c.indicators.filter((e) => e.roleKey && ROLE_KEY.test(e.roleKey) && e.kind !== "BINARY" && e.kind !== "QUALITATIVE" && !seen.has(e.roleKey) && seen.add(e.roleKey));
  const counts = withRole.filter((e) => e.kind === "COUNT");
  const rest = withRole.filter((e) => e.kind !== "COUNT");
  return [...counts, ...rest].slice(0, 6);
}

const slug = (id: LibrarySectorId): string => id.toLowerCase().replace(/_/g, "-");
export const dashboardTemplateIdFor = (id: LibrarySectorId): string => `tpl-lib-${slug(id)}`;
export const canvasTemplateIdFor = (id: LibrarySectorId): string => `lib-canvas-${slug(id)}`;
