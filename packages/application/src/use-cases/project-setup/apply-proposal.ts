import type { CreateProjectInput } from "@donordesk/contracts";
import type { ApplyPlan, Result, SetupAreaKey } from "@donordesk/domain";
import { DomainError, blockingProblems, checkProposal, planApply, proposeCodes } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import { driveFileIdsOf, type ISetupAreaApplier, type ISetupDocumentStore, type ISetupProposalRepository, type ISetupRunRepository } from "../../ports/project-setup.js";
import type { SetupProjectCreator } from "../../ports/project-setup-apply.js";
import { appliersByArea } from "./apply-registry.js";
import { assertProposalAccess } from "./proposal-state.js";

export interface ApplySetupInput {
  /** The person's completed project form, started from the preview's draft. */
  project: CreateProjectInput;
  areas: Readonly<Partial<Record<SetupAreaKey, boolean>>>;
}

export interface AppliedArea {
  area: SetupAreaKey;
  status: "APPLIED" | "ALREADY_APPLIED" | "FAILED" | "NOT_RUN";
  created: number;
  skipped: number;
  notes: string[];
  error?: string;
}

/** What became of the source document: now in the project's folder in the organisation's Drive, or still safe where it was put. */
export interface AppliedDocument {
  name: string;
  folder?: string;
  link?: string;
  /** A plain sentence when the move did not happen (the document is untouched and the move is tried again on the next apply). */
  error?: string;
}

export interface ApplySetupResult {
  projectId: string;
  status: "APPLIED" | "PARTIAL";
  areas: AppliedArea[];
  skipped: ApplyPlan["skipped"];
  /** One entry per source document (a setup may use several), in the order they were added. */
  documents?: AppliedDocument[];
}

const APPLYABLE = new Set(["READY", "PARTIAL"]);

/**
 * Applies a reviewed proposal (Phase 36.3): creates the project from the person's form, then runs each area's applier in
 * the plan's order. It stops at the first area that fails: earlier areas stay applied, and applying again resumes after
 * the last finished one (finished areas are read from the apply runs). The proposal is claimed with its version, so two
 * tabs cannot apply it at once. Only appliers write, and only through the existing handlers.
 */
export class ApplySetupProposalHandler {
  constructor(
    private readonly proposals: ISetupProposalRepository,
    private readonly runs: ISetupRunRepository,
    private readonly appliers: ReadonlyArray<ISetupAreaApplier>,
    private readonly projects: SetupProjectCreator,
    private readonly documents: ISetupDocumentStore,
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
    private readonly ids: IIdGenerator,
  ) {}

  async handle(ctx: AuthenticatedContext, id: string, input: ApplySetupInput): Promise<Result<ApplySetupResult, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const found = await this.proposals.findById(id, tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("Setup proposal", id) };
    const access = assertProposalAccess(ctx, found.value, this.clock.now());
    if (!access.ok) return access;
    if (!APPLYABLE.has(found.value.status)) {
      return { ok: false, error: DomainError.conflict("This proposal cannot be applied now: it is still being read, is being applied, or is already applied.") };
    }
    const proposal = proposeCodes(found.value.proposal);
    const blocking = blockingProblems(checkProposal(proposal));
    if (blocking.length > 0) {
      return { ok: false, error: DomainError.validation(`Fix ${blocking.length} problem(s) in the review before applying.`) };
    }
    const plan = planApply(proposal, input.areas);
    if (!plan.steps.some((s) => s.order === 1)) {
      return { ok: false, error: DomainError.validation("Accept the project facts: the project is created from them.") };
    }
    const byArea = appliersByArea(this.appliers);
    const missing = plan.steps.find((s) => !byArea.has(s.area));
    if (missing) return { ok: false, error: DomainError.validation(`No applier is registered for ${missing.area}.`) };

    const claim = { ...found.value, status: "APPLYING" as const, proposal };
    const claimed = await this.proposals.update(claim, found.value.updatedAt);
    if (!claimed.ok) return claimed;
    if (!claimed.value) return { ok: false, error: DomainError.conflict("Someone changed or started applying this proposal. Reload it.") };

