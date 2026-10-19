import type { PrismaClient } from "@prisma/client";
import {
  AddBudgetExpenseHandler,
  AddBudgetLineHandler,
  AddPlanDependencyHandler,
  AssignPlannedActivityHandler,
  BulkPlanActionHandler,
  ChangeActivityPeopleHandler,
  ChangePlanStatusHandler,
  CompletePlannedActivityHandler,
  CopyWorkPlanHandler,
  CreateActivityUpdateHandler,
  CreatePlannedActivityHandler,
  DefineProjectFieldHandler,
  GetActivityPeopleHandler,
  GetBreakdownProgressHandler,
  GetMyWeekHandler,
  GetPlanItemBudgetHandler,
  GetPlanItemFieldsHandler,
  GetProgressHandler,
  GetProjectBudgetHandler,
  GetSubmissionMappingHandler,
  GetWorkloadHandler,
  ImportSubmissionsHandler,
  ImportWorkPlanHandler,
  ListAutomationRulesHandler,
  ListBeneficiariesHandler,
  ListPlanRevisionsHandler,
  ListProjectFieldValuesHandler,
  ListProjectFieldsHandler,
  ListWorkPlanHandler,
  PlanAccess,
  PlanLinkResolver,
  PlanRecorder,
  PrepareProgressHandler,
  PreviewSubmissionsHandler,
  RegisterBeneficiaryHandler,
  RemovePlanDependencyHandler,
  RemoveProgressHandler,
  ReschedulePlannedActivityHandler,
  SaveProgressHandler,
  SaveSubmissionMappingHandler,
  SetAutomationRuleHandler,
  SetCapacityHandler,
  SetPlanIndicatorsHandler,
  SetPlanItemFieldsHandler,
  StartPlanFromLogframeHandler,
  UndoBulkPlanActionHandler,
  UpdatePlannedActivityHandler,
  type ActivityLinkResolver,
  type IActivityUpdateRepository,
  type IAuditLogger,
  type IClock,
  type IIdGenerator,
  type IIndicatorRepository,
  type IIndicatorUpdateRepository,
  type ILogframeRepository,
  type IProjectRepository,
  type IReportingPeriodRepository,
  type ITaskReconciliation,
} from "@donordesk/application";
import {
  PrismaAutomationSettings,
  PrismaBeneficiaryLinkRepository,
  PrismaBeneficiaryRepository,
  PrismaBudgetRepository,
  PrismaCustomFieldValueRepository,
  PrismaDeliveryFactsReader,
  PrismaMemberCapacityRepository,
  PrismaMemberDirectory,
  PrismaMyWeekReader,
  PrismaPlanContextReader,
  PrismaPlanDependencyRepository,
  PrismaPlanRevisionRepository,
  PrismaPlannedActivityIndicatorRepository,
  PrismaPlannedActivityRepository,
  PrismaProgressRepository,
  PrismaProjectFieldRepository,
  PrismaProjectSubmissionMappingRepository,
} from "../repositories/workplan.js";

/** What the work plan needs from the rest of the container. Everything else it builds itself. */
export interface WorkplanModuleDeps {
  prisma: PrismaClient;
  ids: IIdGenerator;
  clock: IClock;
  audits: IAuditLogger;
  logframe: ILogframeRepository;
  indicators: IIndicatorRepository;
  indicatorUpdates: IIndicatorUpdateRepository;
  periods: IReportingPeriodRepository;
  projects: IProjectRepository;
  activities: IActivityUpdateRepository;
  activityLinks: ActivityLinkResolver;
  taskReconciler: ITaskReconciliation;
}

/**
 * The work plan (phases 28 and 28.1) as one module: its repositories, the services over them, and every handler. The container
 * takes `handlers` as they are and the few repositories other parts still read (activities, revisions, context, links, settings).
 */
