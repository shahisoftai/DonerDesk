import { SETUP_AREA_KEYS, applyFinanceOperation, applyPlaceOperation, applyPlanOperation, applyResultOperation, applyRiskOperation, type FinanceOperation, type PlaceOperation, type PlanOperation, type ResultOperation, type RiskOperation, type TenantId } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";
import {
  ApplyDefaultPackHandler, ChangeSetupProposalHandler, DraftViewer, SignOffSetupHandler, DiscardSetupProposalHandler, EditSetupDraftHandler, EditSetupProposalHandler, GetSetupDraftHandler, StartBlankSetupHandler, GetSetupProposalHandler, ListSetupProposalsHandler,
  ParseUploadedFileHandler, RerunSetupAreaHandler, SetSetupDocumentKindHandler, GetSetupSourcePassageHandler, SetupExtractionOrchestrator, StartSetupExtractionHandler,
  UpdateSetupAssistSettingsHandler, ListOrganisationPacksHandler, SaveOrganisationPackHandler, RemoveOrganisationPackHandler,
  type BackgroundRunner, type IAuditLogger, type IClock, type IIdGenerator, type ILLMProvider, type IOrganizationRepository,
  type ISetupAreaExtractor, type ISetupDocumentStore, type ISetupLlm, type ISetupProposalRepository, type ISetupRunRepository, type IStorage,
} from "@donordesk/application";
import { PrismaSetupProposalRepository, PrismaSetupRunRepository } from "../repositories/project-setup.js";
import { OrganisationPackSource } from "../project-setup/organisation-pack-source.js";
import { PrismaSetupPackRepository } from "../repositories/setup-packs.js";
import { StoredSetupDocumentReader } from "../project-setup/source-reader.js";
import { workerScannedPageReader } from "../project-setup/pdf-layout.js";
import { TenantSetupLlm, withReplyMemory } from "../project-setup/setup-llm.js";
import { LlmSectionSurveyor } from "../project-setup/section-surveyor.js";
import { LlmFieldVerifier } from "../project-setup/field-verifier.js";
import { NominatimPlaceLookup } from "../project-setup/place-lookup.js";
import { SingleReadAreaExtractor, SingleReadReader } from "../project-setup/single-read-extractor.js";
import { createSetupExtractors } from "../project-setup/prompted-area-extractor.js";
import { withSheetShortcuts } from "../project-setup/sheet-first-extractor.js";
import { SETUP_EXTRACTION_SPECS } from "../project-setup/prompts/index.js";

export interface ProjectSetupModuleDeps {
  prisma: PrismaClient;
  ids: IIdGenerator;
  clock: IClock;
  audits: IAuditLogger;
  orgs: IOrganizationRepository;
  /** Server storage, used only to clean up proposals made before documents moved to the organisation's Drive. */
  storage: IStorage;
  /** Where project documents live: the organisation's own Google Drive. */
  documents: ISetupDocumentStore;
  parseUploadedFile: ParseUploadedFileHandler;
  /** `model` asks for another model than the organisation's own (the structural areas' heavier model). */
  llmFor: (tenantId: string, model?: string) => Promise<ILLMProvider | null>;
  /** The model for the areas that decide structure (results chain, indicators, work plan); absent = the organisation's own. */
  heavyModel?: string | undefined;
  /** The AI service's own refusal text, for the server log only. */
  onProviderError?: (info: { tenantId: string; message: string }) => void;
  runInBackground: BackgroundRunner;
  /** Overrides the registered area extractors (tests); by default every `SETUP_EXTRACTION_SPECS` area over the tenant LLM. */
  extractors?: ReadonlyArray<ISetupAreaExtractor>;
  maxRunsPerDay: number;
  /** True for an organisation whose plan has no daily document cap. */
  hasNoDailyCap?: (tenantId: TenantId) => Promise<boolean>;
  /** How many areas of one document are read at the same time. */
  concurrency?: number;
  /** The longest one AI call may take, in milliseconds (default 90 000). A call that is slower is retried once, then the part fails. */
  callTimeoutMs?: number;
  /** A Nominatim endpoint for recognising place names on the public web; absent = no lookup, nothing is sent. */
  placeLookupUrl?: string | undefined;
}

