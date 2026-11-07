import type { BlockModel, ModelOf as DomainModelOf, PaintFrame } from "@donordesk/domain/contexts/canvas/index.js";

export type { ModelOf } from "@donordesk/domain/contexts/canvas/index.js";
export type { smallMultiplesModel, resultsChainModel, portfolioSummaryModel, portfolioTableModel, portfolioHealthModel, portfolioCountriesModel, bigNumbersModel, funnelModel, progressRingsModel, reachModel, activitiesByLocationModel, locationResultsModel, locationComparisonModel, demographicsModel, fundingModel, bannerModel, heroModel, imageModel, keyMessagesModel, legendNotesModel, quoteModel, sectorGridModel, threeWModel, timelineModel } from "@donordesk/domain/contexts/canvas/index.js";

/** The props of a screen renderer for the block whose model function is `F`: the model it paints is derived from that function, so the two cannot drift apart. */
export interface ScreenRendererPropsOf<F extends (...args: never[]) => BlockModel<unknown>> { model: BlockModel<DomainModelOf<F>>; frame: PaintFrame; assetUrl?: ((assetId: string) => string | undefined) | undefined }
