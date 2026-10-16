import test from "node:test";
import assert from "node:assert/strict";
import { buildRecordChunks, scopeStatements, figuresInRecords } from "../dist/index.js";

const project = { title: "P", projectCode: "C", donorName: "D", implementingOrganization: "I", country: "Nigeria", sector: "WASH", duration: { start: new Date("2026-02-01"), end: new Date("2026-09-30") } };
const scope = {
  eventName: "Flooding in Jere and Konduga",
  location: "Jere LGA",
  situationDate: "2026-08-15",
  affectedPopulation: [{ group: "Households affected", figure: "1,850", source: "Borno State flood rapid assessment", asOf: "2026-08-14" }],
  needs: ["Safe water and chlorination."],
};

test("a situation scope becomes statements, including the affected-population figure with its source and date", () => {
  const lines = scopeStatements(scope);
  assert.ok(lines.some((l) => l.includes("Households affected: 1,850 (source: Borno State flood rapid assessment, as of 2026-08-14)")));
  assert.ok(lines.some((l) => l === "A reported need is Safe water and chlorination."));
});

test("the scope chunks are record chunks, so the lint can ground the figure the user supplied", () => {
  const chunks = buildRecordChunks({ project, period: { reportType: "SITUATION", duration: { start: new Date("2026-08-06"), end: new Date("2026-08-15") }, scope }, activities: [], indicatorUpdates: [] });
  const scopeChunks = chunks.filter((c) => c.chunkId.startsWith("record:scope:"));
  assert.ok(scopeChunks.length >= 3);
  assert.ok(figuresInRecords(chunks).includes("1850"));
});

test("no scope, no scope chunks", () => {
  assert.deepEqual(scopeStatements(undefined), []);
  assert.deepEqual(scopeStatements({}), []);
});

test("an indicator's means of verification is a record, so a report may say where its results are kept", () => {
  const chunks = buildRecordChunks({
    project,
    period: { reportType: "FINAL", duration: { start: new Date("2026-02-01"), end: new Date("2026-09-30") } },
    activities: [],
    indicatorUpdates: [],
    indicatorDefinitions: [{ code: "WS-OC1c", name: "Water points with chlorine residual", meansOfVerification: "Water quality test logs" }, { code: "X-1" }],
  });
  const mov = chunks.filter((c) => c.chunkId.startsWith("record:indicator:") && c.chunkId.endsWith("-mov:0"));
  assert.equal(mov.length, 1);
  assert.ok(mov[0].text.includes("verified through: Water quality test logs"));
  assert.ok(mov[0].chunkId.startsWith("record:"));
});