/** The project setup wizard (Phase 36) as one module: its repositories, reader, LLM facade, orchestrator and handlers. */
export function createProjectSetupModule(deps: ProjectSetupModuleDeps) {
  const proposals: ISetupProposalRepository = new PrismaSetupProposalRepository(deps.prisma);
  const runs: ISetupRunRepository = new PrismaSetupRunRepository(deps.prisma);
  const reader = new StoredSetupDocumentReader(deps.documents, deps.parseUploadedFile, workerScannedPageReader(process.env.AI_REPORTER_URL, process.env.INTERNAL_TOKEN ?? ""));
  const llm: ISetupLlm = withReplyMemory(new TenantSetupLlm(deps.llmFor, deps.onProviderError));
  // `single` (SETUP_READ_MODE): one whole-document reading replaces the survey, the sheet shortcuts and the per-area prompts.
  const singleRead = process.env.SETUP_READ_MODE === "single";
  const singleReader = new SingleReadReader(llm);
  const extractors = deps.extractors ?? (singleRead
    ? SETUP_AREA_KEYS.map((area) => new SingleReadAreaExtractor(area, singleReader))
    : withSheetShortcuts(createSetupExtractors(SETUP_EXTRACTION_SPECS, llm, deps.heavyModel)));
  const orchestrator = new SetupExtractionOrchestrator(proposals, runs, reader, extractors, deps.audits, deps.clock, deps.ids, undefined, deps.callTimeoutMs, deps.concurrency, deps.extractors ? {} : {
    surveyor: singleRead ? undefined : new LlmSectionSurveyor(llm, SETUP_EXTRACTION_SPECS),
    verifier: singleRead ? undefined : new LlmFieldVerifier(llm),
    placeLookup: deps.placeLookupUrl ? new NominatimPlaceLookup(deps.placeLookupUrl) : undefined,
  });
  const rerun = new RerunSetupAreaHandler(proposals, runs, reader, extractors, deps.audits, deps.clock, deps.ids, undefined, deps.callTimeoutMs, deps.runInBackground);
  const viewer = new DraftViewer(runs, deps.clock);
  const packRepo = new PrismaSetupPackRepository(deps.prisma);
  const handlers = {
    startSetupExtraction: new StartSetupExtractionHandler(deps.orgs, proposals, runs, deps.documents, llm, orchestrator, deps.audits, deps.clock, deps.ids, deps.runInBackground, deps.maxRunsPerDay, deps.hasNoDailyCap),
    getSetupProposal: new GetSetupProposalHandler(proposals, runs, deps.clock),
    listSetupProposals: new ListSetupProposalsHandler(proposals, deps.clock),
    editSetupProposal: new EditSetupProposalHandler(proposals, deps.audits, deps.clock),
    rerunSetupArea: rerun,
    setSetupDocumentKind: new SetSetupDocumentKindHandler(proposals, rerun, deps.audits, deps.clock),
    getSetupSourcePassage: new GetSetupSourcePassageHandler(proposals, reader, deps.clock),
    discardSetupProposal: new DiscardSetupProposalHandler(proposals, runs, deps.storage, deps.documents, deps.audits, deps.clock),
    updateSetupAssistSettings: new UpdateSetupAssistSettingsHandler(deps.orgs, deps.audits),
    startBlankSetup: new StartBlankSetupHandler(proposals, deps.audits, deps.clock, deps.ids),
    getSetupDraft: new GetSetupDraftHandler(proposals, deps.clock, viewer),
    editSetupDraft: new EditSetupDraftHandler(proposals, deps.audits, deps.clock, viewer),
    changeSetupResults: new ChangeSetupProposalHandler<ResultOperation>(proposals, deps.audits, deps.clock, applyResultOperation, "setup.results.changed", viewer),
    changeSetupRisks: new ChangeSetupProposalHandler<RiskOperation>(proposals, deps.audits, deps.clock, applyRiskOperation, "setup.risks.changed", viewer),
    signOffSetup: new SignOffSetupHandler(proposals, deps.audits, deps.clock, viewer),
    changeSetupFinance: new ChangeSetupProposalHandler<FinanceOperation>(proposals, deps.audits, deps.clock, applyFinanceOperation, "setup.finance.changed", viewer),
    changeSetupPlan: new ChangeSetupProposalHandler<PlanOperation>(proposals, deps.audits, deps.clock, applyPlanOperation, "setup.plan.changed", viewer),
    changeSetupPlaces: new ChangeSetupProposalHandler<PlaceOperation>(proposals, deps.audits, deps.clock, applyPlaceOperation, "setup.places.changed", viewer),
    applyDefaultPack: new ApplyDefaultPackHandler(proposals, new OrganisationPackSource(packRepo), deps.audits, deps.clock, viewer),
    listOrganisationPacks: new ListOrganisationPacksHandler(packRepo),
    saveOrganisationPack: new SaveOrganisationPackHandler(packRepo, deps.audits),
    removeOrganisationPack: new RemoveOrganisationPackHandler(packRepo, deps.audits),
  };
  return { proposals, runs, reader, llm, orchestrator, handlers };
}

export type ProjectSetupHandlers = ReturnType<typeof createProjectSetupModule>["handlers"];
