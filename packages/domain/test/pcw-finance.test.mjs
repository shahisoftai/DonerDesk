import test from "node:test";
import assert from "node:assert/strict";
import {
  FINANCE_OPERATIONS, applyFinanceOperation, financeSummary, suggestBudgetLinks, SUPPORT_WORDS, applyOperation,
  emptyDraft, emptyProposal, evaluateRequirements, SETUP_REQUIREMENTS, gapInbox, budgetKeyOf, planKeyOf, SUPPORT_LINE,
} from "../dist/index.js";

const run = (p, op) => { const r = applyFinanceOperation(p, op); assert.equal(r.ok, true, r.reason); return r.proposal; };
const refused = (p, op) => { const r = applyFinanceOperation(p, op); assert.equal(r.ok, false); return r.reason; };
const item = (value) => ({ value, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" });

test("every finance operation kind has a handler", () => {
  assert.deepEqual(Object.keys(FINANCE_OPERATIONS).sort(), ["ADD_BUDGET", "ADD_FUNDING", "EDIT_BUDGET", "EDIT_FUNDING"]);
});

test("funding is the person's own, amounts are plain digits, and a currency is three letters", () => {
  const p = run(emptyProposal(), { kind: "ADD_FUNDING", sourceName: " EU ", amount: "1,250,000.50", currency: "eur" });
  assert.deepEqual(p.funding[0].value, { sourceName: "EU", amount: "1250000.50", currency: "EUR" });
  assert.equal(p.funding[0].status, "EDITED");
  assert.match(refused(p, { kind: "ADD_FUNDING", sourceName: "EU", amount: "1,250", currency: "EUR" }), /more than one way/);
  assert.match(refused(p, { kind: "ADD_FUNDING", sourceName: "EU", amount: "0", currency: "EUR" }), /more than zero/);
  assert.match(refused(p, { kind: "ADD_FUNDING", sourceName: "EU", amount: "abc", currency: "EUR" }), /more than one way/);
  assert.match(refused(p, { kind: "ADD_FUNDING", sourceName: "EU", amount: "5", currency: "EURO" }), /three letters/);
  assert.match(refused(p, { kind: "ADD_FUNDING", sourceName: " ", amount: "5", currency: "EUR" }), /who the funding/);
  assert.match(refused(p, { kind: "ADD_FUNDING", sourceName: "eu", amount: "1250000.5", currency: "EUR" }), /already on the list/);
});

test("editing funding validates the same way and keeps the rest", () => {
  let p = run(emptyProposal(), { kind: "ADD_FUNDING", sourceName: "EU", amount: "100", currency: "EUR" });
  p = run(p, { kind: "EDIT_FUNDING", path: "funding.0", patch: { amount: "250" } });
  assert.deepEqual(p.funding[0].value, { sourceName: "EU", amount: "250", currency: "EUR" });
  assert.match(refused(p, { kind: "EDIT_FUNDING", path: "funding.0", patch: { currency: "x" } }), /three letters/);
  assert.match(refused(p, { kind: "EDIT_FUNDING", path: "funding.4", patch: {} }), /not in the project/);
});

test("a budget line gets its own address, and editing keeps the address so its activity survives", () => {
  let p = run(emptyProposal(), { kind: "ADD_BUDGET", category: "Wells", amount: "5000", currency: "EUR" });
  const key = budgetKeyOf(p.budget[0].value);
  assert.equal(key, "new-budget:1");
  p = run(p, { kind: "ADD_BUDGET", category: "Training", amount: "2000", currency: "EUR" });
  assert.notEqual(budgetKeyOf(p.budget[1].value), key);
  const edited = run(p, { kind: "EDIT_BUDGET", path: "budget.0", patch: { category: "Boreholes", amount: "6000" } });
  assert.equal(budgetKeyOf(edited.budget[0].value), key);
  const docRow = { ...emptyProposal(), budget: [item({ category: "Staff", amount: "100", currency: "USD", logframeCode: null, kind: "LINE", ref: "F1" })] };
  const before = budgetKeyOf(docRow.budget[0].value);
  assert.equal(before, "ref:F1");
  assert.equal(budgetKeyOf(run(docRow, { kind: "EDIT_BUDGET", path: "budget.0", patch: { category: "Salaries", ref: "F9" } }).budget[0].value), before, "a document row keeps the address it had");
});

test("the summary adds each currency on its own, uses categories before details, and counts what it could not read", () => {
  const d = emptyDraft();
  d.proposal.funding = [item({ sourceName: "A", amount: "1000", currency: "USD" }), item({ sourceName: "B", amount: "500", currency: "USD" }), item({ sourceName: "C", amount: "200", currency: "EUR" }), item({ sourceName: "D", amount: "1,250", currency: "USD" })];
  d.proposal.budget = [
    item({ category: "Wells", amount: "900", currency: "USD", logframeCode: null, kind: "LINE" }),
    item({ category: "Detail row", amount: "100", currency: "USD", logframeCode: null, kind: "DETAIL", ref: "F1.1" }),
  ];
  const s = financeSummary(d);
  assert.deepEqual(s.funding, [{ currency: "EUR", total: 200 }, { currency: "USD", total: 1500 }]);
  assert.deepEqual(s.budget, [{ currency: "USD", total: 900 }], "the detail row is not counted on top of the categories");
  assert.deepEqual(s.differences, [{ currency: "USD", funding: 1500, budget: 900 }]);
  assert.equal(s.unreadable, 1, "1,250 is ambiguous so it is left out and counted, never added as 0");
});

test("details are used when there are no categories; nothing is compared across currencies", () => {
  const d = emptyDraft();
  d.proposal.funding = [item({ sourceName: "A", amount: "1000", currency: "USD" })];
  d.proposal.budget = [item({ category: "x", amount: "400", currency: "EUR", logframeCode: null, kind: "DETAIL", ref: "F1.1" }), item({ category: "y", amount: "600", currency: "EUR", logframeCode: null, kind: "DETAIL", ref: "F1.2" })];
  const s = financeSummary(d);
  assert.deepEqual(s.budget, [{ currency: "EUR", total: 1000 }]);
  assert.deepEqual(s.differences, [], "dollars and euros are never set against each other");
});

test("a budget that matches its funding agrees; a stated grand total that does not add up is flagged", () => {
  const d = emptyDraft();
  d.proposal.funding = [item({ sourceName: "A", amount: "1000", currency: "USD" })];
  d.proposal.budget = [item({ category: "Wells", amount: "1000", currency: "USD", logframeCode: null, kind: "LINE" })];
  assert.deepEqual([financeSummary(d).differences, financeSummary(d).statedTotalMismatch], [[], false]);
  d.proposal.budget.push(item({ category: "Total project cost", amount: "1200", currency: "USD", logframeCode: null, kind: "TOTAL" }));
  assert.equal(financeSummary(d).statedTotalMismatch, true);
});

// ---------- budget suggestions ----------

function planDraft() {
  const d = emptyDraft();
  d.proposal.plan = [
    item({ title: "Drill water wells", logframeCode: "A1", start: null, end: null, location: null, lead: null, planCode: "1.1" }),
    item({ title: "Train health workers", logframeCode: "A2", start: null, end: null, location: null, lead: null, planCode: "1.2" }),
  ];
  d.proposal.budget = [
    item({ category: "Water wells construction", amount: "5000", currency: "USD", logframeCode: null, kind: "LINE", key: "b1" }),
    item({ category: "Salaries", amount: "3000", currency: "USD", logframeCode: null, kind: "LINE", key: "b2" }),
    item({ category: "Vehicles", amount: "800", currency: "USD", logframeCode: null, kind: "LINE", key: "b3" }),
    item({ category: "Training materials", amount: "500", currency: "USD", logframeCode: "A2", kind: "LINE", key: "b4" }),
  ];
  return d;
}

test("budget lines are placed by their result link, then by words, and support costs by the table of support words", () => {
  const by = Object.fromEntries(suggestBudgetLinks(planDraft()).map((s) => [s.budgetKey, s]));
  assert.equal(by.b1.target, "code:1.1");
  assert.match(by.b1.reason, /shares words with “Drill water wells”/);
  assert.equal(by.b2.target, SUPPORT_LINE);
  assert.match(by.b2.reason, /run the whole project/);
  assert.equal(by.b3, undefined, "a line that matches nothing gets nothing: no guess");
  assert.equal(by.b4.target, "code:1.2");
  assert.match(by.b4.reason, /ties this line to activity A2/);
  assert.ok(SUPPORT_WORDS.includes("salaries"));
});

test("budget suggestions are deterministic, never repeat what is placed or rejected, and never change the draft", () => {
  const d = planDraft();
  const before = JSON.stringify(d);
  const first = suggestBudgetLinks(d);
  assert.deepEqual(suggestBudgetLinks(d), first);
  assert.equal(JSON.stringify(d), before);
  assert.ok(first.every((s) => s.id === `BUDGET:${s.budgetKey}:${s.target}` && s.reason.length > 10));
  d.extras.rejectedSuggestions = [first[0].id];
  d.extras.finance.budgetPlan.b4 = SUPPORT_LINE;
  assert.ok(!suggestBudgetLinks(d).some((s) => s.budgetKey === "b4" || s.id === first[0].id));
});

test("a tie between two activities gives no suggestion", () => {
  const d = emptyDraft();
  d.proposal.plan = [item({ title: "Community water meetings", logframeCode: null, start: null, end: null, location: null, lead: null, planCode: "1" }), item({ title: "Community water visits", logframeCode: null, start: null, end: null, location: null, lead: null, planCode: "2" })];
  d.proposal.budget = [item({ category: "Community water", amount: "10", currency: "USD", logframeCode: null, kind: "LINE", key: "t" })];
  assert.deepEqual(suggestBudgetLinks(d), []);
});

test("accepting places the lines, refuses a stale id, and the plan target is checked", () => {
  const d = planDraft();
  const ids = suggestBudgetLinks(d).map((s) => s.id);
  const r = applyOperation(d, { kind: "ACCEPT_BUDGET_SUGGESTIONS", ids });
  assert.equal(r.ok, true);
  assert.equal(r.draft.extras.finance.budgetPlan.b2, SUPPORT_LINE);
  assert.equal(applyOperation(r.draft, { kind: "ACCEPT_BUDGET_SUGGESTIONS", ids }).ok, false);
  assert.match(applyOperation(d, { kind: "SET_FINANCE", patch: { budgetPlan: { b1: "code:nope" } } }).reason, /planned activities/);
  assert.equal(applyOperation(d, { kind: "SET_FINANCE", patch: { budgetPlan: { b1: "code:1.1", b2: SUPPORT_LINE } } }).ok, true);
  assert.match(applyOperation(d, { kind: "SET_FINANCE", patch: { reportingCurrency: "usd" } }).reason, /three letters/);
});

test("the finance requirements close when funding, lines and currency are settled, and compare funding with budget", () => {
  const open = (x) => gapInbox(evaluateRequirements(x, SETUP_REQUIREMENTS)).map((r) => r.key).filter((k) => k.startsWith("finance."));
  const d = planDraft();
  d.proposal.funding = [item({ sourceName: "EU", amount: "9300", currency: "USD" })];
  d.extras.team = [{ key: "pm", name: "Pat", email: null, role: "PROJECT_MANAGER", external: false, invite: "LATER" }];
  assert.deepEqual(open(d).sort(), ["finance.budget", "finance.reconcile"]);
  let done = applyOperation(d, { kind: "ACCEPT_BUDGET_SUGGESTIONS", ids: suggestBudgetLinks(d).map((s) => s.id) }).draft;
  done = applyOperation(done, { kind: "SET_FINANCE", patch: { budgetPlan: { ...done.extras.finance.budgetPlan, b3: SUPPORT_LINE }, reportingCurrency: "USD" } }).draft;
  assert.deepEqual(open(done), [], "9300 of funding equals the 9300 budgeted");
  done.proposal.funding = [item({ sourceName: "EU", amount: "10000", currency: "USD" })];
  assert.deepEqual(open(done), ["finance.reconcile"], "a difference holds the slide open");
  const acknowledged = applyOperation(done, { kind: "SET_FINANCE", patch: { differenceAcknowledged: true } }).draft;
  assert.deepEqual(open(acknowledged), []);
  const off = applyOperation(d, { kind: "ANSWER_NOT_USED", requirement: "finance.funding" }).draft;
  assert.deepEqual(open(off), [], "finance not used switches the whole slide off");
});

test("a budget placement patch is merged into the existing placements, so two quick changes both stay", () => {
  const d = planDraft();
  const one = applyOperation(d, { kind: "SET_FINANCE", patch: { budgetPlan: { b1: "code:1.1" } } }).draft;
  const two = applyOperation(one, { kind: "SET_FINANCE", patch: { budgetPlan: { b2: SUPPORT_LINE } } }).draft;
  assert.equal(two.extras.finance.budgetPlan.b1, "code:1.1");
  assert.equal(two.extras.finance.budgetPlan.b2, SUPPORT_LINE);
});
