/**
 * The models of the infographic-style blocks (Phase 45.1): one pure function per kind, looked up by this table. The print composer
 * and the screen both paint what these return, so a figure, a gap or a note cannot differ between a preview and a published file.
 * `PENDING_MODEL_KINDS` are the blocks still drawn straight from their settings; 45.2 ports them, and the test pins the list so it can only shrink.
 */
import { bigNumbersModel, funnelModel, progressRingsModel } from "./numbers.js";
import { activitiesByLocationModel, locationComparisonModel, locationResultsModel, reachModel } from "./location.js";
import { demographicsModel, fundingModel } from "./people-money.js";
import { heroModel, bannerModel, imageModel, keyMessagesModel, legendNotesModel, quoteModel, sectorGridModel, threeWModel, timelineModel } from "./authored.js";
import { smallMultiplesModel, resultsChainModel } from "./series.js";
import { portfolioCountriesModel, portfolioHealthModel, portfolioSummaryModel, portfolioTableModel } from "./portfolio.js";
import type { ModelFn } from "./props.js";

export const INFOGRAPHIC_MODELS: Readonly<Record<string, ModelFn>> = {
  BIG_NUMBERS: bigNumbersModel, PROGRESS_RINGS: progressRingsModel, FUNNEL: funnelModel,
  REACH: reachModel, ACTIVITIES_BY_LOCATION: activitiesByLocationModel, LOCATION_RESULTS: locationResultsModel, LOCATION_COMPARISON: locationComparisonModel,
  DEMOGRAPHICS: demographicsModel, FUNDING: fundingModel,
  KEY_MESSAGES: keyMessagesModel, QUOTE: quoteModel, LEGEND_NOTES: legendNotesModel, BANNER: bannerModel, IMAGE: imageModel,
  TIMELINE: timelineModel, THREE_W: threeWModel, SECTOR_GRID: sectorGridModel, HERO: heroModel,
  SMALL_MULTIPLES: smallMultiplesModel, RESULTS_CHAIN: resultsChainModel, PORTFOLIO_SUMMARY: portfolioSummaryModel, PORTFOLIO_TABLE: portfolioTableModel, PORTFOLIO_HEALTH: portfolioHealthModel, PORTFOLIO_COUNTRIES: portfolioCountriesModel,
};

export const PENDING_MODEL_KINDS: readonly string[] = [];
export type { ModelFn, SectionProps } from "./props.js";
import type { BlockModel } from "../block-definition.js";
/** The model a function returns when it has something to show: lets a painter be typed against the model it paints. */
export type ModelOf<F extends (...args: never[]) => BlockModel<unknown>> = Extract<ReturnType<F>, { state: "ready" }>["model"];
export { bigNumbersModel, funnelModel, progressRingsModel } from "./numbers.js";
export { activitiesByLocationModel, locationComparisonModel, locationResultsModel, reachModel } from "./location.js";
export { demographicsModel, fundingModel } from "./people-money.js";
export * from "./places.js";
export * from "./series.js";
export * from "./portfolio.js";
export type { Figure } from "./numbers.js";
export { heroModel, bannerModel, imageModel, keyMessagesModel, legendNotesModel, quoteModel, sectorGridModel, threeWModel, timelineModel } from "./authored.js";
