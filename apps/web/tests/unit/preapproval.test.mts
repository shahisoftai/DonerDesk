import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluatePreApproval } from "../../src/features/review/application/preapproval.ts";

test("no issues when sections approved and checklist clean", () => {
  const issues = evaluatePreApproval({
    draftStatus: "UNDER_REVIEW",
    sections: [{ status: "APPROVED" }, { status: "APPROVED" }],
    checklist: [],
    unverifiedIndicatorCount: 0,
    sensitiveEvidenceCount: 0,
  });
  assert.deepEqual(issues, []);
});

test("incomplete sections are blocking", () => {
  const issues = evaluatePreApproval({
    draftStatus: "UNDER_REVIEW",
    sections: [{ status: "APPROVED" }, { status: "DRAFTED" }],
    checklist: [],
  });
  assert.ok(issues.some((i) => i.code === "INCOMPLETE_SECTIONS" && i.severity === "blocking"));
});

test("open critical/high checklist items are blocking", () => {
  const issues = evaluatePreApproval({
    draftStatus: "UNDER_REVIEW",
    sections: [{ status: "APPROVED" }],
    checklist: [{ severity: "CRITICAL", status: "OPEN" }],
  });
  assert.ok(issues.some((i) => i.code === "OPEN_CRITICAL_CHECKLIST" && i.severity === "blocking"));
});

test("open low/medium items are warnings", () => {
  const issues = evaluatePreApproval({
    draftStatus: "UNDER_REVIEW",
    sections: [{ status: "APPROVED" }],
    checklist: [{ severity: "MEDIUM", status: "OPEN" }],
  });
  assert.ok(issues.some((i) => i.code === "OPEN_LOW_CHECKLIST" && i.severity === "warning"));
});

test("unverified indicators and sensitive evidence are warnings", () => {
  const issues = evaluatePreApproval({
    draftStatus: "UNDER_REVIEW",
    sections: [{ status: "APPROVED" }],
    checklist: [],
    unverifiedIndicatorCount: 3,
    sensitiveEvidenceCount: 2,
  });
  assert.ok(issues.some((i) => i.code === "UNVERIFIED_INDICATORS" && i.severity === "warning"));
  assert.ok(issues.some((i) => i.code === "SENSITIVE_EVIDENCE" && i.severity === "warning"));
});

test("resolved and accepted-risk items are not counted as open", () => {
  const issues = evaluatePreApproval({
    draftStatus: "UNDER_REVIEW",
    sections: [{ status: "APPROVED" }],
    checklist: [
      { severity: "CRITICAL", status: "RESOLVED" },
      { severity: "HIGH", status: "ACCEPTED_RISK" },
      { severity: "HIGH", status: "NOT_APPLICABLE" },
    ],
  });
  assert.ok(!issues.some((i) => i.code === "OPEN_CRITICAL_CHECKLIST"));
});
