import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { templatePlaceholder, groundProposed, groundAreaPatch, figuresSupported, sectionIsEmpty, findingFor, setupRepairs, addOnlyNew, markDoubted, verifiableFields, applyStructure } from "@donordesk/domain";
import { createLLMProvider } from "../dist/llm/factory.js";
import { runAreaExtraction, chunkBlocksText } from "../dist/project-setup/extractor-shared.js";
import { toBlocks } from "../dist/project-setup/source-reader.js";
import { withReplyMemory } from "../dist/project-setup/setup-llm.js";
import { mergePlaces } from "../dist/project-setup/prompts/places.js";
import { LlmSectionSurveyor } from "../dist/project-setup/section-surveyor.js";
import { NominatimPlaceLookup } from "../dist/project-setup/place-lookup.js";
import { blocksToText, wordlessPages } from "../dist/project-setup/pdf-layout.js";
import { scoreReading } from "./setup-corpus/score.mjs";

const item = (value, sourceQuote, extra = {}) => ({ value, sourceQuote, sourceRef: { documentId: "s", block: 1 }, confidence: "HIGH", status: "PROPOSED", ...extra });
const SRC = "Target 13,500 people in Baidoa. Budget total USD 500,000. Women are at least 50% of staff.";

test("A1: a value its quote does not support is refused", () => {
  assert.equal(groundProposed(item({ title: "Budget", target: "500,000" }, "Budget total USD 500,000"), SRC).grounded, true, "a figure in the quote still passes: the verifier owns meaning");
  assert.deepEqual(groundProposed(item({ title: "Build hospitals" }, "Women are at least 50% of staff"), SRC), { grounded: false, reason: "VALUE_NOT_IN_QUOTE" });
  assert.deepEqual(groundProposed(item({ title: "Women" }, "a"), SRC), { grounded: false, reason: "QUOTE_NOT_FOUND" });
  assert.deepEqual(groundProposed(item({ sourceName: "Budget", amount: "500,000", currency: "EUR" }, "Budget total USD 500,000"), SRC), { grounded: false, reason: "VALUE_NOT_IN_QUOTE" });
});

test("A2: a wrong citation is corrected to the block that holds the quote", () => {
  const blocks = [{ documentId: "s", index: 1, text: "Target 13,500 people in Baidoa." }, { documentId: "s", index: 2, text: "Budget total USD 500,000." }];
  const g = groundAreaPatch("RISKS", { risks: [item({ title: "Budget" }, "Budget total USD 500,000")] }, SRC, blocks);
  assert.equal(g.fields.risks[0].sourceRef.block, 2);
});

test("A4: one number in any spelling; scale words count; a different scale does not match", () => {
  assert.ok(figuresSupported("1250000", "1.250.000,00"));
  assert.ok(figuresSupported("1250000", "1 250 000"));
  assert.ok(figuresSupported("1,200,000", "$1.2 million"));
  assert.ok(figuresSupported("1,250", "1.250"), "an ambiguous mark keeps both readings");
  assert.ok(!figuresSupported("1.2", "$1.2 million"));
  assert.ok(!figuresSupported("500", "1,250"));
  assert.ok(figuresSupported("1530000", "T225 No. 20 76500 1530000"), "a table's neighbouring cells do not merge");
  assert.ok(figuresSupported("100", "Personnel 100 100"));
});

test("B1: a reply cut at the limit is never accepted whole; the chunk is read in halves", async () => {
  const cut = '{"x":[{"title":"A"}';
  const seen = [];
  const llm = { completeJson: async ({ user }) => { seen.push(user); return { ok: true, value: user.includes("\n") ? { text: cut, truncated: true, model: "m", promptVersion: "p" } : { text: JSON.stringify({ x: [user] }), model: "m", promptVersion: "p" } }; } };
  const r = await runAreaExtraction({ llm, tenantId: "t", proposalId: "p", blocks: [{ documentId: "s", index: 1, text: "goal one" }, { documentId: "s", index: 2, text: "goal two" }], sourceText: "", prior: {}, maxTokens: 1, timeoutMs: 1, keywords: ["goal"], buildPrompt: (t) => ({ system: "", user: t }), parseChunk: (raw) => raw, merge: (a, b) => ({ x: [...(a.x ?? []), ...(b.x ?? [])] }) });
  assert.equal(r.ok, true);
  assert.equal(r.value.fields.x.length, 2);
}, );

