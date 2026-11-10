import { BLOCK_KINDS, type BlockKind } from "@donordesk/domain/contexts/canvas/index.js";
import type { ScreenRenderer } from "../ports/screen-renderer";
import { BigNumbersScreen, FunnelScreen, ProgressRingsScreen } from "./screens/numbers";
import { ActivitiesByLocationScreen, LocationComparisonScreen, LocationResultsScreen, ReachScreen } from "./screens/places";
import { DemographicsScreen, FundingScreen } from "./screens/people-money";
import { BannerScreen, HeroScreen, DividerScreen, IconScreen, ShapeScreen, KeyMessagesScreen, LegendNotesScreen, TextScreen } from "./screens/text";
import { ResultsChainScreen, SmallMultiplesScreen } from "./screens/series";
import { PortfolioCountriesScreen, PortfolioHealthScreen, PortfolioSummaryScreen, PortfolioTableScreen } from "./screens/portfolio";
import { AiTextScreen, CalloutScreen, FilterBarScreen, GroupScreen, RepeaterScreen, TabsScreen } from "./screens/structure";
import { ImageScreen, QuoteScreen, SectorGridScreen, ThreeWScreen, TimelineScreen } from "./screens/stories";

/**
 * Screen renderers (Phase 45.2): one React component per block kind, looked up here and nowhere else - the canvas never branches on a
 * kind. Each paints the same model the print painter paints. `SCREEN_PENDING` is what is still missing; the completeness test pins that
 * list so it can only shrink.
 */
const as = (c: unknown): ScreenRenderer => c as ScreenRenderer;

export const SCREEN_RENDERERS: Readonly<Partial<Record<BlockKind, ScreenRenderer>>> = {
  BIG_NUMBERS: as(BigNumbersScreen), PROGRESS_RINGS: as(ProgressRingsScreen), FUNNEL: as(FunnelScreen),
  REACH: as(ReachScreen), ACTIVITIES_BY_LOCATION: as(ActivitiesByLocationScreen), LOCATION_RESULTS: as(LocationResultsScreen), LOCATION_COMPARISON: as(LocationComparisonScreen),
  DEMOGRAPHICS: as(DemographicsScreen), FUNDING: as(FundingScreen),
  HERO: as(HeroScreen), TEXT: as(TextScreen), DIVIDER: as(DividerScreen), SHAPE: as(ShapeScreen), ICON: as(IconScreen), BANNER: as(BannerScreen), KEY_MESSAGES: as(KeyMessagesScreen), LEGEND_NOTES: as(LegendNotesScreen),
  QUOTE: as(QuoteScreen), IMAGE: as(ImageScreen), TIMELINE: as(TimelineScreen), SECTOR_GRID: as(SectorGridScreen), THREE_W: as(ThreeWScreen),
  SMALL_MULTIPLES: as(SmallMultiplesScreen), RESULTS_CHAIN: as(ResultsChainScreen),
  PORTFOLIO_SUMMARY: as(PortfolioSummaryScreen), PORTFOLIO_TABLE: as(PortfolioTableScreen), PORTFOLIO_HEALTH: as(PortfolioHealthScreen), PORTFOLIO_COUNTRIES: as(PortfolioCountriesScreen),
  CALLOUT: as(CalloutScreen), AI_SUMMARY: as(AiTextScreen), AI_MESSAGES: as(AiTextScreen), AI_ASK: as(AiTextScreen),
  GROUP: as(GroupScreen), TABS: as(TabsScreen), REPEATER: as(RepeaterScreen), FILTER_BAR: as(FilterBarScreen),
};

export const SCREEN_PENDING: readonly BlockKind[] = BLOCK_KINDS.filter((k) => SCREEN_RENDERERS[k] === undefined);

export const screenRendererFor = (kind: string): ScreenRenderer | undefined => ((BLOCK_KINDS as readonly string[]).includes(kind) ? SCREEN_RENDERERS[kind as BlockKind] : undefined);
