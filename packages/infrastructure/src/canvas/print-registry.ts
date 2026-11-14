import { BLOCK_KINDS, definitionFor, type BlockKind, type SectionProps } from "@donordesk/domain";
import type { InfographicSectionConfig } from "@donordesk/domain";
import { titleFor } from "../infographics/blocks-core.js";
import type { RenderCtx, Slot } from "../infographics/kit.js";
import { factsOf } from "./facts-of.js";
import { paintMultiCard } from "./painters/multi-card.js";
import { paintBigNumbers, paintFunnel, paintProgressRings } from "./painters/numbers.js";
import { paintActivitiesByLocation, paintLocationComparison, paintLocationResults, paintReach } from "./painters/places.js";
import { paintDemographics, paintFunding } from "./painters/people-money.js";
import { paintBanner, paintHero, paintDivider, paintKeyMessages, paintLegendNotes, paintText } from "./painters/text.js";
import { paintImage, paintQuote, paintSectorGrid, paintThreeW, paintTimeline } from "./painters/stories.js";
import { paintPortfolioCountries, paintPortfolioHealth, paintPortfolioSummary, paintPortfolioTable } from "./painters/portfolio.js";
import { paintIcon, paintShape } from "./painters/shapes.js";
import { paintResultsChain, paintSmallMultiples } from "./painters/series.js";
import { paintAiText, paintCallout, paintGroup, paintNothing, paintTabs } from "./painters/structure.js";
import type { PrintPainter } from "./print-types.js";
import { paintDataCompleteness, paintDataDrivers, paintDataVisual } from "./painters/datasets.js";

/**
 * Print painters (Phase 45.2): one SVG painter per block kind, looked up here and nowhere else. A painter is given the block's
 * resolved model - the one the screen paints - the page context, the heading and the width, and returns SVG text; every authored
 * string it writes goes through the `kit.ts` escape helpers. A kind without a painter is still drawn by the Studio's older block
 * functions (the composer's fallback) until it is ported; `PRINT_PENDING` is that list and the test pins it so it can only shrink.
 * A canvas holding a pending kind is refused for publish with a plain sentence (`unpaintable`), never exported with the block left out.
 */
export type { PrintPainter };

export const PRINT_PAINTERS: Readonly<Partial<Record<BlockKind, PrintPainter<never>>>> = {
  BIG_NUMBERS: paintBigNumbers, MULTI_CARD: paintMultiCard as PrintPainter<never>, PROGRESS_RINGS: paintProgressRings, FUNNEL: paintFunnel,
  REACH: paintReach, ACTIVITIES_BY_LOCATION: paintActivitiesByLocation, LOCATION_RESULTS: paintLocationResults, LOCATION_COMPARISON: paintLocationComparison,
  DEMOGRAPHICS: paintDemographics, FUNDING: paintFunding,
  HERO: paintHero, TEXT: paintText, DIVIDER: paintDivider, BANNER: paintBanner, KEY_MESSAGES: paintKeyMessages, LEGEND_NOTES: paintLegendNotes,
  SHAPE: paintShape, ICON: paintIcon,
  QUOTE: paintQuote, IMAGE: paintImage, TIMELINE: paintTimeline, SECTOR_GRID: paintSectorGrid, THREE_W: paintThreeW,
  SMALL_MULTIPLES: paintSmallMultiples, RESULTS_CHAIN: paintResultsChain,
  PORTFOLIO_SUMMARY: paintPortfolioSummary, PORTFOLIO_TABLE: paintPortfolioTable, PORTFOLIO_HEALTH: paintPortfolioHealth, PORTFOLIO_COUNTRIES: paintPortfolioCountries,
  CALLOUT: paintCallout, AI_SUMMARY: paintAiText, AI_MESSAGES: paintAiText, AI_ASK: paintAiText, GROUP: paintGroup, TABS: paintTabs, REPEATER: paintNothing, FILTER_BAR: paintNothing,
  DATA_VISUAL: paintDataVisual as PrintPainter<never>, DATA_SLICER: paintNothing, DATA_COMPLETENESS: paintDataCompleteness as PrintPainter<never>, DATA_DRIVERS: paintDataDrivers as PrintPainter<never>,
};

export const PRINT_PENDING: readonly BlockKind[] = BLOCK_KINDS.filter((k) => PRINT_PAINTERS[k] === undefined);

export const printPainterFor = (kind: string): PrintPainter<never> | undefined => ((BLOCK_KINDS as readonly string[]).includes(kind) ? PRINT_PAINTERS[kind as BlockKind] : undefined);

/** The kinds on a canvas that cannot be printed yet; empty means the canvas can be published. */
export const unpaintable = (kinds: Iterable<string>): string[] => [...new Set([...kinds].filter((k) => printPainterFor(k) === undefined))].sort();

/**
 * Draws one section through its painter: resolve the model from the page's facts, then paint it. Returns `null` when the kind has no
 * painter (the caller falls back), `undefined` when the block is left out of this export, or the block.
 */
export function paintSection(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot | undefined | null {
  const painter = printPainterFor(section.kind);
  const def = definitionFor(section.kind);
  if (!painter || !def) return null;
  const { kind: _kind, ...props } = section;
  const model = (def as unknown as { resolve(p: SectionProps, d: unknown): never }).resolve(props, factsOf(c));
  return painter({ model, ctx: c, props, title: titleFor(c, section), width });
}
