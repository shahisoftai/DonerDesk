import { PrismaClient } from "@prisma/client";
import { UnitOfWork } from "./db/unit-of-work.js";
import { TenantId, configureLlmPrices, pricesFromEnv, type DomainError, type Result } from "@donordesk/domain";

import { UpdateTemplateRequirementsHandler, UpdateTemplateMetadataHandler, ReextractTemplateHandler, MarkTemplateReviewedHandler, GetTemplateHandler, GetTemplateVersionHandler, GetTemplateOriginalFileHandler, SetTemplateLibraryHandler, SetDefaultTemplateHandler, ListLibraryTemplatesHandler, CloneTemplateHandler, ParseTemplateFileHandler, PreviewTemplateBriefHandler, TemplateExtractionRunner, PeriodTemplateResolver, type ITemplateExtractionService, type ILLMProvider, SignUpHandler, LoginHandler, InviteUserHandler, ListPendingInvitationsHandler, AcceptInvitationHandler, ChangeRoleHandler, ChangePasswordHandler, RequestPasswordResetHandler, ConfirmPasswordResetHandler, UpdateOrganizationHandler, UpdateOrganizationReportingDefaultsHandler, ConnectGoogleDriveHandler, GoogleSignInHandler, LinkGoogleDriveEvidenceHandler, ListUsersHandler, IssueScimCredentialHandler, ListScimCredentialsHandler, RevokeScimCredentialHandler, CreateProjectHandler, CreateDemoProjectHandler, DeleteDemoProjectHandler, UpdateProjectHandler, ArchiveProjectHandler, RestoreProjectHandler, ListProjectsHandler, GetProjectHandler, AssignProjectMemberHandler, UpdateProjectMemberHandler, RemoveProjectMemberHandler, ListProjectMembersHandler, UploadTemplateHandler, DetectTemplateRegionsHandler, UpdateTemplateMappingHandler, ApproveTemplateMappingHandler, LockTemplateMappingHandler, UpdateTemplateSectionsHandler, DeleteTemplateHandler, ListTemplatesHandler, CreateLogframeItemHandler, MoveLogframeItemHandler, ImportLogframeHandler, CopyProjectSetupHandler, ImportIndicatorsHandler, CreateIndicatorHandler, UpdateIndicatorSemanticsHandler, UpdateIndicatorHandler, MoveIndicatorHandler, ArchiveIndicatorHandler, RestoreIndicatorHandler, ListArchivedIndicatorsHandler, IndicatorApprovalGuard, ActivityApprovalGuard, DefaultTemplateResolver, ChangePeriodTemplateHandler, ResubmitActivityHandler, WithdrawActivityHandler, RestoreActivityHandler, BulkReviewActivitiesHandler, GetDefaultTemplatesHandler, CreateAllPeriodsHandler, EvidenceLinkService, ActivityLinkResolver, PlanDeliveryService, GetPlanStorySuggestionHandler, GetPortfolioIndicatorsHandler, RunAutomationsHandler, SetWorkPlanningVisibilityHandler, ListProjectPeopleHandler, CreateRiskHandler, UpdateRiskHandler, CloseRiskHandler, ListRisksHandler, GetActivityFileNeedsHandler, ProjectHealthService, VisibleProjects, GetDeliveryHealthHandler, GetEntryDueDaysHandler, SetEntryDueDaysHandler, GetPortfolioHealthHandler, GetRiskTrendHandler, RefreshProjectRiskHandler, CreateTaskHandler, CompleteTaskHandler, CancelTaskHandler, ListAssignmentsHandler, ListTeamWorkHandler, SetIndicatorOwnerHandler, SetPeriodOwnerHandler, AssignChecklistItemHandler, AssignmentQueue, TaskReconciler, GetPeriodOptionsHandler, PlanClosingReportHandler, StartClosingReportHandler, GetEvidenceSupportHandler, ResolveSectionFlagsHandler, ConfirmIndicatorSemanticsHandler, VerifyPeriodIndicatorUpdatesHandler, CreateIndicatorUpdateHandler, ParseUploadedFileHandler, ExportOrganizationHandler, LogframeVersioner, withLogframeVersioning, ListLogframeVersionsHandler, GetLogframeChangesHandler, ApproveLogframeVersionHandler, SetRequireEvidenceForVerificationHandler, VerificationEvidencePolicy, CompleteMfaLoginHandler, GetMfaStatusHandler, BeginMfaEnrollmentHandler, EnableMfaHandler, DisableMfaHandler, ResetUserMfaHandler, ListFundingHandler, SaveProgrammeHandler, SaveGrantHandler, PlaceProjectHandler, BulkUpsertIndicatorUpdatesHandler, ListPeriodIndicatorsHandler, ParseIndicatorSheetHandler, VerifyIndicatorUpdateHandler, RequestIndicatorUpdateCorrectionHandler, RejectIndicatorUpdateHandler, ListIndicatorUpdatesHandler, GetProjectDataSheetHandler, SectionDataChartsHandler, ReopenReportHandler, ImportDataSheetHandler, ListLogframeHandler, ListIndicatorsHandler, UploadEvidenceHandler, ImportEvidenceHandler, SuggestEvidenceTagsHandler, AcceptEvidenceTagsHandler, SetEvidencePeriodHandler, PersistEvidenceTagsHandler, VerifyEvidenceHandler, SearchEvidenceHandler, GetEvidenceHandler, CreateActivityUpdateHandler, ImportActivitiesHandler, PolishActivityHandler, ReviewActivityHandler, ListActivitiesHandler, GetActivityHandler, UpdateActivityHandler, AttachEvidenceHandler, DetachEvidenceHandler, SuggestEvidenceLinksHandler, CreateReportingPeriodHandler, EnsureAutoPeriodHandler, ListReportingPeriodsHandler, GenerateReportDraftHandler, GetReportDraftHandler, GetSmartReviewHandler, UpdateReportSectionHandler, CreateReportSectionHandler, DeleteReportSectionHandler, ReorderReportSectionsHandler, UpdateReportSectionChartHandler, RefreshSectionChartsHandler, SectionChartService, ApproveReportSectionHandler, SubmitReportForReviewHandler, CancelReportGenerationHandler, ActivateReportDraftHandler, ApproveReportHandler, RejectReportHandler, ResolveReportClaimHandler, BulkResolveReportClaimHandler, UpdateReportingPeriodStoryHandler, UpdateReportingPeriodScopeHandler, CancelReportingPeriodHandler, MarkSummaryCurrentHandler, ConfirmClaimMatchesIndicatorHandler, SetStandingStatementHandler, SetTemplateDefaultForTypeHandler, SetRequireSecondApproverHandler, BulkVerifyEvidenceHandler, GetComplianceNotesHandler, SaveSectionNoteHandler, RestoreReportingPeriodHandler, ConvertPeriodToFinalHandler, FinanceInputsService, GetPeriodFinanceHandler, SavePeriodFinanceHandler, PreviewPeriodFinanceImportHandler, VerifyPeriodFinanceHandler, ImportPeriodIndicatorValuesHandler, ProposeFieldReportExtractionHandler, ApplyFieldReportExtractionHandler, DetectMissingEvidenceHandler, ResolveChecklistItemHandler, BulkResolveChecklistHandler, ListChecklistHandler, ListAiSectionRunsHandler, RequestIdempotencyService, ChecklistReconciler, CalculateReadinessHandler, RecomputeReadinessHandler, GenerateChecklistHandler, RewriteReportSectionHandler, IndicatorAnalyticsService, InferredReportPlanner, CreateExportHandler, GetExportPreflightHandler, RunExportHandler, RunRemindersHandler, GetNotificationPreferencesHandler, UpdateNotificationPreferencesHandler, PersonNotifier, ReportNotifier, AddCommentHandler, ResolveCommentHandler, ListCommentsHandler, ListNotificationsHandler, MarkNotificationReadHandler, ListAuditLogHandler, RecordLegalConsentHandler, GetLegalConsentHandler, GetProjectSetupHandler, AcknowledgeProjectSetupHandler, RetryProjectWorkspaceHandler, RepairProjectWorkspaceHandler, ListWorkspaceFilesHandler, ProvisionTenantWorkspacesHandler, ImportDriveFileHandler, GetReportingProfileHandler, UpsertReportingProfileHandler, ProjectReadinessService, UuidIdGenerator, type SystemClock, SystemClock as SystemClockImpl, ProvisionTenantHandler, EntitlementService, CreateCheckoutHandler, CreateTopupCheckoutHandler, SubmitContactSalesInquiryHandler, SubmitNonprofitVerificationHandler, ApproveNonprofitVerificationHandler, RejectNonprofitVerificationHandler, ListPendingNonprofitVerificationsHandler, ListCreditPacksHandler, CompCreditPackHandler, RefundCreditPackHandler, CreateCustomerPortalHandler, GetBillingSummaryHandler, ProcessBillingWebhookHandler, ExpireLocalTrialsHandler, ReconcileBillingSubscriptionsHandler, ReconcileManagedStorageUsageHandler, ReleaseStaleUsageReservationsHandler, RetryBillingInboxHandler, RunGrandfatherCreditCutoverHandler, RunGrandfatherByoLlmHandler, BillingSubscriptionSynchronizer, ReportRevisionService, ReportAssuranceService, RecordChunkBuilder, LintGrounding, GetReportAssuranceHandler, ReassessReportRevisionHandler, ResolveEffectiveRequirementsHandler, UpsertRequirementPackHandler, ListRequirementPacksHandler, ActivateRequirementPackHandler, UpsertAwardOverrideHandler, CreateSubmissionSnapshotHandler, RegenerateReportSectionHandler, ReopenReportClaimHandler, ApplyClaimSuggestionHandler, GetClaimSuggestionHandler, ListSectionRevisionsHandler, ReportGenerationContextBuilder, SectionGenerationService, AiCreditGate, UpdateAgentMemorySettingsHandler, ExtractAgentMemoryHandler, ListPendingAgentMemoryHandler, ApproveAgentMemoryHandler, RejectAgentMemoryHandler, DeactivateAgentMemoryHandler } from "@donordesk/application";
import type { IJobQueue, IReportDraftGenerator, INotificationPort, IAgentMemoryRepository, IAgentMemoryExtractor } from "@donordesk/application";
import { EmailAdapter } from "./comms/email.js";
import { LocalSmtpEmailAdapter } from "./comms/local-smtp-email.js";
import { PostmarkNotificationAdapter, FanOutNotificationAdapter } from "./comms/postmark-notification-adapter.js";
import { ConsoleContactSalesNotifier } from "./comms/console-contact-sales-notifier.js";
import { EmailContactSalesNotifier } from "./comms/email-contact-sales-notifier.js";

