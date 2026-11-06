import type { Result, SetupAreaKey, TenantId } from "@donordesk/domain";
import { DomainError, SETUP_AREA_KEYS, SETUP_AREAS, checkProposal, estimateCostUsd, isPriced } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IClock } from "../../ports/core.js";
import type { ISetupProposalRepository, ISetupRunRepository, StoredSetupProposal, StoredSetupRun } from "../../ports/project-setup.js";
import { STALE_AREA_RUN_MS, assertProposalAccess } from "./proposal-state.js";

export interface SetupAreaCounts {
  area: SetupAreaKey;
  labelKey: string;
  /** The proposal fields the area owns, so a screen lists its items without a table of its own. */
  fields: readonly string[];
  /** Everything proposed for the area, whatever the person has decided. */
  items: number;
  /** Items that will be applied (accepted, or written by the person). */
  accepted: number;
}

/** What reading this document asked of the AI service. `costUsd` is null when the model has no price on file (never a made-up number). */
export interface SetupUsageSummary {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
}

export interface SetupProposalView {
  usage: SetupUsageSummary;
  proposal: StoredSetupProposal;
  problems: ReturnType<typeof checkProposal>;
  runs: StoredSetupRun[];
  areas: SetupAreaCounts[];
}

/** Read model for one proposal: the stored proposal, its runs, the current cross-area problems and per-area counts. */
export class GetSetupProposalHandler {
  constructor(
    private readonly proposals: ISetupProposalRepository,
    private readonly runs: ISetupRunRepository,
    private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<SetupProposalView, DomainError>> {
    const stored = await this.proposals.findById(id, ctx.tenant.tenantId);
    if (!stored.ok) return stored;
    if (!stored.value) return { ok: false, error: DomainError.notFound("Setup proposal", id) };
    const access = assertProposalAccess(ctx, stored.value, this.clock.now());
    if (!access.ok) return access;
    const listed = await this.runs.listByProposal(id, ctx.tenant.tenantId);
    if (!listed.ok) return listed;
    const proposal = stored.value;
    const runs = { ok: true as const, value: await this.settleStaleRuns(listed.value, ctx.tenant.tenantId) };
    return {
      ok: true,
      value: {
        usage: usageOf(runs.value, proposal.model),
        proposal,
        problems: checkProposal(proposal.proposal),
        runs: runs.value,
        areas: SETUP_AREA_KEYS.map((area) => ({
          area,
          labelKey: SETUP_AREAS[area].labelKey,
          fields: SETUP_AREAS[area].fields,
          items: SETUP_AREAS[area].items(proposal.proposal),
          accepted: SETUP_AREAS[area].accepted(proposal.proposal),
        })),
      },
    };
  }
  /** A part's run that has been "running" far longer than any call can last is marked failed, so the screen never waits on it. */
  private async settleStaleRuns(runs: StoredSetupRun[], tenantId: TenantId): Promise<StoredSetupRun[]> {
    const now = this.clock.now();
    const out: StoredSetupRun[] = [];
    for (const run of runs) {
      const stale = run.status === "RUNNING" && run.area !== undefined && now.getTime() - run.startedAt.getTime() > STALE_AREA_RUN_MS;
      if (!stale) { out.push(run); continue; }
      const detail = { reason: "This part stopped before it finished. Read it again." };
      await this.runs.fail(run.id, tenantId, detail, now);
      out.push({ ...run, status: "FAILED", detail, finishedAt: now });
    }
    return out;
  }
}

/** The tokens every reading of this document used (the first read and any re-read of a part), priced when the model is. */
export function usageOf(runs: ReadonlyArray<StoredSetupRun>, model: string | undefined): SetupUsageSummary {
  const sum = { calls: 0, inputTokens: 0, outputTokens: 0 };
  // Area runs carry their own usage; the whole-document run repeats the total, so it is not added again.
  for (const run of runs) {
    if (run.kind !== "EXTRACT" || run.area === undefined) continue;
    for (const key of ["calls", "inputTokens", "outputTokens"] as const) {
      const n = run.detail[key];
      if (typeof n === "number") sum[key] += n;
    }
  }
  const priced = model !== undefined && isPriced(model) && sum.calls > 0;
  return { ...sum, costUsd: priced ? estimateCostUsd(model, sum.inputTokens, sum.outputTokens) : null };
}
