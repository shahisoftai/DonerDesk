/**
 * The page a new dashboard starts with when it is made from a map (Phase 53.3): one map block, full width, reading one project and
 * (when chosen) one indicator, in the report look (no ground or labels are stored: the preset decides). Pure.
 */
export interface MapOnlyBlock {
  id: string;
  kind: "MAP";
  bounds: { x: number; y: number; w: number; h: number };
  props: { view: "RESULTS"; indicatorId?: string };
  bindings: Array<{ type: "PROJECT"; slot: "project"; projectId: string }>;
  alt: string;
}
export interface MapOnlyPage { id: string; title: string; blocks: MapOnlyBlock[] }

export function mapOnlyPages(input: { projectId: string; indicatorId?: string | undefined; title: string; alt: string }): MapOnlyPage[] {
  return [{
    id: "page-1", title: input.title,
    blocks: [{
      id: "map-1", kind: "MAP", bounds: { x: 0, y: 0, w: 12, h: 8 },
      props: { view: "RESULTS", ...(input.indicatorId ? { indicatorId: input.indicatorId } : {}) },
      bindings: [{ type: "PROJECT", slot: "project", projectId: input.projectId }],
      alt: input.alt,
    }],
  }];
}