import {
  PrismaOrganizationRepository,
  PrismaUserRepository,
  PrismaInvitationRepository,
  PrismaPasswordResetTokenRepository,
  PrismaScimCredentialRepository,
} from "./repositories/identity.js";
import { PrismaProjectRepository } from "./repositories/projects.js";
import { PrismaDemoProjectRepository } from "./repositories/demo.js";
import { PrismaProjectMemberRepository } from "./repositories/project-members.js";
import {
  PrismaProjectSetupRepository,
  PrismaReportingProfileRepository,
} from "./repositories/setup.js";
import { PrismaPeriodFinancialRepository } from "./repositories/finance.js";
import {
  PrismaBillingSubscriptionRepository,
  PrismaEntitlementGrantRepository,
  PrismaUsageCounterRepository,
  PrismaBillingEventInboxRepository,
  PrismaTrialIdentityRepository,
  PrismaPurchasedCreditPackRepository,
  PrismaNonprofitVerificationRepository,
  PrismaPlatformLlmConfigRepository,
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
import { PrismaRequestIdempotencyRepository } from "./repositories/request-idempotency.js";
import { PrismaActivityUpdateRepository } from "./repositories/activities.js";
import { PrismaProjectRiskRepository } from "./repositories/risks.js";
import { RiskReviewAssignmentSource } from "./assignment-sources/risk-review-source.js";
import { PrismaCollectionFactsReader, PrismaRiskTrendStore, PrismaEntryDueDays } from "./repositories/health.js";
import { IndicatorValueAssignmentSource } from "./assignment-sources/indicator-value-source.js";
import { PrismaReminderLedger, PrismaNotificationPreferences, PrismaReminderAudience } from "./repositories/reminders.js";
import { PrismaCommentTargets } from "./repositories/comment-targets.js";
import { PrismaProjectTaskRepository, PrismaTaskSubjectResolver, PrismaTaskFactsReader, PrismaProjectRoster } from "./repositories/tasks.js";
import { TaskAssignmentSource } from "./assignment-sources/task-source.js";
import { PlanItemAssignmentSource } from "./assignment-sources/plan-item-source.js";
import { ChecklistAssignmentSource } from "./assignment-sources/checklist-source.js";
import { ReportDeadlineAssignmentSource } from "./assignment-sources/report-deadline-source.js";
import { EvidenceReviewAssignmentSource, ActivityReviewAssignmentSource, ActivityFixAssignmentSource } from "./assignment-sources/review-sources.js";
import { PrismaPortfolioValueReader } from "./repositories/portfolio.js";
import { PrismaDeliveryFactsReader } from "./repositories/workplan.js";
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
import { FallbackTemplateExtractionService, HeuristicTemplateExtractor, LlmTemplateExtractor, TemplateExtractionQuota, TEMPLATE_EXTRACTION_OPERATION, TocTemplateExtractor } from "./llm/template-extraction/index.js";
import { UsageRecordingLlmProvider } from "./llm/usage-recording-provider.js";
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
import { JobRetryRunner } from "./jobs/retry-runner.js";
import { OrganizationExporter } from "./exports/organization-exporter.js";
import { PrismaFailedJobStore } from "./repositories/failed-jobs.js";
import { PrismaLogframeVersionRepository } from "./repositories/logframe-versions.js";
import { PrismaFundingRepository } from "./repositories/funding.js";
import { TotpMfaService } from "./auth/totp-mfa-service.js";
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
  /** Re-hands jobs the API could not queue; the api runs it on a timer. */
  jobRetry: JobRetryRunner;
  failedJobs: PrismaFailedJobStore;
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
  scimCredentials: PrismaScimCredentialRepository;
  passwordResetRateLimiter: InMemoryPasswordResetRateLimiter;
  billingSubscriptions: PrismaBillingSubscriptionRepository;
  entitlementGrants: PrismaEntitlementGrantRepository;
  usageCounters: PrismaUsageCounterRepository;
  billingInbox: PrismaBillingEventInboxRepository;
  trialIdentities: PrismaTrialIdentityRepository;
  purchasedCreditPacks: PrismaPurchasedCreditPackRepository;
  llmUsage: PrismaLlmUsageRepository;
  planCatalog: PrismaPlanCatalogRepository;
  billingProvider: ReturnType<typeof createBillingProvider>;
  projects: PrismaProjectRepository;
  demoProjects: PrismaDemoProjectRepository;
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
  /** Makes a create request repeatable under an `Idempotency-Key` (the first response is replayed). */
  requestIdempotency: RequestIdempotencyService;
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
    completeMfaLogin: CompleteMfaLoginHandler;
    getMfaStatus: GetMfaStatusHandler;
    beginMfaEnrollment: BeginMfaEnrollmentHandler;
    enableMfa: EnableMfaHandler;
    disableMfa: DisableMfaHandler;
    resetUserMfa: ResetUserMfaHandler;
    googleSignIn: GoogleSignInHandler;
    inviteUser: InviteUserHandler;
    listPendingInvitations: ListPendingInvitationsHandler;
    acceptInvitation: AcceptInvitationHandler;
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
    issueScimCredential: IssueScimCredentialHandler;
    listScimCredentials: ListScimCredentialsHandler;
    revokeScimCredential: RevokeScimCredentialHandler;
    createProject: CreateProjectHandler;
    createDemoProject: CreateDemoProjectHandler;
    deleteDemoProject: DeleteDemoProjectHandler;
    updateProject: UpdateProjectHandler;
    archiveProject: ArchiveProjectHandler;
    restoreProject: RestoreProjectHandler;
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
    copyProjectSetup: CopyProjectSetupHandler;
    importIndicators: ImportIndicatorsHandler;
    createIndicator: CreateIndicatorHandler;
    updateIndicatorSemantics: UpdateIndicatorSemanticsHandler;
    updateIndicator: UpdateIndicatorHandler;
    moveIndicator: MoveIndicatorHandler;
    archiveIndicator: ArchiveIndicatorHandler;
    restoreIndicator: RestoreIndicatorHandler;
    listLogframeVersions: ListLogframeVersionsHandler;
    getLogframeChanges: GetLogframeChangesHandler;
    approveLogframeVersion: ApproveLogframeVersionHandler;
    listFunding: ListFundingHandler;
    saveProgramme: SaveProgrammeHandler;
    saveGrant: SaveGrantHandler;
    placeProject: PlaceProjectHandler;
    listArchivedIndicators: ListArchivedIndicatorsHandler;
    confirmIndicatorSemantics: ConfirmIndicatorSemanticsHandler;
    verifyPeriodIndicatorUpdates: VerifyPeriodIndicatorUpdatesHandler;
    createIndicatorUpdate: CreateIndicatorUpdateHandler;
    parseUploadedFile: ParseUploadedFileHandler;
    exportOrganization: ExportOrganizationHandler;
    bulkUpsertIndicatorUpdates: BulkUpsertIndicatorUpdatesHandler;
    listPeriodIndicators: ListPeriodIndicatorsHandler;
    parseIndicatorSheet: ParseIndicatorSheetHandler;
    verifyIndicatorUpdate: VerifyIndicatorUpdateHandler;
    requestIndicatorUpdateCorrection: RequestIndicatorUpdateCorrectionHandler;
    rejectIndicatorUpdate: RejectIndicatorUpdateHandler;
    listIndicatorUpdates: ListIndicatorUpdatesHandler;
    getProjectDataSheet: GetProjectDataSheetHandler;
    importDataSheet: ImportDataSheetHandler;
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
    getPortfolioIndicators: GetPortfolioIndicatorsHandler;
    setWorkPlanningVisibility: SetWorkPlanningVisibilityHandler;
    listProjectPeople: ListProjectPeopleHandler;
    createRisk: CreateRiskHandler;
    updateRisk: UpdateRiskHandler;
    closeRisk: CloseRiskHandler;
    listRisks: ListRisksHandler;
    planStorySuggestion: GetPlanStorySuggestionHandler;
    getActivityFileNeeds: GetActivityFileNeedsHandler;
    getDeliveryHealth: GetDeliveryHealthHandler;
    getEntryDueDays: GetEntryDueDaysHandler;
    setEntryDueDays: SetEntryDueDaysHandler;
    getPortfolioHealth: GetPortfolioHealthHandler;
    getRiskTrend: GetRiskTrendHandler;
    createTask: CreateTaskHandler;
    completeTask: CompleteTaskHandler;
    cancelTask: CancelTaskHandler;
    listAssignments: ListAssignmentsHandler;
    listTeamWork: ListTeamWorkHandler;
    setIndicatorOwner: SetIndicatorOwnerHandler;
    setPeriodOwner: SetPeriodOwnerHandler;
    assignChecklistItem: AssignChecklistItemHandler;
    importActivities: ImportActivitiesHandler;
    polishActivity: PolishActivityHandler;
    reviewActivity: ReviewActivityHandler;
    resubmitActivity: ResubmitActivityHandler;
    withdrawActivity: WithdrawActivityHandler;
    restoreActivity: RestoreActivityHandler;
    bulkReviewActivities: BulkReviewActivitiesHandler;
    listActivities: ListActivitiesHandler;
    getActivity: GetActivityHandler;
    updateActivity: UpdateActivityHandler;
    attachEvidence: AttachEvidenceHandler;
    getPeriodOptions: GetPeriodOptionsHandler;
    planClosingReport: PlanClosingReportHandler;
    startClosingReport: StartClosingReportHandler;
    getEvidenceSupport: GetEvidenceSupportHandler;
    suggestEvidenceLinks: SuggestEvidenceLinksHandler;
    detachEvidence: DetachEvidenceHandler;
    createReportingPeriod: CreateReportingPeriodHandler;
    ensureAutoPeriod: EnsureAutoPeriodHandler;
    updateReportingPeriodStory: UpdateReportingPeriodStoryHandler;
    updateReportingPeriodScope: UpdateReportingPeriodScopeHandler;
    cancelReportingPeriod: CancelReportingPeriodHandler;
    markSummaryCurrent: MarkSummaryCurrentHandler;
    confirmClaimMatchesIndicator: ConfirmClaimMatchesIndicatorHandler;
    setStandingStatement: SetStandingStatementHandler;
    setTemplateDefaultForType: SetTemplateDefaultForTypeHandler;
    setRequireSecondApprover: SetRequireSecondApproverHandler;
    setRequireEvidenceForVerification: SetRequireEvidenceForVerificationHandler;
    bulkVerifyEvidence: BulkVerifyEvidenceHandler;
    getComplianceNotes: GetComplianceNotesHandler;
    saveSectionNote: SaveSectionNoteHandler;
    restoreReportingPeriod: RestoreReportingPeriodHandler;
    convertPeriodToFinal: ConvertPeriodToFinalHandler;
    changePeriodTemplate: ChangePeriodTemplateHandler;
    getDefaultTemplates: GetDefaultTemplatesHandler;
    createAllPeriods: CreateAllPeriodsHandler;
    getPeriodFinance: GetPeriodFinanceHandler;
    savePeriodFinance: SavePeriodFinanceHandler;
    previewPeriodFinanceImport: PreviewPeriodFinanceImportHandler;
    verifyPeriodFinance: VerifyPeriodFinanceHandler;
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
    refreshSectionCharts: RefreshSectionChartsHandler;
    sectionDataCharts: SectionDataChartsHandler;
    reopenReport: ReopenReportHandler;
    approveReportSection: ApproveReportSectionHandler;
    submitReportForReview: SubmitReportForReviewHandler;
    approveReport: ApproveReportHandler;
    rejectReport: RejectReportHandler;
    resolveReportClaim: ResolveReportClaimHandler;
    bulkResolveReportClaims: BulkResolveReportClaimHandler;
    resolveSectionFlags: ResolveSectionFlagsHandler;
    reassessReportRevision: ReassessReportRevisionHandler;
    regenerateReportSection: RegenerateReportSectionHandler;
    reopenReportClaim: ReopenReportClaimHandler;
    getClaimSuggestion: GetClaimSuggestionHandler;
    applyClaimSuggestion: ApplyClaimSuggestionHandler;
    listSectionRevisions: ListSectionRevisionsHandler;
    resolveEffectiveRequirements: ResolveEffectiveRequirementsHandler;
    upsertRequirementPack: UpsertRequirementPackHandler;
    activateRequirementPack: ActivateRequirementPackHandler;
    listRequirementPacks: ListRequirementPacksHandler;
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
    runReminders: RunRemindersHandler;
    getNotificationPreferences: GetNotificationPreferencesHandler;
    updateNotificationPreferences: UpdateNotificationPreferencesHandler;
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
    createTopupCheckout: CreateTopupCheckoutHandler;
    submitContactSalesInquiry: SubmitContactSalesInquiryHandler;
    submitNonprofitVerification: SubmitNonprofitVerificationHandler;
    listPendingNonprofitVerifications: ListPendingNonprofitVerificationsHandler;
    listCreditPacks: ListCreditPacksHandler;
    compCreditPack: CompCreditPackHandler;
    refundCreditPack: RefundCreditPackHandler;
    approveNonprofitVerification: ApproveNonprofitVerificationHandler;
    rejectNonprofitVerification: RejectNonprofitVerificationHandler;
    createCustomerPortal: CreateCustomerPortalHandler;
    getBillingSummary: GetBillingSummaryHandler;
    listAiSectionRuns: ListAiSectionRunsHandler;
    processBillingWebhook: ProcessBillingWebhookHandler;
    expireLocalTrials: ExpireLocalTrialsHandler;
    reconcileBillingSubscriptions: ReconcileBillingSubscriptionsHandler;
    reconcileManagedStorageUsage: ReconcileManagedStorageUsageHandler;
    releaseStaleUsageReservations: ReleaseStaleUsageReservationsHandler;
    retryBillingInbox: RetryBillingInboxHandler;
    runGrandfatherCreditCutover: RunGrandfatherCreditCutoverHandler;
    runGrandfatherByoLlm: RunGrandfatherByoLlmHandler;
  } & WorkplanHandlers;
}

