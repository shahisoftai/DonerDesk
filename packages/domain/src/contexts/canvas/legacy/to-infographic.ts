/**
 * A canvas as the design the file renderer draws (Phase 45): each block that a file can hold becomes the section the renderer already
 * knows; every other block is named in `skipped` with the reason, never left out silently. Order is reading order: page by page, top to
 * bottom, left to right. Pure.
 */
import type { InfographicConfig, InfographicSectionConfig, InfographicSectionKind } from "../../infographics/composition.js";
import { GRID_SPANS, formatById } from "../../infographics/formats.js";
import { themeById } from "../../infographics/theme.js";
import { PORTFOLIO_KINDS } from "../../infographics/composition.js";
import { INFOGRAPHIC_BLOCK_SPECS } from "../blocks/infographic-blocks.js";
import { toLegacySpec, type ChartSpecV2 } from "../../reporting/chart-spec-v2.js";
import type { BlockInstance, Canvas } from "../canvas.js";
import { projectOf } from "../binding.js";
import { childrenOf, containerRole, isContainerKind, topLevel } from "../containers.js";

export interface SkippedBlock { blockId: string; kind: string; reason: string }
export interface CanvasAsDesign { config: InfographicConfig; skipped: SkippedBlock[] }

type Props = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
const asProps = (b: BlockInstance): Props => (b.props && typeof b.props === "object" ? (b.props as Props) : {});
type Mapped = Partial<InfographicSectionConfig> & { kind: InfographicSectionKind; /** Drawn in the file, but part of it is screen-only: said, never dropped silently. */ screenOnlyPart?: string } | string;

const FILE_KINDS = new Set<string>(Object.keys(INFOGRAPHIC_BLOCK_SPECS));
const MAPPERS: Readonly<Record<string, (b: BlockInstance, p: Props) => Mapped>> = {
  TEXT: (_b, p) => ({ kind: "TEXT", ...(str(p.text) ? { text: str(p.text) } : {}) }),
  DIVIDER: () => ({ kind: "DIVIDER" }),
  SHAPE: (_b, p) => ({ kind: "SHAPE", ...(str(p.shape) ? { shape: p.shape as never } : {}), ...(str(p.tone) ? { tone: p.tone as never } : {}) }),
  ICON: (_b, p) => (str(p.iconId) ? { kind: "ICON", iconId: str(p.iconId) as string, ...(str(p.tone) ? { tone: p.tone as never } : {}), ...(str(p.label) ? { altText: str(p.label) as string } : {}) } : "No icon is chosen."),
  CALLOUT: (_b, p) => (str(p.text) ? { kind: "TEXT", text: str(p.text) as string } : "The callout has no words."),
  KPI: (_b, p) => (str(p.indicatorId) ? { kind: "BIG_NUMBERS", numbers: [{ label: str(p.title) ?? "", source: "INDICATOR", indicatorId: str(p.indicatorId) as string }] } : "No indicator is chosen."),
  CHART: (_b, p) => {
    const legacy = p.spec ? toLegacySpec(p.spec as ChartSpecV2) : null;
    return legacy ? { kind: "CHART", chart: legacy as never, ...(str((p.spec as { title?: string }).title) ? { title: str((p.spec as { title?: string }).title) } : {}) } : "This chart has no file version yet.";
  },
  MAP: (_b, p) => ({ kind: "MAP", ...(str(p.title) ? { title: str(p.title) } : {}), ...(str(p.shading) ? { mapMetric: p.shading as never } : {}), ...(p.markers ? { screenOnlyPart: "The small charts on this map are drawn on screen only; the file has the map without them." } : {}) }),
  TABLE: (_b, p) => ({ kind: "TABLE", ...(str(p.title) ? { title: str(p.title) } : {}), indicatorIds: Array.isArray((p.query as { indicatorIds?: unknown } | undefined)?.indicatorIds) ? ((p.query as { indicatorIds: string[] }).indicatorIds) : [] }),
  METRIC: (_b, p) => metricFigure(p),
  MULTI_CARD: (_b, p) => multiCardFigures(p),
  PROJECT_LIST: () => "PROJECT_LIST_FILE",
  AI_SUMMARY: (_b, p) => aiText(p),
  AI_MESSAGES: (_b, p) => aiText(p),
  AI_ASK: (_b, p) => aiText(p),
};
// Only words a person accepted go into a file.
const aiText = (p: Props): Mapped => (p.accepted === true && str(p.text) ? { kind: "TEXT", text: str(p.text) as string } : "The text is a draft that has not been accepted.");
/** A number tile a file can hold: the activity counts that have a figure in the file renderer. Money is shown on screen only. */
const METRIC_SOURCE: Readonly<Record<string, string>> = { ACTIVITIES_TOTAL: "ACTIVITIES_PLANNED", ACTIVITIES_DONE: "ACTIVITIES_DONE", ACTIVITIES_LATE: "ACTIVITIES_LATE" };
const metricFigure = (p: Props): Mapped => {
  const source = METRIC_SOURCE[String(p.metric)];
  return source ? { kind: "BIG_NUMBERS", numbers: [{ label: str(p.title) ?? "", source: source as never }] } : "Money and in-progress counts are shown on screen only.";
};
/** A figure card goes into a file as big numbers when every figure is an indicator's; counts and money are shown on screen only, so such a card is named as left out rather than printed with figures missing. */
const multiCardFigures = (p: Props): Mapped => {
  const items = Array.isArray(p.items) ? (p.items as Array<{ source?: { kind?: string; indicatorId?: string }; label?: string }>) : [];
  if (items.length === 0) return "The card has no figures.";
  if (items.some((i) => i.source?.kind !== "INDICATOR" || !str(i.source.indicatorId))) return "Counts of places, donors, partners and facilities are shown on screen only.";
  return { kind: "BIG_NUMBERS", ...(str(p.header) ? { title: str(p.header) } : {}), numbers: items.map((i) => ({ label: str(i.label) ?? "", source: "INDICATOR", indicatorId: i.source!.indicatorId as string })) } as Mapped;
};
const SCREEN_ONLY: Readonly<Record<string, string>> = {
  GROUP: "A group has no picture of its own.",
  TABS: "Tabs are shown on screen only.", REPEATER: "A repeater is shown on screen only.", FILTER_BAR: "Filters are shown on screen only.",
};

