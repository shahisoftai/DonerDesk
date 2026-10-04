import assert from "node:assert/strict";
import test from "node:test";
import { NumericAssertionVerifier } from "../dist/llm/verifier-strategies.js";
import { DeterministicClaimVerifier } from "../dist/llm/claim-verifier.js";
import { summarizeFinance, normalizeFinanceFigures } from "@donordesk/domain";

const verifier = new NumericAssertionVerifier();
const atom = (value, role = "ACHIEVEMENT") => ({ charStart: 0, charEnd: value.length, value, role, bound: false });
const finding = (over = {}) => ({
  indicatorId: "ind-1", indicatorCode: "IND-1", value: "2500", target: "8000", unit: "people", reportingPeriodId: "p", qualityFlags: [], ...over,
});

test("a cumulative-to-date figure is verified like the period value, and so is its percent of the project target", () => {
  const f = finding({ lifeOfProject: { value: "7000", basis: "REPORTED_CUMULATIVE", periodsCovered: 3, asOf: "2028-06-30" } });
  assert.equal(verifier.verify({ atoms: [atom("7000")], findings: [f] }).result, "PASSED");
  assert.equal(verifier.verify({ atoms: [atom("87.5", "PERCENT")], findings: [f] }).result, "PASSED", "7000 / 8000 = 87.5%");
  assert.equal(verifier.verify({ atoms: [atom("7400")], findings: [f] }).result, "FAILED");
  const without = finding();
  assert.equal(verifier.verify({ atoms: [atom("7000")], findings: [without] }).result, "FAILED", "no life-of-project figure, nothing to ground it");
});

const finance = summarizeFinance("USD", normalizeFinanceFigures({
  lines: [{ budgetLine: "Staff", budget: "6000", expenditure: "2000", committed: "500" }, { budgetLine: "Unfunded", budget: "0", expenditure: "10" }],
}));

test("numbers equal to a verified financial figure are grounded; others are not", () => {
  for (const [value, role] of [["6000", "CURRENCY"], ["2010", "CURRENCY"], ["3990", "CURRENCY"], ["500", "CURRENCY"], ["33.5", "PERCENT"], ["33.3", "PERCENT"], ["10", "CURRENCY"]]) {
    assert.equal(verifier.verify({ atoms: [atom(value, role)], findings: [], finance }).result, "PASSED", `${value} should be grounded`);
  }
  assert.equal(verifier.verify({ atoms: [atom("2100", "CURRENCY")], findings: [], finance }).result, "FAILED");
  assert.equal(verifier.verify({ atoms: [atom("2010", "CURRENCY")], findings: [] }).result, "FAILED", "without verified figures nothing is grounded");
});

test("the claim verifier passes the finance figures through to the numeric check", async () => {
  const v = new DeterministicClaimVerifier();
  const claim = { text: "Expenditure was 2010 against a budget of 6000.", type: "NUMERIC", proposedSources: [] };
  const withFinance = await v.verify({ claim, findings: [], evidencePackages: [], finance });
  assert.equal(withFinance.value.result, "PASSED");
  const withoutFinance = await v.verify({ claim, findings: [], evidencePackages: [] });
  assert.equal(withoutFinance.value.result, "FAILED");
});
