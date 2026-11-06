/**
 * Composition of the setup appliers (Phase 36.3): each applier gets only the one existing handler it delegates to, as the
 * narrow `Setup*` port. This is the only place that knows which concrete handler backs which port.
 */
import {
  FactsApplier, FundingBudgetApplier, IndicatorsApplier, LogframeApplier, PeriodsApplier, PlacesApplier, PlanApplier, RisksApplier,
  type AuthenticatedContext, type CreateAllPeriodsHandler, type CreateFundingSourceHandler, type AddProjectFundingHandler,
  type CreateRiskHandler, type IProjectFundingRepository, type IProjectRepository, type ISetupAreaApplier, type ImportIndicatorsHandler,
  type ImportLogframeHandler, type ImportPlacesHandler, type ImportWorkPlanHandler, type ListFundingSourcesHandler, type ListRisksHandler,
  type SetupFundingWriter, type SetupRiskWriter, type SetupWorkspaceProbe,
} from "@donordesk/application";
import { ok } from "@donordesk/domain";

export interface SetupApplierDeps {
  importLogframe: ImportLogframeHandler;
  importIndicators: ImportIndicatorsHandler;
  createAllPeriods: CreateAllPeriodsHandler;
  importWorkPlan: ImportWorkPlanHandler;
  importPlaces: ImportPlacesHandler;
  createRisk: CreateRiskHandler;
  listRisks: ListRisksHandler;
  listFundingSources: ListFundingSourcesHandler;
  createFundingSource: CreateFundingSourceHandler;
  addProjectFunding: AddProjectFundingHandler;
  fundings: IProjectFundingRepository;
  projects: IProjectRepository;
  workspace: SetupWorkspaceProbe;
}

/**
 * `deps` is read on every call, not at construction: the container builds the appliers inside its handler table and the
 * delegated handlers (wrapped later with logframe versioning) are looked up when an apply actually runs.
 */
export function createSetupAppliers(deps: () => SetupApplierDeps): ISetupAreaApplier[] {
  const d = new Proxy({} as SetupApplierDeps, { get: (_t, key) => deps()[key as keyof SetupApplierDeps] });
  const risks: SetupRiskWriter = {
    list: (ctx, projectId) => d.listRisks.handle(ctx, projectId),
    create: (ctx, projectId, input) => d.createRisk.handle(ctx, projectId, input),
  };
  const finance: SetupFundingWriter = {
    sources: (ctx: AuthenticatedContext) => d.listFundingSources.handle(ctx),
    createSource: (ctx, name) => d.createFundingSource.handle(ctx, { name, ownFunding: true }),
    existing: async (ctx, projectId) => {
      const rows = await d.fundings.listByProject(projectId, ctx.tenant.tenantId);
      return rows.ok ? ok(rows.value.map((f) => ({ fundingSourceId: f.fundingSourceId, amountText: String(Number(f.amount.minor) / 100), currency: f.amount.currency }))) : rows;
    },
    add: (ctx, projectId, input) => d.addProjectFunding.handle(ctx, projectId, input),
    projectStart: async (ctx, projectId) => {
      const p = await d.projects.findById(projectId, ctx.tenant.tenantId);
      return p.ok ? ok(p.value ? p.value.duration.start.toISOString().slice(0, 10) : null) : p;
    },
  };
  return [
    new FactsApplier(),
    new LogframeApplier({ handle: (ctx, input) => d.importLogframe.handle(ctx, input) }),
    new IndicatorsApplier({ handle: (ctx, input) => d.importIndicators.handle(ctx, input) }),
    new PeriodsApplier({ handle: (ctx, projectId, options) => d.createAllPeriods.handle(ctx, projectId, options) }, { stillPreparing: (ctx, projectId) => d.workspace.stillPreparing(ctx, projectId) }),
    new PlanApplier({ handle: (ctx, projectId, input) => d.importWorkPlan.handle(ctx, projectId, input) }),
    new PlacesApplier({ handle: (ctx, input) => d.importPlaces.handle(ctx, input) }),
    new FundingBudgetApplier(finance),
    new RisksApplier(risks),
  ];
}
