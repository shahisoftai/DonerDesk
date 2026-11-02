import type { SetupAreaKey, Result, SetupDraft } from "@donordesk/domain";
import { DomainError, LAUNCH_STEPS, SETUP_AREA_KEYS, SETUP_REQUIREMENTS, canLaunch, evaluateRequirements, notWrittenAtLaunch, projectInputFromDraft, proposalForLaunch } from "@donordesk/domain";
import { CreateProjectSchema } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IOrganizationRepository } from "../../ports/identity.js";
import type { ISetupProposalRepository, ISetupRunRepository } from "../../ports/project-setup.js";
import type { ISetupLaunchStep, SetupUserDirectory } from "../../ports/project-setup-launch.js";
import type { AppliedArea, ApplySetupInput, ApplySetupResult } from "./apply-proposal.js";
import { draftOf } from "./draft-view.js";
import { assertProposalAccess } from "./proposal-state.js";

/** What launching calls to create the project and its parts: the existing apply, which is already resumable. */
export interface SetupProposalApplier {
  handle(ctx: AuthenticatedContext, id: string, input: ApplySetupInput): Promise<Result<ApplySetupResult, DomainError>>;
}

export interface LaunchStepReport {
  key: string;
  label: string;
  status: "DONE" | "ALREADY_DONE" | "FAILED" | "NOT_RUN";
  done: number;
  notes: string[];
  error?: string;
}

export interface LaunchReport {
  projectId: string;
  status: "LAUNCHED" | "PARTIAL";
  areas: AppliedArea[];
  steps: LaunchStepReport[];
  /** What the draft holds that launching did not write, in words (never silently dropped). */
  notWritten: string[];
}

const ALL_AREAS = Object.fromEntries(SETUP_AREA_KEYS.map((a) => [a, true])) as Record<SetupAreaKey, boolean>;

/**
 * Launches the project (Phase 38.9b). The server decides, not the page: it re-reads the stored draft, checks every requirement
 * and the sign-off again, and refuses if anything is open or the sign-off is stale. Then it creates the project and its parts
 * through the existing apply, and runs the wizard's own steps in order. Each step is recorded; launching again after a failure
 * skips what finished and carries on from the step that failed, so nothing is created twice. Only existing handlers write.
 */
export class LaunchProjectHandler {
  constructor(
    private readonly proposals: ISetupProposalRepository,
    private readonly runs: ISetupRunRepository,
    private readonly applier: SetupProposalApplier,
    private readonly orgs: IOrganizationRepository,
    private readonly users: SetupUserDirectory,
    private readonly steps: ReadonlyArray<ISetupLaunchStep>,
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
    private readonly ids: IIdGenerator,
  ) {}

  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<LaunchReport, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const found = await this.proposals.findById(id, tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("Setup proposal", id) };
    const access = assertProposalAccess(ctx, found.value, this.clock.now());
    if (!access.ok) return access;
    if (found.value.createdById !== ctx.tenant.userId) return { ok: false, error: DomainError.forbidden("Only the person who started this setup can start the project") };
    if (found.value.status !== "READY" && found.value.status !== "PARTIAL") {
      return { ok: false, error: DomainError.conflict("This setup cannot be started now: it is still being read, is being started, or has already been started.") };
    }
    const draft = draftOf(found.value);
    // Once a launch has begun, applying has rewritten the stored proposal itself (codes, links), so the fingerprint no longer
    // matches what was signed. A resumed launch still needs the sign-off and every requirement, but not the fingerprint. A launch
    // has begun when the project exists or a launch run was recorded (a first attempt can fail before the project is made).
    const before = await this.runs.listByProposal(id, tenantId);
    if (!before.ok) return before;
    const resumed = Boolean(found.value.appliedProjectId) || before.value.some((r) => r.kind === "LAUNCH");
    const blockers = canLaunch(evaluateRequirements(draft, SETUP_REQUIREMENTS), draft).blockers.filter((b) => !(resumed && b.kind === "SIGN_OFF_STALE"));
    if (blockers.length > 0) return { ok: false, error: DomainError.validation(this.refusal(blockers)) };

