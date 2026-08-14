import { PrismaClient } from "@prisma/client";

import {
  SignUpHandler,
  LoginHandler,
  InviteUserHandler,
  ChangeRoleHandler,
  UpdateOrganizationHandler,
  ConnectGoogleDriveHandler,
  GoogleSignInHandler,
  LinkGoogleDriveEvidenceHandler,
  ListUsersHandler,
  CreateProjectHandler,
  UpdateProjectHandler,
  ListProjectsHandler,
  GetProjectHandler,
  UploadTemplateHandler,
  UpdateTemplateSectionsHandler,
  ListTemplatesHandler,
  CreateLogframeItemHandler,
  CreateIndicatorHandler,
  CreateIndicatorUpdateHandler,
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
  DetectMissingEvidenceHandler,
  ResolveChecklistItemHandler,
  ListChecklistHandler,
  CalculateReadinessHandler,
  RecomputeReadinessHandler,
  GenerateChecklistHandler,
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
  UuidIdGenerator,
  type SystemClock,
  SystemClock as SystemClockImpl,
} from "@donordesk/application";
import type { IJobQueue } from "@donordesk/application";

import {
  PrismaOrganizationRepository,
  PrismaUserRepository,
  PrismaInvitationRepository,
} from "./repositories/identity.js";
import { PrismaProjectRepository } from "./repositories/projects.js";
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
import { PrismaGoogleDriveTokenStore } from "./storage/prisma-google-drive-token-store.js";
import { GoogleDriveOAuthConnector } from "./storage/google-drive-oauth.js";
import { PrismaGoogleDriveCredentialStore } from "./storage/google-drive-credentials.js";
import { TolerantDocumentParser } from "./parsers/document-parser.js";
import { StubTemplateExtractionService } from "./llm/template-extraction.js";
import { StubEvidenceTagger } from "./llm/evidence-tagger.js";
import { StubActivityPolisher } from "./llm/activity-polisher.js";
import { StubReportDraftGenerator } from "./llm/report-draft-generator.js";
import { StubChecklistDetector } from "./llm/checklist-detector.js";
import { DefaultExportBuilder } from "./exports/builder.js";
import { createLogger } from "./observability/logger.js";
import {
  LoggingNotificationAdapter,
} from "./support.js";
import { OutboxEventBus, DEFAULT_EVENT_TO_JOB } from "./events/outbox-event-bus.js";
import { createJobQueue } from "./jobs/index.js";