test("B3 and B1: the Claude adapter sends the schema, falls back on 400, and reports truncation", async () => {
  const bodies = [];
  const server = createServer((req, res) => {
    let data = ""; req.on("data", (d) => { data += d; });
    req.on("end", () => {
      const body = JSON.parse(data); bodies.push(body);
      res.setHeader("content-type", "application/json");
      if (body.output_config?.format && bodies.length === 1) { res.statusCode = 400; return res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "schema" } })); }
      res.end(JSON.stringify({ id: "m", type: "message", role: "assistant", model: "x", content: [{ type: "text", text: "{}" }], stop_reason: "max_tokens", usage: { input_tokens: 1, output_tokens: 1 } }));
    });
  });
  await new Promise((r) => server.listen(0, r));
  const provider = createLLMProvider({ provider: "anthropic", apiKey: "k", model: "x", baseUrl: `http://127.0.0.1:${server.address().port}` });
  const reply = await provider.complete({ systemPrompt: "", userPrompt: "u", jsonSchema: { type: "object" } });
  server.close();
  assert.equal(bodies[0].output_config.format.type, "json_schema");
  assert.equal(bodies.at(-1).output_config, undefined);
  assert.equal(reply.truncated, true);
});

test("B4: a failed chunk keeps the others and says partly read", async () => {
  const llm = { completeJson: async ({ user }) => (user.startsWith("[1]") ? { ok: true, value: { text: '{"x":[1]}', model: "m", promptVersion: "p" } } : { ok: false, error: { code: "POLICY_DENIED", message: "no" } }) };
  const long = "goal ".repeat(2500);
  const r = await runAreaExtraction({ llm, tenantId: "t", proposalId: "p", blocks: [{ documentId: "s", index: 1, text: long }, { documentId: "s", index: 2, text: long }], sourceText: "", prior: {}, maxTokens: 1, timeoutMs: 1, keywords: ["goal"], buildPrompt: (t) => ({ system: "", user: t }), parseChunk: (raw) => raw, merge: (a, b) => ({ ...a, ...b }) });
  assert.equal(r.ok, true);
  assert.equal(r.value.partlyRead, true);
});

test("C1: a structure the readings disagreed on is marked for checking", () => {
  const out = applyStructure([item({ level: "GOAL", code: "G", title: "A", parentCode: null, description: null }, "A")], [{ level: "GOAL", parent: null, agreed: false }]);
  assert.equal(out[0].confidence, "LOW");
});

test("C2: a budget short of its funding asks one second look, which only adds", () => {
  const p = { funding: [item({ sourceName: "F", amount: "100", currency: "USD" }, "q")], budget: [item({ category: "A", amount: "90", currency: "USD" }, "q")] };
  assert.equal(setupRepairs(p)[0].area, "FUNDING_BUDGET");
  assert.equal(setupRepairs({ ...p, funding: [item({ sourceName: "F", amount: "90", currency: "USD" }, "q")] }).length, 0);
  const again = addOnlyNew(p, { budget: [item({ category: "A", amount: "90", currency: "USD" }, "q"), item({ category: "PSC", amount: "10", currency: "USD" }, "PSC Cost 10")], funding: [] });
  assert.equal(again.budget.length, 2);
  const row = (category) => item({ category, amount: "467,290.00", currency: "USD" }, "G.1 | Estimate budget based on instructions | 467,290.00");
  assert.equal(addOnlyNew({ budget: [row("G.1 Estimate budget")] }, { budget: [row("Estimate budget")] }).budget.length, 1, "the same row under another name is not added twice");
});

