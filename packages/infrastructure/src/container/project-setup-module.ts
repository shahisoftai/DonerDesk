import type { TenantId } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";
import {
  DiscardSetupProposalHandler, EditSetupProposalHandler, GetSetupProposalHandler, ListSetupProposalsHandler,
  ParseUploadedFileHandler, RerunSetupAreaHandler, SetupExtractionOrchestrator, StartSetupExtractionHandler,
  UpdateSetupAssistSettingsHandler,
  type BackgroundRunner, type IAuditLogger, type IClock, type IIdGenerator, type ILLMProvider, type IOrganizationRepository,
  type ISetupAreaExtractor, type ISetupDocumentStore, type ISetupLlm, type ISetupProposalRepository, type ISetupRunRepository, type IStorage,
} from "@donordesk/application";
import { PrismaSetupProposalRepository, PrismaSetupRunRepository } from "../repositories/project-setup.js";
import { StoredSetupDocumentReader } from "../project-setup/source-reader.js";
import { TenantSetupLlm } from "../project-setup/setup-llm.js";
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
  llmFor: (tenantId: string) => Promise<ILLMProvider | null>;
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
}

/** The project setup wizard (Phase 36) as one module: its repositories, reader, LLM facade, orchestrator and handlers. */
export function createProjectSetupModule(deps: ProjectSetupModuleDeps) {
  const proposals: ISetupProposalRepository = new PrismaSetupProposalRepository(deps.prisma);
  const runs: ISetupRunRepository = new PrismaSetupRunRepository(deps.prisma);
  const reader = new StoredSetupDocumentReader(deps.documents, deps.parseUploadedFile);
  const llm: ISetupLlm = new TenantSetupLlm(deps.llmFor, deps.onProviderError);
  const extractors = deps.extractors ?? withSheetShortcuts(createSetupExtractors(SETUP_EXTRACTION_SPECS, llm));
  const orchestrator = new SetupExtractionOrchestrator(proposals, runs, reader, extractors, deps.audits, deps.clock, deps.ids, undefined, deps.callTimeoutMs, deps.concurrency);
  const handlers = {
    startSetupExtraction: new StartSetupExtractionHandler(deps.orgs, proposals, runs, deps.documents, llm, orchestrator, deps.audits, deps.clock, deps.ids, deps.runInBackground, deps.maxRunsPerDay, deps.hasNoDailyCap),
    getSetupProposal: new GetSetupProposalHandler(proposals, runs, deps.clock),
    listSetupProposals: new ListSetupProposalsHandler(proposals, deps.clock),
    editSetupProposal: new EditSetupProposalHandler(proposals, deps.audits, deps.clock),
    rerunSetupArea: new RerunSetupAreaHandler(proposals, runs, reader, extractors, deps.audits, deps.clock, deps.ids, undefined, deps.callTimeoutMs, deps.runInBackground),
    discardSetupProposal: new DiscardSetupProposalHandler(proposals, runs, deps.storage, deps.documents, deps.audits, deps.clock),
    updateSetupAssistSettings: new UpdateSetupAssistSettingsHandler(deps.orgs, deps.audits),
  };
  return { proposals, runs, reader, llm, orchestrator, handlers };
}

export type ProjectSetupHandlers = ReturnType<typeof createProjectSetupModule>["handlers"];
