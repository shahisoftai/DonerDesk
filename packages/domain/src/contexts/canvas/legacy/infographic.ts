/**
 * Reads a stored infographic design as a canvas (Phase 45.1). A section keeps its settings as block props; its width (`span`)
 * and the order the Studio placed it in become grid cells; a page break starts a new page; hidden stays hidden. Anything the
 * canvas cannot yet carry exactly is named in `losses`, never dropped silently.
 */
import { spanOf, type InfographicConfig, type InfographicSectionConfig } from "../../infographics/composition.js";
import { migrateChartSpec } from "../../reporting/chart-spec-v2.js";
import { INFOGRAPHIC_BLOCK_SPECS } from "../blocks/infographic-blocks.js";
import type { BlockInstance, Canvas, CanvasPage } from "../canvas.js";

type One = { kind: string; props: unknown; h: number; loss?: string };
/** One section becomes one block, or several when it held more than one block can (a long key-figures row). */
type Mapped = One | One[] | string;
/** A row of key figures shows this many; a longer one becomes more rows, so nothing is cut. */
const KEY_FIGURES_PER_ROW = 6;
const strip = ({ kind: _k, title: _t, ...rest }: InfographicSectionConfig) => rest;

const CORE_MAPPERS: Readonly<Record<string, (s: InfographicSectionConfig) => Mapped>> = {
  TEXT: (s) => ({ kind: "TEXT", props: { text: s.text ?? "", role: "body" }, h: 2 }),
  DIVIDER: () => ({ kind: "DIVIDER", props: { line: true }, h: 1 }),
  KPIS: (s) => {
    const ids = s.indicatorIds ?? [];
    const chunks = Array.from({ length: Math.max(1, Math.ceil(ids.length / KEY_FIGURES_PER_ROW)) }, (_, i) => ids.slice(i * KEY_FIGURES_PER_ROW, (i + 1) * KEY_FIGURES_PER_ROW));
    return chunks.map((chunk) => ({ kind: "BIG_NUMBERS", props: { numbers: chunk.map((id) => ({ label: "", source: "INDICATOR", indicatorId: id })), ...(s.rounding ? { rounding: s.rounding } : {}) }, h: 2 }));
  },
  CHART: (s) => {
    const spec = s.chart ? migrateChartSpec(s.chart) : null;
    return spec ? { kind: "CHART", props: { spec }, h: 4 } : "The chart's settings could not be read.";
  },
  MAP: (s) => ({ kind: "MAP", props: { view: "RESULTS", ...(s.title ? { title: s.title } : {}), ...(s.mapMetric && s.mapMetric !== "NONE" ? { shading: s.mapMetric } : {}), ...(s.locationKeys?.length ? { placeKeys: s.locationKeys } : {}) }, h: 6 }),
};

const CARRIED_MAPPERS: Record<string, (s: InfographicSectionConfig) => Mapped> = Object.fromEntries(
  (Object.keys(INFOGRAPHIC_BLOCK_SPECS) as Array<keyof typeof INFOGRAPHIC_BLOCK_SPECS>).map((kind) => [kind, (s: InfographicSectionConfig): Mapped => ({ kind, props: { ...(s.title ? { title: s.title } : {}), ...strip(s) }, h: INFOGRAPHIC_BLOCK_SPECS[kind].h })]),
);
const KIND_MAPPERS: Readonly<Record<string, (s: InfographicSectionConfig) => Mapped>> = { ...CARRIED_MAPPERS, ...CORE_MAPPERS };

export interface LegacyInfographic { canvas: Canvas; unreadable: Array<{ index: number; reason: string }>; losses: Array<{ index: number; note: string }> }

export function legacyInfographicToCanvas(input: { id: string; title: string; config: InfographicConfig; revision: number; projectScope?: boolean }): LegacyInfographic {
  const unreadable: LegacyInfographic["unreadable"] = [];
  const losses: LegacyInfographic["losses"] = [];
  const pages: CanvasPage[] = [];
  let page: CanvasPage | null = null;
  let x = 0, y = 0, rowH = 0;
  const newPage = (): CanvasPage => { const p: CanvasPage = { id: `page-${pages.length + 1}`, title: `Page ${pages.length + 1}`, format: input.config.format ?? "A4_PORTRAIT", blocks: [] }; pages.push(p); x = 0; y = 0; rowH = 0; return p; };

  input.config.sections.forEach((section, index) => {
    const mapper = KIND_MAPPERS[section.kind];
    const mapped: Mapped = mapper ? mapper(section) : "This kind of section is not known.";
    if (typeof mapped === "string") { unreadable.push({ index, reason: mapped }); return; }
    const parts = Array.isArray(mapped) ? mapped : [mapped];
    if (!page || section.pageBreakBefore) page = newPage();
    parts.forEach((part, partIndex) => {
      if (part.loss) losses.push({ index, note: part.loss });
      const w = spanOf(section);
      if (x + w > 12) { y += rowH; x = 0; rowH = 0; }
      const id = partIndex === 0 ? `s${index + 1}` : `s${index + 1}-${partIndex + 1}`;
      // The first block carries the section's own flags; a hidden section stays hidden in every part.
      page!.blocks.push({ id, kind: part.kind, props: part.props, bindings: [], bounds: { x, y, w, h: part.h }, ...(section.hidden ? { style: { hidden: true } } : {}), ...(section.altText && partIndex === 0 ? { alt: section.altText } : {}) });
      x += w; rowH = Math.max(rowH, part.h);
    });
  });
  if (pages.length === 0) newPage();

  const canvas: Canvas = {
    id: input.id, scope: input.config.scope === "PORTFOLIO" ? "PORTFOLIO" : "PROJECT", mode: "PUBLISHED_ONLY", profile: input.config.profile ?? "INTERNAL",
    title: input.title, language: input.config.language ?? "en", themeId: input.config.themeId ?? "DEFAULT", pages, revision: input.revision,
    options: {
      ...(input.config.periodFromId ? { periodFromId: input.config.periodFromId } : {}), ...(input.config.periodToId ? { periodToId: input.config.periodToId } : {}),
      ...(input.config.locationKeys?.length ? { locationKeys: input.config.locationKeys } : {}), ...(input.config.acknowledgement ? { acknowledgement: input.config.acknowledgement } : {}),
      ...(input.config.subtitle ? { subtitle: input.config.subtitle } : {}),
    },
  };
  return { canvas, unreadable, losses };
}
