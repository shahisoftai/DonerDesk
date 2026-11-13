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
export interface MapOnlyPage { id: string; title: string; format: string; blocks: MapOnlyBlock[] }

/** A name that fits the wire limits (a canvas 120, a page 80, a block's alt text 500): cut at a word, never mid-word when it can be avoided. */
export function fitText(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max / 2 ? cut.slice(0, at) : cut).trimEnd()}…`;
}

export function mapOnlyPages(input: { projectId: string; indicatorId?: string | undefined; title: string; alt: string }): MapOnlyPage[] {
  return [{
    id: "page-1", title: fitText(input.title, 80), format: "WEB_FLUID",
    blocks: [{
      id: "map-1", kind: "MAP", bounds: { x: 0, y: 0, w: 12, h: 8 },
      props: { view: "RESULTS", ...(input.indicatorId ? { indicatorId: input.indicatorId } : {}) },
      bindings: [{ type: "PROJECT", slot: "project", projectId: input.projectId }],
      alt: fitText(input.alt, 500),
    }],
  }];
}
