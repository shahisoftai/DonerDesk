import { PrismaClient } from "@prisma/client";
import { TenantId } from "@donordesk/domain";

import {
  UpdateTemplateRequirementsHandler,
  UpdateTemplateMetadataHandler,
  ReextractTemplateHandler,
  MarkTemplateReviewedHandler,
  GetTemplateHandler,
  GetTemplateVersionHandler,
  GetTemplateOriginalFileHandler,
  SetTemplateLibraryHandler,
  SetDefaultTemplateHandler,
  ListLibraryTemplatesHandler,
  CloneTemplateHandler,
  ParseTemplateFileHandler,
  PreviewTemplateBriefHandler,
  TemplateExtractionRunner,
  PeriodTemplateResolver,
  type ITemplateExtractionService,
  type ILLMProvider,
  SignUpHandler,
  LoginHandler,
  InviteUserHandler,
  ChangeRoleHandler,
  ChangePasswordHandler,
  RequestPasswordResetHandler,
  ConfirmPasswordResetHandler,
  UpdateOrganizationHandler,
  UpdateOrganizationReportingDefaultsHandler,
  ConnectGoogleDriveHandler,
  GoogleSignInHandler,
  LinkGoogleDriveEvidenceHandler,
  ListUsersHandler,
  CreateProjectHandler,
  UpdateProjectHandler,
  ListProjectsHandler,
  GetProjectHandler,
  AssignProjectMemberHandler,
  UpdateProjectMemberHandler,
  RemoveProjectMemberHandler,
  ListProjectMembersHandler,
  UploadTemplateHandler,
  DetectTemplateRegionsHandler,
  UpdateTemplateMappingHandler,
  ApproveTemplateMappingHandler,
  LockTemplateMappingHandler,
  UpdateTemplateSectionsHandler,
  DeleteTemplateHandler,
  ListTemplatesHandler,
  CreateLogframeItemHandler,
  MoveLogframeItemHandler,
  ImportLogframeHandler,
  ImportIndicatorsHandler,
  CreateIndicatorHandler,
  UpdateIndicatorSemanticsHandler,
  CreateIndicatorUpdateHandler,
  BulkUpsertIndicatorUpdatesHandler,
  ListPeriodIndicatorsHandler,
  ParseIndicatorSheetHandler,
  VerifyIndicatorUpdateHandler,
  RequestIndicatorUpdateCorrectionHandler,
  RejectIndicatorUpdateHandler,
  ListIndicatorUpdatesHandler,
  ListLogframeHandler,
  ListIndicatorsHandler,
  UploadEvidenceHandler,
  ImportEvidenceHandler,
  SuggestEvidenceTagsHandler,
  AcceptEvidenceTagsHandler,
  SetEvidencePeriodHandler,
  PersistEvidenceTagsHandler,
  VerifyEvidenceHandler,
  SearchEvidenceHandler,
  GetEvidenceHandler,
  CreateActivityUpdateHandler,
  ImportActivitiesHandler,
  PolishActivityHandler,
  ReviewActivityHandler,
  ListActivitiesHandler,
  GetActivityHandler,
  UpdateActivityHandler,
  AttachEvidenceHandler,
  DetachEvidenceHandler,
  SuggestEvidenceLinksHandler,
  CreateReportingPeriodHandler,
  EnsureAutoPeriodHandler,
  ListReportingPeriodsHandler,
  GenerateReportDraftHandler,
  GetReportDraftHandler,
  GetSmartReviewHandler,
  UpdateReportSectionHandler,
  CreateReportSectionHandler,
  DeleteReportSectionHandler,
  ReorderReportSectionsHandler,
  UpdateReportSectionChartHandler,
  ApproveReportSectionHandler,
  SubmitReportForReviewHandler,
  CancelReportGenerationHandler,
  ActivateReportDraftHandler,
  ApproveReportHandler,
  RejectReportHandler,
  ResolveReportClaimHandler,
  BulkResolveReportClaimHandler,
  UpdateReportingPeriodStoryHandler,
  ImportPeriodIndicatorValuesHandler,
  ProposeFieldReportExtractionHandler,
  ApplyFieldReportExtractionHandler,
  DetectMissingEvidenceHandler,
  ResolveChecklistItemHandler,
  BulkResolveChecklistHandler,
  ListChecklistHandler,
  CalculateReadinessHandler,
  RecomputeReadinessHandler,
  GenerateChecklistHandler,
  RewriteReportSectionHandler,
  IndicatorAnalyticsService,
  InferredReportPlanner,
  CreateExportHandler,
  GetExportPreflightHandler,
  RunExportHandler,
  GenerateDeadlineRemindersHandler,
  AddCommentHandler,
  ResolveCommentHandler,
  ListCommentsHandler,
  ListNotificationsHandler,
  MarkNotificationReadHandler,
  ListAuditLogHandler,
  RecordLegalConsentHandler,
  GetLegalConsentHandler,
  GetProjectSetupHandler,
  AcknowledgeProjectSetupHandler,
  RetryProjectWorkspaceHandler,
  RepairProjectWorkspaceHandler,
  ListWorkspaceFilesHandler,
  ProvisionTenantWorkspacesHandler,
  ImportDriveFileHandler,
  GetReportingProfileHandler,
  UpsertReportingProfileHandler,
  ProjectReadinessService,
  UuidIdGenerator,
  type SystemClock,
  SystemClock as SystemClockImpl,
  ProvisionTenantHandler,
  EntitlementService,
  CreateCheckoutHandler,
  CreateCustomerPortalHandler,
  GetBillingSummaryHandler,
  ProcessBillingWebhookHandler,
  ExpireLocalTrialsHandler,
  ReconcileBillingSubscriptionsHandler,
  ReconcileManagedStorageUsageHandler,
  ReleaseStaleUsageReservationsHandler,
  RetryBillingInboxHandler,
  RunGrandfatherCreditCutoverHandler,
  BillingSubscriptionSynchronizer,
  ReportRevisionService,
  ReportAssuranceService,
  GetReportAssuranceHandler,
  ReassessReportRevisionHandler,
  ResolveEffectiveRequirementsHandler,
  UpsertRequirementPackHandler,
  ActivateRequirementPackHandler,
  UpsertAwardOverrideHandler,
  CreateSubmissionSnapshotHandler,
  RegenerateReportSectionHandler,
  ReopenReportClaimHandler,
  ApplyClaimSuggestionHandler,
  GetClaimSuggestionHandler,
  ListSectionRevisionsHandler,
  ReportGenerationContextBuilder,
  SectionGenerationService,
  UpdateAgentMemorySettingsHandler,
  ExtractAgentMemoryHandler,
  ListPendingAgentMemoryHandler,
  ApproveAgentMemoryHandler,
  RejectAgentMemoryHandler,
  DeactivateAgentMemoryHandler,
} from "@donordesk/application";
import type { IJobQueue, IReportDraftGenerator, INotificationPort, IAgentMemoryRepository, IAgentMemoryExtractor } from "@donordesk/application";
import { EmailAdapter } from "./comms/email.js";
import { PostmarkNotificationAdapter, FanOutNotificationAdapter } from "./comms/postmark-notification-adapter.js";

import {
  PrismaOrganizationRepository,
  PrismaUserRepository,
  PrismaInvitationRepository,
  PrismaPasswordResetTokenRepository,
} from "./repositories/identity.js";
import { PrismaProjectRepository } from "./repositories/projects.js";
import { PrismaProjectMemberRepository } from "./repositories/project-members.js";
import {
  PrismaProjectSetupRepository,
  PrismaReportingProfileRepository,
} from "./repositories/setup.js";
import {
  PrismaBillingSubscriptionRepository,
  PrismaEntitlementGrantRepository,
  PrismaUsageCounterRepository,
  PrismaBillingEventInboxRepository,
  PrismaTrialIdentityRepository,
  PrismaLlmUsageRepository,
  PrismaPlanCatalogRepository,
} from "./repositories/billing.js";
import { PrismaDonorTemplateRepository } from "./repositories/templates.js";
import {
  PrismaLogframeRepository,
  PrismaIndicatorRepository,
  PrismaIndicatorUpdateRepository,
} from "./repositories/logframe.js";
import { PrismaEvidenceRepository } from "./repositories/evidence.js";
import { PrismaIdempotencyRepository } from "./repositories/idempotency.js";
import { PrismaActivityUpdateRepository } from "./repositories/activities.js";
import {
  PrismaReportingPeriodRepository,
  PrismaReportDraftRepository,
  PrismaReportSectionRepository,
} from "./repositories/reporting.js";
import {
  PrismaReportPlanRepository,
  PrismaReportClaimRepository,
  PrismaReportGenerationRunRepository,
  PrismaDonorTemplateMappingRepository,
} from "./repositories/report-intelligence.js";
import {
  PrismaReportRevisionRepository,
  PrismaSubmissionSnapshotRepository,
  PrismaRequirementPackRepository,
  PrismaAwardOverrideRepository,
  PrismaResolvedRequirementsRepository,
} from "./repositories/report-revisions.js";
import { PrismaReportArtifactRepository } from "./repositories/report-artifact-repository.js";
import { PrismaAgentMemoryRepository } from "./repositories/agent-memory-repository.js";
import { DeterministicMemoryExtractor } from "./memory/deterministic-memory-extractor.js";
import { createAgentMemoryLookup } from "./llm/agent-memory-brief.js";
import { PrismaChecklistRepository } from "./repositories/checklist.js";
import { PrismaExportRepository } from "./repositories/exports.js";
import {
  PrismaCommentRepository,
  PrismaNotificationRepository,
  PrismaAuditRepository,
} from "./repositories/support.js";

