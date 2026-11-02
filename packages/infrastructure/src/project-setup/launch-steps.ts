/**
 * Composition of the wizard's launch steps (Phase 38.9b): each step gets only the one existing handler it delegates to, as the
 * narrow `Setup*` port. This is the only place that knows which concrete handler backs which port. `deps` is read on every call,
 * not at construction, because the container builds these inside its handler table and the delegated handlers are looked up
 * when a launch actually runs.
 */
import {
  ActivationStep, BudgetLinesStep, DashboardStep, EntryWindowsStep, FormsStep, IndicatorOwnerApplier, InvitationsStep, PlanLeadApplier, PendingMemberResolver, ResponsibilitiesStep, ReviewModeStep,
  type AddBudgetLineHandler, type UpdateProjectHandler, type ApplyDashboardTemplateHandler, type AssignPlannedActivityHandler, type GetPlanItemBudgetHandler, type ListWorkPlanHandler, type SetupBudgetWriter, type SetupDashboardWriter, type SetupPlanRows, type AssignProjectMemberHandler, type IAuditLogger, type IPendingMemberRepository, type IResponsibilityApplier, type SetIndicatorOwnerHandler,
  type SetupActingContext, type SetupIndicatorOwners, type SetupMemberAssigner, type CreateFormFromIndicatorHandler, type InviteUserHandler, type ISetupLaunchStep, type IUserRepository, type ListIndicatorsHandler,
  type ListPendingInvitationsHandler, type ListReportingPeriodsHandler, type SetPeriodEntryWindowHandler, type SetSimpleReviewHandler,
  type SetupEntryWindowWriter, type SetupFormWriter, type SetupInviter, type SetupReviewModeWriter, type SetupUserDirectory,
} from "@donordesk/application";
import type { AuthenticatedContext } from "@donordesk/application";
import { TenantId, isRateIndicator, ok, type BudgetCostCategory, type Role } from "@donordesk/domain";

export interface LaunchStepDeps {
  setSimpleReview: SetSimpleReviewHandler;
  setPeriodEntryWindow: SetPeriodEntryWindowHandler;
  listReportingPeriods: ListReportingPeriodsHandler;
  listIndicators: ListIndicatorsHandler;
  createFormFromIndicator: CreateFormFromIndicatorHandler;
  inviteUser: InviteUserHandler;
  listPendingInvitations: ListPendingInvitationsHandler;
  assignProjectMember: AssignProjectMemberHandler;
  setIndicatorOwner: SetIndicatorOwnerHandler;
  listWorkPlan: ListWorkPlanHandler;
  assignPlannedActivity: AssignPlannedActivityHandler;
  addBudgetLine: AddBudgetLineHandler;
  getPlanItemBudget: GetPlanItemBudgetHandler;
  applyDashboardTemplate: ApplyDashboardTemplateHandler;
  updateProject: UpdateProjectHandler;
}

/** What the step that puts the team on the project needs besides handlers: who has an account, where the rest are kept, time and ids. */
export interface LaunchStepExtras {
  users: SetupUserDirectory;
  pending: IPendingMemberRepository;
  now: () => Date;
  newId: () => string;
}

function planRows(d: LaunchStepDeps): SetupPlanRows {
  return {
    rows: async (ctx, projectId) => {
      const r = await d.listWorkPlan.handle(ctx, projectId);
      return r.ok ? ok(r.value.map((row) => ({ id: row.id, title: row.title, plannedStart: row.plannedStart }))) : r;
    },
    assignLead: (ctx, itemId, userId) => d.assignPlannedActivity.handle(ctx, itemId, { ownerUserId: userId, supportUserIds: [], scope: "THIS" } as never),
  };
}

/** The responsibility appliers, used by the launch step and by the resolver that runs when a pending person joins: one set, one place. */
export function createResponsibilityAppliers(deps: () => LaunchStepDeps): { appliers: IResponsibilityApplier[]; members: SetupMemberAssigner } {
  const d = new Proxy({} as LaunchStepDeps, { get: (_t, key) => deps()[key as keyof LaunchStepDeps] });
  const owners: SetupIndicatorOwners = {
    idsByCode: async (ctx, projectId) => {
      const r = await d.listIndicators.handle(ctx, projectId);
      return r.ok ? ok(new Map((r.value as Array<{ id: string; code: string }>).map((i) => [i.code, i.id] as const))) : r;
    },
    setOwner: (ctx, indicatorId, userId) => d.setIndicatorOwner.handle(ctx, indicatorId, { userId }),
  };
  const members: SetupMemberAssigner = {
    assign: async (ctx, projectId, userId, role) => {
      const r = await d.assignProjectMember.handle(ctx, projectId, { userId, role: role as Role });
      // Already being a member (an invitation made them one) is exactly what was wanted.
      return r.ok || r.error.code === "CONFLICT" ? ok(undefined) : r;
    },
  };
  return { appliers: [new IndicatorOwnerApplier(owners), new PlanLeadApplier(planRows(d))], members };
}