export interface Container {
  prisma: PrismaClient;
  auth: JwtAuthProvider | OidcAuthProvider;
  storage: LocalStorage;
  evidenceStorage: EvidenceStorageResolver;
  googleDriveOAuth: GoogleDriveOAuthConnector;
  googleDriveCredentials: PrismaGoogleDriveCredentialStore;
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
  projects: PrismaProjectRepository;
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
    listUsers: ListUsersHandler;
    createProject: CreateProjectHandler;
    updateProject: UpdateProjectHandler;
    listProjects: ListProjectsHandler;
    getProject: GetProjectHandler;
    uploadTemplate: UploadTemplateHandler;
    updateTemplateSections: UpdateTemplateSectionsHandler;
    listTemplates: ListTemplatesHandler;
    createLogframeItem: CreateLogframeItemHandler;
    createIndicator: CreateIndicatorHandler;
    createIndicatorUpdate: CreateIndicatorUpdateHandler;
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
    detectMissingEvidence: DetectMissingEvidenceHandler;
    resolveChecklistItem: ResolveChecklistItemHandler;
    listChecklist: ListChecklistHandler;
    calculateReadiness: CalculateReadinessHandler;
    recomputeReadiness: RecomputeReadinessHandler;
    generateChecklist: GenerateChecklistHandler;
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
    connectGoogleDrive: ConnectGoogleDriveHandler;
    linkGoogleDriveEvidence: LinkGoogleDriveEvidenceHandler;
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
  );
  const parser = new TolerantDocumentParser();
  const ids = new UuidIdGenerator();
  const clock = new SystemClockImpl();
  const jobQueue = createJobQueue(logger);
  const events = new OutboxEventBus(logger, jobQueue, DEFAULT_EVENT_TO_JOB);
  const notify = new LoggingNotificationAdapter(logger);

  const googleDriveOAuth = new GoogleDriveOAuthConnector();

  const organizations = new PrismaOrganizationRepository(prisma);
  const users = new PrismaUserRepository(prisma);
  const invitations = new PrismaInvitationRepository(prisma);
  const projects = new PrismaProjectRepository(prisma);
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
  const checklist = new PrismaChecklistRepository(prisma);
  const exports = new PrismaExportRepository(prisma);
  const comments = new PrismaCommentRepository(prisma);
  const notifications = new PrismaNotificationRepository(prisma);
  const audits = new PrismaAuditRepository(prisma);

  const evidenceTagger = new StubEvidenceTagger();
  const activityPolisher = new StubActivityPolisher();
  const templateExtraction = new StubTemplateExtractionService();
  const reportDraftGenerator = new StubReportDraftGenerator();
  const checklistDetector = new StubChecklistDetector();
  const exportBuilder = new DefaultExportBuilder();

  const calculateReadinessHandler = new CalculateReadinessHandler(drafts, sections, indicators, indicatorUpdates, evidence, checklist);
  const detectMissingEvidenceHandler = new DetectMissingEvidenceHandler(ids, checklist, checklistDetector, periods, templates, indicatorUpdates, sections, activities, evidence, audits);
  const createExportHandler = new CreateExportHandler(ids, exports, projects, periods, drafts, sections, indicators, indicatorUpdates, activities, checklist, evidence, exportBuilder, storage, audits);

  const handlers: Container["handlers"] = {
    signUp: new SignUpHandler(ids, organizations, users, auth, events, audits),
    login: new LoginHandler(users, auth, audits),
    googleSignIn: new GoogleSignInHandler(googleSignIn, users, auth, audits),
    inviteUser: new InviteUserHandler(ids, users, invitations, audits, notify),
    changeRole: new ChangeRoleHandler(users, audits),
    updateOrganization: new UpdateOrganizationHandler(organizations, audits),
    connectGoogleDrive: new ConnectGoogleDriveHandler(
      googleDriveOAuth,
      organizations,
      async (tenantId, refreshToken) => googleDriveCredentials.save(tenantId, refreshToken),
      audits,
    ),
    linkGoogleDriveEvidence: new LinkGoogleDriveEvidenceHandler(ids, evidence, evidenceStorage, events, audits),
    listUsers: new ListUsersHandler(users),
    createProject: new CreateProjectHandler(ids, projects, audits),
    updateProject: new UpdateProjectHandler(projects, audits),
    listProjects: new ListProjectsHandler(projects),
    getProject: new GetProjectHandler(projects),
    uploadTemplate: new UploadTemplateHandler(ids, templates, templateExtraction, audits),
    updateTemplateSections: new UpdateTemplateSectionsHandler(templates, audits),
    listTemplates: new ListTemplatesHandler(templates),
    createLogframeItem: new CreateLogframeItemHandler(ids, logframe, audits),
    createIndicator: new CreateIndicatorHandler(ids, indicators, audits),
    createIndicatorUpdate: new CreateIndicatorUpdateHandler(ids, indicatorUpdates, audits),
    verifyIndicatorUpdate: new VerifyIndicatorUpdateHandler(indicatorUpdates, audits),
    listLogframe: new ListLogframeHandler(logframe, indicators),
    listIndicators: new ListIndicatorsHandler(indicators),
    uploadEvidence: new UploadEvidenceHandler(ids, evidence, evidenceStorage, events, audits),
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
    createReportingPeriod: new CreateReportingPeriodHandler(ids, periods, audits),
    listReportingPeriods: new ListReportingPeriodsHandler(periods),
    generateReportDraft: new GenerateReportDraftHandler(
      ids, periods, drafts, sections, projects, organizations, templates, logframe, indicators, indicatorUpdates, activities, evidence, reportDraftGenerator, audits,
    ),
    getReportDraft: new GetReportDraftHandler(drafts, sections),
    updateReportSection: new UpdateReportSectionHandler(sections, audits),
    approveReportSection: new ApproveReportSectionHandler(sections, audits),
    submitReportForReview: new SubmitReportForReviewHandler(drafts, audits),
    approveReport: new ApproveReportHandler(drafts, periods, audits),
    detectMissingEvidence: detectMissingEvidenceHandler,
    resolveChecklistItem: new ResolveChecklistItemHandler(checklist, audits),
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
  };

  return {
    prisma, auth, storage, evidenceStorage, googleDriveOAuth, googleDriveCredentials, parser, logger, ids, clock, events, notify, jobQueue,
    evidenceTagger, activityPolisher, templateExtraction, reportDraftGenerator, checklistDetector, exportBuilder,
    organizations, users, invitations, projects, templates, logframe, indicators, indicatorUpdates, evidence, idempotency, activities,
    periods, drafts, sections, checklist, exports, comments, notifications, audits,
    handlers,
  };
}

function withTenantSession(databaseUrl: string, tenantId: string): string {
  if (!/^[A-Za-z0-9_-]{3,128}$/.test(tenantId)) throw new Error("Invalid tenant identifier");
  const url = new URL(databaseUrl);
  url.searchParams.set("options", `-c app.current_tenant=${tenantId}`);
  return url.toString();
}