import { JwtAuthProvider } from "./auth/jwt.js";
import { OidcAuthProvider } from "./auth/oidc.js";
import { GoogleSignInConnector } from "./auth/google-sign-in.js";
import { LocalStorage } from "./storage/local-storage.js";
import { EvidenceStorageResolver } from "./storage/router.js";
import { ProjectWorkspaceServiceResolver, PrismaWorkspaceNameProvider } from "./storage/workspace-router.js";
import { PrismaGoogleDriveTokenStore } from "./storage/prisma-google-drive-token-store.js";
import { GoogleDriveOAuthConnector } from "./storage/google-drive-oauth.js";
import { GoogleDriveFileReader } from "./storage/google-drive.js";
import { GoogleSheetsReader } from "./storage/google-sheets-reader.js";
import { PrismaGoogleDriveCredentialStore } from "./storage/google-drive-credentials.js";
import { TolerantDocumentParser } from "./parsers/document-parser.js";
import { MammothDonorTemplateStructureParser } from "./parsers/donor-template-structure-parser.js";
import { HttpDonorTemplateWorkerClient } from "./llm/donor-template-worker-client.js";
import { FallbackTemplateExtractionService, HeuristicTemplateExtractor, LlmTemplateExtractor, TocTemplateExtractor } from "./llm/template-extraction/index.js";
import { CompositeStructuredDocumentParser } from "./parsers/structured/index.js";
import { StorageTemplateFileStore } from "./storage/template-file-store.js";
import { NarratorBriefRenderer } from "./llm/narrator-brief-renderer.js";
import { StubEvidenceTagger } from "./llm/evidence-tagger.js";
import { StubActivityPolisher } from "./llm/activity-polisher.js";
import { StubReportDraftGenerator } from "./llm/report-draft-generator.js";
import { createLLMProvider } from "./llm/factory.js";
import { PlatformLlmConfigResolver, type ResolvedLlmConfig } from "./llm/llm-config-resolver.js";
import { LlmReportDraftGenerator } from "./llm/llm-report-draft-generator.js";
import { AiReporterDraftGenerator } from "./llm/ai-reporter-draft-generator.js";
import { HttpWorkerClient } from "./llm/ai-reporter-worker-client.js";
import { createEmbeddingGenerator } from "./llm/embedding-generator.js";
import { PrismaEmbeddingStore } from "./repositories/embedding-store.js";
import { PrismaEvidenceDirectory, PrismaReportInputsChangeReader } from "./repositories/report-editor-read-models.js";
import { InMemorySectionRegenerationTracker } from "./repositories/section-regeneration-tracker.js";
import { DeterministicPriorPeriodService } from "./llm/prior-period.js";
import { DeterministicClaimVerifier } from "./llm/claim-verifier.js";
import { DeterministicAssertionExtractor } from "./llm/assertion-extractor.js";
import { Sha256HashService } from "./llm/hash-service.js";
import { DeterministicRequirementResolver } from "./llm/requirement-resolver.js";
import { ChecklistUnsupportedClaimProjector } from "./llm/checklist-projector.js";
import { EvidencePackageBuilder } from "./ai/evidence-package-builder.js";
import { StubChecklistDetector } from "./llm/checklist-detector.js";
import { DefaultExportBuilder } from "./exports/builder.js";
import { createLogger } from "./observability/logger.js";
import { isTruthyFlag } from "./observability/feature-flags.js";
import {
  LoggingNotificationAdapter,
} from "./support.js";
import { OutboxEventBus, DEFAULT_EVENT_TO_JOB } from "./events/outbox-event-bus.js";
import { createJobQueue } from "./jobs/index.js";
import { createBillingProvider } from "./billing/index.js";
import { InMemoryPasswordResetRateLimiter } from "./security/password-reset-rate-limiter.js";

