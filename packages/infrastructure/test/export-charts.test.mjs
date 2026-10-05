import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { DefaultExportBuilder } from "../dist/exports/builder.js";
import { chartHasData } from "../dist/exports/chart-png-renderer.js";

const resolved = (over = {}) => ({ type: "BAR", dataBinding: "TABLE_INDICATOR_PROGRESS", categories: ["IND-1", "IND-2"], series: [{ name: "% of target", data: [105, 100] }], unit: "%", title: "Progress", referenceLine: { name: "Target (100%)", value: 100 }, ...over });
const base = (charts) => ({
  exportType: "WORD", exportIntent: "INTERNAL_REVIEW", watermark: "INTERNAL PREVIEW", projectName: "P", reportingPeriodLabel: "2026-08", reportTitle: "R",
  sections: [{ title: "3 Results", content: "Text.", status: "DRAFTED", level: 1 }, { title: "5 Finance", content: "Text.", status: "DRAFTED", level: 1 }],
  indicators: [], activities: [], checklist: [], evidenceItems: [], includeSensitive: false, charts,
});
const open = (buffer) => JSZip.loadAsync(buffer);
const mediaCount = async (buffer) => Object.keys((await open(buffer)).files).filter((n) => /^word\/media\/.+\.png$/.test(n)).length;
const documentXml = async (buffer) => (await open(buffer)).file("word/document.xml").async("string");

test("every chart of a section is exported, each with a numbered caption; sections without charts get none", async () => {
  const charts = [
    { sectionTitle: "3 Results", caption: "Progress against targets — Results", resolved: resolved() },
    { sectionTitle: "3 Results", caption: "Participants by activity", resolved: resolved({ dataBinding: "TABLE_ACTIVITY_PARTICIPANTS", categories: ["A", "B"], series: [{ name: "Female", data: [5, 4] }, { name: "Male", data: [3, 6] }], stacked: true, unit: "participants", referenceLine: undefined }) },
    { sectionTitle: "5 Finance", caption: "Budget and expenditure by budget line", resolved: resolved({ dataBinding: "TABLE_FINANCE_BY_LINE", categories: ["Training"], series: [{ name: "Budget", data: [100] }, { name: "Expenditure", data: [97] }], unit: "USD", referenceLine: undefined }) },
  ];
  const { fileBuffer } = await new DefaultExportBuilder().build(base(charts));
  assert.equal(await mediaCount(fileBuffer), 3);
  const xml = await documentXml(fileBuffer);
  for (const caption of ["Figure 1. Progress against targets", "Figure 2. Participants by activity", "Figure 3. Budget and expenditure by budget line"]) assert.ok(xml.includes(caption), caption);
  assert.equal(await mediaCount((await new DefaultExportBuilder().build(base([]))).fileBuffer), 0);
});

test("a chart with nothing to draw (no values, or all zero) is left out; a hand-made chart still works", async () => {
  assert.equal(chartHasData({ resolved: resolved({ series: [{ name: "x", data: [null, null] }] }) }), false);
  assert.equal(chartHasData({ resolved: resolved({ series: [{ name: "x", data: [0, 0] }] }) }), false);
  assert.equal(chartHasData({ resolved: resolved() }), true);
  const manual = { sectionTitle: "3 Results", config: { type: "BAR", dataBinding: "INDICATOR_PROGRESS", options: {} }, indicators: [{ code: "A", name: "A", baseline: "0", target: "100", unit: "kits", achievement: "40", status: "VERIFIED" }, { code: "B", name: "B", baseline: "0", target: "50", unit: "kits", achievement: "25", status: "VERIFIED" }] };
  const { fileBuffer } = await new DefaultExportBuilder().build(base([manual, { sectionTitle: "5 Finance", resolved: resolved({ series: [{ name: "x", data: [null, null] }] }) }]));
  assert.equal(await mediaCount(fileBuffer), 1);
});

test("a PDF with charts is produced", async () => {
  const { fileBuffer, contentType } = await new DefaultExportBuilder().build({ ...base([{ sectionTitle: "3 Results", caption: "Progress", resolved: resolved() }]), exportType: "PDF" });
  assert.equal(contentType, "application/pdf");
  assert.equal(fileBuffer.subarray(0, 4).toString(), "%PDF");
});