import { createWorkplanModule, type WorkplanHandlers } from "./container/workplan-module.js";

/** Use cases that run in one transaction with their audit row (H-3). Add a name here, never a wrapper elsewhere. */
export const ATOMIC_HANDLERS = [
  "changeRole",
  "setRequireSecondApprover",
  "createIndicatorUpdate",
  "bulkUpsertIndicatorUpdates",
  "verifyIndicatorUpdate",
  "requestIndicatorUpdateCorrection",
  "rejectIndicatorUpdate",
  "verifyPeriodIndicatorUpdates",
  "approveReportSection",
  "submitReportForReview",
  "approveReport",
  "rejectReport",
  "reviewActivity",
  "bulkReviewActivities",
  "resolveChecklistItem",
  "cancelReportingPeriod",
  "restoreReportingPeriod",
  "convertPeriodToFinal",
  "archiveIndicator",
  "restoreIndicator",
] as const satisfies ReadonlyArray<keyof Container["handlers"]>;

/** The outgoing mail sender chosen by EMAIL_PROVIDER: "smtp" (the host's own mail server on 127.0.0.1) or "postmark"; none means mail is only logged. */
function createEmailSender(): EmailAdapter | null {
  const fromAddress = process.env.EMAIL_FROM_ADDRESS ?? "notifications@donordesk.online";
  if (process.env.EMAIL_PROVIDER === "smtp") return new LocalSmtpEmailAdapter({ fromAddress });
  if (process.env.EMAIL_PROVIDER === "postmark" && process.env.POSTMARK_SERVER_TOKEN) {
    return new EmailAdapter({ smtpHost: "", smtpPort: 0, smtpUser: process.env.POSTMARK_SERVER_TOKEN, smtpPassword: "", fromAddress });
  }
  return null;
}

