import test from "node:test";
import assert from "node:assert/strict";
import { SectionGenerationService } from "../dist/index.js";
import { summarizeFinance, normalizeFinanceFigures } from "@donordesk/domain";

const finance = summarizeFinance("USD", normalizeFinanceFigures({ budget: "100", expenditure: "40" }));
const service = new SectionGenerationService({ generate: () => "id" }, { recordRun: async () => undefined }, {}, {}, { record: async () => undefined });

function request(inputs, language = "en") {
  const generator = {
    model: { modelId: "stub", promptVersion: 1, modelVersion: "1" },
    generateSection: async () => ({ section: { sectionId: "s", title: "t", content: "Spending is on track.", claims: [], sourceReferences: [] }, usedFallback: false }),
  };
  return { ctx: { tenant: { tenantId: { toString: () => "tenant-a" } } }, runId: "r", plan: { sections: [] }, inputs: { verifiedFindings: [], evidencePackages: [], activities: [], indicatorUpdates: [], reportContext: {}, ...inputs }, reportingProfileSnapshot: { language }, generator, draftedSections: [] };
}

test("a blueprint financial section gets the verified table after the prose, once", async () => {
  const section = { templateSectionId: "bp:quarterly:finance", title: "Financial and Procurement Status", inputType: "NARRATIVE" };
  const out = await service.draft(request({ finance }), "s", section);
  assert.match(out.section.content, /^Spending is on track\.\n\n\| Budget line \| Budget \(USD\)/);
  assert.match(out.section.content, /\| \*\*Total\*\* \| 100 \| 40 \| 60 \| 40% \|/);
  const again = request({ finance });
  again.generator.generateSection = async () => ({ section: { sectionId: "s", title: "t", content: out.section.content, claims: [], sourceReferences: [] }, usedFallback: false });
  assert.equal((await service.draft(again, "s", section)).section.content.split("| **Total**").length, 2, "the table is not appended twice");
});

test("a donor template's financial narrative gets the same table; its other sections do not", async () => {
  const out = await service.draft(request({ finance }), "s", { templateSectionId: "tpl-7", title: "3. Financial Report", inputType: "NARRATIVE" });
  assert.match(out.section.content, /\| \*\*Total\*\* \| 100 \| 40 \| 60 \| 40% \|/);
  const other = await service.draft(request({ finance }), "s", { templateSectionId: "tpl-8", title: "Lessons Learned", inputType: "NARRATIVE" });
  assert.equal(other.section.content, "Spending is on track.");
  const withDonorTable = await service.draft(request({ finance }), "s", { templateSectionId: "tpl-9", title: "Financial Report", inputType: "NARRATIVE", requiredTables: [{ title: "Budget", columns: ["Line", "Amount"] }] });
  assert.equal(withDonorTable.section.content, "Spending is on track.", "the donor's own table shape wins");
});

test("no verified figures, no table", async () => {
  const out = await service.draft(request({}), "s", { templateSectionId: "bp:quarterly:finance", title: "Financial and Procurement Status" });
  assert.equal(out.section.content, "Spending is on track.");
});

test("the situation figures table is appended with the previous report's figures", async () => {
  const situation = { current: { affectedPopulation: [{ group: "Households", figure: "1,500" }] }, previous: { situationDate: "2028-05-01", affectedPopulation: [{ group: "households", figure: "1,200" }] } };
  const out = await service.draft(request({ situation }), "s", { templateSectionId: "bp:situation:needs", title: "Affected Population and Needs" });
  assert.match(out.section.content, /\| Households \| 1,500 \| 1,200 \(2028-05-01\) \| — \| — \|/);
});
