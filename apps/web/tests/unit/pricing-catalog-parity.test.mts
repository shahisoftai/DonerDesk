import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PLAN_CATALOG, ENTERPRISE_PRICE_FLOOR_ANNUAL_USD } from "@donordesk/domain";

/**
 * WS-A.7 coupling-gate guard (memorybank/imp/Phase22-tier-pricing.md §2.1):
 * the marketing pages hard-code price/credit copy rather than importing it
 * from the domain catalog, so nothing stops them drifting from what
 * `/v1/billing/summary` actually enforces. This test fails CI the moment
 * either marketing page's numbers stop matching `PLAN_CATALOG`, instead of
 * relying on a human remembering to keep them in sync.
 */

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)), "utf8");
}

function usd(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

test("landing page pricing copy matches PLAN_CATALOG (Team/Growth monthly + annual + AI credits)", () => {
  const source = readSource("src/app/page.tsx");
  const team = PLAN_CATALOG.TEAM;
  const growth = PLAN_CATALOG.GROWTH;

  assert.ok(source.includes(`monthly: "${usd(team.monthlyPriceUsd!)}"`), `page.tsx Team monthly price must match PLAN_CATALOG.TEAM.monthlyPriceUsd (${team.monthlyPriceUsd})`);
  assert.ok(source.includes(`annual: "${usd(team.annualPriceUsd!)}"`), `page.tsx Team annual price must match PLAN_CATALOG.TEAM.annualPriceUsd (${team.annualPriceUsd})`);
  assert.ok(source.includes(`monthly: "${usd(growth.monthlyPriceUsd!)}"`), `page.tsx Growth monthly price must match PLAN_CATALOG.GROWTH.monthlyPriceUsd (${growth.monthlyPriceUsd})`);
  assert.ok(source.includes(`annual: "${usd(growth.annualPriceUsd!)}"`), `page.tsx Growth annual price must match PLAN_CATALOG.GROWTH.annualPriceUsd (${growth.annualPriceUsd})`);

  assert.ok(
    source.includes(`${PLAN_CATALOG.STARTER.monthlyAiDraftCredits} successful AI report drafts / month`),
    `page.tsx Starter AI credit copy must match PLAN_CATALOG.STARTER.monthlyAiDraftCredits (${PLAN_CATALOG.STARTER.monthlyAiDraftCredits})`,
  );
  assert.ok(
    source.includes(`${team.monthlyAiDraftCredits} successful AI report drafts / month`),
    `page.tsx Team AI credit copy must match PLAN_CATALOG.TEAM.monthlyAiDraftCredits (${team.monthlyAiDraftCredits})`,
  );
  assert.ok(
    source.includes(`${growth.monthlyAiDraftCredits} successful AI report drafts / month`),
    `page.tsx Growth AI credit copy must match PLAN_CATALOG.GROWTH.monthlyAiDraftCredits (${growth.monthlyAiDraftCredits})`,
  );
});

test("/pricing page matches PLAN_CATALOG (prices, AI credits, Enterprise floor)", () => {
  const source = readSource("src/app/pricing/page.tsx");
  const team = PLAN_CATALOG.TEAM;
  const growth = PLAN_CATALOG.GROWTH;

  assert.ok(source.includes(`priceLine: "${usd(team.monthlyPriceUsd!)}"`), `pricing/page.tsx Team monthly price must match PLAN_CATALOG.TEAM.monthlyPriceUsd (${team.monthlyPriceUsd})`);
  assert.ok(source.includes(`priceLine: "${usd(growth.monthlyPriceUsd!)}"`), `pricing/page.tsx Growth monthly price must match PLAN_CATALOG.GROWTH.monthlyPriceUsd (${growth.monthlyPriceUsd})`);
  assert.ok(source.includes(`${usd(team.annualPriceUsd!)} / year`), `pricing/page.tsx Team annual price must match PLAN_CATALOG.TEAM.annualPriceUsd (${team.annualPriceUsd})`);
  assert.ok(source.includes(`${usd(growth.annualPriceUsd!)} / year`), `pricing/page.tsx Growth annual price must match PLAN_CATALOG.GROWTH.annualPriceUsd (${growth.annualPriceUsd})`);

  assert.ok(
    source.includes(`${team.monthlyAiDraftCredits} successful AI report drafts / month`),
    `pricing/page.tsx Team AI credit copy must match PLAN_CATALOG.TEAM.monthlyAiDraftCredits (${team.monthlyAiDraftCredits})`,
  );
  assert.ok(
    source.includes(`${growth.monthlyAiDraftCredits} successful AI report drafts / month`),
    `pricing/page.tsx Growth AI credit copy must match PLAN_CATALOG.GROWTH.monthlyAiDraftCredits (${growth.monthlyAiDraftCredits})`,
  );

  // Comparison table row: ["$0", "$<team>", "$<growth>", "Custom"]
  assert.ok(
    source.includes(`cells: ["$0", "${usd(team.monthlyPriceUsd!)}", "${usd(growth.monthlyPriceUsd!)}", "Custom"]`),
    "pricing/page.tsx comparison-table monthly-price row must match PLAN_CATALOG",
  );
  assert.ok(
    source.includes(`"${usd(team.annualPriceUsd!)}", "${usd(growth.annualPriceUsd!)}", "From ${usd(ENTERPRISE_PRICE_FLOOR_ANNUAL_USD)}/yr"`),
    `pricing/page.tsx comparison-table annual-price row must match PLAN_CATALOG + ENTERPRISE_PRICE_FLOOR_ANNUAL_USD (${ENTERPRISE_PRICE_FLOOR_ANNUAL_USD})`,
  );

  assert.ok(
    source.includes(`Annual contract from ${usd(ENTERPRISE_PRICE_FLOOR_ANNUAL_USD)} / year`),
    `pricing/page.tsx Enterprise floor copy must match ENTERPRISE_PRICE_FLOOR_ANNUAL_USD (${ENTERPRISE_PRICE_FLOOR_ANNUAL_USD})`,
  );
});
