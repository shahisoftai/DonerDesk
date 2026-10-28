import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PLAN_CATALOG, ENTERPRISE_PRICE_FLOOR_ANNUAL_USD } from "@donordesk/domain";
import { homePlans } from "../../src/components/site/plans.ts";

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

test("landing page plan cards are built from PLAN_CATALOG (Team/Growth monthly price, AI credits, NGO price)", () => {
  const source = readSource("src/app/page.tsx");
  assert.ok(source.includes("homePlans()"), "page.tsx must build its plan cards with homePlans(), which reads PLAN_CATALOG");
  const cards = homePlans();
  const team = PLAN_CATALOG.TEAM;
  const growth = PLAN_CATALOG.GROWTH;
  const byName = (n: string) => cards.find((c) => c.name === n)!;
  assert.equal(byName("Team").price, usd(team.monthlyPriceUsd!));
  assert.equal(byName("Growth").price, usd(growth.monthlyPriceUsd!));
  for (const [name, plan] of [["Starter", PLAN_CATALOG.STARTER], ["Team", team], ["Growth", growth]] as const) {
    assert.ok(byName(name).points.includes(`${plan.monthlyAiDraftCredits} successful AI report drafts / month`), `${name} card must state the catalogue's AI draft count (${plan.monthlyAiDraftCredits})`);
  }
  assert.ok(byName("Team").points.some((p) => p.includes(`$${(team.monthlyPriceUsd! * 0.75).toFixed(2)}`)), "Team NGO price must be the standard price less the 25% welcome discount");
  assert.ok(byName("Growth").points.some((p) => p.includes(`$${(growth.monthlyPriceUsd! * 0.75).toFixed(2)}`)), "Growth NGO price must be the standard price less the 25% welcome discount");
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

test("/pricing Free-card and comparison credits match PLAN_CATALOG (STARTER drift guard)", () => {
  // The audit-found bug: the Free card hard-coded "10 drafts" while the catalog
  // (and the page's own comparison row) said 5 — the landing-page STARTER check
  // above did not cover this file, so add explicit STARTER coverage here.
  const source = readSource("src/app/pricing/page.tsx");
  const starterCredits = PLAN_CATALOG.STARTER.monthlyAiDraftCredits;

  assert.ok(
    source.includes(`${starterCredits} successful AI report drafts every month`),
    `pricing/page.tsx Free-card AI credit copy must match PLAN_CATALOG.STARTER.monthlyAiDraftCredits (${starterCredits})`,
  );
  assert.ok(
    source.includes(`cells: ["${starterCredits}", "${PLAN_CATALOG.TEAM.monthlyAiDraftCredits}", "${PLAN_CATALOG.GROWTH.monthlyAiDraftCredits}", "Contracted pool"]`),
    "pricing/page.tsx comparison-table credits row must match PLAN_CATALOG for all tiers",
  );
  assert.ok(
    !source.includes("10 successful AI report drafts"),
    "pricing/page.tsx must not carry a hard-coded draft count that diverges from PLAN_CATALOG",
  );
});

test("landing page Enterprise floor tracks ENTERPRISE_PRICE_FLOOR_ANNUAL_USD and plan links keep their signup options", () => {
  const enterprise = homePlans().find((c) => c.name === "Enterprise")!;
  assert.ok(enterprise.per.includes(usd(ENTERPRISE_PRICE_FLOOR_ANNUAL_USD)), `Enterprise floor line must track ENTERPRISE_PRICE_FLOOR_ANNUAL_USD (${ENTERPRISE_PRICE_FLOOR_ANNUAL_USD})`);
  const hrefs = homePlans().map((c) => c.href);
  assert.deepEqual(hrefs, ["/signup", "/signup?plan=team", "/signup?plan=growth", "/contact-sales"]);
});