export interface Container {
  prisma: PrismaClient;
  /**
   * Waits for work a handler started in the background (section-wise
   * generation, single-section regeneration). The api calls it before
   * disconnecting a request's database client, so background writes never
   * run on a closed connection. The response itself is not delayed.
   */
  settleBackgroundWork(): Promise<void>;
  auth: JwtAuthProvider | OidcAuthProvider;
  storage: LocalStorage;
  evidenceStorage: EvidenceStorageResolver;
  googleDriveOAuth: GoogleDriveOAuthConnector;
  googleDriveCredentials: PrismaGoogleDriveCredentialStore;
  driveFileReader: GoogleDriveFileReader;
  parser: TolerantDocumentParser;
  logger: ReturnType<typeof createLogger>;
  ids: UuidIdGenerator;
  clock: SystemClock;
  events: OutboxEventBus;
  notify: INotificationPort;
  jobQueue: IJobQueue;
  evidenceTagger: StubEvidenceTagger;
  activityPolisher: StubActivityPolisher;
  templateExtraction: ITemplateExtractionService;
  structuredParser: CompositeStructuredDocumentParser;
  templateFiles: StorageTemplateFileStore;
  checklistDetector: StubChecklistDetector;
  exportBuilder: DefaultExportBuilder;
  // Repositories
  organizations: PrismaOrganizationRepository;
  users: PrismaUserRepository;
  invitations: PrismaInvitationRepository;
  passwordResetTokens: PrismaPasswordResetTokenRepository;
  passwordResetRateLimiter: InMemoryPasswordResetRateLimiter;
  billingSubscriptions: PrismaBillingSubscriptionRepository;
  entitlementGrants: PrismaEntitlementGrantRepository;
  usageCounters: PrismaUsageCounterRepository;
  billingInbox: PrismaBillingEventInboxRepository;
  trialIdentities: PrismaTrialIdentityRepository;
  llmUsage: PrismaLlmUsageRepository;
  planCatalog: PrismaPlanCatalogRepository;
  billingProvider: ReturnType<typeof createBillingProvider>;
  projects: PrismaProjectRepository;
  projectMembers: PrismaProjectMemberRepository;
  projectSetup: PrismaProjectSetupRepository;
  reportingProfiles: PrismaReportingProfileRepository;
  readiness: ProjectReadinessService;
  projectWorkspace: ProjectWorkspaceServiceResolver;
  templates: PrismaDonorTemplateRepository;
  logframe: PrismaLogframeRepository;
  indicators: PrismaIndicatorRepository;
  indicatorUpdates: PrismaIndicatorUpdateRepository;
  evidence: PrismaEvidenceRepository;
  idempotency: PrismaIdempotencyRepository;
  activities: PrismaActivityUpdateRepository;
  periods: PrismaReportingPeriodRepository;
  drafts: PrismaReportDraftRepository;
  sections: PrismaReportSectionRepository;
  reportPlans: PrismaReportPlanRepository;
  reportClaims: PrismaReportClaimRepository;
  generationRuns: PrismaReportGenerationRunRepository;
  reportRevisions: PrismaReportRevisionRepository;
  reportArtifacts: PrismaReportArtifactRepository;
  agentMemory: PrismaAgentMemoryRepository;
  submissionSnapshots: PrismaSubmissionSnapshotRepository;
  requirementPacks: PrismaRequirementPackRepository;
  awardOverrides: PrismaAwardOverrideRepository;
  resolvedRequirements: PrismaResolvedRequirementsRepository;
  donorTemplateMappings: PrismaDonorTemplateMappingRepository;
  checklist: PrismaChecklistRepository;
  exports: PrismaExportRepository;
  comments: PrismaCommentRepository;
  notifications: PrismaNotificationRepository;
  audits: PrismaAuditRepository;
  // Handlers
  handlers: {
    signUp: SignUpHandler;
    login: LoginHandler;
    googleSignIn: GoogleSignInHandler;
    inviteUser: InviteUserHandler;
    changeRole: ChangeRoleHandler;
    changePassword: ChangePasswordHandler;
    requestPasswordReset: RequestPasswordResetHandler;
    confirmPasswordReset: ConfirmPasswordResetHandler;
    updateOrganization: UpdateOrganizationHandler;
    updateOrganizationReportingDefaults: UpdateOrganizationReportingDefaultsHandler;
    updateAgentMemorySettings: UpdateAgentMemorySettingsHandler;
    listPendingAgentMemory: ListPendingAgentMemoryHandler;
    approveAgentMemory: ApproveAgentMemoryHandler;
    rejectAgentMemory: RejectAgentMemoryHandler;
    deactivateAgentMemory: DeactivateAgentMemoryHandler;
    listUsers: ListUsersHandler;
    createProject: CreateProjectHandler;
    updateProject: UpdateProjectHandler;
    listProjects: ListProjectsHandler;
    getProject: GetProjectHandler;
    assignProjectMember: AssignProjectMemberHandler;
    updateProjectMember: UpdateProjectMemberHandler;
    removeProjectMember: RemoveProjectMemberHandler;
    listProjectMembers: ListProjectMembersHandler;
    getProjectSetup: GetProjectSetupHandler;
    acknowledgeProjectSetup: AcknowledgeProjectSetupHandler;
    retryProjectWorkspace: RetryProjectWorkspaceHandler;
    repairProjectWorkspace: RepairProjectWorkspaceHandler;
    listWorkspaceFiles: ListWorkspaceFilesHandler;
    provisionTenantWorkspaces: ProvisionTenantWorkspacesHandler;
    importDriveFile: ImportDriveFileHandler;
    getReportingProfile: GetReportingProfileHandler;
    upsertReportingProfile: UpsertReportingProfileHandler;
    uploadTemplate: UploadTemplateHandler;
    detectTemplateRegions: DetectTemplateRegionsHandler;
    updateTemplateMapping: UpdateTemplateMappingHandler;
    approveTemplateMapping: ApproveTemplateMappingHandler;
    lockTemplateMapping: LockTemplateMappingHandler;
    updateTemplateSections: UpdateTemplateSectionsHandler;
    deleteTemplate: DeleteTemplateHandler;
    listTemplates: ListTemplatesHandler;
    getTemplate: GetTemplateHandler;
    getTemplateVersion: GetTemplateVersionHandler;
    getTemplateOriginalFile: GetTemplateOriginalFileHandler;
    parseTemplateFile: ParseTemplateFileHandler;
    updateTemplateRequirements: UpdateTemplateRequirementsHandler;
    updateTemplateMetadata: UpdateTemplateMetadataHandler;
    reextractTemplate: ReextractTemplateHandler;
    markTemplateReviewed: MarkTemplateReviewedHandler;
    setTemplateLibrary: SetTemplateLibraryHandler;
    setTemplateDefault: SetDefaultTemplateHandler;
    listLibraryTemplates: ListLibraryTemplatesHandler;
    cloneTemplate: CloneTemplateHandler;
    previewTemplateBrief: PreviewTemplateBriefHandler;
    createLogframeItem: CreateLogframeItemHandler;
    moveLogframeItem: MoveLogframeItemHandler;
    importLogframe: ImportLogframeHandler;
    importIndicators: ImportIndicatorsHandler;
    createIndicator: CreateIndicatorHandler;
    updateIndicatorSemantics: UpdateIndicatorSemanticsHandler;
    createIndicatorUpdate: CreateIndicatorUpdateHandler;
    bulkUpsertIndicatorUpdates: BulkUpsertIndicatorUpdatesHandler;
    listPeriodIndicators: ListPeriodIndicatorsHandler;
    parseIndicatorSheet: ParseIndicatorSheetHandler;
    verifyIndicatorUpdate: VerifyIndicatorUpdateHandler;
    requestIndicatorUpdateCorrection: RequestIndicatorUpdateCorrectionHandler;
    rejectIndicatorUpdate: RejectIndicatorUpdateHandler;
    listIndicatorUpdates: ListIndicatorUpdatesHandler;
    listLogframe: ListLogframeHandler;
    listIndicators: ListIndicatorsHandler;
    uploadEvidence: UploadEvidenceHandler;
    importEvidence: ImportEvidenceHandler;
    suggestEvidenceTags: SuggestEvidenceTagsHandler;
    acceptEvidenceTags: AcceptEvidenceTagsHandler;
    setEvidencePeriod: SetEvidencePeriodHandler;
    persistEvidenceTags: PersistEvidenceTagsHandler;
    verifyEvidence: VerifyEvidenceHandler;
    searchEvidence: SearchEvidenceHandler;
    getEvidence: GetEvidenceHandler;
    createActivityUpdate: CreateActivityUpdateHandler;
    importActivities: ImportActivitiesHandler;
    polishActivity: PolishActivityHandler;
    reviewActivity: ReviewActivityHandler;
    listActivities: ListActivitiesHandler;
    getActivity: GetActivityHandler;
    updateActivity: UpdateActivityHandler;
    attachEvidence: AttachEvidenceHandler;
    suggestEvidenceLinks: SuggestEvidenceLinksHandler;
    detachEvidence: DetachEvidenceHandler;
    createReportingPeriod: CreateReportingPeriodHandler;
    ensureAutoPeriod: EnsureAutoPeriodHandler;
    updateReportingPeriodStory: UpdateReportingPeriodStoryHandler;
    importPeriodIndicatorValues: ImportPeriodIndicatorValuesHandler;
    proposeFieldReportExtraction: ProposeFieldReportExtractionHandler;
    applyFieldReportExtraction: ApplyFieldReportExtractionHandler;
    listReportingPeriods: ListReportingPeriodsHandler;
    generateReportDraft: GenerateReportDraftHandler;
    getReportDraft: GetReportDraftHandler;
    getSmartReview: GetSmartReviewHandler;
    cancelReportGeneration: CancelReportGenerationHandler;
    activateReportDraft: ActivateReportDraftHandler;
    getReportAssurance: GetReportAssuranceHandler;
    updateReportSection: UpdateReportSectionHandler;
    createReportSection: CreateReportSectionHandler;
    deleteReportSection: DeleteReportSectionHandler;
    reorderReportSections: ReorderReportSectionsHandler;
    updateReportSectionChart: UpdateReportSectionChartHandler;
    approveReportSection: ApproveReportSectionHandler;
    submitReportForReview: SubmitReportForReviewHandler;
    approveReport: ApproveReportHandler;
    rejectReport: RejectReportHandler;
    resolveReportClaim: ResolveReportClaimHandler;
    bulkResolveReportClaims: BulkResolveReportClaimHandler;
    reassessReportRevision: ReassessReportRevisionHandler;
    regenerateReportSection: RegenerateReportSectionHandler;
    reopenReportClaim: ReopenReportClaimHandler;
    getClaimSuggestion: GetClaimSuggestionHandler;
    applyClaimSuggestion: ApplyClaimSuggestionHandler;
    listSectionRevisions: ListSectionRevisionsHandler;
    resolveEffectiveRequirements: ResolveEffectiveRequirementsHandler;
    upsertRequirementPack: UpsertRequirementPackHandler;
    activateRequirementPack: ActivateRequirementPackHandler;
    upsertAwardOverride: UpsertAwardOverrideHandler;
    createSubmissionSnapshot: CreateSubmissionSnapshotHandler;
    detectMissingEvidence: DetectMissingEvidenceHandler;
    resolveChecklistItem: ResolveChecklistItemHandler;
    bulkResolveChecklist: BulkResolveChecklistHandler;
    listChecklist: ListChecklistHandler;
    calculateReadiness: CalculateReadinessHandler;
    recomputeReadiness: RecomputeReadinessHandler;
    generateChecklist: GenerateChecklistHandler;
    rewriteReportSection: RewriteReportSectionHandler;
    createExport: CreateExportHandler;
    getExportPreflight: GetExportPreflightHandler;
    runExport: RunExportHandler;
    generateDeadlineReminders: GenerateDeadlineRemindersHandler;
    addComment: AddCommentHandler;
    resolveComment: ResolveCommentHandler;
    listComments: ListCommentsHandler;
    listNotifications: ListNotificationsHandler;
    markNotificationRead: MarkNotificationReadHandler;
    listAuditLog: ListAuditLogHandler;
    recordLegalConsent: RecordLegalConsentHandler;
    getLegalConsent: GetLegalConsentHandler;
    connectGoogleDrive: ConnectGoogleDriveHandler;
    linkGoogleDriveEvidence: LinkGoogleDriveEvidenceHandler;
    createCheckout: CreateCheckoutHandler;
    createCustomerPortal: CreateCustomerPortalHandler;
    getBillingSummary: GetBillingSummaryHandler;
    processBillingWebhook: ProcessBillingWebhookHandler;
    expireLocalTrials: ExpireLocalTrialsHandler;
    reconcileBillingSubscriptions: ReconcileBillingSubscriptionsHandler;
    reconcileManagedStorageUsage: ReconcileManagedStorageUsageHandler;
    releaseStaleUsageReservations: ReleaseStaleUsageReservationsHandler;
    retryBillingInbox: RetryBillingInboxHandler;
    runGrandfatherCreditCutover: RunGrandfatherCreditCutoverHandler;
  };
}