export function createContainer(options?: { tenantId?: string; useAdminConnection?: boolean }): Container {
  const baseUrl = options?.useAdminConnection ? process.env.DATABASE_ADMIN_URL : process.env.DATABASE_URL;
  const tenantUrl = baseUrl && options?.tenantId ? withTenantSession(baseUrl, options.tenantId) : baseUrl;
  const basePrisma = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    ...(tenantUrl ? { datasources: { db: { url: tenantUrl } } } : {}),
  });
  // Every repository gets this client: outside a unit of work it is the plain client, inside one it is the open transaction.
  const unitOfWork = new UnitOfWork(basePrisma);
  const prisma = unitOfWork.client;
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
  // The operator's own AI rates (LLM_PRICES_JSON) over the built-in estimates.
  configureLlmPrices(pricesFromEnv(process.env.LLM_PRICES_JSON));
  const logframeVersions = new PrismaLogframeVersionRepository(prisma);
  const mfaService = new TotpMfaService();
  const funding = new PrismaFundingRepository(prisma);
  const failedJobs = new PrismaFailedJobStore(prisma);
  const jobRetry = new JobRetryRunner(failedJobs, jobQueue, logger);
  const events = new OutboxEventBus(logger, jobQueue, DEFAULT_EVENT_TO_JOB, failedJobs);
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
  const emailSender = createEmailSender();
  const notify: INotificationPort = emailSender
    ? new FanOutNotificationAdapter([loggingNotifier, new PostmarkNotificationAdapter(emailSender, users, logger)])
    : loggingNotifier;
  const invitations = new PrismaInvitationRepository(prisma);
  const passwordResetTokens = new PrismaPasswordResetTokenRepository(prisma);
  const scimCredentials = new PrismaScimCredentialRepository(prisma);
  const passwordResetRateLimiter = new InMemoryPasswordResetRateLimiter();
  const projects = new PrismaProjectRepository(prisma);
  const demoProjects = new PrismaDemoProjectRepository(prisma);
  const projectMembers = new PrismaProjectMemberRepository(prisma);
  const projectSetup = new PrismaProjectSetupRepository(prisma);
  const reportingProfiles = new PrismaReportingProfileRepository(prisma);
  const templates = new PrismaDonorTemplateRepository(prisma, logger);
  const logframe = new PrismaLogframeRepository(prisma);
  const indicators = new PrismaIndicatorRepository(prisma);
  const indicatorUpdates = new PrismaIndicatorUpdateRepository(prisma);
  const evidence = new PrismaEvidenceRepository(prisma);
  const idempotency = new PrismaIdempotencyRepository(prisma);
  const requestIdempotency = new RequestIdempotencyService(new PrismaRequestIdempotencyRepository(prisma));
  const activities = new PrismaActivityUpdateRepository(prisma);
  const periods = new PrismaReportingPeriodRepository(prisma);
  const drafts = new PrismaReportDraftRepository(prisma);
  const indicatorApprovalGuard = new IndicatorApprovalGuard(indicatorUpdates, drafts);
  const activityApprovalGuard = new ActivityApprovalGuard(periods, drafts);
  const sections = new PrismaReportSectionRepository(prisma);
  const reportPlans = new PrismaReportPlanRepository(prisma);
  const reportClaims = new PrismaReportClaimRepository(prisma);
  const generationRuns = new PrismaReportGenerationRunRepository(prisma);
  const reportRevisions = new PrismaReportRevisionRepository(prisma);
  const reportArtifacts = new PrismaReportArtifactRepository(prisma);
  const sectionChartService = new SectionChartService(reportArtifacts);
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
  const purchasedCreditPacks = new PrismaPurchasedCreditPackRepository(prisma);
  const nonprofitVerifications = new PrismaNonprofitVerificationRepository(prisma);
  const platformLlmConfigs = new PrismaPlatformLlmConfigRepository(prisma);
  const llmUsage = new PrismaLlmUsageRepository(prisma);
  const planCatalog = new PrismaPlanCatalogRepository(prisma);
  const billingProvider = createBillingProvider();
  const entitlements = new EntitlementService(entitlementGrants, billingSubscriptions, usageCounters, projects, users, planCatalog, purchasedCreditPacks);
  const billingSubscriptionSynchronizer = new BillingSubscriptionSynchronizer(billingProvider, billingSubscriptions, entitlementGrants, ids, audits, clock, purchasedCreditPacks);
  const provisionTenant = new ProvisionTenantHandler(ids, organizations, users, entitlementGrants, auth, events, audits, clock, trialIdentities);

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
    projectMembers,
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

  /**
   * WS-E gate shared by report drafting and template extraction: a TENANT-
   * scoped LLM config is honored only on plans with byoLlmEnabled. Fails
   * CLOSED: when the entitlement cannot be resolved for a tenant-scoped
   * config, the tenant's credentials are discarded (platform/env default
   * instead) and the failure is audited — an unresolvable entitlement must
   * never widen access. Returns the config to use (null = platform default).
   */
  const gateTenantLlm = async (
    resolved: ResolvedLlmConfig | null,
    tenantId: string | undefined,
    path: "report-draft" | "template-extraction",
  ): Promise<ResolvedLlmConfig | null> => {
    if (resolved?.scope !== "TENANT" || !tenantId) return resolved;
    const entitlementResult = await entitlements.resolve({ tenantId });
    const allowed = entitlementResult.ok && entitlementResult.value.limits.byoLlmEnabled === true;
    if (allowed) return resolved;
    logger?.warn(
      entitlementResult.ok
        ? "Tenant has a configured LLM provider but byoLlmEnabled=false for its plan; using the platform default instead"
        : "Tenant has a configured LLM provider but its entitlement could not be resolved; failing closed to the platform default",
      { tenantId, path },
    );
    audits
      .record({
        tenantId: TenantId.create(tenantId),
        actorId: "system:generate-report-draft",
        eventType: "billing.byo_llm.blocked_by_plan",
        entityType: "organization",
        entityId: tenantId,
        systemNote: entitlementResult.ok
          ? `Configured LLM provider (${resolved.provider}) ignored on ${path}: plan does not include byoLlmEnabled`
          : `Configured LLM provider (${resolved.provider}) ignored on ${path}: entitlement resolution failed (fail-closed)`,
      })
      .catch((error) => {
        // The block still applies; this only warns that the audit trail lost a row.
        logger?.warn("Failed to record billing.byo_llm.blocked_by_plan audit event", { tenantId, path, error: error instanceof Error ? error.message : String(error) });
      });
    return null;
  };

  const getReportDraftGenerator = async (tenantId?: string): Promise<IReportDraftGenerator> => {
    const tenantKey = tenantId ?? "default";
    const tenantResolved = await resolveTenantLlm(tenantId);
    const resolved = await gateTenantLlm(tenantResolved, tenantId, "report-draft");
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
  const templateExtractionQuota = new TemplateExtractionQuota(llmUsage);
  const resolveTemplateLlm = async (tenantId: string): Promise<ILLMProvider | null> => {
    try {
      const org = await organizations.findByTenant(TenantId.create(tenantId));
      if (!org.ok || !org.value?.aiEnabled) return null;
      const tenantResolved = await resolveTenantLlm(tenantId);
      // Same WS-E plan gate as report drafting (fail-closed) — tenant keys
      // must not flow to the extraction path on plans without BYO either.
      const resolved = await gateTenantLlm(tenantResolved, tenantId, "template-extraction");
      // The daily cap protects the DonorDesk provider; a tenant's own key is not capped.
      if (resolved?.scope !== "TENANT" && (await templateExtractionQuota.isExceeded(tenantId))) {
        logger.warn("Template extraction LLM quota reached; using heuristic extraction", { tenantId });
        return null;
      }
      const provider = resolved ? createLLMProvider(resolved) : process.env.LLM_PROVIDER ? createLLMProvider() : null;
      if (!provider || provider.name === "stub") return null;
      return new UsageRecordingLlmProvider(provider, llmUsage, ids, { tenantId, operationType: TEMPLATE_EXTRACTION_OPERATION, promptId: "template-extractor" });
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

  const activityLinks = new ActivityLinkResolver(logframe);
  // Requests (Phase 28.3): the reconciler closes the ones the records show were met, and is told after the changes that meet them.
  const projectTasks = new PrismaProjectTaskRepository(prisma);
  const projectRoster = new PrismaProjectRoster(prisma);
  const notificationPreferences = new PrismaNotificationPreferences(prisma);
  // Tells one person: an in-app note always, an email only when their setting allows it.
  const personNotifier = new PersonNotifier(ids, notifications, notify, notificationPreferences);
  const taskReconciler = new TaskReconciler(projectTasks, new PrismaTaskFactsReader(prisma), audits, clock);
  // The work plan: repositories, services and handlers are built in one module (see container/workplan-module.ts).
  const workplan = createWorkplanModule({ prisma, ids, clock, audits, logframe, indicators, indicatorUpdates, periods, projects, activities, activityLinks, taskReconciler });
  const { plannedActivities, planRevisions, planContext, planLinks, automationSettings } = workplan;
  const runAutomations = new RunAutomationsHandler(projects, plannedActivities, new PrismaDeliveryFactsReader(prisma), automationSettings, new PrismaReminderAudience(prisma), new PrismaReminderLedger(prisma), personNotifier, automationSettings);
  const projectRisks = new PrismaProjectRiskRepository(prisma);
  const collectionFacts = new PrismaCollectionFactsReader(prisma);
  const entryDueDays = new PrismaEntryDueDays(prisma);
  const projectHealth = new ProjectHealthService(plannedActivities, new PrismaDeliveryFactsReader(prisma), collectionFacts);
  const riskTrendStore = new PrismaRiskTrendStore(prisma);
  const riskRefresh = new RefreshProjectRiskHandler(projects, projectHealth, checklist, periods, riskTrendStore, audits);
  const assignmentQueue = new AssignmentQueue([
    new PlanItemAssignmentSource(prisma), new TaskAssignmentSource(prisma), new ChecklistAssignmentSource(prisma), new ReportDeadlineAssignmentSource(prisma),
    new ActivityFixAssignmentSource(prisma), new EvidenceReviewAssignmentSource(prisma), new ActivityReviewAssignmentSource(prisma),
    new IndicatorValueAssignmentSource(collectionFacts), new RiskReviewAssignmentSource(prisma),
  ]);
  const evidenceLinker = new EvidenceLinkService(evidence, activities, indicatorUpdates, audits, taskReconciler);
  const indicatorAnalytics = new IndicatorAnalyticsService(periods, indicators, indicatorUpdates, logframe);
  const periodFinancials = new PrismaPeriodFinancialRepository(prisma);
  const financeInputs = new FinanceInputsService(reportingProfiles, periodFinancials);
  const reportPlanner = new InferredReportPlanner(ids);
  const evidencePackageBuilder = new EvidencePackageBuilder(evidence);
  const claimVerifier = new DeterministicClaimVerifier();
  const hashService = new Sha256HashService();
  const logframeVersioner = new LogframeVersioner(logframe, indicators, logframeVersions, hashService, ids);
  const verificationEvidencePolicy = new VerificationEvidencePolicy(indicators, reportingProfiles);
  const assertionExtractor = new DeterministicAssertionExtractor();
  const revisionService = new ReportRevisionService(reportRevisions, sections, hashService);
  const sectionRegenerationTracker = new InMemorySectionRegenerationTracker();
  const backgroundTasks = new Set<Promise<void>>();
  const runInBackground = (task: () => Promise<void>): void => {
    // Started inside a unit of work, a task waits for the commit: it must see what the request wrote, and it must
    // never hold on to a transaction that has closed.
    const start = (): void => {
      const running: Promise<void> = Promise.resolve()
        .then(() => task())
        .catch((error: unknown) => logger.error("Background task failed", { error: error instanceof Error ? error.message : String(error) }))
        .finally(() => backgroundTasks.delete(running));
      backgroundTasks.add(running);
    };
    UnitOfWork.afterCommit(start);
  };
  const unsupportedClaimProjector = new ChecklistUnsupportedClaimProjector(ids, checklist);
  const planDelivery = new PlanDeliveryService(plannedActivities, planRevisions);
  const recordChunkBuilder = new RecordChunkBuilder(periods, projects, activities, indicators, indicatorUpdates, evidence, planDelivery);
  const lintGrounding = new LintGrounding(recordChunkBuilder, evidencePackageBuilder, financeInputs);
  const assuranceService = new ReportAssuranceService(ids, sections, drafts, reportRevisions, reportClaims, assertionExtractor, claimVerifier, indicatorAnalytics, evidencePackageBuilder, unsupportedClaimProjector, financeInputs, recordChunkBuilder);

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
  const updateReportSectionHandler = new UpdateReportSectionHandler(sections, drafts, revisionService, assuranceService, audits, onManualEditCommitted, runInBackground, sectionChartService);
  const claimSuggestionHandler = new GetClaimSuggestionHandler(reportClaims, drafts, indicatorAnalytics);
  const requirementResolver = new DeterministicRequirementResolver(ids, periods, requirementPacks, awardOverrides, reportPlans, resolvedRequirements);

  const detectMissingEvidenceHandler = new DetectMissingEvidenceHandler(ids, checklist, checklistDetector, periods, drafts, templates, indicatorUpdates, sections, activities, evidence, audits, indicatorAnalytics, financeInputs, indicators);
  // Reading the checklist or a period's readiness closes the items the data already satisfies: no manual scan needed.
  const checklistReconciler = new ChecklistReconciler(detectMissingEvidenceHandler);
  const calculateReadinessHandler = new CalculateReadinessHandler(periods, drafts, sections, indicators, indicatorUpdates, evidence, activities, checklist, templates, indicatorAnalytics, lintGrounding, checklistReconciler, audits, planDelivery);

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

  const createExportHandler = new CreateExportHandler(ids, exports, projects, periods, drafts, sections, indicators, indicatorUpdates, activities, checklist, evidence, submissionSnapshots, exportBuilder, storage, audits, donorTemplateMappings, templates, reportClaims, reportArtifacts);
  const templateExtractionRunner = new TemplateExtractionRunner(templates, templateExtraction, templateFiles, structuredParser, audits);
  const uploadTemplateHandler = new UploadTemplateHandler(ids, templates, templateFiles, templateExtractionRunner, runInBackground, audits);
  const parseTemplateFileHandler = new ParseTemplateFileHandler(structuredParser, templateFiles);
  const donorTemplateStructureParser = new MammothDonorTemplateStructureParser();
  const detectTemplateRegionsHandler = new DetectTemplateRegionsHandler(ids, templates, donorTemplateMappings, donorTemplateStructureParser, audits);
  const updateTemplateMappingHandler = new UpdateTemplateMappingHandler(donorTemplateMappings, audits);
  const approveTemplateMappingHandler = new ApproveTemplateMappingHandler(donorTemplateMappings, donorTemplateRenderer, storage, audits);
  const lockTemplateMappingHandler = new LockTemplateMappingHandler(periods, donorTemplateMappings, audits);
  const reportNotifier = new ReportNotifier(personNotifier, projects, projectMembers);
  const approveReportHandler = new ApproveReportHandler(drafts, periods, checklist, reportClaims, sections, reportRevisions, resolvedRequirements, audits, indicatorAnalytics, lintGrounding, { profiles: reportingProfiles, projects, members: projectMembers }, reportNotifier, logframeVersions);
  const defaultTemplateResolver = new DefaultTemplateResolver(templates, reportingProfiles);
  const closingPlanHandler = new PlanClosingReportHandler(projects, periods, drafts, indicators, indicatorUpdates, activities, reportingProfiles, templates, financeInputs, defaultTemplateResolver, projectMembers);
  const createReportingPeriodHandler = new CreateReportingPeriodHandler(ids, periods, projects, templates, projectSetup, reportingProfiles, readiness, audits, events, activities, defaultTemplateResolver);
  const ensureAutoPeriodHandler = new EnsureAutoPeriodHandler(projects, reportingProfiles, periods, createReportingPeriodHandler);

  const periodContextBuilder = new ReportGenerationContextBuilder(periods, projects, organizations, new PeriodTemplateResolver(templates, periods), indicatorUpdates, activities, indicatorAnalytics, evidencePackageBuilder, getReportDraftGenerator, financeInputs, evidence, planDelivery);
  const getProjectDataSheet = new GetProjectDataSheetHandler(periods, logframe, indicators, indicatorUpdates, financeInputs, periodFinancials);
  const bulkUpsertIndicatorUpdates = new BulkUpsertIndicatorUpdatesHandler(ids, indicatorUpdates, indicators, periods, audits, evidenceLinker, taskReconciler);
  const sectionDataCharts = new SectionDataChartsHandler(sections, drafts, periods, reportArtifacts, getProjectDataSheet, ids, audits);
  const handlers: Container["handlers"] = {
    ...workplan.handlers,
    signUp: new SignUpHandler(ids, organizations, users, auth, events, audits, provisionTenant),
    login: new LoginHandler(users, auth, audits, mfaService),
    completeMfaLogin: new CompleteMfaLoginHandler(users, auth, mfaService, audits),
    getMfaStatus: new GetMfaStatusHandler(users),
    beginMfaEnrollment: new BeginMfaEnrollmentHandler(users, mfaService),
    enableMfa: new EnableMfaHandler(users, mfaService, audits),
    disableMfa: new DisableMfaHandler(users, auth, mfaService, audits),
    resetUserMfa: new ResetUserMfaHandler(users, audits),
    googleSignIn: new GoogleSignInHandler(googleSignIn, users, organizations, auth, ids, audits, provisionTenant),
    inviteUser: new InviteUserHandler(ids, users, invitations, audits, notify, entitlements, projects),
    listPendingInvitations: new ListPendingInvitationsHandler(invitations),
    acceptInvitation: new AcceptInvitationHandler(ids, users, invitations, auth, audits, entitlements, projectMembers),
    changeRole: new ChangeRoleHandler(users, audits, entitlements),
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
    linkGoogleDriveEvidence: new LinkGoogleDriveEvidenceHandler(ids, evidence, evidenceStorage, events, audits, evidenceLinker),
    listUsers: new ListUsersHandler(users),
    issueScimCredential: new IssueScimCredentialHandler(scimCredentials, ids, audits),
    listScimCredentials: new ListScimCredentialsHandler(scimCredentials),
    revokeScimCredential: new RevokeScimCredentialHandler(scimCredentials, audits),
    createProject: new CreateProjectHandler(ids, projects, projectSetup, reportingProfiles, organizations, projectWorkspace, events, audits, entitlements, projectMembers),
    createDemoProject: new CreateDemoProjectHandler(ids, projects, projectSetup, reportingProfiles, logframe, indicators, templates, audits),
    deleteDemoProject: new DeleteDemoProjectHandler(projects, demoProjects, audits),
    updateProject: new UpdateProjectHandler(projects, periods, audits),
    archiveProject: new ArchiveProjectHandler(projects, audits),
    restoreProject: new RestoreProjectHandler(projects, audits, entitlements),
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
    copyProjectSetup: new CopyProjectSetupHandler(projects, logframe, indicators, ids, audits),
    importIndicators: new ImportIndicatorsHandler(ids, logframe, indicators, audits),
    createIndicator: new CreateIndicatorHandler(ids, indicators, audits),
    updateIndicatorSemantics: new UpdateIndicatorSemanticsHandler(indicators, audits),
    updateIndicator: new UpdateIndicatorHandler(indicators, indicatorUpdates, audits),
    moveIndicator: new MoveIndicatorHandler(indicators, logframe, indicatorApprovalGuard, audits),
    archiveIndicator: new ArchiveIndicatorHandler(indicators, indicatorUpdates, indicatorApprovalGuard, audits),
    restoreIndicator: new RestoreIndicatorHandler(indicators, audits),
    listLogframeVersions: new ListLogframeVersionsHandler(logframeVersions),
    getLogframeChanges: new GetLogframeChangesHandler(logframeVersions),
    approveLogframeVersion: new ApproveLogframeVersionHandler(logframeVersions, logframeVersioner, audits),
    listFunding: new ListFundingHandler(funding, new VisibleProjects(projects, projectMembers)),
    saveProgramme: new SaveProgrammeHandler(funding, ids, audits),
    saveGrant: new SaveGrantHandler(funding, ids, audits),
    placeProject: new PlaceProjectHandler(funding, projects, audits),
    listArchivedIndicators: new ListArchivedIndicatorsHandler(indicators),
    confirmIndicatorSemantics: new ConfirmIndicatorSemanticsHandler(indicators, audits),
    verifyPeriodIndicatorUpdates: new VerifyPeriodIndicatorUpdatesHandler(indicatorUpdates, indicators, periods, activities, audits, verificationEvidencePolicy),
    parseUploadedFile: new ParseUploadedFileHandler(parser),
    exportOrganization: new ExportOrganizationHandler(new OrganizationExporter(prisma, storage), audits),
    createIndicatorUpdate: new CreateIndicatorUpdateHandler(ids, indicatorUpdates, audits, indicators, periods, evidenceLinker, taskReconciler),
    bulkUpsertIndicatorUpdates,
    getProjectDataSheet,
    importDataSheet: new ImportDataSheetHandler(getProjectDataSheet, bulkUpsertIndicatorUpdates),
    listPeriodIndicators: new ListPeriodIndicatorsHandler(periods, logframe, indicators, indicatorUpdates, activities, projects, new PrismaEntryDueDays(prisma), clock),
    parseIndicatorSheet: new ParseIndicatorSheetHandler(periods, indicators, sheetReader),
    verifyIndicatorUpdate: new VerifyIndicatorUpdateHandler(indicatorUpdates, audits, verificationEvidencePolicy),
    requestIndicatorUpdateCorrection: new RequestIndicatorUpdateCorrectionHandler(indicatorUpdates, audits),
    rejectIndicatorUpdate: new RejectIndicatorUpdateHandler(indicatorUpdates, audits),
    listIndicatorUpdates: new ListIndicatorUpdatesHandler(indicators, indicatorUpdates, periods),
    listLogframe: new ListLogframeHandler(logframe, indicators, activities),
    listIndicators: new ListIndicatorsHandler(indicators),
    uploadEvidence: new UploadEvidenceHandler(ids, evidence, evidenceStorage, events, audits, usageCounters, entitlements, evidenceLinker),
    importEvidence: new ImportEvidenceHandler(ids, evidence, activities, indicators, audits, evidenceLinker),
    suggestEvidenceTags: new SuggestEvidenceTagsHandler(evidence, evidenceTagger),
    acceptEvidenceTags: new AcceptEvidenceTagsHandler(evidence, audits),
    setEvidencePeriod: new SetEvidencePeriodHandler(evidence, periods, audits),
    persistEvidenceTags: new PersistEvidenceTagsHandler(evidence, audits, idempotency),
    verifyEvidence: new VerifyEvidenceHandler(evidence, audits),
    bulkVerifyEvidence: new BulkVerifyEvidenceHandler(new VerifyEvidenceHandler(evidence, audits)),
    searchEvidence: new SearchEvidenceHandler(evidence),
    getEvidence: new GetEvidenceHandler(evidence),
    createActivityUpdate: new CreateActivityUpdateHandler(ids, activities, audits, activityLinks, planLinks, taskReconciler),
    getPortfolioIndicators: new GetPortfolioIndicatorsHandler(projects, projectMembers, new PrismaPortfolioValueReader(prisma)),
    setWorkPlanningVisibility: new SetWorkPlanningVisibilityHandler(projects, audits),
    listProjectPeople: new ListProjectPeopleHandler(projectMembers, users),
    createTask: new CreateTaskHandler(ids, projectTasks, new PrismaTaskSubjectResolver(prisma), projectRoster, personNotifier, audits, clock),
    completeTask: new CompleteTaskHandler(projectTasks, audits, clock),
    cancelTask: new CancelTaskHandler(projectTasks, audits, clock),
    listAssignments: new ListAssignmentsHandler(assignmentQueue, taskReconciler, clock),
    listTeamWork: new ListTeamWorkHandler(assignmentQueue, taskReconciler, clock),
    setIndicatorOwner: new SetIndicatorOwnerHandler(indicators, projectRoster, audits),
    setPeriodOwner: new SetPeriodOwnerHandler(periods, projectRoster, audits),
    assignChecklistItem: new AssignChecklistItemHandler(checklist, projectRoster, personNotifier, audits),
    getDeliveryHealth: new GetDeliveryHealthHandler(projects, projectHealth, clock),
    getEntryDueDays: new GetEntryDueDaysHandler(entryDueDays),
    setEntryDueDays: new SetEntryDueDaysHandler(entryDueDays, audits),
    getPortfolioHealth: new GetPortfolioHealthHandler(new VisibleProjects(projects, projectMembers), projectHealth, clock),
    getRiskTrend: new GetRiskTrendHandler(riskTrendStore, projects),
    getActivityFileNeeds: new GetActivityFileNeedsHandler(activities, plannedActivities, evidence),
    createRisk: new CreateRiskHandler(ids, projectRisks, projectRoster, plannedActivities, personNotifier, audits, clock),
    updateRisk: new UpdateRiskHandler(projectRisks, projectRoster, personNotifier, audits, clock),
    closeRisk: new CloseRiskHandler(projectRisks, audits, clock),
    listRisks: new ListRisksHandler(projectRisks),
    planStorySuggestion: new GetPlanStorySuggestionHandler(periods, planDelivery),
    importActivities: new ImportActivitiesHandler(ids, activities, logframe, indicators, periods, audits),
    polishActivity: new PolishActivityHandler(activities, activityPolisher),
    reviewActivity: new ReviewActivityHandler(activities, audits, activityApprovalGuard, taskReconciler),
    resubmitActivity: new ResubmitActivityHandler(activities, audits),
    withdrawActivity: new WithdrawActivityHandler(activities, audits, activityApprovalGuard),
    restoreActivity: new RestoreActivityHandler(activities, audits),
    bulkReviewActivities: new BulkReviewActivitiesHandler(new ReviewActivityHandler(activities, audits)),
    listActivities: new ListActivitiesHandler(activities),
    getActivity: new GetActivityHandler(activities),
    updateActivity: new UpdateActivityHandler(activities, evidence, audits, activityLinks, planLinks),
    attachEvidence: new AttachEvidenceHandler(evidenceLinker),
    getPeriodOptions: new GetPeriodOptionsHandler(projects, periods, activities),
    getEvidenceSupport: new GetEvidenceSupportHandler(evidence, activities, indicators, indicatorUpdates, reportClaims, sections),
    suggestEvidenceLinks: new SuggestEvidenceLinksHandler(evidence, activities, indicators, indicatorUpdates),
    detachEvidence: new DetachEvidenceHandler(evidenceLinker),
    createReportingPeriod: createReportingPeriodHandler,
    planClosingReport: closingPlanHandler,
    startClosingReport: new StartClosingReportHandler(closingPlanHandler, createReportingPeriodHandler, reportingProfiles, detectMissingEvidenceHandler),
    ensureAutoPeriod: ensureAutoPeriodHandler,
    updateReportingPeriodStory: new UpdateReportingPeriodStoryHandler(periods, audits),
    updateReportingPeriodScope: new UpdateReportingPeriodScopeHandler(periods, drafts, sections, reportRevisions, activities, audits),
    cancelReportingPeriod: new CancelReportingPeriodHandler(periods, drafts, audits),
    markSummaryCurrent: new MarkSummaryCurrentHandler(sections, drafts, audits),
    confirmClaimMatchesIndicator: new ConfirmClaimMatchesIndicatorHandler(reportClaims, sections, drafts, indicatorAnalytics, new ResolveReportClaimHandler(reportClaims, audits, sections, assuranceService)),
    setStandingStatement: new SetStandingStatementHandler(ids, reportingProfiles, audits),
    setTemplateDefaultForType: new SetTemplateDefaultForTypeHandler(ids, reportingProfiles, templates, audits),
    setRequireSecondApprover: new SetRequireSecondApproverHandler(ids, reportingProfiles, audits),
    setRequireEvidenceForVerification: new SetRequireEvidenceForVerificationHandler(ids, reportingProfiles, audits),
    getComplianceNotes: new GetComplianceNotesHandler(periodContextBuilder, periods, reportingProfiles),
    saveSectionNote: new SaveSectionNoteHandler(periodContextBuilder, periods, audits),
    restoreReportingPeriod: new RestoreReportingPeriodHandler(periods, drafts, audits),
    convertPeriodToFinal: new ConvertPeriodToFinalHandler(periods, drafts, audits),
    changePeriodTemplate: new ChangePeriodTemplateHandler(periods, drafts, templates, audits),
    getDefaultTemplates: new GetDefaultTemplatesHandler(defaultTemplateResolver),
    createAllPeriods: new CreateAllPeriodsHandler(projects, reportingProfiles, periods, createReportingPeriodHandler),
    getPeriodFinance: new GetPeriodFinanceHandler(periods, financeInputs, projects, periodFinancials),
    savePeriodFinance: new SavePeriodFinanceHandler(ids, periods, financeInputs, projects, periodFinancials, drafts, audits),
    previewPeriodFinanceImport: new PreviewPeriodFinanceImportHandler(periods, financeInputs, projects),
    verifyPeriodFinance: new VerifyPeriodFinanceHandler(periods, financeInputs, projects, periodFinancials, audits),
    importPeriodIndicatorValues: new ImportPeriodIndicatorValuesHandler(ids, indicators, indicatorUpdates, audits),
    proposeFieldReportExtraction: new ProposeFieldReportExtractionHandler(periodContextBuilder),
    applyFieldReportExtraction: new ApplyFieldReportExtractionHandler(ids, indicators, indicatorUpdates, activities, periods, audits),
    listReportingPeriods: new ListReportingPeriodsHandler(periods, calculateReadinessHandler, drafts),
    generateReportDraft: new GenerateReportDraftHandler(
      ids, periods, drafts, sections, projects, organizations, templates, indicatorUpdates, activities,
      reportPlanner, requirementResolver, indicatorAnalytics, evidencePackageBuilder, generationRuns, reportPlans,
      revisionService, assuranceService,
      getReportDraftGenerator, audits, entitlements, usageCounters, llmUsage, reportArtifacts, runInBackground, purchasedCreditPacks, financeInputs,
    ),
    getReportDraft: new GetReportDraftHandler(drafts, sections, reportClaims, reportRevisions, reportPlans, reportArtifacts, {
      evidenceDirectory: new PrismaEvidenceDirectory(prisma),
      inputsChangeReader: new PrismaReportInputsChangeReader(prisma),
      regenerationTracker: sectionRegenerationTracker,
      commentCounter: comments,
      reopenReader: {
        latestFor: async ({ draftId, projectId, tenantId }) => {
          const rows = await audits.listByTenant(tenantId, { projectId, eventType: "report.draft.reopened", limit: 100 });
          const row = rows.ok ? rows.value.filter((r) => r.entityId === draftId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] : undefined;
          if (!row) return null;
          const read = (json: string | undefined): Record<string, unknown> => { try { return JSON.parse(json ?? "{}") as Record<string, unknown>; } catch { return {}; } };
          return { at: row.createdAt.toISOString(), byId: row.actorId, reason: String(read(row.newValue).reason ?? ""), previousStatus: String(read(row.oldValue).status ?? "") };
        },
      },
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
    refreshSectionCharts: new RefreshSectionChartsHandler(sections, sectionChartService, audits),
    sectionDataCharts,
    reopenReport: new ReopenReportHandler(drafts, periods, audits),
    rewriteReportSection: new RewriteReportSectionHandler(
      ids, drafts, sections, periods, indicatorUpdates, activities, indicatorAnalytics, evidencePackageBuilder,
      getReportDraftGenerator, revisionService, assuranceService, generationRuns, audits, reportArtifacts,
    ),
    approveReportSection: new ApproveReportSectionHandler(sections, reportClaims, reportRevisions, audits),
    submitReportForReview: new SubmitReportForReviewHandler(drafts, audits, reportNotifier),
    approveReport: approveReportHandler,
    rejectReport: new RejectReportHandler(drafts, audits, reportNotifier),
    resolveReportClaim: new ResolveReportClaimHandler(reportClaims, audits, sections, assuranceService),
    resolveSectionFlags: new ResolveSectionFlagsHandler(sections, reportClaims, new ResolveReportClaimHandler(reportClaims, audits, sections, assuranceService), new ApproveReportSectionHandler(sections, reportClaims, reportRevisions, audits), audits),
    bulkResolveReportClaims: new BulkResolveReportClaimHandler(new ResolveReportClaimHandler(reportClaims, audits, sections, assuranceService)),
    reassessReportRevision: new ReassessReportRevisionHandler(sections, reportRevisions, assuranceService, audits),
    regenerateReportSection: new RegenerateReportSectionHandler(
      ids, drafts, sections, reportPlans, generationRuns,
      new ReportGenerationContextBuilder(periods, projects, organizations, new PeriodTemplateResolver(templates, periods), indicatorUpdates, activities, indicatorAnalytics, evidencePackageBuilder, getReportDraftGenerator, financeInputs, evidence, planDelivery),
      new SectionGenerationService(ids, llmUsage, revisionService, assuranceService, audits, reportArtifacts),
      sectionRegenerationTracker, new AiCreditGate(entitlements, llmUsage, audits, purchasedCreditPacks), audits, runInBackground,
    ),
    reopenReportClaim: new ReopenReportClaimHandler(reportClaims, sections, assuranceService, audits),
    getClaimSuggestion: claimSuggestionHandler,
    applyClaimSuggestion: new ApplyClaimSuggestionHandler(reportClaims, sections, claimSuggestionHandler, updateReportSectionHandler),
    listSectionRevisions: new ListSectionRevisionsHandler(sections, reportRevisions),
    resolveEffectiveRequirements: new ResolveEffectiveRequirementsHandler(requirementResolver, audits),
    upsertRequirementPack: new UpsertRequirementPackHandler(ids, requirementPacks, audits),
    activateRequirementPack: new ActivateRequirementPackHandler(requirementPacks, audits),
    listRequirementPacks: new ListRequirementPacksHandler(requirementPacks),
    upsertAwardOverride: new UpsertAwardOverrideHandler(ids, awardOverrides, audits),
    createSubmissionSnapshot: new CreateSubmissionSnapshotHandler(ids, drafts, sections, reportClaims, reportRevisions, resolvedRequirements, submissionSnapshots, periods, generationRuns, approveReportHandler, audits, events, requirementResolver),
    detectMissingEvidence: detectMissingEvidenceHandler,
    resolveChecklistItem: new ResolveChecklistItemHandler(checklist, audits),
    bulkResolveChecklist: new BulkResolveChecklistHandler(checklist, audits),
    listChecklist: new ListChecklistHandler(checklist, checklistReconciler),
    calculateReadiness: calculateReadinessHandler,
    recomputeReadiness: new RecomputeReadinessHandler(calculateReadinessHandler),
    generateChecklist: new GenerateChecklistHandler(detectMissingEvidenceHandler),
    createExport: createExportHandler,
    runExport: new RunExportHandler(createExportHandler),
    getExportPreflight: new GetExportPreflightHandler(periods, drafts, sections, indicatorUpdates, checklist, evidence, approveReportHandler, activities, sectionDataCharts),
    runReminders: new RunRemindersHandler(assignmentQueue, new PrismaReminderLedger(prisma), notificationPreferences, new PrismaReminderAudience(prisma), personNotifier, audits, clock, riskRefresh, runAutomations),
    getNotificationPreferences: new GetNotificationPreferencesHandler(notificationPreferences),
    updateNotificationPreferences: new UpdateNotificationPreferencesHandler(notificationPreferences, audits),
    addComment: new AddCommentHandler(ids, comments, audits, personNotifier, new PrismaCommentTargets(prisma)),
    resolveComment: new ResolveCommentHandler(comments, audits),
    listComments: new ListCommentsHandler(comments),
    listNotifications: new ListNotificationsHandler(notifications),
    markNotificationRead: new MarkNotificationReadHandler(notifications, audits),
    listAuditLog: new ListAuditLogHandler(audits),
    recordLegalConsent: new RecordLegalConsentHandler(audits),
    getLegalConsent: new GetLegalConsentHandler(audits),
    createCheckout: new CreateCheckoutHandler(billingProvider, organizations, billingSubscriptions, ids, audits),
    createTopupCheckout: new CreateTopupCheckoutHandler(billingProvider, organizations, entitlements, audits, purchasedCreditPacks),
    submitContactSalesInquiry: new SubmitContactSalesInquiryHandler(
      emailSender
        ? new EmailContactSalesNotifier(emailSender, process.env.SALES_INBOX_EMAIL ?? "support@donordesk.online")
        : new ConsoleContactSalesNotifier(logger),
      audits,
    ),
    submitNonprofitVerification: new SubmitNonprofitVerificationHandler(ids, nonprofitVerifications, audits),
    listPendingNonprofitVerifications: new ListPendingNonprofitVerificationsHandler(nonprofitVerifications),
    listCreditPacks: new ListCreditPacksHandler(purchasedCreditPacks),
    compCreditPack: new CompCreditPackHandler(purchasedCreditPacks, audits, clock),
    refundCreditPack: new RefundCreditPackHandler(purchasedCreditPacks, audits),
    approveNonprofitVerification: new ApproveNonprofitVerificationHandler(nonprofitVerifications, organizations, audits),
    rejectNonprofitVerification: new RejectNonprofitVerificationHandler(nonprofitVerifications, organizations, audits),
    createCustomerPortal: new CreateCustomerPortalHandler(billingProvider, billingSubscriptions, audits),
    getBillingSummary: new GetBillingSummaryHandler(entitlements),
    listAiSectionRuns: new ListAiSectionRunsHandler(llmUsage),
    processBillingWebhook: new ProcessBillingWebhookHandler(billingProvider, billingSubscriptions, billingInbox, billingSubscriptionSynchronizer, purchasedCreditPacks, audits),
    expireLocalTrials: new ExpireLocalTrialsHandler(entitlementGrants, audits, clock),
    reconcileBillingSubscriptions: new ReconcileBillingSubscriptionsHandler(billingProvider, billingSubscriptions, billingSubscriptionSynchronizer, clock, audits),
    reconcileManagedStorageUsage: new ReconcileManagedStorageUsageHandler(usageCounters, evidence, clock, audits),
    releaseStaleUsageReservations: new ReleaseStaleUsageReservationsHandler(usageCounters, llmUsage, clock, audits),
    retryBillingInbox: new RetryBillingInboxHandler(billingProvider, billingSubscriptions, billingInbox, billingSubscriptionSynchronizer, clock, audits),
    runGrandfatherCreditCutover: new RunGrandfatherCreditCutoverHandler(billingSubscriptions, entitlementGrants, usageCounters, audits, clock, planCatalog),
    runGrandfatherByoLlm: new RunGrandfatherByoLlmHandler(platformLlmConfigs, entitlementGrants, entitlements, audits, clock, planCatalog),
  };

  // Every change to the results framework leaves a version behind (H-1). The project is found before the call, because
  // a delete removes the record it would be found by; versioning never fails the change itself.
  const versionError = (error: unknown) => logger.error("logframe.version_failed", { error: error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error) });
  const tenantOf = (args: unknown[]) => (args[0] as { tenant: { tenantId: TenantId } }).tenant.tenantId;
  const projectInArg = (field: string) => (args: unknown[]) => (args[1] as Record<string, string | undefined>)[field];
  const projectOfItem = async (args: unknown[]) => {
    const found = await logframe.findById(args[1] as string, tenantOf(args));
    return found.ok ? found.value?.projectId : undefined;
  };
  const projectOfIndicator = (pick: (args: unknown[]) => string) => async (args: unknown[]) => {
    const found = await indicators.findById(pick(args), tenantOf(args));
    return found.ok ? found.value?.projectId : undefined;
  };
  const versioned = <H extends { handle: (...a: never[]) => Promise<Result<unknown, DomainError>> }>(handler: H, projectOf: (args: unknown[]) => Promise<string | undefined> | string | undefined): H =>
    withLogframeVersioning(handler, logframeVersioner, { projectOf, onError: versionError });
  versioned(handlers.createLogframeItem, projectInArg("projectId"));
  versioned(handlers.moveLogframeItem, projectOfItem);
  versioned(handlers.importLogframe, projectInArg("projectId"));
  versioned(handlers.copyProjectSetup, projectInArg("targetProjectId"));
  versioned(handlers.importIndicators, projectInArg("projectId"));
  versioned(handlers.createIndicator, projectInArg("projectId"));
  versioned(handlers.updateIndicatorSemantics, projectOfIndicator((a) => (a[1] as { indicatorId: string }).indicatorId));
  versioned(handlers.updateIndicator, projectOfIndicator((a) => (a[1] as { indicatorId: string }).indicatorId));
  versioned(handlers.moveIndicator, projectOfIndicator((a) => (a[1] as { indicatorId: string }).indicatorId));
  versioned(handlers.archiveIndicator, projectOfIndicator((a) => a[1] as string));
  versioned(handlers.restoreIndicator, projectOfIndicator((a) => a[1] as string));

  // Sign-off, role and indicator-review use cases: the change and its audit row commit together or not at all.
  // Only short, database-only use cases belong here (see UnitOfWork): nothing that calls a model or a payment provider,
  // and nothing whose repository catches a database error and carries on.
  for (const name of ATOMIC_HANDLERS) unitOfWork.atomic(handlers[name]);

  return {
    prisma,
    settleBackgroundWork: async () => {
      while (backgroundTasks.size > 0) await Promise.allSettled([...backgroundTasks]);
    },
    auth, storage, evidenceStorage, googleDriveOAuth, googleDriveCredentials, driveFileReader, parser, logger, ids, clock, events, jobRetry, failedJobs, notify, jobQueue,
    evidenceTagger, activityPolisher, templateExtraction, structuredParser, templateFiles, checklistDetector, exportBuilder,
    organizations, users, invitations, passwordResetTokens, passwordResetRateLimiter, scimCredentials,
    projects, demoProjects, projectSetup, reportingProfiles, readiness, projectWorkspace, templates, logframe, indicators, indicatorUpdates, evidence, idempotency, requestIdempotency, activities,
    periods, drafts, sections, reportPlans, reportClaims, generationRuns, reportRevisions, reportArtifacts, agentMemory, submissionSnapshots, requirementPacks, awardOverrides, resolvedRequirements, donorTemplateMappings, checklist, exports, comments, notifications, audits, projectMembers,
    billingSubscriptions, entitlementGrants, usageCounters, billingInbox, trialIdentities, purchasedCreditPacks, llmUsage, planCatalog, billingProvider,
    handlers,
  };
}

function withTenantSession(databaseUrl: string, tenantId: string): string {
  if (!/^[A-Za-z0-9_-]{3,128}$/.test(tenantId)) throw new Error("Invalid tenant identifier");
  const url = new URL(databaseUrl);
  url.searchParams.set("options", `-c app.current_tenant=${tenantId}`);
  return url.toString();
}