export function createWorkplanModule(deps: WorkplanModuleDeps) {
  const { prisma, ids, clock, audits, logframe, indicators, indicatorUpdates, periods, projects, activities, activityLinks, taskReconciler } = deps;
  const plannedActivities = new PrismaPlannedActivityRepository(prisma);
  const planRevisions = new PrismaPlanRevisionRepository(prisma);
  const planDependencies = new PrismaPlanDependencyRepository(prisma);
  const projectFields = new PrismaProjectFieldRepository(prisma);
  const customFieldValues = new PrismaCustomFieldValueRepository(prisma);
  const budgets = new PrismaBudgetRepository(prisma);
  const memberCapacity = new PrismaMemberCapacityRepository(prisma);
  const automationSettings = new PrismaAutomationSettings(prisma);
  const beneficiaries = new PrismaBeneficiaryRepository(prisma);
  const submissionMappings = new PrismaProjectSubmissionMappingRepository(prisma);
  const activityIndicators = new PrismaPlannedActivityIndicatorRepository(prisma);
  const progressLog = new PrismaProgressRepository(prisma);
  const beneficiaryLinks = new PrismaBeneficiaryLinkRepository(prisma);
  const planContext = new PrismaPlanContextReader(prisma);
  const planLinks = new PlanLinkResolver(plannedActivities);
  const planAccess = new PlanAccess(plannedActivities);
  const planRecorder = new PlanRecorder(ids, planRevisions, audits, clock);
  const bulkPlan = new BulkPlanActionHandler(planAccess, plannedActivities, planContext,
    new AssignPlannedActivityHandler(planAccess, plannedActivities, planContext, planRecorder),
    new ReschedulePlannedActivityHandler(planAccess, plannedActivities, planContext, planRecorder, clock, planDependencies),
    new ChangePlanStatusHandler(planAccess, plannedActivities, planRecorder, clock), clock);

  const handlers = {
    createPlannedActivity: new CreatePlannedActivityHandler(ids, plannedActivities, planContext, logframe, audits),
    changePlanStatus: new ChangePlanStatusHandler(planAccess, plannedActivities, planRecorder, clock),
    reschedulePlannedActivity: new ReschedulePlannedActivityHandler(planAccess, plannedActivities, planContext, planRecorder, clock, planDependencies),
    addPlanDependency: new AddPlanDependencyHandler(plannedActivities, planDependencies, ids, audits, clock),
    removePlanDependency: new RemovePlanDependencyHandler(plannedActivities, planDependencies, audits),
    defineProjectField: new DefineProjectFieldHandler(projectFields, ids, audits, clock),
    listProjectFields: new ListProjectFieldsHandler(projectFields),
    addBudgetLine: new AddBudgetLineHandler(planAccess, budgets, ids, audits, clock),
    getWorkload: new GetWorkloadHandler(plannedActivities, planContext, memberCapacity, clock),
    setAutomationRule: new SetAutomationRuleHandler(automationSettings, audits, clock),
    listAutomationRules: new ListAutomationRulesHandler(automationSettings),
    registerBeneficiary: new RegisterBeneficiaryHandler(beneficiaries, planContext, ids, audits, clock),
    listBeneficiaries: new ListBeneficiariesHandler(beneficiaries, planContext),
    importSubmissions: new ImportSubmissionsHandler(beneficiaries, planContext, ids, audits, clock, submissionMappings),
    previewSubmissions: new PreviewSubmissionsHandler(beneficiaries, planContext, submissionMappings),
    getSubmissionMapping: new GetSubmissionMappingHandler(submissionMappings),
    saveSubmissionMapping: new SaveSubmissionMappingHandler(submissionMappings, audits, clock),
    setPlanIndicators: new SetPlanIndicatorsHandler(planAccess, activityIndicators, indicators, audits, clock),
    getProgress: new GetProgressHandler(planAccess, progressLog, activityIndicators, indicators),
    prepareProgress: new PrepareProgressHandler(planAccess, progressLog, activityIndicators, indicators),
    saveProgress: new SaveProgressHandler(planAccess, progressLog, activityIndicators, indicators, ids, audits, clock),
    removeProgress: new RemoveProgressHandler(planAccess, progressLog, audits),
    getActivityPeople: new GetActivityPeopleHandler(planAccess, beneficiaryLinks, beneficiaries),
    changeActivityPeople: new ChangeActivityPeopleHandler(planAccess, beneficiaryLinks, beneficiaries, audits, clock),
    completePlannedActivity: new CompletePlannedActivityHandler(
      planAccess, periods,
      new CreateActivityUpdateHandler(ids, activities, audits, activityLinks, planLinks, taskReconciler),
      new ChangePlanStatusHandler(planAccess, plannedActivities, planRecorder, clock), clock),
    setCapacity: new SetCapacityHandler(memberCapacity, audits, clock),
    bulkPlanAction: bulkPlan,
    undoBulkPlanAction: new UndoBulkPlanActionHandler(bulkPlan),
    addBudgetExpense: new AddBudgetExpenseHandler(planAccess, budgets, ids, audits, clock),
    getPlanItemBudget: new GetPlanItemBudgetHandler(planAccess, budgets),
    getProjectBudget: new GetProjectBudgetHandler(plannedActivities, budgets, planContext),
    getBreakdownProgress: new GetBreakdownProgressHandler(indicators, indicatorUpdates, periods, planContext),
    getPlanItemFields: new GetPlanItemFieldsHandler(planAccess, projectFields, customFieldValues),
    listProjectFieldValues: new ListProjectFieldValuesHandler(projectFields, customFieldValues, planContext),
    setPlanItemFields: new SetPlanItemFieldsHandler(planAccess, projectFields, customFieldValues, audits, clock),
    assignPlannedActivity: new AssignPlannedActivityHandler(planAccess, plannedActivities, planContext, planRecorder),
    updatePlannedActivity: new UpdatePlannedActivityHandler(planAccess, plannedActivities, planContext, planRecorder, clock),
    startPlanFromLogframe: new StartPlanFromLogframeHandler(ids, plannedActivities, planContext, logframe, audits),
    listWorkPlan: new ListWorkPlanHandler(plannedActivities, new PrismaDeliveryFactsReader(prisma), planContext, clock, planDependencies),
    listPlanRevisions: new ListPlanRevisionsHandler(plannedActivities, planRevisions),
    getMyWeek: new GetMyWeekHandler(new PrismaMyWeekReader(prisma), new PrismaDeliveryFactsReader(prisma), clock),
    copyWorkPlan: new CopyWorkPlanHandler(projects, logframe, plannedActivities, ids, audits),
    importWorkPlan: new ImportWorkPlanHandler(ids, plannedActivities, planContext, new PrismaMemberDirectory(prisma), logframe, audits),
  };

  return { plannedActivities, planRevisions, planContext, planLinks, automationSettings, handlers };
}

/** The work plan's handlers by name, for the container's `handlers` type. */
export type WorkplanHandlers = ReturnType<typeof createWorkplanModule>["handlers"];