    const org = await this.orgs.findByTenant(tenantId);
    if (!org.ok) return org;
    const emails = draft.extras.team.flatMap((p) => (p.email ? [p.email.trim().toLowerCase()] : []));
    const known = emails.length > 0 ? await this.users.idsByEmail(ctx, emails) : { ok: true as const, value: new Map<string, string>() };
    if (!known.ok) return known;
    const project = projectInputFromDraft(draft, { organisationName: org.value?.name ?? "", userId: ctx.tenant.userId, userIdByEmail: known.value });
    if (!project.ok) return { ok: false, error: DomainError.validation(project.reason) };
    const parsed = CreateProjectSchema.safeParse(project.input);
    if (!parsed.success) return { ok: false, error: DomainError.validation(parsed.error.issues[0]?.message ?? "The project details are not complete.") };

    const beginId = this.ids.generate();
    await this.runs.start({ id: beginId, tenantId, proposalId: id, kind: "LAUNCH", status: "RUNNING", detail: { step: "BEGIN" }, startedAt: this.clock.now() });
    const applied = await this.applier.handle(ctx, id, { project: parsed.data, areas: ALL_AREAS, proposal: proposalForLaunch(draft) });
    if (!applied.ok) {
      await this.runs.fail(beginId, tenantId, { step: "BEGIN", reason: applied.error.message }, this.clock.now());
      return applied;
    }
    await this.runs.finish(beginId, tenantId, { step: "BEGIN" }, this.clock.now());
    const projectId = applied.value.projectId;
    const reports: LaunchStepReport[] = LAUNCH_STEPS.map((s) => ({ key: s.key, label: s.label, status: "NOT_RUN", done: 0, notes: [] }));
    if (applied.value.status !== "APPLIED") return { ok: true, value: this.report(projectId, "PARTIAL", applied.value.areas, reports, draft) };

    const previous = await this.runs.listByProposal(id, tenantId);
    if (!previous.ok) return previous;
    const finished = new Set(previous.value.filter((r) => r.kind === "LAUNCH" && r.status === "FINISHED" && r.detail.step !== "BEGIN").map((r) => String(r.detail.step)));
    const byKey = new Map(this.steps.map((s) => [s.key, s] as const));
    let failed = false;
    for (const report of reports) {
      const step = byKey.get(report.key);
      if (failed || !step) { if (!step && !failed) { report.status = "FAILED"; report.error = "This step is not available."; failed = true; } continue; }
      if (finished.has(report.key)) { report.status = "ALREADY_DONE"; continue; }
      const runId = this.ids.generate();
      await this.runs.start({ id: runId, tenantId, proposalId: id, kind: "LAUNCH", status: "RUNNING", detail: { step: report.key }, startedAt: this.clock.now() });
      const outcome = await step.run(ctx, projectId, draft);
      if (!outcome.ok) {
        failed = true;
        report.status = "FAILED";
        report.error = outcome.error.message;
        await this.runs.fail(runId, tenantId, { step: report.key, reason: outcome.error.message }, this.clock.now());
        continue;
      }
      report.status = "DONE";
      report.done = outcome.value.done;
      report.notes = outcome.value.notes;
      await this.runs.finish(runId, tenantId, { step: report.key, done: outcome.value.done, notes: outcome.value.notes.length }, this.clock.now());
    }

    // The apply marked the proposal APPLIED; a wizard step that failed puts it back so launching can be tried again.
    if (failed) {
      const latest = await this.proposals.findById(id, tenantId);
      if (latest.ok && latest.value) await this.proposals.update({ ...latest.value, status: "PARTIAL" });
    }
    await this.audit.record({
      tenantId, actorId: ctx.tenant.userId, eventType: failed ? "setup.launch.partial" : "setup.launch.finished", entityType: "project_setup_proposal", entityId: id,
      newValue: JSON.stringify({ projectId, steps: reports.map((r) => `${r.key}:${r.status}`) }),
    });
    return { ok: true, value: this.report(projectId, failed ? "PARTIAL" : "LAUNCHED", applied.value.areas, reports, draft) };
  }

  private report(projectId: string, status: LaunchReport["status"], areas: AppliedArea[], steps: LaunchStepReport[], draft: SetupDraft): LaunchReport {
    return { projectId, status, areas, steps, notWritten: notWrittenAtLaunch(draft) };
  }

  private refusal(blockers: ReadonlyArray<{ kind: string; count?: number }>): string {
    const b = blockers[0]!;
    if (b.kind === "OPEN_REQUIREMENTS") return `${b.count} thing${b.count === 1 ? " is" : "s are"} still to answer. Finish those, then sign off and start the project.`;
    if (b.kind === "SIGN_OFF_STALE") return "Something changed after you signed off. Look at the last slide and sign off again.";
    return "Sign off on the last slide before starting the project.";
  }
}