/** A page that is only a screen (fluid web) is put on an A4 page in a file. */
/** A block's width in a file: the nearest width the page offers (3, 4, 6, 8, 9 or 12 of 12), the wider one on a tie. */
export const snapSpan = (w: number): number => [...GRID_SPANS].sort((a, b) => Math.abs(a - w) - Math.abs(b - w) || b - a)[0] ?? 12;
/** A look the file renderer does not know falls back to the standard one. */
const fileThemeOf = (id: string): string => (id === "BRAND" || themeById(id) ? id : "DEFAULT");
const fileFormatOf = (format: string | undefined): string => (format && formatById(format) ? format : "A4_PORTRAIT");

/** The section kind a block becomes in a file, where it differs from its own name. */
const MAP_TO_SECTION: Readonly<Record<string, string>> = { KPI: "BIG_NUMBERS", MULTI_CARD: "BIG_NUMBERS", PROJECT_LIST: "PORTFOLIO_TABLE", CALLOUT: "TEXT", AI_SUMMARY: "TEXT", AI_MESSAGES: "TEXT", AI_ASK: "TEXT" };

/** The project a file reads: the canvas's own, else the first project a block names. */
export const fileProjectOf = (canvas: Canvas, own: string | undefined): string | undefined => own ?? canvas.pages.flatMap((p) => p.blocks).map((b) => projectOf(b.bindings)).find((p): p is string => Boolean(p));

