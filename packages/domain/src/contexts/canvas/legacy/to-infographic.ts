/**
 * A canvas as the design the file renderer draws (Phase 45): each block that a file can hold becomes the section the renderer already
 * knows; every other block is named in `skipped` with the reason, never left out silently. Order is reading order: page by page, top to
 * bottom, left to right. Pure.
 */
import type { InfographicConfig, InfographicSectionConfig, InfographicSectionKind } from "../../infographics/composition.js";
import { formatById } from "../../infographics/formats.js";
import { INFOGRAPHIC_BLOCK_SPECS } from "../blocks/infographic-blocks.js";
import { toLegacySpec, type ChartSpecV2 } from "../../reporting/chart-spec-v2.js";
import type { BlockInstance, Canvas } from "../canvas.js";

export interface SkippedBlock { blockId: string; kind: string; reason: string }
export interface CanvasAsDesign { config: InfographicConfig; skipped: SkippedBlock[] }

type Props = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
const asProps = (b: BlockInstance): Props => (b.props && typeof b.props === "object" ? (b.props as Props) : {});
type Mapped = Partial<InfographicSectionConfig> & { kind: InfographicSectionKind } | string;

const FILE_KINDS = new Set<string>(Object.keys(INFOGRAPHIC_BLOCK_SPECS));
const MAPPERS: Readonly<Record<string, (b: BlockInstance, p: Props) => Mapped>> = {
  TEXT: (_b, p) => ({ kind: "TEXT", ...(str(p.text) ? { text: str(p.text) } : {}) }),
  DIVIDER: () => ({ kind: "DIVIDER" }),
  CALLOUT: (_b, p) => (str(p.text) ? { kind: "TEXT", text: str(p.text) as string } : "The callout has no words."),
  KPI: (_b, p) => (str(p.indicatorId) ? { kind: "BIG_NUMBERS", numbers: [{ label: str(p.title) ?? "", source: "INDICATOR", indicatorId: str(p.indicatorId) as string }] } : "No indicator is chosen."),
  CHART: (_b, p) => {
    const legacy = p.spec ? toLegacySpec(p.spec as ChartSpecV2) : null;
    return legacy ? { kind: "CHART", chart: legacy as never, ...(str((p.spec as { title?: string }).title) ? { title: str((p.spec as { title?: string }).title) } : {}) } : "This chart has no file version yet.";
  },
  MAP: (_b, p) => ({ kind: "MAP", ...(str(p.title) ? { title: str(p.title) } : {}), ...(str(p.shading) ? { mapMetric: p.shading as never } : {}) }),
  TABLE: (_b, p) => ({ kind: "TABLE", ...(str(p.title) ? { title: str(p.title) } : {}), indicatorIds: Array.isArray((p.query as { indicatorIds?: unknown } | undefined)?.indicatorIds) ? ((p.query as { indicatorIds: string[] }).indicatorIds) : [] }),
  AI_SUMMARY: (_b, p) => aiText(p),
  AI_MESSAGES: (_b, p) => aiText(p),
  AI_ASK: (_b, p) => aiText(p),
};
// Only words a person accepted go into a file.
const aiText = (p: Props): Mapped => (p.accepted === true && str(p.text) ? { kind: "TEXT", text: str(p.text) as string } : "The text is a draft that has not been accepted.");
const SCREEN_ONLY: Readonly<Record<string, string>> = {
  METRIC: "Number tiles are shown on screen only.", PROJECT_LIST: "A list of projects is shown on screen only.", GROUP: "A group has no picture of its own.",
  TABS: "Tabs are shown on screen only.", REPEATER: "A repeater is shown on screen only.", FILTER_BAR: "Filters are shown on screen only.",
};

/** A page that is only a screen (fluid web) is put on an A4 page in a file. */
const fileFormatOf = (format: string | undefined): string => (format && formatById(format) ? format : "A4_PORTRAIT");

export function canvasAsDesign(canvas: Canvas): CanvasAsDesign {
  const skipped: SkippedBlock[] = [];
  const sections: InfographicSectionConfig[] = [];
  canvas.pages.forEach((page, pageIndex) => {
    const ordered = [...page.blocks].sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x);
    let first = true;
    for (const block of ordered) {
      if (block.style?.hidden) continue;
      const props = asProps(block);
      const mapper = MAPPERS[block.kind];
      const mapped: Mapped = mapper ? mapper(block, props) : FILE_KINDS.has(block.kind) ? ({ ...props, kind: block.kind } as Mapped) : SCREEN_ONLY[block.kind] ?? "This kind of block cannot be put in a file.";
      if (typeof mapped === "string") { skipped.push({ blockId: block.id, kind: block.kind, reason: mapped }); continue; }
      const section: InfographicSectionConfig = { ...mapped, span: block.bounds.w, ...(block.alt ? { altText: block.alt } : {}), ...(first && pageIndex > 0 ? { pageBreakBefore: true } : {}) } as InfographicSectionConfig;
      sections.push(section);
      first = false;
    }
  });
  const o = canvas.options;
  const config: InfographicConfig = {
    templateId: "CUSTOM", templateVersion: 1, title: canvas.title, themeId: canvas.themeId, language: canvas.language, profile: canvas.profile === "LIVE_INTERNAL" ? "INTERNAL" : canvas.profile,
    format: fileFormatOf(canvas.pages[0]?.format), ...(canvas.scope === "PORTFOLIO" ? { scope: "PORTFOLIO" as const } : {}),
    ...(o?.periodFromId ? { periodFromId: o.periodFromId } : {}), ...(o?.periodToId ? { periodToId: o.periodToId } : {}),
    ...(o?.locationKeys?.length ? { locationKeys: o.locationKeys } : {}), ...(o?.acknowledgement ? { acknowledgement: o.acknowledgement } : {}), ...(o?.subtitle ? { subtitle: o.subtitle } : {}),
    sections,
  };
  return { config, skipped };
}