test("C3: a doubted value is marked, never changed or removed", () => {
  const facts = Object.fromEntries(["name", "code", "donor", "countries", "sectors", "startDate", "endDate", "currency", "summary"].map((k) => [k, item(null, null)]));
  facts.name = item("Water", "Water project");
  const p = { facts, funding: [], indicators: [] };
  assert.equal(verifiableFields(p)[0].path, "facts.name");
  const marked = markDoubted(p, ["facts.name"]);
  assert.equal(marked.facts.name.value, "Water");
  assert.equal(marked.facts.name.confidence, "LOW");
});

test("C4: the same question is answered once; fresh asks again; a cut reply is not kept", async () => {
  let calls = 0;
  const llm = withReplyMemory({ available: async () => true, completeJson: async () => { calls += 1; return { ok: true, value: { text: "{}", model: "m", promptVersion: "p", ...(calls === 3 ? { truncated: true } : {}) } }; } });
  const q = { tenantId: "t", system: "s", user: "u", maxTokens: 1, timeoutMs: 1 };
  await llm.completeJson(q); await llm.completeJson(q);
  assert.equal(calls, 1);
  await llm.completeJson({ ...q, fresh: true });
  assert.equal(calls, 2);
  await llm.completeJson({ ...q, tenantId: "other" });
  assert.equal(calls, 3);
});

test("C5: Baidoa and Baidoa District are one place; different parents are two", () => {
  const p = (name, parentName = null) => item({ name, parentName, adminLevel: null, latitude: null, longitude: null }, name);
  const one = mergePlaces({ places: [p("Baidoa"), p("Baidoa District", "Bay")] }, {});
  assert.equal(one.places.length, 1);
  assert.equal(one.places[0].value.name, "Baidoa District");
  assert.equal(mergePlaces({ places: [p("Hope", "A"), p("Hope", "B")] }, {}).places.length, 2);
});

test("D1: a table's later blocks carry its columns, outside their text", () => {
  const rows = Array.from({ length: 60 }, (_, i) => `IND${i} | Number of people reached with service ${i} | 0 | ${1000 + i} | quarterly`);
  const blocks = toBlocks(["Code | Indicator | Baseline | Target | Frequency", ...rows].join("\n"));
  assert.ok(blocks.length > 1);
  assert.ok(blocks.slice(1).every((b) => b.columns?.startsWith("Code | Indicator")));
  assert.ok(blocks.slice(1).every((b) => !b.text.includes("Code | Indicator")));
});

test("D2, D3: a PDF keeps headings and rows; wordless pages are named", () => {
  const blocks = [{ kind: "HEADING", level: 1, text: "Budget", page: 1 }, { kind: "TABLE", rows: [["A", "1"]], page: 3 }];
  assert.equal(blocksToText(blocks), "Budget\n\nA | 1");
  assert.deepEqual(wordlessPages(blocks, 3), [2]);
});

test("D4: more chunks may be asked for; the default stays three", () => {
  const text = Array.from({ length: 8 }, () => "x".repeat(11_000)).join("\n");
  assert.equal(chunkBlocksText(text).partlyRead, true);
  assert.equal(chunkBlocksText(text, 10).partlyRead, false);
});

