// Phase 38.8: the Budget and finance slide's pure rules.
import test from "node:test";
import assert from "node:assert/strict";
import { SUPPORT, activityChoices, currencyNote, money, placementLabel, suggestedCurrency, suggestionFor, targetLabel } from "../../src/features/project-setup/pcw/domain/finance-view.ts";
import { SUPPORT_LINE } from "@donordesk/domain";
import { PCW_COPY } from "../../src/features/project-setup/pcw/copy.ts";
import { findRawTokens } from "@donordesk/domain/core/copy-lint.js";

const view = (extra = {}) => ({
  plan: [{ planKey: "code:1.1", value: { title: "Drill wells" } }, { planKey: "new:2", value: { title: null } }],
  funding: [{ value: { currency: "USD" } }, { value: { currency: "EUR" } }, { value: { currency: "USD" } }],
  budgetSuggestions: [{ id: "BUDGET:b1:code:1.1", budgetKey: "b1", target: "code:1.1", reason: "r" }],
  financeSummary: { funding: [{ currency: "USD", total: 10 }], budget: [{ currency: "USD", total: 10 }], differences: [], statedTotalMismatch: false, unreadable: 0 },
  extras: { finance: { budgetPlan: { b1: "code:1.1", b2: "SUPPORT" } } },
  ...extra,
}) as never;

test("the support marker is the one the domain uses", () => {
  assert.equal(SUPPORT, SUPPORT_LINE);
});

test("amounts read the same in every browser and keep cents only when there are some", () => {
  assert.equal(money(1234567), "1,234,567");
  assert.equal(money(1234567.5), "1,234,567.50");
  assert.equal(money(0), "0");
});

test("a budget line shows where it was placed in words, and nothing when it has not been placed", () => {
  assert.equal(placementLabel(view(), "b1", "Support"), "Drill wells");
  assert.equal(placementLabel(view(), "b2", "Support"), "Support");
  assert.equal(placementLabel(view(), "b9", "Support"), "");
});

test("activities are offered by their addresses, with a fallback name", () => {
  assert.deepEqual(activityChoices(view()), [{ key: "code:1.1", label: "Drill wells" }, { key: "new:2", label: "new:2" }]);
});

test("the reporting currency offered is the one funding is most often in, never a guess from nothing", () => {
  assert.equal(suggestedCurrency(view()), "USD");
  assert.equal(suggestedCurrency(view({ funding: [] })), "");
});

test("a note about currencies is shown only when they differ or there are several", () => {
  assert.equal(currencyNote(view()), false);
  assert.equal(currencyNote(view({ financeSummary: { funding: [{ currency: "USD", total: 1 }], budget: [{ currency: "EUR", total: 1 }], differences: [], statedTotalMismatch: false, unreadable: 0 } })), true);
  assert.equal(currencyNote(view({ financeSummary: { funding: [], budget: [], differences: [], statedTotalMismatch: false, unreadable: 0 } })), false);
});

test("a suggestion is found by its line and named by its target", () => {
  assert.equal(suggestionFor(view(), "b1")?.target, "code:1.1");
  assert.equal(suggestionFor(view(), "zz"), undefined);
  assert.equal(targetLabel(view(), "code:1.1", "Support"), "Drill wells");
  assert.equal(targetLabel(view(), SUPPORT, "Support"), "Support");
});

test("the words on this slide are plain language", () => {
  const c = PCW_COPY.finance;
  const texts = [...Object.values(c).filter((v): v is string => typeof v === "string"), c.useAll(3), c.unreadable(1), c.unreadable(2), c.differs("USD", "10", "5")];
  for (const t of texts) assert.deepEqual(findRawTokens(t), [], t);
});
