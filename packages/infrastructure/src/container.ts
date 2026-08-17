import { PrismaClient } from "@prisma/client";

import {
  SignUpHandler,
  LoginHandler,
  InviteUserHandler,
  ChangeRoleHandler,
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
  UpdateTemplateSectionsHandler,
  DeleteTemplateHandler,
  ListTemplatesHandler,
  CreateLogframeItemHandler,
  CreateIndicatorHandler,
  CreateIndicatorUpdateHandler,
  BulkUpsertIndicatorUpdatesHandler,
  ListPeriodIndicatorsHandler,
  ParseIndicatorSheetHandler,
  VerifyIndicatorUpdateHandler,
  ListLogframeHandler,
  ListIndicatorsHandler,
  UploadEvidenceHandler,
  SuggestEvidenceTagsHandler,
  AcceptEvidenceTagsHandler,
  PersistEvidenceTagsHandler,
  VerifyEvidenceHandler,
  SearchEvidenceHandler,
  GetEvidenceHandler,
  CreateActivityUpdateHandler,
  PolishActivityHandler,
  ReviewActivityHandler,
  ListActivitiesHandler,
  GetActivityHandler,
  CreateReportingPeriodHandler,
  ListReportingPeriodsHandler,
  GenerateReportDraftHandler,
  GetReportDraftHandler,
  UpdateReportSectionHandler,
  ApproveReportSectionHandler,
  SubmitReportForReviewHandler,
  ApproveReportHandler,
  RejectReportHandler,
  ResolveReportClaimHandler,
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
} from "@donordesk/application";
import type { IJobQueue } from "@donordesk/application";

