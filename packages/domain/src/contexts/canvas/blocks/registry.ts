/**
 * The one table of blocks (Phase 45). This is the only file allowed to branch on a block's kind; everything else looks a
 * definition up here. `BLOCK_KINDS` is the full catalogue the product commits to; `PORTED_KINDS` are the ones with a
 * definition so far. Batch 45.2 moves every existing dashboard and infographic block across, and the test pins
 * `PENDING_KINDS` (the difference) so it can only shrink.
 */
import type { BlockDefinition } from "../block-definition.js";
import type { Picture } from "../motion.js";
import { textBlock } from "./text.js";
import { dividerBlock } from "./divider.js";
import { shapeBlock } from "./shape-block.js";
import { iconBlock } from "./icon-block.js";
import { kpiBlock } from "./kpi.js";
import { metricBlock } from "./metric.js";
import { multiCardBlock } from "./multi-card.js";
import { mapBlock } from "./map.js";
import { chartBlock } from "./chart.js";
import { tableBlock } from "./table.js";
import { projectListBlock } from "./project-list.js";
import { INFOGRAPHIC_BLOCKS } from "./infographic-blocks.js";
import { STRUCTURE_BLOCKS } from "./structure-blocks.js";
import { dataVisualBlock } from "./data-visual.js";
import { dataSlicerBlock } from "./data-slicer.js";
import { dataCompletenessBlock } from "./data-completeness.js";
import { dataDriversBlock } from "./data-drivers.js";

type AnyBlock = BlockDefinition<never, unknown, never>;
const any = (d: unknown): AnyBlock => d as AnyBlock;

export const BLOCK_KINDS = [
  "TEXT", "DIVIDER", "HERO", "BANNER", "KEY_MESSAGES", "QUOTE", "CALLOUT", "LEGEND_NOTES",
  "KPI", "BIG_NUMBERS", "METRIC", "MULTI_CARD", "PROGRESS_RINGS",
  "CHART", "SMALL_MULTIPLES",
  "MAP", "LOCATION_RESULTS", "LOCATION_COMPARISON", "ACTIVITIES_BY_LOCATION",
  "TABLE", "PROJECT_LIST", "FUNNEL", "FUNDING", "RESULTS_CHAIN", "SECTOR_GRID", "TIMELINE", "THREE_W", "DEMOGRAPHICS", "REACH",
  "PORTFOLIO_SUMMARY", "PORTFOLIO_TABLE", "PORTFOLIO_HEALTH", "PORTFOLIO_COUNTRIES",
  "IMAGE", "SHAPE", "ICON",
  "AI_SUMMARY", "AI_MESSAGES", "AI_ASK",
  "GROUP", "TABS", "REPEATER",
  "FILTER_BAR",
  "DATA_VISUAL", "DATA_SLICER", "DATA_COMPLETENESS", "DATA_DRIVERS",
] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export const BLOCK_REGISTRY: Readonly<Partial<Record<BlockKind, BlockDefinition<never, unknown, never>>>> = {
  TEXT: any(textBlock),
  DIVIDER: any(dividerBlock),
  SHAPE: any(shapeBlock),
  ICON: any(iconBlock),
  KPI: any(kpiBlock),
  METRIC: any(metricBlock),
  MULTI_CARD: any(multiCardBlock),
  MAP: any(mapBlock),
  CHART: any(chartBlock),
  TABLE: any(tableBlock),
  PROJECT_LIST: any(projectListBlock),
  DATA_VISUAL: any(dataVisualBlock),
  DATA_SLICER: any(dataSlicerBlock),
  DATA_COMPLETENESS: any(dataCompletenessBlock),
  DATA_DRIVERS: any(dataDriversBlock),
  ...STRUCTURE_BLOCKS,
  ...Object.fromEntries(Object.entries(INFOGRAPHIC_BLOCKS).map(([k, d]) => [k, any(d)])),
};

export const PORTED_KINDS = BLOCK_KINDS.filter((k) => BLOCK_REGISTRY[k] !== undefined);
export const PENDING_KINDS = BLOCK_KINDS.filter((k) => BLOCK_REGISTRY[k] === undefined);

export const isBlockKind = (k: string): k is BlockKind => (BLOCK_KINDS as readonly string[]).includes(k);
/** What kind of picture a block is, for motion: its own `picture` trait, else a word for its family. A block that is none of these only fades. */
export function pictureOfBlock(block: { kind: string; props: unknown }): Picture {
  const def = definitionFor(block.kind) as unknown as { family: string; picture?: Picture | ((props: unknown) => Picture) } | undefined;
  if (!def) return "OTHER";
  if (def.picture) return typeof def.picture === "function" ? def.picture(block.props) : def.picture;
  return def.family === "TEXT" ? "TEXT" : def.family === "MEDIA" ? "IMAGE" : def.family === "MAPS" ? "MAP" : "OTHER";
}

export const definitionFor = (k: string): BlockDefinition<never, unknown, never> | undefined => (isBlockKind(k) ? BLOCK_REGISTRY[k] : undefined);