test("Rule 2: emptiness is read from the text: blank tables are empty, any statement is not", () => {
  const b = (text, section = "4 Logframe") => [{ documentId: "s", index: 0, text, section }];
  assert.ok(sectionIsEmpty(b("4 Logframe\nCode | Result | Target\n1.1 | To be completed after identification | 0\n1.2 | |")));
  assert.ok(sectionIsEmpty(b("Activity 1.1.1 | [insert description]")));
  assert.equal(templatePlaceholder("Outcome Indicator 1.1 (Custom):."), "WHOLE");
  assert.ok(!sectionIsEmpty(b("Code | Place\n1 | Baidoa town")), "short text in a cell is a statement");
  assert.ok(!sectionIsEmpty(b("Goal | Reduce mortality")), "a lone row with a value is a statement");
  assert.ok(!sectionIsEmpty(b("The project works in two districts.")));
  const blocks = [...b("1 | |", "A"), ...b("Real sentence here.", "B")];
  assert.equal(findingFor("PLAN", ["A"], blocks).state, "EMPTY");
  assert.equal(findingFor("PLAN", ["A", "B"], blocks).state, "PARTLY_EMPTY");
  assert.equal(findingFor("PLAN", [], blocks).state, "NOT_IN_DOCUMENTS");
});

test("Rule 1: headings are mapped by the model, and a failed survey still uses the known headings", async () => {
  const blocks = ["Introduction", "Cronología prevista", "Budget", "Annex"].map((section, index) => ({ documentId: "s", index, section, text: "words" }));
  const specs = [{ area: "FUNDING_BUDGET", sectionTitles: ["budget"] }, { area: "PLAN", sectionTitles: [] }];
  const ok = new LlmSectionSurveyor({ completeJson: async () => ({ ok: true, value: { text: '{"parts":[{"section":1,"areas":["PLAN"]},{"section":99,"areas":["PLAN"]},{"section":0,"areas":["NOPE"]}]}', model: "m", promptVersion: "p" } }) }, specs);
  const read = await ok.survey({ tenantId: "t", blocks });
  assert.deepEqual(read.sections.PLAN, ["Cronología prevista"]);
  assert.deepEqual(read.sections.FUNDING_BUDGET, ["Budget"]);
  const failed = new LlmSectionSurveyor({ completeJson: async () => ({ ok: false, error: {} }) }, specs);
  assert.deepEqual((await failed.survey({ tenantId: "t", blocks })).sections, { FUNDING_BUDGET: ["Budget"] });
});

test("Rule 5: a place is recognised from the web, only name and country are sent, another country is refused", async () => {
  const urls = [];
  const lookup = new NominatimPlaceLookup("https://geo.example/", async (url) => { urls.push(url); return { ok: true, json: async () => [{ name: "Baidoa", display_name: "Baidoa, Bay, Somalia", address: { country: "Somalia" } }] }; }, 0);
  assert.deepEqual(await lookup.lookup("Baidoa", "Somalia"), { name: "Baidoa", within: "Bay, Somalia", country: "Somalia", source: "OpenStreetMap" });
  assert.match(urls[0], /q=Baidoa%2C%20Somalia$/);
  assert.equal(await lookup.lookup("Baidoa", "Kenya"), null);
  const theatre = new NominatimPlaceLookup("https://geo.example", async () => ({ ok: true, json: async () => [{ name: "The National Theatre", display_name: "The National Theatre, Mogadishu, Somalia", address: { country: "Somalia" } }] }), 0);
  assert.equal(await theatre.lookup("Somalia", null), null, "a landmark is not the place asked for");
  const broken = new NominatimPlaceLookup("https://geo.example", async () => { throw new Error("down"); }, 0);
  assert.equal(await broken.lookup("X", null), null);
});

test("E1: the scorer separates wrong, missed and invented", () => {
  const s = scoreReading({ facts: { name: "Water", code: null, donor: "F" }, lists: { places: { key: "name", items: [{ name: "Baidoa", adminLevel: 2 }] } } },
    { facts: { name: { value: "Water" }, code: { value: "X1" }, donor: { value: "G" } }, places: [{ value: { name: "Baidoa", adminLevel: 1 } }, { value: { name: "Nairobi" } }] });
  assert.deepEqual([s.correct, s.wrongShown, s.invented, s.missed], [1, 2, 2, 0]);
});
