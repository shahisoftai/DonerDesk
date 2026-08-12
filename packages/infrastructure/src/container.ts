import { PrismaClient } from "@prisma/client";

import {
  SignUpHandler,
  LoginHandler,
  InviteUserHandler,
  ChangeRoleHandler,
  UpdateOrganizationHandler,
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
  VerifyEvidenceHandler,
  SearchEvidenceHandler,
  CreateActivityUpdateHandler,
  PolishActivityHandler,
  ReviewActivityHandler,
  ListActivitiesHandler,
  CreateReportingPeriodHandler,
  ListReportingPeriodsHandler,
  GenerateReportDraftHandler,
  UpdateReportSectionHandler,
  ApproveReportSectionHandler,
  SubmitReportForReviewHandler,
  ApproveReportHandler,
  DetectMissingEvidenceHandler,
  ResolveChecklistItemHandler,
  ListChecklistHandler,
  CalculateReadinessHandler,
  CreateExportHandler,
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
import { LocalStorage } from "./storage/local-storage.js";
import { TolerantDocumentParser } from "./parsers/document-parser.js";
import { StubTemplateExtractionService } from "./llm/template-extraction.js";
import { StubEvidenceTagger } from "./llm/evidence-tagger.js";
import { StubActivityPolisher } from "./llm/activity-polisher.js";
import { StubReportDraftGenerator } from "./llm/report-draft-generator.js";
import { StubChecklistDetector } from "./llm/checklist-detector.js";
import { DefaultExportBuilder } from "./exports/builder.js";
import { createLogger } from "./observability/logger.js";
import {
  LoggingEventBus,
  LoggingNotificationAdapter,
  InMemoryJobQueue,
} from "./support.js";

export interface Container {
  prisma: PrismaClient;
  auth: JwtAuthProvider | OidcAuthProvider;
  storage: LocalStorage;
  parser: TolerantDocumentParser;
  logger: ReturnType<typeof createLogger>;
  ids: UuidIdGenerator;
  clock: SystemClock;
  events: LoggingEventBus;
  notify: LoggingNotificationAdapter;
  jobQueue: InMemoryJobQueue;
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
    verifyEvidence: VerifyEvidenceHandler;
    searchEvidence: SearchEvidenceHandler;
    createActivityUpdate: CreateActivityUpdateHandler;
    polishActivity: PolishActivityHandler;
    reviewActivity: ReviewActivityHandler;
    listActivities: ListActivitiesHandler;
    createReportingPeriod: CreateReportingPeriodHandler;
    listReportingPeriods: ListReportingPeriodsHandler;
    generateReportDraft: GenerateReportDraftHandler;
    updateReportSection: UpdateReportSectionHandler;
    approveReportSection: ApproveReportSectionHandler;
    submitReportForReview: SubmitReportForReviewHandler;
    approveReport: ApproveReportHandler;
    detectMissingEvidence: DetectMissingEvidenceHandler;
    resolveChecklistItem: ResolveChecklistItemHandler;
    listChecklist: ListChecklistHandler;
    calculateReadiness: CalculateReadinessHandler;
    createExport: CreateExportHandler;
    addComment: AddCommentHandler;
    resolveComment: ResolveCommentHandler;
    listComments: ListCommentsHandler;
    listNotifications: ListNotificationsHandler;
    markNotificationRead: MarkNotificationReadHandler;
    listAuditLog: ListAuditLogHandler;
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
  const storage = new LocalStorage();
  const parser = new TolerantDocumentParser();
  const ids = new UuidIdGenerator();
  const clock = new SystemClockImpl();
  const events = new LoggingEventBus(logger);
  const notify = new LoggingNotificationAdapter(logger);
  const jobQueue = new InMemoryJobQueue(async (name, payload) => {
    logger.info("job.dequeued", { name, payload });
  });

  const organizations = new PrismaOrganizationRepository(prisma);
  const users = new PrismaUserRepository(prisma);
  const invitations = new PrismaInvitationRepository(prisma);
  const projects = new PrismaProjectRepository(prisma);
  const templates = new PrismaDonorTemplateRepository(prisma);
  const logframe = new PrismaLogframeRepository(prisma);
  const indicators = new PrismaIndicatorRepository(prisma);
  const indicatorUpdates = new PrismaIndicatorUpdateRepository(prisma);
  const evidence = new PrismaEvidenceRepository(prisma);
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

  const handlers = {
    signUp: new SignUpHandler(ids, organizations, users, auth, events, audits),
    login: new LoginHandler(users, auth, audits),
    inviteUser: new InviteUserHandler(ids, users, invitations, audits, notify),
    changeRole: new ChangeRoleHandler(users, audits),
    updateOrganization: new UpdateOrganizationHandler(organizations, audits),
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
    uploadEvidence: new UploadEvidenceHandler(ids, evidence, storage, parser, jobQueue, audits),
    suggestEvidenceTags: new SuggestEvidenceTagsHandler(evidence, evidenceTagger),
    acceptEvidenceTags: new AcceptEvidenceTagsHandler(evidence, audits),
    verifyEvidence: new VerifyEvidenceHandler(evidence, audits),
    searchEvidence: new SearchEvidenceHandler(evidence),
    createActivityUpdate: new CreateActivityUpdateHandler(ids, activities, audits),
    polishActivity: new PolishActivityHandler(activities, activityPolisher),
    reviewActivity: new ReviewActivityHandler(activities, audits),
    listActivities: new ListActivitiesHandler(activities),
    createReportingPeriod: new CreateReportingPeriodHandler(ids, periods, audits),
    listReportingPeriods: new ListReportingPeriodsHandler(periods),
    generateReportDraft: new GenerateReportDraftHandler(
      ids, periods, drafts, sections, projects, organizations, templates, logframe, indicators, indicatorUpdates, activities, evidence, reportDraftGenerator, audits,
    ),
    updateReportSection: new UpdateReportSectionHandler(sections, audits),
    approveReportSection: new ApproveReportSectionHandler(sections, audits),
    submitReportForReview: new SubmitReportForReviewHandler(drafts, audits),
    approveReport: new ApproveReportHandler(drafts, periods, audits),
    detectMissingEvidence: new DetectMissingEvidenceHandler(
      ids, checklist, checklistDetector, periods, templates, indicatorUpdates, sections, activities, evidence, audits,
    ),
    resolveChecklistItem: new ResolveChecklistItemHandler(checklist, audits),
    listChecklist: new ListChecklistHandler(checklist),
    calculateReadiness: new CalculateReadinessHandler(drafts, sections, indicators, indicatorUpdates, evidence, checklist),
    createExport: new CreateExportHandler(
      ids, exports, projects, periods, drafts, sections, indicators, indicatorUpdates, activities, checklist, evidence, exportBuilder, storage, audits,
    ),
    addComment: new AddCommentHandler(ids, comments, audits, notify),
    resolveComment: new ResolveCommentHandler(comments, audits),
    listComments: new ListCommentsHandler(comments),
    listNotifications: new ListNotificationsHandler(notifications),
    markNotificationRead: new MarkNotificationReadHandler(notifications, audits),
    listAuditLog: new ListAuditLogHandler(audits),
  };

  return {
    prisma, auth, storage, parser, logger, ids, clock, events, notify, jobQueue,
    evidenceTagger, activityPolisher, templateExtraction, reportDraftGenerator, checklistDetector, exportBuilder,
    organizations, users, invitations, projects, templates, logframe, indicators, indicatorUpdates, evidence, activities,
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