export function canvasAsDesign(canvas: Canvas, projectId?: string): CanvasAsDesign {
  const skipped: SkippedBlock[] = [];
  const sections: InfographicSectionConfig[] = [];
  canvas.pages.forEach((page, pageIndex) => {
    // A file is a single column of sections: containers are opened in place (a group's name, each tab's title, then what they hold).
    const ordered: Array<BlockInstance | { heading: string }> = [];
    for (const top of [...topLevel(page.blocks)].sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x)) {
      if (!isContainerKind(top.kind)) { ordered.push(top); continue; }
      if (top.style?.hidden) continue;
      const p = asProps(top);
      if (containerRole(top.kind) === "FRAME") { if (str(p.title)) ordered.push({ heading: str(p.title) as string }); ordered.push(...childrenOf(page.blocks, top.id)); }
      else if (containerRole(top.kind) === "TABS") ((Array.isArray(p.titles) ? p.titles : []) as unknown[]).forEach((t, i) => { ordered.push({ heading: String(t) }); ordered.push(...childrenOf(page.blocks, top.id, i)); });
      else skipped.push({ blockId: top.id, kind: top.kind, reason: "A repeater is shown on screen only." });
    }
    let first = true;
    for (const entry of ordered) {
      if ("heading" in entry) { sections.push({ kind: "TEXT", text: entry.heading, span: 12, ...(first && pageIndex > 0 ? { pageBreakBefore: true } : {}) } as InfographicSectionConfig); first = false; continue; }
      const block = entry;
      if (block.style?.hidden) continue;
      const props = asProps(block);
      // A file reads one project; a block bound to another stays on screen and is named.
      const bound = projectOf(block.bindings);
      if (projectId && bound && bound !== projectId) { skipped.push({ blockId: block.id, kind: block.kind, reason: "This block reads another project; a file reads one." }); continue; }
      // A design covers one project or the whole portfolio, never both: the other kind of block stays on screen and is named.
      const portfolioBlock = block.kind.startsWith("PORTFOLIO_");
      if (portfolioBlock && canvas.scope !== "PORTFOLIO") { skipped.push({ blockId: block.id, kind: block.kind, reason: "Portfolio blocks go in a file only from a portfolio canvas." }); continue; }
      if (canvas.scope === "PORTFOLIO" && !PORTFOLIO_KINDS.has(MAP_TO_SECTION[block.kind] ?? block.kind)) { skipped.push({ blockId: block.id, kind: block.kind, reason: "A portfolio canvas puts only portfolio blocks, a map, text and pictures in a file." }); continue; }
      const mapper = MAPPERS[block.kind];
      const mapped: Mapped = mapper ? mapper(block, props) : FILE_KINDS.has(block.kind) ? ({ ...props, kind: block.kind } as Mapped) : SCREEN_ONLY[block.kind] ?? "This kind of block cannot be put in a file.";
      if (mapped === "PROJECT_LIST_FILE") { if (canvas.scope === "PORTFOLIO") sections.push({ kind: "PORTFOLIO_TABLE", span: snapSpan(block.bounds.w), ...(str(props.title) ? { title: str(props.title) } : {}) } as InfographicSectionConfig); else skipped.push({ blockId: block.id, kind: block.kind, reason: "A list of projects goes in a file only from a portfolio canvas." }); first = false; continue; }
      if (typeof mapped === "string") { skipped.push({ blockId: block.id, kind: block.kind, reason: mapped }); continue; }
      const { screenOnlyPart, ...drawn } = mapped;
      if (screenOnlyPart) skipped.push({ blockId: block.id, kind: block.kind, reason: screenOnlyPart });
      const section: InfographicSectionConfig = { ...drawn, span: snapSpan(block.bounds.w), ...(block.alt ? { altText: block.alt } : {}), ...(first && pageIndex > 0 ? { pageBreakBefore: true } : {}) } as InfographicSectionConfig;
      sections.push(section);
      first = false;
    }
  });
  const o = canvas.options;
  const config: InfographicConfig = {
    templateId: "CUSTOM", templateVersion: 1, title: canvas.title, themeId: fileThemeOf(canvas.themeId), language: canvas.language, profile: canvas.profile === "LIVE_INTERNAL" ? "INTERNAL" : canvas.profile,
    format: fileFormatOf(canvas.pages[0]?.format), ...(canvas.scope === "PORTFOLIO" ? { scope: "PORTFOLIO" as const } : {}),
    ...(o?.periodFromId ? { periodFromId: o.periodFromId } : {}), ...(o?.periodToId ? { periodToId: o.periodToId } : {}),
    ...(o?.locationKeys?.length ? { locationKeys: o.locationKeys } : {}), ...(o?.acknowledgement ? { acknowledgement: o.acknowledgement } : {}), ...(o?.subtitle ? { subtitle: o.subtitle } : {}),
    sections,
  };
  return { config, skipped };
}