/** A context that acts as an existing user of the organisation, with their real role. */
export function createActingContext(users: IUserRepository): SetupActingContext {
  return {
    asUser: async (tenantId, userId) => {
      const found = await users.findById(userId, TenantId.create(tenantId));
      if (!found.ok || !found.value || found.value.status === "REMOVED") return null;
      return { tenant: { tenantId: TenantId.create(tenantId), userId, role: found.value.role }, requestId: "pending-member" } as AuthenticatedContext;
    },
  };
}

export function createPendingMemberResolver(deps: () => LaunchStepDeps, pending: IPendingMemberRepository, users: IUserRepository, audit: IAuditLogger): PendingMemberResolver {
  const { appliers, members } = createResponsibilityAppliers(deps);
  return new PendingMemberResolver(pending, members, createActingContext(users), appliers, audit);
}

export function createLaunchSteps(deps: () => LaunchStepDeps, extras: LaunchStepExtras): ISetupLaunchStep[] {
  const d = new Proxy({} as LaunchStepDeps, { get: (_t, key) => deps()[key as keyof LaunchStepDeps] });
  const review: SetupReviewModeWriter = { handle: (ctx, projectId, simple) => d.setSimpleReview.handle(ctx, projectId, simple) };
  const windows: SetupEntryWindowWriter = {
    periods: async (ctx, projectId) => {
      const r = await d.listReportingPeriods.handle(ctx, projectId);
      if (!r.ok) return r;
      return ok((r.value as Array<{ id: string; endDate: string; cancelled: boolean }>).filter((p) => !p.cancelled).map((p) => ({ id: p.id, endDate: p.endDate })));
    },
    setWindow: (ctx, periodId, w) => d.setPeriodEntryWindow.handle(ctx, periodId, w),
  };
  const forms: SetupFormWriter = {
    indicatorIds: async (ctx, projectId) => {
      const r = await d.listIndicators.handle(ctx, projectId);
      if (!r.ok) return r;
      return ok(new Map((r.value as Array<{ id: string; code: string }>).map((i) => [i.code, i.id] as const)));
    },
    createDraft: (ctx, indicatorId) => d.createFormFromIndicator.handle(ctx, indicatorId),
  };
  const inviter: SetupInviter = {
    pendingEmails: async (ctx) => {
      const r = await d.listPendingInvitations.handle(ctx);
      return r.ok ? ok(new Set(r.value.filter((i) => !i.expired).map((i) => i.email.toLowerCase()))) : r;
    },
    invite: (ctx, input) => d.inviteUser.handle(ctx, { email: input.email, role: input.role as Role, projectIds: input.projectIds, external: input.external }),
  };
  const { appliers, members } = createResponsibilityAppliers(deps);
  const budget: SetupBudgetWriter = {
    existingCodes: async (ctx, itemId) => {
      const r = await d.getPlanItemBudget.handle(ctx, itemId);
      return r.ok ? ok(new Set(r.value.map((l) => l.code))) : r;
    },
    add: (ctx, itemId, line) => d.addBudgetLine.handle(ctx, itemId, { ...line, category: line.category as BudgetCostCategory }),
  };
  const dashboard: SetupDashboardWriter = {
    indicators: async (ctx, projectId) => {
      const r = await d.listIndicators.handle(ctx, projectId);
      if (!r.ok) return r;
      return ok((r.value as Array<{ id: string; code: string; name: string; type: string; unit?: string | null }>).map((i) => ({ id: i.id, code: i.code, name: i.name, type: i.type, isRate: isRateIndicator({ type: i.type, ...(i.unit ? { unit: i.unit } : {}) }) })));
    },
    apply: (ctx, templateId, input) => d.applyDashboardTemplate.handle(ctx, templateId, { projectId: input.projectId, name: input.name, scope: "PROJECT", mapping: input.mapping }),
  };
  return [
    new ReviewModeStep(review), new EntryWindowsStep(windows), new FormsStep(forms),
    new ResponsibilitiesStep(extras.users, members, extras.pending, appliers, extras.now, extras.newId),
    new BudgetLinesStep(planRows(d), budget), new DashboardStep(dashboard), new InvitationsStep(inviter),
    new ActivationStep({ activate: async (ctx, projectId) => { const r = await d.updateProject.handle(ctx, projectId, { status: "ACTIVE" }); return r.ok ? ok(undefined) : r; } }),
  ];
}

/** Which of these emails already belong to a user in the organisation. */
export function createUserDirectory(users: IUserRepository): SetupUserDirectory {
  return {
    idsByEmail: async (ctx, emails) => {
      const found = new Map<string, string>();
      for (const email of new Set(emails.map((e) => e.trim().toLowerCase()))) {
        const r = await users.findByEmail(email, ctx.tenant.tenantId);
        if (r.ok && r.value) found.set(email, r.value.id.toString());
      }
      return ok(found);
    },
  };
}