    let projectId = found.value.appliedProjectId;
    if (!projectId) {
      const created = await this.projects.handle(ctx, input.project);
      if (!created.ok) {
        await this.proposals.update({ ...claim, status: found.value.status });
        return created;
      }
      projectId = created.value.id;
      await this.proposals.update({ ...claim, appliedProjectId: projectId });
    }

    // The source documents go into the new project's own folder in the organisation's Drive. They never fail the apply: each
    // file is safe in staging, and finishing the apply again retries the move.
    const documents = await this.moveDocuments(ctx, id, found.value.sourceStorageKey, found.value.sourceName, projectId);

    const previous = await this.runs.listByProposal(id, tenantId);
    if (!previous.ok) return previous;
    const done = new Set(previous.value.filter((r) => r.kind === "APPLY" && r.status === "FINISHED" && r.area).map((r) => r.area!));
    const areas: AppliedArea[] = [];
    let failed = false;
    for (const step of plan.steps) {
      if (failed) {
        areas.push({ area: step.area, status: "NOT_RUN", created: 0, skipped: 0, notes: [] });
        continue;
      }
      if (done.has(step.area)) {
        areas.push({ area: step.area, status: "ALREADY_APPLIED", created: 0, skipped: 0, notes: [] });
        continue;
      }
      const runId = this.ids.generate();
      await this.runs.start({ id: runId, tenantId, proposalId: id, kind: "APPLY", area: step.area, status: "RUNNING", detail: {}, startedAt: this.clock.now() });
      const outcome = await byArea.get(step.area)!.apply({ auth: ctx, proposalId: id }, projectId, proposal);
      if (!outcome.ok) {
        failed = true;
        await this.runs.fail(runId, tenantId, { reason: outcome.error.message }, this.clock.now());
        areas.push({ area: step.area, status: "FAILED", created: 0, skipped: 0, notes: [], error: outcome.error.message });
        continue;
      }
      await this.runs.finish(runId, tenantId, { created: outcome.value.created, skipped: outcome.value.skipped }, this.clock.now());
      await this.audit.record({
        tenantId, actorId: ctx.tenant.userId, eventType: "setup.apply.area", entityType: "project_setup_proposal", entityId: id,
        newValue: JSON.stringify({ area: step.area, projectId, created: outcome.value.created, skipped: outcome.value.skipped }),
      });
      areas.push({ area: step.area, status: "APPLIED", ...outcome.value });
    }

    const status = failed ? "PARTIAL" : "APPLIED";
    await this.proposals.update({ ...claim, appliedProjectId: projectId, status });
    await this.audit.record({
      tenantId, actorId: ctx.tenant.userId, eventType: failed ? "setup.apply.partial" : "setup.apply.finished", entityType: "project_setup_proposal", entityId: id,
      newValue: JSON.stringify({ projectId, areas: areas.map((a) => `${a.area}:${a.status}`) }),
    });
    return { ok: true, value: { projectId, status, areas, skipped: plan.skipped, ...(documents.length > 0 ? { documents } : {}) } };
  }

  private async moveDocuments(ctx: AuthenticatedContext, proposalId: string, storageKey: string, fallbackName: string, projectId: string): Promise<AppliedDocument[]> {
    const out: AppliedDocument[] = [];
    // A proposal made before documents moved to the organisation's Drive has no Drive files to move.
    for (const fileId of driveFileIdsOf(storageKey)) {
      const moved = await this.documents.moveToProject(ctx.tenant.tenantId, fileId, projectId);
      await this.audit.record({
        tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: moved.ok ? "setup.apply.document" : "setup.apply.document_pending",
        entityType: "project_setup_proposal", entityId: proposalId, newValue: JSON.stringify({ projectId, moved: moved.ok }),
      });
      if (!moved.ok) {
        out.push({ name: fallbackName, error: "Your document could not be moved into the project's folder yet. It is safe in your Google Drive, and it moves when you finish creating." });
        continue;
      }
      out.push({ name: moved.value.name ?? fallbackName, folder: moved.value.folder, ...(moved.value.webLink ? { link: moved.value.webLink } : {}) });
    }
    return out;
  }
}
