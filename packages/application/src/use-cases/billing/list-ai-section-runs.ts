import type { Result, AiRunSummary, AiRunOutcome } from "@donordesk/domain";
import { summarizeAiRun, countAiRunOutcomes } from "@donordesk/domain";
import type { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ILlmUsageRepository } from "../../ports/billing.js";

export const AI_SECTION_RUN_LIMIT = 50;

export interface AiSectionRunsView {
  runs: AiRunSummary[];
  counts: Record<AiRunOutcome, number>;
}

/**
 * The last section runs of the AI writer for the tenant: what the AI wrote, what it wrote after a retry and what fell
 * back to a basic version, with the reason. Administrator-only (the route requires `org.manage`); no server log needed.
 */
export class ListAiSectionRunsHandler {
  constructor(private readonly runs: ILlmUsageRepository) {}

  async handle(ctx: AuthenticatedContext, limit: number = AI_SECTION_RUN_LIMIT): Promise<Result<AiSectionRunsView, DomainError>> {
    const found = await this.runs.listRecent(ctx.tenant.tenantId.toString(), "REPORT_SECTION", limit);
    if (!found.ok) return found;
    const runs = found.value.map(summarizeAiRun);
    return { ok: true, value: { runs, counts: countAiRunOutcomes(runs) } };
  }
}