import {
  PrismaOrganizationRepository,
  PrismaUserRepository,
  PrismaInvitationRepository,
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
import { StubTemplateExtractionService } from "./llm/template-extraction.js";
import { StubEvidenceTagger } from "./llm/evidence-tagger.js";
import { StubActivityPolisher } from "./llm/activity-polisher.js";
import { StubReportDraftGenerator } from "./llm/report-draft-generator.js";
import { DeterministicClaimVerifier } from "./llm/claim-verifier.js";
import { EvidencePackageBuilder } from "./ai/evidence-package-builder.js";
import { StubChecklistDetector } from "./llm/checklist-detector.js";
import { DefaultExportBuilder } from "./exports/builder.js";
import { createLogger } from "./observability/logger.js";
import {
  LoggingNotificationAdapter,
} from "./support.js";
import { OutboxEventBus, DEFAULT_EVENT_TO_JOB } from "./events/outbox-event-bus.js";
import { createJobQueue } from "./jobs/index.js";
import { createBillingProvider } from "./billing/index.js";

export interface Container {
  prisma: PrismaClient;
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
  notify: LoggingNotificationAdapter;
  jobQueue: IJobQueue;
  evidenceTagger: StubEvidenceTagger;
  activityPolisher: StubActivityPolisher;
  templateExtraction: StubTemplateExtractionService;
  reportDraftGenerator: StubReportDraftGenerator;
  checklistDetector: StubChecklistDetector;
  exportBuilder: DefaultExportBuilder;
  // Repositories
  organizations: PrismaOrganizationRepository;
  users: PrismaUserRepository;
  invitations: PrismaInvitationRepository;
  billingSubscriptions: PrismaBillingSubscriptionRepository;
  entitlementGrants: PrismaEntitlementGrantRepository;
  usageCounters: PrismaUsageCounterRepository;
  billingInbox: PrismaBillingEventInboxRepository;
  trialIdentities: PrismaTrialIdentityRepository;
  llmUsage: PrismaLlmUsageRepository;
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
    updateOrganization: UpdateOrganizationHandler;
    updateOrganizationReportingDefaults: UpdateOrganizationReportingDefaultsHandler;
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
    updateTemplateSections: UpdateTemplateSectionsHandler;
    deleteTemplate: DeleteTemplateHandler;
    listTemplates: ListTemplatesHandler;
    createLogframeItem: CreateLogframeItemHandler;
    createIndicator: CreateIndicatorHandler;
    createIndicatorUpdate: CreateIndicatorUpdateHandler;
    bulkUpsertIndicatorUpdates: BulkUpsertIndicatorUpdatesHandler;
    listPeriodIndicators: ListPeriodIndicatorsHandler;
    parseIndicatorSheet: ParseIndicatorSheetHandler;
    verifyIndicatorUpdate: VerifyIndicatorUpdateHandler;
    listLogframe: ListLogframeHandler;
    listIndicators: ListIndicatorsHandler;
    uploadEvidence: UploadEvidenceHandler;
    suggestEvidenceTags: SuggestEvidenceTagsHandler;
    acceptEvidenceTags: AcceptEvidenceTagsHandler;
    persistEvidenceTags: PersistEvidenceTagsHandler;
    verifyEvidence: VerifyEvidenceHandler;
    searchEvidence: SearchEvidenceHandler;
    getEvidence: GetEvidenceHandler;
    createActivityUpdate: CreateActivityUpdateHandler;
    polishActivity: PolishActivityHandler;
    reviewActivity: ReviewActivityHandler;
    listActivities: ListActivitiesHandler;
    getActivity: GetActivityHandler;
    createReportingPeriod: CreateReportingPeriodHandler;
    listReportingPeriods: ListReportingPeriodsHandler;
    generateReportDraft: GenerateReportDraftHandler;
    getReportDraft: GetReportDraftHandler;
    updateReportSection: UpdateReportSectionHandler;
    approveReportSection: ApproveReportSectionHandler;
    submitReportForReview: SubmitReportForReviewHandler;
    approveReport: ApproveReportHandler;
    rejectReport: RejectReportHandler;
    resolveReportClaim: ResolveReportClaimHandler;
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
  const notify = new LoggingNotificationAdapter(logger);

  const googleDriveOAuth = new GoogleDriveOAuthConnector();

  const organizations = new PrismaOrganizationRepository(prisma);
  const users = new PrismaUserRepository(prisma);
  const invitations = new PrismaInvitationRepository(prisma);
  const projects = new PrismaProjectRepository(prisma);
  const projectMembers = new PrismaProjectMemberRepository(prisma);
  const projectSetup = new PrismaProjectSetupRepository(prisma);
  const reportingProfiles = new PrismaReportingProfileRepository(prisma);
  const templates = new PrismaDonorTemplateRepository(prisma);
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
  const billingProvider = createBillingProvider();
  const entitlements = new EntitlementService(entitlementGrants, billingSubscriptions, usageCounters, projects, users);
  const provisionTenant = new ProvisionTenantHandler(ids, organizations, users, entitlementGrants, trialIdentities, auth, events, audits, clock);

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
  const templateExtraction = new StubTemplateExtractionService();
  const reportDraftGenerator = new StubReportDraftGenerator();
  const checklistDetector = new StubChecklistDetector();
  const exportBuilder = new DefaultExportBuilder();

  const indicatorAnalytics = new IndicatorAnalyticsService(periods, indicators, indicatorUpdates);
  const reportPlanner = new InferredReportPlanner(ids);
  const evidencePackageBuilder = new EvidencePackageBuilder(evidence);
  const claimVerifier = new DeterministicClaimVerifier();

  const calculateReadinessHandler = new CalculateReadinessHandler(drafts, sections, indicators, indicatorUpdates, evidence, checklist);
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

  const createExportHandler = new CreateExportHandler(ids, exports, projects, periods, drafts, sections, indicators, indicatorUpdates, activities, checklist, evidence, exportBuilder, storage, audits);
  const uploadTemplateHandler = new UploadTemplateHandler(ids, templates, templateExtraction, audits);

  const handlers: Container["handlers"] = {
    signUp: new SignUpHandler(ids, organizations, users, auth, events, audits, provisionTenant),
    login: new LoginHandler(users, auth, audits),
    googleSignIn: new GoogleSignInHandler(googleSignIn, users, organizations, auth, ids, audits, provisionTenant),
    inviteUser: new InviteUserHandler(ids, users, invitations, audits, notify, entitlements),
    changeRole: new ChangeRoleHandler(users, audits),
    updateOrganization: new UpdateOrganizationHandler(organizations, audits),
    updateOrganizationReportingDefaults: new UpdateOrganizationReportingDefaultsHandler(organizations, audits),
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
    listProjects: new ListProjectsHandler(projects),
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
    importDriveFile: new ImportDriveFileHandler(driveFileReader, parser, uploadTemplateHandler, audits),
    getReportingProfile: new GetReportingProfileHandler(reportingProfiles),
    upsertReportingProfile: new UpsertReportingProfileHandler(ids, reportingProfiles, templates, audits),
    uploadTemplate: uploadTemplateHandler,
    updateTemplateSections: new UpdateTemplateSectionsHandler(templates, audits),
    deleteTemplate: new DeleteTemplateHandler(templates, audits),
    listTemplates: new ListTemplatesHandler(templates),
    createLogframeItem: new CreateLogframeItemHandler(ids, logframe, audits),
    createIndicator: new CreateIndicatorHandler(ids, indicators, audits),
    createIndicatorUpdate: new CreateIndicatorUpdateHandler(ids, indicatorUpdates, audits),
    bulkUpsertIndicatorUpdates: new BulkUpsertIndicatorUpdatesHandler(ids, indicatorUpdates, indicators, periods, audits),
    listPeriodIndicators: new ListPeriodIndicatorsHandler(periods, logframe, indicators, indicatorUpdates),
    parseIndicatorSheet: new ParseIndicatorSheetHandler(periods, indicators, sheetReader),
    verifyIndicatorUpdate: new VerifyIndicatorUpdateHandler(indicatorUpdates, audits),
    listLogframe: new ListLogframeHandler(logframe, indicators),
    listIndicators: new ListIndicatorsHandler(indicators),
    uploadEvidence: new UploadEvidenceHandler(ids, evidence, evidenceStorage, events, audits, usageCounters, entitlements),
    suggestEvidenceTags: new SuggestEvidenceTagsHandler(evidence, evidenceTagger),
    acceptEvidenceTags: new AcceptEvidenceTagsHandler(evidence, audits),
    persistEvidenceTags: new PersistEvidenceTagsHandler(evidence, audits, idempotency),
    verifyEvidence: new VerifyEvidenceHandler(evidence, audits),
    searchEvidence: new SearchEvidenceHandler(evidence),
    getEvidence: new GetEvidenceHandler(evidence),
    createActivityUpdate: new CreateActivityUpdateHandler(ids, activities, audits),
    polishActivity: new PolishActivityHandler(activities, activityPolisher),
    reviewActivity: new ReviewActivityHandler(activities, audits),
    listActivities: new ListActivitiesHandler(activities),
    getActivity: new GetActivityHandler(activities),
    createReportingPeriod: new CreateReportingPeriodHandler(ids, periods, projects, templates, projectSetup, reportingProfiles, readiness, audits, events),
    listReportingPeriods: new ListReportingPeriodsHandler(periods),
    generateReportDraft: new GenerateReportDraftHandler(
      ids, periods, drafts, sections, projects, organizations, templates, indicatorUpdates, activities,
      reportPlanner, indicatorAnalytics, evidencePackageBuilder, claimVerifier, generationRuns, reportPlans, reportClaims,
      reportDraftGenerator, audits, entitlements, usageCounters, llmUsage,
    ),
    getReportDraft: new GetReportDraftHandler(drafts, sections, reportClaims, reportPlans),
    updateReportSection: new UpdateReportSectionHandler(sections, audits),
    rewriteReportSection: new RewriteReportSectionHandler(sections, reportDraftGenerator, audits),
    approveReportSection: new ApproveReportSectionHandler(sections, reportClaims, audits),
    submitReportForReview: new SubmitReportForReviewHandler(drafts, audits),
    approveReport: new ApproveReportHandler(drafts, periods, checklist, reportClaims, audits),
    rejectReport: new RejectReportHandler(drafts, audits),
    resolveReportClaim: new ResolveReportClaimHandler(reportClaims, audits),
    detectMissingEvidence: detectMissingEvidenceHandler,
    resolveChecklistItem: new ResolveChecklistItemHandler(checklist, audits),
    bulkResolveChecklist: new BulkResolveChecklistHandler(checklist, audits),
    listChecklist: new ListChecklistHandler(checklist),
    calculateReadiness: calculateReadinessHandler,
    recomputeReadiness: new RecomputeReadinessHandler(calculateReadinessHandler),
    generateChecklist: new GenerateChecklistHandler(detectMissingEvidenceHandler),
    createExport: createExportHandler,
    runExport: new RunExportHandler(createExportHandler),
    getExportPreflight: new GetExportPreflightHandler(periods, drafts, sections, indicatorUpdates, checklist, evidence),
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
    processBillingWebhook: new ProcessBillingWebhookHandler(billingProvider, billingSubscriptions, entitlementGrants, billingInbox, ids, audits, clock),
    expireLocalTrials: new ExpireLocalTrialsHandler(entitlementGrants, audits, clock),
  };

  return {
    prisma, auth, storage, evidenceStorage, googleDriveOAuth, googleDriveCredentials, driveFileReader, parser, logger, ids, clock, events, notify, jobQueue,
    evidenceTagger, activityPolisher, templateExtraction, reportDraftGenerator, checklistDetector, exportBuilder,
    organizations, users, invitations,     projects, projectSetup, reportingProfiles, readiness, projectWorkspace, templates, logframe, indicators, indicatorUpdates, evidence, idempotency, activities,
    periods, drafts, sections, reportPlans, reportClaims, generationRuns, donorTemplateMappings, checklist, exports, comments, notifications, audits, projectMembers,
    billingSubscriptions, entitlementGrants, usageCounters, billingInbox, trialIdentities, llmUsage, billingProvider,
    handlers,
  };
}

function withTenantSession(databaseUrl: string, tenantId: string): string {
  if (!/^[A-Za-z0-9_-]{3,128}$/.test(tenantId)) throw new Error("Invalid tenant identifier");
  const url = new URL(databaseUrl);
  url.searchParams.set("options", `-c app.current_tenant=${tenantId}`);
  return url.toString();
}
