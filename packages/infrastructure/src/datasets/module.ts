import type { PrismaClient } from "@prisma/client";
import {
  AddDatasetLinkHandler, AddDatasetVersionHandler, CheckDatasetUploadHandler, DatasetProblemsSheetHandler, DatasetSources, DecideDatasetVersionHandler, DeleteDatasetHandler,
  GetDatasetHandler, ListDatasetKitsHandler, ListDatasetsHandler, MakeKitDashboardsHandler, PullDatasetConnectorHandler, RemoveDatasetLinkHandler, RestoreDatasetVersionHandler,
  SaveDatasetConnectorHandler, SaveDatasetHandler, RunScheduledDatasetPullsHandler, SetDatasetRestrictionHandler, SuggestDatasetLinksHandler, SyncDatasetLinksHandler, UpdateDatasetHandler, UploadDatasetFileHandler, VersionBuilder,
  type BulkUpsertIndicatorUpdatesHandler, type FormRecordsReader, type CreateCanvasHandler, type DatasetDeps, type IConnectorFetch, type IIndicatorRepository, type IIndicatorUpdateRepository, type IReportingPeriodRepository,
} from "@donordesk/application";
import { DomainError, err, ok } from "@donordesk/domain";
import { EnvConnectorSecrets, SafeConnectorHttp } from "../integrations/connector-adapters.js";
import { ExcelWorkbookReader } from "./workbook-reader.js";
import { PrismaDatasetCatalog, PrismaDatasetLinkRepository, PrismaDatasetRowStore, PrismaDatasetSecretStore } from "./repositories.js";

export interface DatasetsModuleDeps extends Omit<DatasetDeps, "catalog"> {
  prisma: PrismaClient;
  indicators: IIndicatorRepository;
  updates: IIndicatorUpdateRepository;
  periods: IReportingPeriodRepository;
  bulkSave: Pick<BulkUpsertIndicatorUpdatesHandler, "handle">;
  createCanvas: Pick<CreateCanvasHandler, "handle">;
  /** Collection forms whose accepted records are offered as datasets (J6). */
  forms?: FormRecordsReader | undefined;
}

const REASONS: Record<string, string> = { UNSAFE_ADDRESS: "the address is not a public https address", UNREACHABLE: "the server could not be reached", UNAUTHORIZED: "the key was refused", NOT_FOUND: "the address was not found", SERVER_ERROR: "the server had an error", TIMEOUT: "it took too long to answer", TOO_BIG: "the answer was too large", BAD_REPLY: "the answer could not be read" };

/** Phase 54 datasets as one module: repositories, the provider the canvas and the Studio read, and the handlers. */
export function createDatasetsModule(deps: DatasetsModuleDeps) {
  const catalog = new PrismaDatasetCatalog(deps.prisma);
  const rows = new PrismaDatasetRowStore(deps.prisma);
  const links = new PrismaDatasetLinkRepository(deps.prisma);
  const secrets = new PrismaDatasetSecretStore(deps.prisma, new EnvConnectorSecrets());
  const http = new SafeConnectorHttp();
  const fetchJson: IConnectorFetch = { getJson: async (url, headers) => { const r = await http.get(url, headers); return r.ok ? ok(r.json) : err(DomainError.validation(REASONS[r.reason] ?? r.reason)); } };
  const reader = new ExcelWorkbookReader();
  const d: DatasetDeps = { catalog, visible: deps.visible, audit: deps.audit, clock: deps.clock, ids: deps.ids, storage: deps.storage, places: deps.places };
  const builder = new VersionBuilder(d, reader, rows);
  const sources = new DatasetSources(d, rows, deps.forms);
  const linkDeps = { links, rows, indicators: deps.indicators, updates: deps.updates, periods: deps.periods, places: deps.places, save: deps.bulkSave };
  const syncLinks = new SyncDatasetLinksHandler(d, linkDeps);
  const pull = new PullDatasetConnectorHandler(d, secrets, fetchJson, builder, reader, syncLinks);
  return {
    sources,
    pull,
    catalog,
    handlers: {
      uploadDatasetFile: new UploadDatasetFileHandler(d, reader),
      checkDatasetUpload: new CheckDatasetUploadHandler(d, reader, rows),
      datasetProblemsSheet: new DatasetProblemsSheetHandler(d, reader),
      saveDataset: new SaveDatasetHandler(d, builder),
      addDatasetVersion: new AddDatasetVersionHandler(d, builder),
      decideDatasetVersion: new DecideDatasetVersionHandler(d),
      restoreDatasetVersion: new RestoreDatasetVersionHandler(d),
      updateDataset: new UpdateDatasetHandler(d),
      setDatasetRestriction: new SetDatasetRestrictionHandler(d),
      deleteDataset: new DeleteDatasetHandler(d, builder),
      listDatasets: new ListDatasetsHandler(d),
      getDataset: new GetDatasetHandler(d, links),
      listDatasetKits: new ListDatasetKitsHandler(),
      makeKitDashboards: new MakeKitDashboardsHandler(d, deps.createCanvas),
      addDatasetLink: new AddDatasetLinkHandler(d, linkDeps, syncLinks),
      removeDatasetLink: new RemoveDatasetLinkHandler(d, links),
      syncDatasetLinks: syncLinks,
      suggestDatasetLinks: new SuggestDatasetLinksHandler(d, deps.indicators),
      saveDatasetConnector: new SaveDatasetConnectorHandler(d, secrets),
      pullDatasetConnector: pull,
      runScheduledDatasetPulls: new RunScheduledDatasetPullsHandler(d, pull),
    },
  };
}

export type DatasetsHandlers = ReturnType<typeof createDatasetsModule>["handlers"];
