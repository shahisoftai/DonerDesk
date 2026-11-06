/**
 * The narrow shapes the wizard's launch steps delegate to (Phase 38.9b, interface segregation): each step sees only the one
 * call it makes, never the container. The existing handlers satisfy these structurally in the container's wiring.
 */
import type { DomainError, Result, SetupDraft } from "@donordesk/domain";
import type { AuthenticatedContext } from "../context.js";

type R<T> = Promise<Result<T, DomainError>>;

export interface SetupReviewModeWriter {
  handle(ctx: AuthenticatedContext, projectId: string, simple: boolean): R<void>;
}
export interface SetupEntryWindowWriter {
  periods(ctx: AuthenticatedContext, projectId: string): R<Array<{ id: string; endDate: string }>>;
  setWindow(ctx: AuthenticatedContext, periodId: string, window: { opensOn: string; closesOn: string }): R<unknown>;
}
export interface SetupFormWriter {
  /** Indicator code -> id for the project's live indicators. */
  indicatorIds(ctx: AuthenticatedContext, projectId: string): R<Map<string, string>>;
  /** A draft form from one indicator; refuses one that is calculated or not a running sum, in a sentence. */
  createDraft(ctx: AuthenticatedContext, indicatorId: string): R<{ id: string; notes: string[] }>;
}
export interface SetupInviter {
  /** Lower-cased emails with an invitation still waiting, so a repeat never invites twice. */
  pendingEmails(ctx: AuthenticatedContext): R<Set<string>>;
  invite(ctx: AuthenticatedContext, input: { email: string; role: string; projectIds: string[]; external: boolean }): R<unknown>;
}
/** Which of these emails already belong to a user in the organisation (lower-cased email -> user id). */
export interface SetupUserDirectory {
  idsByEmail(ctx: AuthenticatedContext, emails: readonly string[]): R<Map<string, string>>;
}

export interface LaunchStepOutcome {
  /** What the step did, as a count (periods set, forms drafted, people invited). */
  done: number;
  /** Plain sentences: what could not be done, and why. A note is not a failure. */
  notes: string[];
}

/** One launch step. A returned error stops the launch there; a note does not. A step is safe to run again. */
export interface ISetupLaunchStep {
  readonly key: string;
  run(ctx: AuthenticatedContext, projectId: string, draft: SetupDraft): R<LaunchStepOutcome>;
}

// ---------- people who are named but have not joined yet (Phase 38.9c) ----------

/** Makes someone a member of the project. Already being a member is not an error: the call is safe to repeat. */
export interface SetupMemberAssigner {
  assign(ctx: AuthenticatedContext, projectId: string, userId: string, role: string): R<void>;
}
/** The one existing handler the indicator-owner responsibility delegates to. */
export interface SetupIndicatorOwners {
  idsByCode(ctx: AuthenticatedContext, projectId: string): R<Map<string, string>>;
  setOwner(ctx: AuthenticatedContext, indicatorId: string, userId: string): R<void>;
}
/** A person named in the wizard who had no account at launch, and what they are to be responsible for once they join. */
export interface PendingMember {
  id: string;
  tenantId: string;
  projectId: string;
  email: string;
  name: string;
  role: string;
  /** Who launched the project; the resolver acts with their authority when the person joins. */
  createdById: string;
  responsibilitiesJson: string;
  createdAt: Date;
}
export interface IPendingMemberRepository {
  create(m: PendingMember): R<void>;
  find(tenantId: string, projectId: string, email: string): R<PendingMember | null>;
  listByEmail(tenantId: string, email: string): R<PendingMember[]>;
  delete(id: string, tenantId: string): R<void>;
}
/** A context that acts as an existing user of the organisation (their real role), or null when they are gone. */
export interface SetupActingContext {
  asUser(tenantId: string, userId: string): Promise<AuthenticatedContext | null>;
}

// ---------- planned activities, budget lines and the starting dashboard (Phase 38.9d) ----------

/** The project's planned activities, to find one again by title and start day, and to give one a lead. */
export interface SetupPlanRows {
  rows(ctx: AuthenticatedContext, projectId: string): R<Array<{ id: string; title: string; plannedStart: string }>>;
  assignLead(ctx: AuthenticatedContext, itemId: string, userId: string): R<void>;
}
export interface SetupBudgetWriter {
  /** Codes of the budget lines an activity already has, so a repeat never adds a line twice. */
  existingCodes(ctx: AuthenticatedContext, itemId: string): R<Set<string>>;
  add(ctx: AuthenticatedContext, itemId: string, line: { code: string; category: string; description: string; currency: string; amount: string }): R<unknown>;
}
export interface SetupDashboardWriter {
  indicators(ctx: AuthenticatedContext, projectId: string): R<Array<{ id: string; code: string; name: string; type: string; isRate: boolean }>>;
  apply(ctx: AuthenticatedContext, templateId: string, input: { projectId: string; name: string; mapping: Record<string, string | null> }): R<{ dashboardId: string; chartsLeftOut: Array<{ title: string; missingRoles: string[] }> }>;
}

/** Starts the project: the one existing call that makes a draft project active. Safe to repeat. */
export interface SetupProjectActivator {
  activate(ctx: AuthenticatedContext, projectId: string): R<void>;
}
