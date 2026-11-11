/**
 * The table of formatting capabilities (Phase 50.2). Each row checks its own settings; which capabilities a block offers comes from
 * its definition (`formats`) or, when it names none, from its family. Nothing here names a block kind.
 */
import { definitionFor } from "../blocks/registry.js";
import type { BlockFamily } from "../block-definition.js";
import { colourChoiceProblem, conditionalProblems } from "./conditional.js";
import { numbersProblems } from "./number-format.js";
import { TEXT_ALIGNMENTS, DISPLAY_UNITS, SIDES, TOTAL_FUNCTIONS, type BlockFormat, type FormatCapability } from "./types.js";

type Checker<K extends FormatCapability> = (settings: NonNullable<BlockFormat[K]>, ctx: FormatContext) => string[];
export interface FormatContext { isRate: boolean }
export interface CapabilityDef<K extends FormatCapability> { labelKey: string; check: Checker<K> }

const colours = (...cs: Array<Parameters<typeof colourChoiceProblem>[0]>): string[] => cs.map(colourChoiceProblem).filter((p): p is string => p !== null);
const oneOf = (v: unknown, list: readonly unknown[] | undefined, msg: string): string[] => (v === undefined || list?.includes(v) ? [] : [msg]);

export const CAPABILITY_DEFS: { [K in FormatCapability]: CapabilityDef<K> } = {
  title: { labelKey: "format.title", check: (s) => [...(s.subtitle && s.subtitle.length > 120 ? ["A subtitle is at most 120 characters."] : []), ...oneOf(s.align, TEXT_ALIGNMENTS, "Unknown alignment."), ...colours(s.color)] },
  frame: { labelKey: "format.frame", check: (s) => [
    ...oneOf(s.borderSide, ["all", ...SIDES], "Unknown border side."),
    ...(s.borderWidth !== undefined && (!Number.isInteger(s.borderWidth) || s.borderWidth < 1 || s.borderWidth > 8) ? ["A border is 1 to 8 px."] : []),
    ...(s.padding && Object.values(s.padding).some((v) => !Number.isInteger(v) || v < 0 || v > 48) ? ["Padding is 0 to 48 px on each side."] : []),
    ...colours(s.borderColor)] },
  accentBar: { labelKey: "format.accentBar", check: (s) => [...oneOf(s.side, SIDES, "Unknown side."), ...(s.thickness !== undefined && (!Number.isInteger(s.thickness) || s.thickness < 2 || s.thickness > 12) ? ["An accent bar is 2 to 12 px."] : []), ...colours(s.color)] },
  numbers: { labelKey: "format.numbers", check: (s) => [...oneOf(s.units, DISPLAY_UNITS, "Unknown display unit."), ...numbersProblems(s)] },
  callout: { labelKey: "format.callout", check: (s) => colours(s.color, s.labelColor) },
  referenceLabels: { labelKey: "format.referenceLabels", check: (s) => colours(s.color) },
  labels: { labelKey: "format.labels", check: () => [] },
  legend: { labelKey: "format.legend", check: (s) => (s.title && s.title.length > 60 ? ["A legend title is at most 60 characters."] : []) },
  colors: { labelKey: "format.colors", check: (s) => !Array.isArray(s.series ?? []) ? ["Series colours are a list."] : [...((s.series?.length ?? 0) > 12 ? ["At most 12 series colours."] : []), ...colours(...(s.series ?? []).filter((c): c is NonNullable<typeof c> => c !== null && c !== undefined))] },
  conditional: { labelKey: "format.conditional", check: (s, ctx) => conditionalProblems(s.rules, ctx) },
  table: { labelKey: "format.table", check: (s, ctx) => [
    ...colours(s.headerFill),
    ...(s.columns ?? []).flatMap((c) => [
      ...oneOf(c.total, TOTAL_FUNCTIONS, "Unknown total."),
      ...(ctx.isRate && c.total && ["SUM"].includes(c.total) ? ["A rate column is never added up."] : []),
      ...(typeof c.width === "number" && (c.width < 40 || c.width > 800) ? ["A fixed column is 40 to 800 px."] : []),
    ])] },
  tooltip: { labelKey: "format.tooltip", check: (s) => ((s.indicatorIds?.length ?? 0) > 6 ? ["A tooltip shows at most 6 extra figures."] : []) },
  emptyData: { labelKey: "format.emptyData", check: (s) => (s.message && s.message.length > 120 ? ["The empty message is at most 120 characters."] : []) },
  visibility: { labelKey: "format.visibility", check: () => [] },
};

const COMMON: readonly FormatCapability[] = ["title", "frame", "visibility"];
/** What a block of each family offers when its definition does not say. */
export const FAMILY_FORMATS: Readonly<Record<BlockFamily, readonly FormatCapability[]>> = {
  TEXT: [...COMMON, "accentBar"],
  NUMBERS: [...COMMON, "accentBar", "numbers", "callout", "referenceLabels", "conditional", "emptyData"],
  CHARTS: [...COMMON, "numbers", "labels", "legend", "colors", "conditional", "tooltip", "emptyData"],
  MAPS: [...COMMON, "numbers", "labels", "legend", "conditional", "tooltip", "emptyData"],
  TABLES: [...COMMON, "numbers", "conditional", "table", "emptyData"],
  AI: [...COMMON, "accentBar"],
  MEDIA: COMMON,
  CONTAINERS: [...COMMON, "accentBar"],
  CONTROLS: ["frame", "visibility"],
};

export function formatsOf(kind: string): readonly FormatCapability[] {
  const def = definitionFor(kind);
  if (!def) return [];
  return def.formats ?? FAMILY_FORMATS[def.family];
}

/** Every problem in a block's formatting: a capability it does not offer, then each capability's own check. */
export function formatProblems(kind: string, format: BlockFormat | undefined, ctx: FormatContext = { isRate: false }): string[] {
  if (!format) return [];
  const offered = new Set(formatsOf(kind));
  const out: string[] = [];
  for (const [key, settings] of Object.entries(format) as Array<[FormatCapability, unknown]>) {
    if (settings === undefined) continue;
    const def = CAPABILITY_DEFS[key] as CapabilityDef<FormatCapability> | undefined;
    if (!def) { out.push(`"${key}" is not a formatting option.`); continue; }
    if (!offered.has(key)) { out.push(`This block has no "${key}" formatting.`); continue; }
    out.push(...(def.check as (s: unknown, c: FormatContext) => string[])(settings, ctx));
  }
  return out;
}
