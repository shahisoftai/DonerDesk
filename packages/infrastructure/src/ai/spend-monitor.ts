import type { ILlmUsageRepository, ILogger } from "@donordesk/application";

/** Month-to-date spend per organisation (US dollars) above which the operator is told. 0 turns the check off. */
export function spendAlertThresholdUsd(raw = process.env.AI_MONTHLY_COST_ALERT_USD): number {
  const value = raw === undefined || raw === "" ? 25 : Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 25;
}

/**
 * Logs `ai.spend_alert` (error level, so it reaches the alert pipeline) for every organisation whose estimated AI spend
 * this calendar month (UTC) is over the threshold. Plan limits bound volume, never spend; this is what notices a runaway
 * loop or a price change. Needs the admin connection: it reads across organisations.
 */
export async function checkAiSpend(runs: ILlmUsageRepository, logger: ILogger, now: Date = new Date(), thresholdUsd = spendAlertThresholdUsd()): Promise<number> {
  if (thresholdUsd <= 0) return 0;
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const found = await runs.costByTenantSince(monthStart);
  if (!found.ok) return 0;
  const over = found.value.filter((row) => row.costUsd > thresholdUsd);
  for (const row of over) {
    logger.error("ai.spend_alert", { tenantId: row.tenantId, monthCostUsd: Number(row.costUsd.toFixed(2)), calls: row.calls, thresholdUsd });
  }
  return over.length;
}
