import type { PrismaClient } from "@prisma/client";
import {
  AdoptLibraryIndicatorsHandler, AdoptLibraryLogframeHandler, ApplyLibraryUpdateHandler, BrowseSectorLibraryHandler, CheckLibraryUpdatesHandler, EffectiveLibraryService,
  ExportReviewSheetHandler, GetLibraryReviewProgressHandler, GetSectorPackHandler, ImportReviewSheetHandler, RecordLibraryReviewHandler, SaveOrganisationEntryHandler,
  SetLibraryEntryHiddenHandler,
  type IAuditLogger, type IClock, type IIndicatorRepository, type ILogframeRepository, type IndicatorCreator, type LogframeItemCreator,
} from "@donordesk/application";
import { PrismaOrganisationLibraryStore } from "../repositories/sector-library.js";

export interface SectorLibraryModuleDeps {
  prisma: PrismaClient;
  clock: IClock;
  audits: IAuditLogger;
  logframe: ILogframeRepository;
  indicators: IIndicatorRepository;
  /** The ordinary create handlers: the library writes nothing of its own. */
  createIndicator: IndicatorCreator;
  createLogframeItem: LogframeItemCreator;
}

/** The sector library (phase 46) as one module: the organisation's store, the effective library over it, and every handler. */
export function createSectorLibraryModule(deps: SectorLibraryModuleDeps) {
  const { prisma, clock, audits, logframe, indicators, createIndicator, createLogframeItem } = deps;
  const store = new PrismaOrganisationLibraryStore(prisma);
  const library = new EffectiveLibraryService(store);
  return {
    library,
    handlers: {
      browseSectorLibrary: new BrowseSectorLibraryHandler(library, indicators),
      getSectorPack: new GetSectorPackHandler(),
      adoptLibraryIndicators: new AdoptLibraryIndicatorsHandler(library, indicators, logframe, createIndicator, audits, clock),
      adoptLibraryLogframe: new AdoptLibraryLogframeHandler(logframe, createLogframeItem, audits),
      checkLibraryUpdates: new CheckLibraryUpdatesHandler(library, indicators),
      applyLibraryUpdate: new ApplyLibraryUpdateHandler(library, indicators, audits, clock),
      saveLibraryEntry: new SaveOrganisationEntryHandler(store, audits),
      setLibraryEntryHidden: new SetLibraryEntryHiddenHandler(store, audits),
      recordLibraryReview: new RecordLibraryReviewHandler(library, store, audits, clock),
      exportLibraryReviewSheet: new ExportReviewSheetHandler(library),
      importLibraryReviewSheet: new ImportReviewSheetHandler(library, store, audits, clock),
      getLibraryReviewProgress: new GetLibraryReviewProgressHandler(library),
    },
  };
}

export type SectorLibraryHandlers = ReturnType<typeof createSectorLibraryModule>["handlers"];
