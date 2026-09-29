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

test("landing page Enterprise floor and signup plan options match PLAN_CATALOG", () => {
  const landing = readSource("src/app/page.tsx");
  assert.ok(
    landing.includes(`annual: "From ${usd(Math.floor(ENTERPRISE_PRICE_FLOOR_ANNUAL_USD / 1000))}k / year"`),
    `page.tsx Enterprise floor line must track ENTERPRISE_PRICE_FLOOR_ANNUAL_USD (${ENTERPRISE_PRICE_FLOOR_ANNUAL_USD})`,
  );
  // §3 pins the NGO ladder as its own decided prices ($79/$179 — "40%" is the
  // marketing rounding, not exact arithmetic: 129*0.6 = 77). Pin them here so
  // any change to the decided NGO ladder is a conscious edit in both places.
  assert.ok(
    landing.includes("NGO price: $79/mo (verified 40% discount)"),
    "page.tsx Team NGO price must stay in lockstep with the §3 decided NGO ladder ($79)",
  );
  assert.ok(
    landing.includes("NGO price: $179/mo (verified 40% discount)"),
    "page.tsx Growth NGO price must stay in lockstep with the §3 decided NGO ladder ($179)",
  );
  assert.ok(
    landing.includes("2 read-only viewers"),
    "page.tsx Starter viewer copy must match PLAN_CATALOG.STARTER.viewerSeats (2)",
  );

  const signup = readSource("src/app/signup/SignupForm.tsx");
  assert.ok(
    signup.includes(`${PLAN_CATALOG.STARTER.monthlyAiDraftCredits} AI drafts/month`),
    "SignupForm STARTER credit copy must match PLAN_CATALOG.STARTER.monthlyAiDraftCredits",
  );
  assert.ok(
    signup.includes(`${PLAN_CATALOG.TEAM.monthlyPriceUsd}/mo`) && signup.includes(`${PLAN_CATALOG.TEAM.monthlyAiDraftCredits} AI drafts/month`),
    "SignupForm Team copy must match PLAN_CATALOG.TEAM price and credits",
  );
  assert.ok(
    signup.includes(`${PLAN_CATALOG.GROWTH.monthlyPriceUsd}/mo`) && signup.includes(`${PLAN_CATALOG.GROWTH.monthlyAiDraftCredits} AI drafts/month`),
    "SignupForm Growth copy must match PLAN_CATALOG.GROWTH price and credits",
  );
});
