import assert from "node:assert/strict";
import test from "node:test";
import { PeriodEvidenceScope } from "../dist/index.js";
import { EvidenceFile } from "@donordesk/domain";

const file = (id, over = {}) => EvidenceFile.create({ id, tenantId: "t", projectId: "pr", fileName: `${id}.pdf`, title: id, fileUrl: "u", fileType: "application/pdf", fileSize: 1, evidenceType: "OTHER", uploadedById: "u", ...over });
const repo = (files) => ({ search: async (f) => ({ ok: true, value: { items: files.filter((x) => !f.verificationStatus || x.verificationStatus === f.verificationStatus), total: files.length, page: 1, pageSize: 200 } }) });

test("the export pack for a final report lists the project's 59 files, not only the final period's 10", async () => {
  const files = [...Array.from({ length: 10 }, (_, i) => file(`final-${i}`, { reportingPeriodId: "final" })), ...Array.from({ length: 49 }, (_, i) => file(`m-${i}`, { reportingPeriodId: `month-${i % 5}` }))];
  const scope = new PeriodEvidenceScope(repo(files));
  const final = await scope.filesFor("t", { id: "final", projectId: "pr", reportType: "FINAL" }, []);
  const monthly = await scope.filesFor("t", { id: "final", projectId: "pr", reportType: "MONTHLY" }, []);
  assert.equal(final.value.length, 59);
  assert.equal(monthly.value.length, 10);
});
