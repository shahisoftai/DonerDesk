import assert from "node:assert/strict";
import test from "node:test";
import { exportFileName } from "../dist/index.js";

const base = { projectTitle: "[DEMO] Learning Recovery for Displaced Children", reportType: "FINAL", periodStart: new Date("2026-08-01"), periodEnd: new Date("2026-08-31"), version: 3 };

test("a draft Word export is named for the project, report kind, period and version", () => {
  assert.equal(exportFileName({ ...base, exportType: "WORD", intent: "INTERNAL_REVIEW" }), "demo-learning-recovery-for-displaced-children-final-2026-08-01-to-2026-08-31-v3-draft.docx");
});

test("a donor submission has no draft marker; each type gets its extension", () => {
  assert.equal(exportFileName({ ...base, exportType: "PDF", intent: "DONOR_SUBMISSION" }), "demo-learning-recovery-for-displaced-children-final-2026-08-01-to-2026-08-31-v3.pdf");
  assert.match(exportFileName({ ...base, exportType: "EXCEL_INDICATORS", intent: "INTERNAL_REVIEW" }), /-indicators\.xlsx$/);
  assert.match(exportFileName({ ...base, exportType: "EVIDENCE_PACK_ZIP", intent: "INTERNAL_REVIEW" }), /-evidence-pack\.zip$/);
  assert.match(exportFileName({ ...base, exportType: "EVIDENCE_CHECKLIST", intent: "INTERNAL_REVIEW" }), /-evidence-checklist\.csv$/);
});

test("odd titles and a missing version still give a clean name", () => {
  const name = exportFileName({ projectTitle: "Écoles / Santé & Nutrition — 2026!!", periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-03-31"), exportType: "WORD", intent: "DONOR_SUBMISSION" });
  assert.match(name, /^[a-z0-9-]+\.docx$/);
  assert.equal(exportFileName({ projectTitle: "###", periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31"), exportType: "PDF", intent: "DONOR_SUBMISSION" }), "report-2026-01-01-to-2026-01-31.pdf");
});
