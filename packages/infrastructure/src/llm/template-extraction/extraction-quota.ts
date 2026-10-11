import type { ILlmUsageRepository } from "@donordesk/application";

export const TEMPLATE_EXTRACTION_OPERATION = "TEMPLATE_EXTRACTION";
export const DEFAULT_TEMPLATE_EXTRACTION_DAILY_CALLS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Daily cap on DonorDesk-provider LLM calls spent on donor-template extraction
 * per tenant (a rolling 24 hours, counted from the `LlmRun` ledger). One
 * extraction makes an outline call plus a few guidance calls, so the default
 * allows roughly ten extractions a day. `TEMPLATE_EXTRACTION_DAILY_LLM_CALLS`
 * overrides it. Over the cap the caller uses the deterministic extractor.
 */
export class TemplateExtractionQuota {
  constructor(
    private readonly runs: ILlmUsageRepository,
    private readonly dailyCalls: number = resolveDailyCalls(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Fails open: if the ledger cannot be read, extraction is allowed. */
  async isExceeded(tenantId: string): Promise<boolean> {
    const since = new Date(this.now().getTime() - DAY_MS);
    const count = await this.runs.countRuns(tenantId, TEMPLATE_EXTRACTION_OPERATION, since);
    return count.ok && count.value >= this.dailyCalls;
  }
}

function resolveDailyCalls(): number {
  const parsed = Number.parseInt(process.env.TEMPLATE_EXTRACTION_DAILY_LLM_CALLS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TEMPLATE_EXTRACTION_DAILY_CALLS;
}