export function createContainer(options?: { tenantId?: string; useAdminConnection?: boolean }): Container {
  const baseUrl = options?.useAdminConnection ? process.env.DATABASE_ADMIN_URL : process.env.DATABASE_URL;
  const tenantUrl = baseUrl && options?.tenantId ? withTenantSession(baseUrl, options.tenantId) : baseUrl;
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    ...(tenantUrl ? { datasources: { db: { url: tenantUrl } } } : {}),
  });
  const logger = createLogger();
  const auth = process.env.AUTH_PROVIDER === "oidc" ? new OidcAuthProvider() : new JwtAuthProvider();
  const googleSignIn = new GoogleSignInConnector();
  const storage = new LocalStorage();
  const googleDriveCredentials = new PrismaGoogleDriveCredentialStore(
    prisma,
    process.env.PLATFORM_MASTER_KEY ? Buffer.from(process.env.PLATFORM_MASTER_KEY, "base64") : Buffer.alloc(0),
  );
  const googleDriveTokens = new PrismaGoogleDriveTokenStore(googleDriveCredentials);
  const driveFileReader = new GoogleDriveFileReader(googleDriveTokens);
  const sheetReader = new GoogleSheetsReader(googleDriveTokens);
  const workspaceNameProvider = new PrismaWorkspaceNameProvider(
    async (id, tenantId) => {
      const row = await prisma.project.findFirst({ where: { id, tenantId: tenantId.toString() }, select: { title: true, projectCode: true } });
      return row ? { title: row.title, projectCode: row.projectCode } : null;
    },
    async (tenantId) => {
      const row = await prisma.organization.findUnique({ where: { tenantId: tenantId.toString() }, select: { name: true } });
      return row ? { name: row.name } : null;
    },
  );
  const projectWorkspace = new ProjectWorkspaceServiceResolver(
    workspaceNameProvider,
    async (tenantId) => {
      const org = await prisma.organization.findUnique({
        where: { tenantId: tenantId.toString() },
        select: { storageProvider: true },
      });
      return (org?.storageProvider as import("@donordesk/domain").StorageProvider | undefined) ?? "LOCAL";
    },
    LocalStorage.resolveRoot(),
    googleDriveTokens,
  );
  const evidenceStorage = new EvidenceStorageResolver(
    storage,
    async (tenantId) => {
      const org = await prisma.organization.findUnique({
        where: { tenantId: tenantId.toString() },
        select: { storageProvider: true },
      });
      return (org?.storageProvider as import("@donordesk/domain").StorageProvider | undefined) ?? "LOCAL";
    },
    googleDriveTokens,
    undefined, // R2 config: wired via env in production; see memorybank/gdrive.md
    projectWorkspace,
  );
  const parser = new TolerantDocumentParser();
  const ids = new UuidIdGenerator();
  const clock = new SystemClockImpl();
  const jobQueue = createJobQueue(logger);
  const events = new OutboxEventBus(logger, jobQueue, DEFAULT_EVENT_TO_JOB);
  const jobRegistrar = jobQueue as unknown as { register?: (n: string, h: (payload: Record<string, unknown>) => Promise<void>) => void };
  if (jobRegistrar?.register) {
    jobRegistrar.register(
      "project.workspace.provision",
      async (payload) => {
        const tenantId = String(payload.tenantId);
        const projectId = String(payload.projectId);
        const tenant = { toString: () => tenantId } as import("@donordesk/domain").TenantId;
        try {
          const setup = await projectSetup.findByProject(projectId, tenant);
          if (setup.ok && setup.value && setup.value.workspaceProvisionStatus === "PENDING") {
            const result = await projectWorkspace.ensureProjectWorkspace(tenant, projectId);
            if (result.ok) {
              setup.value.markReady();
              await projectSetup.update(setup.value);
              const project = await projects.findById(projectId, tenant);
              if (project.ok && project.value) {
                project.value.setWorkspaceRoot(result.value.rootId);
                await projects.update(project.value);
              }
            } else {
              setup.value.markFailed(result.error.message);
              await projectSetup.update(setup.value);
            }
          }
        } catch (error) {
          logger.error("workspace.provision_job_failed", { projectId, error: String(error) });
        }
      },
    );
  }
  const googleDriveOAuth = new GoogleDriveOAuthConnector();

  const organizations = new PrismaOrganizationRepository(prisma);
  const users = new PrismaUserRepository(prisma);
  const loggingNotifier = new LoggingNotificationAdapter(logger);
  const notify: INotificationPort =
    process.env.EMAIL_PROVIDER === "postmark" && process.env.POSTMARK_SERVER_TOKEN
      ? new FanOutNotificationAdapter([
          loggingNotifier,
          new PostmarkNotificationAdapter(
            new EmailAdapter({
              smtpHost: "",
              smtpPort: 0,
              smtpUser: process.env.POSTMARK_SERVER_TOKEN,
              smtpPassword: "",
              fromAddress: process.env.EMAIL_FROM_ADDRESS ?? "notifications@donordesk.online",
            }),
            users,
            logger,
          ),
        ])
      : loggingNotifier;
  const invitations = new PrismaInvitationRepository(prisma);
  const passwordResetTokens = new PrismaPasswordResetTokenRepository(prisma);
  const passwordResetRateLimiter = new InMemoryPasswordResetRateLimiter();
  const projects = new PrismaProjectRepository(prisma);
  const projectMembers = new PrismaProjectMemberRepository(prisma);
  const projectSetup = new PrismaProjectSetupRepository(prisma);
  const reportingProfiles = new PrismaReportingProfileRepository(prisma);
  const templates = new PrismaDonorTemplateRepository(prisma, logger);
  const logframe = new PrismaLogframeRepository(prisma);
  const indicators = new PrismaIndicatorRepository(prisma);
  const indicatorUpdates = new PrismaIndicatorUpdateRepository(prisma);
  const evidence = new PrismaEvidenceRepository(prisma);
  const idempotency = new PrismaIdempotencyRepository(prisma);
  const activities = new PrismaActivityUpdateRepository(prisma);
  const periods = new PrismaReportingPeriodRepository(prisma);
  const drafts = new PrismaReportDraftRepository(prisma);
  const sections = new PrismaReportSectionRepository(prisma);
  const reportPlans = new PrismaReportPlanRepository(prisma);
  const reportClaims = new PrismaReportClaimRepository(prisma);
  const generationRuns = new PrismaReportGenerationRunRepository(prisma);
  const reportRevisions = new PrismaReportRevisionRepository(prisma);
  const reportArtifacts = new PrismaReportArtifactRepository(prisma);
  const agentMemory = new PrismaAgentMemoryRepository(prisma);
  const submissionSnapshots = new PrismaSubmissionSnapshotRepository(prisma);
  const requirementPacks = new PrismaRequirementPackRepository(prisma);
  const awardOverrides = new PrismaAwardOverrideRepository(prisma);
  const resolvedRequirements = new PrismaResolvedRequirementsRepository(prisma);
  const donorTemplateMappings = new PrismaDonorTemplateMappingRepository(prisma);
  const checklist = new PrismaChecklistRepository(prisma);
  const exports = new PrismaExportRepository(prisma);
  const comments = new PrismaCommentRepository(prisma);
  const notifications = new PrismaNotificationRepository(prisma);
  const audits = new PrismaAuditRepository(prisma);

  const billingSubscriptions = new PrismaBillingSubscriptionRepository(prisma);
  const entitlementGrants = new PrismaEntitlementGrantRepository(prisma);
  const usageCounters = new PrismaUsageCounterRepository(prisma);
  const billingInbox = new PrismaBillingEventInboxRepository(prisma);
  const trialIdentities = new PrismaTrialIdentityRepository(prisma);
  const llmUsage = new PrismaLlmUsageRepository(prisma);
  const planCatalog = new PrismaPlanCatalogRepository(prisma);
  const billingProvider = createBillingProvider();
  const entitlements = new EntitlementService(entitlementGrants, billingSubscriptions, usageCounters, projects, users, planCatalog);
  const billingSubscriptionSynchronizer = new BillingSubscriptionSynchronizer(billingProvider, billingSubscriptions, entitlementGrants, ids, audits, clock);
  const provisionTenant = new ProvisionTenantHandler(ids, organizations, users, entitlementGrants, auth, events, audits, clock);

  const readiness = new ProjectReadinessService(
    projects,
    projectSetup,
    reportingProfiles,
    templates,
    indicators,
    users,
    {
      resolve: async (tenantId) => {
        const org = await prisma.organization.findUnique({
          where: { tenantId: tenantId.toString() },
          select: { storageProvider: true },
        });
        return { ok: true, value: { provider: org?.storageProvider ?? "LOCAL" } };
      },
    },
  );

  const evidenceTagger = new StubEvidenceTagger();
  const activityPolisher = new StubActivityPolisher();
  const masterKey = process.env.PLATFORM_MASTER_KEY
    ? Buffer.from(process.env.PLATFORM_MASTER_KEY, "base64")
    : Buffer.alloc(32);
  const llmConfigResolver = new PlatformLlmConfigResolver(prisma, masterKey);

  // Report generators are cached per tenant, keyed by the resolved LLM
  // configuration's fingerprint, so a SuperAdmin change (new default provider,
  // rotated key, tenant's own API added/removed) applies to the next generation
  // without an api restart.
  const generatorCache = new Map<string, { key: string; generator: IReportDraftGenerator }>();
  const generatorPromises = new Map<string, Promise<IReportDraftGenerator>>();
  // Resolved once per process so it is visible in startup logs without
  // waiting for the first /v1/reporting-periods/:id/generate-draft request.
  const aiReporterFlagEnabled = isTruthyFlag(process.env.AI_REPORTER_ENABLED);
  if (aiReporterFlagEnabled) {
    logger?.info("AI Reporter flag is enabled; the dedicated Python worker will be used for report drafting", {
      url: process.env.AI_REPORTER_URL ?? "http://127.0.0.1:8092 (default)",
      httpTimeoutMs: process.env.AI_REPORTER_HTTP_TIMEOUT_MS ?? `derived from AI_REPORTER_DRAFT_TIMEOUT_MS=${process.env.AI_REPORTER_DRAFT_TIMEOUT_MS ?? "90000 (default)"} (2x + 30s)`,
      writerContractVersion: process.env.AI_REPORTER_CONTRACT_VERSION ?? "4 (default)",
      internalTokenSet: Boolean(process.env.INTERNAL_TOKEN),
    });
  } else if (process.env.AI_REPORTER_ENABLED !== undefined) {
    logger?.warn("AI_REPORTER_ENABLED is set but unrecognised; treating as disabled. Accepted values: 1, true, on, yes, enabled (case-insensitive).", {
      raw: process.env.AI_REPORTER_ENABLED,
    });
  }

  // Agent Memory (Phase 21) — platform switch. Effective state is this AND
  // the tenant's own Organization.agentMemoryEnabled toggle (§4.1/§8); either
  // alone off means generation output stays byte-identical to pre-Phase-21
  // behaviour.
  const agentMemoryFlagEnabled = isTruthyFlag(process.env.AGENT_MEMORY_ENABLED);
  if (agentMemoryFlagEnabled) {
    logger?.info("Agent Memory flag is enabled; tenants may opt in from Settings to learn style guidance from reviewer edits");
  } else if (process.env.AGENT_MEMORY_ENABLED !== undefined) {
    logger?.warn("AGENT_MEMORY_ENABLED is set but unrecognised; treating as disabled. Accepted values: 1, true, on, yes, enabled (case-insensitive).", {
      raw: process.env.AGENT_MEMORY_ENABLED,
    });
  }
  const resolveAgentMemoryLookup = async (
    tenantId: string | undefined,
  ): Promise<((sectionTitle: string) => Promise<string[]>) | undefined> => {
    if (!agentMemoryFlagEnabled || !tenantId) return undefined;
    try {
      const org = await organizations.findByTenant(TenantId.create(tenantId));
      if (!org.ok || !org.value?.agentMemoryEnabled) return undefined;
      return createAgentMemoryLookup(agentMemory, TenantId.create(tenantId));
    } catch (error) {
      logger?.warn("Agent Memory lookup unavailable; generation proceeds without learned style guidance", {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  };

  const withProviderSource = (generator: IReportDraftGenerator, providerSource: "PLATFORM" | "TENANT"): IReportDraftGenerator => ({
    model: generator.model,
    providerSource,
    generateDraft: (input) => generator.generateDraft(input),
    generateSection: (input, section) => generator.generateSection(input, section),
    rewriteSection: (input) => generator.rewriteSection(input),
  });

  const resolveTenantLlm = async (tenantId?: string): Promise<ResolvedLlmConfig | null> => {
    try {
      const resolved = await llmConfigResolver.resolve({ tenantId });
      if (resolved.ok) return resolved.value;
      logger?.warn("LLM configuration could not be resolved; using the environment fallback", { tenantId: tenantId ?? "default", error: resolved.error.message });
    } catch (error) {
      logger?.warn("LLM configuration lookup failed; using the environment fallback", { tenantId: tenantId ?? "default", error: error instanceof Error ? error.message : String(error) });
    }
    return null;
  };

  const buildReportDraftGenerator = async (tenantId: string | undefined, resolved: ResolvedLlmConfig | null): Promise<IReportDraftGenerator> => {
    const agentMemoryLookup = await resolveAgentMemoryLookup(tenantId);
    const source = resolved
      ? { scope: resolved.scope, provider: resolved.provider, model: resolved.model ?? "(provider default)", configId: resolved.configId }
      : { scope: "ENV", provider: process.env.AI_REPORTER_PROVIDER ?? process.env.LLM_PROVIDER ?? "stub" };
    // AI Reporter sidecar (feature-flagged): the Python worker drafts with the
    // SAME provider the tenant resolves to — the tenant's own API, else the
    // SuperAdmin default. The resolved credentials are sent per request, so
    // workers.env is only a fallback when no platform configuration exists.
    if (aiReporterFlagEnabled) {
      try {
        const worker = new HttpWorkerClient();
        // Liveness check so a misconfigured worker URL is surfaced in the api
        // logs immediately. It does NOT throw — the generator itself falls
        // back to the deterministic stub per section on worker failure.
        try {
          const probe = await worker.probe();
          if (!probe.ok) {
            logger?.warn("AI Reporter worker probe failed; sections will fall back to the deterministic stub until it recovers", {
              error: probe.error.message,
              url: worker.baseUrl,
              hint: "Verify AI_REPORTER_URL points at the Python worker (default http://127.0.0.1:8092) and the worker service is running.",
            });
          }
        } catch (probeError) {
          logger?.warn("AI Reporter worker probe threw unexpectedly", {
            error: probeError instanceof Error ? probeError.message : String(probeError),
          });
        }
        const embeddingGenerator = createEmbeddingGenerator();
        const embeddingStore = new PrismaEmbeddingStore(prisma);
        const prior = new DeterministicPriorPeriodService(periods, drafts, sections, reportRevisions);
        const modelConfig = resolved
          ? { provider: resolved.provider, model: resolved.model, baseUrl: resolved.baseUrl, apiKey: resolved.apiKey, effort: resolved.effort }
          : undefined; // env default (workers.env)
        logger?.info("Report drafting provider selected", { tenantId: tenantId ?? "default", path: "ai-reporter", ...source });
        return new AiReporterDraftGenerator(worker, new StubReportDraftGenerator(), embeddingGenerator, embeddingStore, prior, logger, undefined, modelConfig, agentMemoryLookup);
      } catch (error) {
        logger?.warn("AI Reporter construction failed; falling back to standard LLM generator", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    try {
      if (resolved) {
        logger?.info("Report drafting provider selected", { tenantId: tenantId ?? "default", path: "llm", ...source });
        return new LlmReportDraftGenerator(createLLMProvider(resolved), undefined, logger, agentMemoryLookup);
      }
      if (process.env.LLM_PROVIDER) {
        // Documented fallback chain: platform config -> LLM_PROVIDER env -> stub.
        return new LlmReportDraftGenerator(createLLMProvider(), undefined, logger, agentMemoryLookup);
      }
    } catch (error) {
      // A provider-construction failure (e.g. missing API key or model) must
      // degrade to the stub, never reject getGenerator and 500 the route.
      logger?.warn("LLM provider construction failed; using stub generator", { tenantId: tenantId ?? "default", ...source, error: error instanceof Error ? error.message : String(error) });
      return new StubReportDraftGenerator();
    }
    // No platform config and no LLM_PROVIDER env: the deterministic stub is
    // used. This must be an explicit, visible dev-only default, never a
    // silent production path, so we log it loudly.
    logger?.warn("No LLM provider configured (no enabled SuperAdmin LLM configuration and LLM_PROVIDER unset); report drafting will use the deterministic stub generator", {
      tenantId: tenantId ?? "default",
      hint: "Enable an LLM provider for all tenants in the SuperAdmin portal (AI tab), or set LLM_PROVIDER.",
    });
    return new StubReportDraftGenerator();
  };

  const getReportDraftGenerator = async (tenantId?: string): Promise<IReportDraftGenerator> => {
    const tenantKey = tenantId ?? "default";
    const resolved = await resolveTenantLlm(tenantId);
    const key = `${aiReporterFlagEnabled ? "ai-reporter" : "llm"}:${resolved?.fingerprint ?? "env"}`;
    const cached = generatorCache.get(tenantKey);
    if (cached && cached.key === key) return cached.generator;
    const promiseKey = `${tenantKey}|${key}`;
    const existing = generatorPromises.get(promiseKey);
    if (existing) return existing;
    const promise = buildReportDraftGenerator(tenantId, resolved)
      .then((built) => {
        // A tenant's own AI provider never consumes DonorDesk AI credits
        // (see GenerateReportDraftHandler). The stub is never tagged.
        const generator = resolved?.scope === "TENANT" && built.model.modelId !== "stub" ? withProviderSource(built, "TENANT") : built;
        generatorCache.set(tenantKey, { key, generator });
        return generator;
      })
      .finally(() => generatorPromises.delete(promiseKey));
    generatorPromises.set(promiseKey, promise);
    return promise;
  };
  // Template extraction uses the same provider the tenant drafts with; an
  // organisation with AI disabled, or no configured provider, gets the
  // deterministic extractor. The template is donor guidance (no beneficiary
  // data), and redaction would break source-grounding, so no PII firewall.
  const resolveTemplateLlm = async (tenantId: string): Promise<ILLMProvider | null> => {
    try {
      const org = await organizations.findByTenant(TenantId.create(tenantId));
      if (!org.ok || !org.value?.aiEnabled) return null;
      const resolved = await resolveTenantLlm(tenantId);
      const provider = resolved ? createLLMProvider(resolved) : process.env.LLM_PROVIDER ? createLLMProvider() : null;
      return provider && provider.name !== "stub" ? provider : null;
    } catch (error) {
      logger.warn("Template extraction LLM unavailable; using heuristic extraction", { tenantId, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  };
  const templateExtraction: ITemplateExtractionService = new FallbackTemplateExtractionService(
    [
      // v2 (default): outline pass over the whole document, then guidance per branch.
      // TEMPLATE_EXTRACTION_PROMPT=v1 restores the single-pass extractor for comparison.
      { name: "AI", extractor: process.env.TEMPLATE_EXTRACTION_PROMPT === "v1" ? new LlmTemplateExtractor(resolveTemplateLlm) : new TocTemplateExtractor(resolveTemplateLlm) },
      { name: "Heuristic", extractor: new HeuristicTemplateExtractor() },
    ],
    logger,
  );
  const structuredParser = new CompositeStructuredDocumentParser();
  const templateFiles = new StorageTemplateFileStore(storage);
  const checklistDetector = new StubChecklistDetector();
  const donorTemplateRenderer = new HttpDonorTemplateWorkerClient();
  const exportBuilder = new DefaultExportBuilder(storage, donorTemplateRenderer);

  const indicatorAnalytics = new IndicatorAnalyticsService(periods, indicators, indicatorUpdates);
  const reportPlanner = new InferredReportPlanner(ids);
  const evidencePackageBuilder = new EvidencePackageBuilder(evidence);
  const claimVerifier = new DeterministicClaimVerifier();
  const hashService = new Sha256HashService();
  const assertionExtractor = new DeterministicAssertionExtractor();
  const revisionService = new ReportRevisionService(reportRevisions, sections, hashService);
  const sectionRegenerationTracker = new InMemorySectionRegenerationTracker();
  const backgroundTasks = new Set<Promise<void>>();
  const runInBackground = (task: () => Promise<void>): void => {
    const running: Promise<void> = task()
      .catch((error: unknown) => logger.error("Background task failed", { error: error instanceof Error ? error.message : String(error) }))
      .finally(() => backgroundTasks.delete(running));
    backgroundTasks.add(running);
  };
  const unsupportedClaimProjector = new ChecklistUnsupportedClaimProjector(ids, checklist);
  const assuranceService = new ReportAssuranceService(ids, sections, drafts, reportRevisions, reportClaims, assertionExtractor, claimVerifier, indicatorAnalytics, evidencePackageBuilder, unsupportedClaimProjector);

  // Agent Memory (Phase 21) — this handler has zero knowledge of the feature
  // beyond invoking an injected hook after a MANUAL_EDIT revision commits
  // (see UpdateReportSectionHandler's constructor docs). The hook itself
  // re-checks both flags at call time (state can change between requests)
  // and is a deliberate no-op — never an error — when either is off.
  const memoryExtractor = new DeterministicMemoryExtractor();
  const extractAgentMemoryHandler = new ExtractAgentMemoryHandler(reportRevisions, sections, drafts, periods, memoryExtractor, agentMemory);
  const onManualEditCommitted = agentMemoryFlagEnabled
    ? async (input: { tenantId: TenantId; sectionId: string; revisionId: string }): Promise<void> => {
        const org = await organizations.findByTenant(input.tenantId);
        if (!org.ok || !org.value?.agentMemoryEnabled) return;
        const result = await extractAgentMemoryHandler.handle(input);
        if (!result.ok) {
          logger.warn("Agent Memory extraction failed", { sectionId: input.sectionId, error: result.error.message });
        }
      }
    : undefined;
  const updateReportSectionHandler = new UpdateReportSectionHandler(sections, drafts, revisionService, assuranceService, audits, onManualEditCommitted, runInBackground);
  const claimSuggestionHandler = new GetClaimSuggestionHandler(reportClaims, drafts, indicatorAnalytics);
  const requirementResolver = new DeterministicRequirementResolver(ids, periods, requirementPacks, awardOverrides, reportPlans, resolvedRequirements);

  const calculateReadinessHandler = new CalculateReadinessHandler(periods, drafts, sections, indicators, indicatorUpdates, evidence, activities, checklist, templates, indicatorAnalytics);
  const detectMissingEvidenceHandler = new DetectMissingEvidenceHandler(ids, checklist, checklistDetector, periods, drafts, templates, indicatorUpdates, sections, activities, evidence, audits);

  if (jobRegistrar?.register) {
    jobRegistrar.register(
      "checklist.generate",
      async (payload) => {
        const tenantId = String(payload.tenantId);
        const reportingPeriodId = String(payload.reportingPeriodId);
        const tenant = { toString: () => tenantId } as import("@donordesk/domain").TenantId;
        const systemCtx = {
          tenant: { tenantId: tenant, userId: "system", role: "ADMIN" as const },
          requestId: "system",
        } as import("@donordesk/application").AuthenticatedContext;
        try {
          await detectMissingEvidenceHandler.handle(systemCtx, reportingPeriodId);
        } catch (error) {
          logger.error("checklist.generate_failed", { reportingPeriodId, error: String(error) });
        }
      },
    );
  }

  const createExportHandler = new CreateExportHandler(ids, exports, projects, periods, drafts, sections, indicators, indicatorUpdates, activities, checklist, evidence, submissionSnapshots, exportBuilder, storage, audits, donorTemplateMappings, templates, reportClaims);
  const templateExtractionRunner = new TemplateExtractionRunner(templates, templateExtraction, templateFiles, structuredParser, audits);
  const uploadTemplateHandler = new UploadTemplateHandler(ids, templates, templateFiles, templateExtractionRunner, runInBackground, audits);
  const parseTemplateFileHandler = new ParseTemplateFileHandler(structuredParser, templateFiles);
  const donorTemplateStructureParser = new MammothDonorTemplateStructureParser();
  const detectTemplateRegionsHandler = new DetectTemplateRegionsHandler(ids, templates, donorTemplateMappings, donorTemplateStructureParser, audits);
  const updateTemplateMappingHandler = new UpdateTemplateMappingHandler(donorTemplateMappings, audits);
  const approveTemplateMappingHandler = new ApproveTemplateMappingHandler(donorTemplateMappings, donorTemplateRenderer, storage, audits);
  const lockTemplateMappingHandler = new LockTemplateMappingHandler(periods, donorTemplateMappings, audits);
  const approveReportHandler = new ApproveReportHandler(drafts, periods, checklist, reportClaims, sections, reportRevisions, resolvedRequirements, audits, indicatorAnalytics);
  const createReportingPeriodHandler = new CreateReportingPeriodHandler(ids, periods, projects, templates, projectSetup, reportingProfiles, readiness, audits, events);
  const ensureAutoPeriodHandler = new EnsureAutoPeriodHandler(projects, reportingProfiles, periods, createReportingPeriodHandler);

  const handlers: Container["handlers"] = {
    signUp: new SignUpHandler(ids, organizations, users, auth, events, audits, provisionTenant),
    login: new LoginHandler(users, auth, audits),
    googleSignIn: new GoogleSignInHandler(googleSignIn, users, organizations, auth, ids, audits, provisionTenant),
    inviteUser: new InviteUserHandler(ids, users, invitations, audits, notify, entitlements),
    changeRole: new ChangeRoleHandler(users, audits),
    changePassword: new ChangePasswordHandler(users, auth, audits, clock),
    requestPasswordReset: new RequestPasswordResetHandler(
      ids, users, passwordResetTokens, passwordResetRateLimiter, audits, notify, clock,
      { webBaseUrl: process.env.WEB_BASE_URL ?? "http://localhost:3000" },
    ),
    confirmPasswordReset: new ConfirmPasswordResetHandler(users, passwordResetTokens, auth, audits, clock),
    updateOrganization: new UpdateOrganizationHandler(organizations, audits),
    updateOrganizationReportingDefaults: new UpdateOrganizationReportingDefaultsHandler(organizations, audits),
    updateAgentMemorySettings: new UpdateAgentMemorySettingsHandler(organizations, audits),
    listPendingAgentMemory: new ListPendingAgentMemoryHandler(agentMemory),
    approveAgentMemory: new ApproveAgentMemoryHandler(agentMemory, audits),
    rejectAgentMemory: new RejectAgentMemoryHandler(agentMemory, audits),
    deactivateAgentMemory: new DeactivateAgentMemoryHandler(agentMemory, audits),
    connectGoogleDrive: new ConnectGoogleDriveHandler(
      googleDriveOAuth,
      organizations,
      async (tenantId, refreshToken) => googleDriveCredentials.save(tenantId, refreshToken),
      audits,
    ),
    linkGoogleDriveEvidence: new LinkGoogleDriveEvidenceHandler(ids, evidence, evidenceStorage, events, audits),
    listUsers: new ListUsersHandler(users),
    createProject: new CreateProjectHandler(ids, projects, projectSetup, reportingProfiles, organizations, projectWorkspace, events, audits, entitlements),
    updateProject: new UpdateProjectHandler(projects, periods, audits),
    listProjects: new ListProjectsHandler(projects, projectMembers),
    getProject: new GetProjectHandler(projects),
    assignProjectMember: new AssignProjectMemberHandler(ids, projectMembers, projects, users, audits, notify),
    updateProjectMember: new UpdateProjectMemberHandler(projectMembers, audits),
    removeProjectMember: new RemoveProjectMemberHandler(projectMembers, audits),
    listProjectMembers: new ListProjectMembersHandler(projectMembers),
    getProjectSetup: new GetProjectSetupHandler(readiness),
    acknowledgeProjectSetup: new AcknowledgeProjectSetupHandler(projectSetup, readiness, audits),
    retryProjectWorkspace: new RetryProjectWorkspaceHandler(projectWorkspace, projects, projectSetup, events, audits),
    repairProjectWorkspace: new RepairProjectWorkspaceHandler(projectWorkspace, projects, projectSetup, audits),
    listWorkspaceFiles: new ListWorkspaceFilesHandler(projectWorkspace, projects),
    provisionTenantWorkspaces: new ProvisionTenantWorkspacesHandler(projectWorkspace, projects, projectSetup, events, audits),
    importDriveFile: new ImportDriveFileHandler(driveFileReader, parser, uploadTemplateHandler, new ImportLogframeHandler(ids, logframe, audits), audits, parseTemplateFileHandler),
    getReportingProfile: new GetReportingProfileHandler(reportingProfiles),
    upsertReportingProfile: new UpsertReportingProfileHandler(ids, reportingProfiles, templates, audits),
    uploadTemplate: uploadTemplateHandler,
    detectTemplateRegions: detectTemplateRegionsHandler,
    updateTemplateMapping: updateTemplateMappingHandler,
    approveTemplateMapping: approveTemplateMappingHandler,
    lockTemplateMapping: lockTemplateMappingHandler,
    updateTemplateSections: new UpdateTemplateSectionsHandler(templates, audits),
    deleteTemplate: new DeleteTemplateHandler(templates, reportingProfiles, audits),
    listTemplates: new ListTemplatesHandler(templates),
    getTemplate: new GetTemplateHandler(templates, templates),
    getTemplateVersion: new GetTemplateVersionHandler(templates),
    getTemplateOriginalFile: new GetTemplateOriginalFileHandler(templates, templateFiles),
    parseTemplateFile: parseTemplateFileHandler,
    updateTemplateRequirements: new UpdateTemplateRequirementsHandler(templates, audits),
    updateTemplateMetadata: new UpdateTemplateMetadataHandler(templates, audits),
    reextractTemplate: new ReextractTemplateHandler(templates, templateExtractionRunner, runInBackground, audits),
    markTemplateReviewed: new MarkTemplateReviewedHandler(templates, audits),
    setTemplateLibrary: new SetTemplateLibraryHandler(templates, audits),
    setTemplateDefault: new SetDefaultTemplateHandler(ids, templates, reportingProfiles, audits),
    listLibraryTemplates: new ListLibraryTemplatesHandler(templates),
    cloneTemplate: new CloneTemplateHandler(ids, templates, audits),
    previewTemplateBrief: new PreviewTemplateBriefHandler(templates, new NarratorBriefRenderer()),
    createLogframeItem: new CreateLogframeItemHandler(ids, logframe, audits),
    moveLogframeItem: new MoveLogframeItemHandler(logframe, audits),
    importLogframe: new ImportLogframeHandler(ids, logframe, audits),
    importIndicators: new ImportIndicatorsHandler(ids, logframe, indicators, audits),
    createIndicator: new CreateIndicatorHandler(ids, indicators, audits),
    updateIndicatorSemantics: new UpdateIndicatorSemanticsHandler(indicators, audits),
    createIndicatorUpdate: new CreateIndicatorUpdateHandler(ids, indicatorUpdates, audits),
    bulkUpsertIndicatorUpdates: new BulkUpsertIndicatorUpdatesHandler(ids, indicatorUpdates, indicators, periods, audits),
    listPeriodIndicators: new ListPeriodIndicatorsHandler(periods, logframe, indicators, indicatorUpdates),
    parseIndicatorSheet: new ParseIndicatorSheetHandler(periods, indicators, sheetReader),
    verifyIndicatorUpdate: new VerifyIndicatorUpdateHandler(indicatorUpdates, audits),
    requestIndicatorUpdateCorrection: new RequestIndicatorUpdateCorrectionHandler(indicatorUpdates, audits),
    rejectIndicatorUpdate: new RejectIndicatorUpdateHandler(indicatorUpdates, audits),
    listIndicatorUpdates: new ListIndicatorUpdatesHandler(indicators, indicatorUpdates, periods),
    listLogframe: new ListLogframeHandler(logframe, indicators),
    listIndicators: new ListIndicatorsHandler(indicators),
    uploadEvidence: new UploadEvidenceHandler(ids, evidence, evidenceStorage, events, audits, usageCounters, entitlements),
    importEvidence: new ImportEvidenceHandler(ids, evidence, activities, indicators, audits),
    suggestEvidenceTags: new SuggestEvidenceTagsHandler(evidence, evidenceTagger),
    acceptEvidenceTags: new AcceptEvidenceTagsHandler(evidence, audits),
    setEvidencePeriod: new SetEvidencePeriodHandler(evidence, periods, audits),
    persistEvidenceTags: new PersistEvidenceTagsHandler(evidence, audits, idempotency),
    verifyEvidence: new VerifyEvidenceHandler(evidence, audits),
    searchEvidence: new SearchEvidenceHandler(evidence),
    getEvidence: new GetEvidenceHandler(evidence),
    createActivityUpdate: new CreateActivityUpdateHandler(ids, activities, audits),
    importActivities: new ImportActivitiesHandler(ids, activities, logframe, indicators, audits),
    polishActivity: new PolishActivityHandler(activities, activityPolisher),
    reviewActivity: new ReviewActivityHandler(activities, audits),
    listActivities: new ListActivitiesHandler(activities),
    getActivity: new GetActivityHandler(activities),
    updateActivity: new UpdateActivityHandler(activities, evidence, audits),
    attachEvidence: new AttachEvidenceHandler(evidence, activities, indicatorUpdates, audits),
    suggestEvidenceLinks: new SuggestEvidenceLinksHandler(evidence, activities, indicators, indicatorUpdates),
    detachEvidence: new DetachEvidenceHandler(evidence, activities, indicatorUpdates, audits),
    createReportingPeriod: createReportingPeriodHandler,
    ensureAutoPeriod: ensureAutoPeriodHandler,
    updateReportingPeriodStory: new UpdateReportingPeriodStoryHandler(periods, audits),
    importPeriodIndicatorValues: new ImportPeriodIndicatorValuesHandler(ids, indicators, indicatorUpdates, audits),
    proposeFieldReportExtraction: new ProposeFieldReportExtractionHandler(),
    applyFieldReportExtraction: new ApplyFieldReportExtractionHandler(ids, indicators, indicatorUpdates, activities, periods, audits),
    listReportingPeriods: new ListReportingPeriodsHandler(periods, calculateReadinessHandler),
    generateReportDraft: new GenerateReportDraftHandler(
      ids, periods, drafts, sections, projects, organizations, templates, indicatorUpdates, activities,
      reportPlanner, requirementResolver, indicatorAnalytics, evidencePackageBuilder, generationRuns, reportPlans,
      revisionService, assuranceService,
      getReportDraftGenerator, audits, entitlements, usageCounters, llmUsage, reportArtifacts, runInBackground,
    ),
    getReportDraft: new GetReportDraftHandler(drafts, sections, reportClaims, reportRevisions, reportPlans, reportArtifacts, {
      evidenceDirectory: new PrismaEvidenceDirectory(prisma),
      inputsChangeReader: new PrismaReportInputsChangeReader(prisma),
      regenerationTracker: sectionRegenerationTracker,
      commentCounter: comments,
    }),
    getSmartReview: new GetSmartReviewHandler(drafts, approveReportHandler, reportClaims, sections),
    cancelReportGeneration: new CancelReportGenerationHandler(drafts, sections, audits),
    activateReportDraft: new ActivateReportDraftHandler(drafts, audits),
    getReportAssurance: new GetReportAssuranceHandler(drafts, sections, reportClaims, reportRevisions, resolvedRequirements),
    updateReportSection: updateReportSectionHandler,
    createReportSection: new CreateReportSectionHandler(ids, drafts, sections, audits),
    deleteReportSection: new DeleteReportSectionHandler(drafts, sections, reportClaims, reportRevisions, audits),
    reorderReportSections: new ReorderReportSectionsHandler(drafts, sections, audits),
    updateReportSectionChart: new UpdateReportSectionChartHandler(sections, audits),
    rewriteReportSection: new RewriteReportSectionHandler(
      ids, drafts, sections, periods, indicatorUpdates, activities, indicatorAnalytics, evidencePackageBuilder,
      getReportDraftGenerator, revisionService, assuranceService, generationRuns, audits, reportArtifacts,
    ),
    approveReportSection: new ApproveReportSectionHandler(sections, reportClaims, reportRevisions, audits),
    submitReportForReview: new SubmitReportForReviewHandler(drafts, audits),
    approveReport: approveReportHandler,
    rejectReport: new RejectReportHandler(drafts, audits),
    resolveReportClaim: new ResolveReportClaimHandler(reportClaims, audits, sections, assuranceService),
    bulkResolveReportClaims: new BulkResolveReportClaimHandler(new ResolveReportClaimHandler(reportClaims, audits, sections, assuranceService)),
    reassessReportRevision: new ReassessReportRevisionHandler(sections, reportRevisions, assuranceService, audits),
    regenerateReportSection: new RegenerateReportSectionHandler(
      ids, drafts, sections, reportPlans, generationRuns,
      new ReportGenerationContextBuilder(periods, projects, organizations, new PeriodTemplateResolver(templates, periods), indicatorUpdates, activities, indicatorAnalytics, evidencePackageBuilder, getReportDraftGenerator),
      new SectionGenerationService(ids, llmUsage, revisionService, assuranceService, audits, reportArtifacts),
      sectionRegenerationTracker, audits, runInBackground,
    ),
    reopenReportClaim: new ReopenReportClaimHandler(reportClaims, sections, assuranceService, audits),
    getClaimSuggestion: claimSuggestionHandler,
    applyClaimSuggestion: new ApplyClaimSuggestionHandler(reportClaims, sections, claimSuggestionHandler, updateReportSectionHandler),
    listSectionRevisions: new ListSectionRevisionsHandler(sections, reportRevisions),
    resolveEffectiveRequirements: new ResolveEffectiveRequirementsHandler(requirementResolver, audits),
    upsertRequirementPack: new UpsertRequirementPackHandler(ids, requirementPacks, audits),
    activateRequirementPack: new ActivateRequirementPackHandler(requirementPacks, audits),
    upsertAwardOverride: new UpsertAwardOverrideHandler(ids, awardOverrides, audits),
    createSubmissionSnapshot: new CreateSubmissionSnapshotHandler(ids, drafts, sections, reportClaims, reportRevisions, resolvedRequirements, submissionSnapshots, periods, generationRuns, approveReportHandler, audits, events),
    detectMissingEvidence: detectMissingEvidenceHandler,
    resolveChecklistItem: new ResolveChecklistItemHandler(checklist, audits),
    bulkResolveChecklist: new BulkResolveChecklistHandler(checklist, audits),
    listChecklist: new ListChecklistHandler(checklist),
    calculateReadiness: calculateReadinessHandler,
    recomputeReadiness: new RecomputeReadinessHandler(calculateReadinessHandler),
    generateChecklist: new GenerateChecklistHandler(detectMissingEvidenceHandler),
    createExport: createExportHandler,
    runExport: new RunExportHandler(createExportHandler),
    getExportPreflight: new GetExportPreflightHandler(periods, drafts, sections, indicatorUpdates, checklist, evidence, approveReportHandler),
    generateDeadlineReminders: new GenerateDeadlineRemindersHandler(ids, drafts, sections, notifications, notify),
    addComment: new AddCommentHandler(ids, comments, audits, notify),
    resolveComment: new ResolveCommentHandler(comments, audits),
    listComments: new ListCommentsHandler(comments),
    listNotifications: new ListNotificationsHandler(notifications),
    markNotificationRead: new MarkNotificationReadHandler(notifications, audits),
    listAuditLog: new ListAuditLogHandler(audits),
    recordLegalConsent: new RecordLegalConsentHandler(audits),
    getLegalConsent: new GetLegalConsentHandler(audits),
    createCheckout: new CreateCheckoutHandler(billingProvider, organizations, billingSubscriptions, ids, audits),
    createCustomerPortal: new CreateCustomerPortalHandler(billingProvider, billingSubscriptions, audits),
    getBillingSummary: new GetBillingSummaryHandler(entitlements),
    processBillingWebhook: new ProcessBillingWebhookHandler(billingProvider, billingSubscriptions, billingInbox, billingSubscriptionSynchronizer),
    expireLocalTrials: new ExpireLocalTrialsHandler(entitlementGrants, audits, clock),
    reconcileBillingSubscriptions: new ReconcileBillingSubscriptionsHandler(billingProvider, billingSubscriptions, billingSubscriptionSynchronizer, clock, audits),
    reconcileManagedStorageUsage: new ReconcileManagedStorageUsageHandler(usageCounters, evidence, clock, audits),
    releaseStaleUsageReservations: new ReleaseStaleUsageReservationsHandler(usageCounters, llmUsage, clock, audits),
    retryBillingInbox: new RetryBillingInboxHandler(billingProvider, billingSubscriptions, billingInbox, billingSubscriptionSynchronizer, clock, audits),
    runGrandfatherCreditCutover: new RunGrandfatherCreditCutoverHandler(billingSubscriptions, entitlementGrants, usageCounters, audits, clock, planCatalog),
  };

  return {
    prisma,
    settleBackgroundWork: async () => {
      while (backgroundTasks.size > 0) await Promise.allSettled([...backgroundTasks]);
    },
    auth, storage, evidenceStorage, googleDriveOAuth, googleDriveCredentials, driveFileReader, parser, logger, ids, clock, events, notify, jobQueue,
    evidenceTagger, activityPolisher, templateExtraction, structuredParser, templateFiles, checklistDetector, exportBuilder,
    organizations, users, invitations, passwordResetTokens, passwordResetRateLimiter,    projects, projectSetup, reportingProfiles, readiness, projectWorkspace, templates, logframe, indicators, indicatorUpdates, evidence, idempotency, activities,
    periods, drafts, sections, reportPlans, reportClaims, generationRuns, reportRevisions, reportArtifacts, agentMemory, submissionSnapshots, requirementPacks, awardOverrides, resolvedRequirements, donorTemplateMappings, checklist, exports, comments, notifications, audits, projectMembers,
    billingSubscriptions, entitlementGrants, usageCounters, billingInbox, trialIdentities, llmUsage, planCatalog, billingProvider,
    handlers,
  };
}

function withTenantSession(databaseUrl: string, tenantId: string): string {
  if (!/^[A-Za-z0-9_-]{3,128}$/.test(tenantId)) throw new Error("Invalid tenant identifier");
  const url = new URL(databaseUrl);
  url.searchParams.set("options", `-c app.current_tenant=${tenantId}`);
  return url.toString();
}
