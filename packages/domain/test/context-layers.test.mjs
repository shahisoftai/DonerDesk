import assert from "node:assert/strict";
import test from "node:test";
import { CONTEXT_LAYERS, CONTEXT_LAYER_KEYS, checkMapContext, imageryUrlProblem, parseMapContext } from "../dist/index.js";

test("imagery: an https tile template passes; anything else names its problem", () => {
  assert.equal(imageryUrlProblem("https://tiles.example.org/imagery/{z}/{x}/{y}.jpg"), null);
  assert.equal(imageryUrlProblem("https://wms.example.org/wms?bbox={bbox-epsg-3857}&format=image/png"), null);
  assert.equal(imageryUrlProblem("http://tiles.example.org/{z}/{x}/{y}.png"), "NOT_HTTPS");
  assert.equal(imageryUrlProblem("https://user:secret@tiles.example.org/{z}/{x}/{y}.png"), "HAS_CREDENTIALS");
  assert.equal(imageryUrlProblem("https://192.168.1.4/{z}/{x}/{y}.png"), "PRIVATE_ADDRESS");
  assert.equal(imageryUrlProblem("https://localhost/{z}/{x}/{y}.png"), "PRIVATE_ADDRESS");
  assert.equal(imageryUrlProblem("https://tiles.example.org/latest.png"), "NO_TILE_PLACEHOLDERS");
  assert.equal(imageryUrlProblem("not a url"), "NOT_A_URL");
});

test("settings: layers are known, kept once and in table order; a credit without an address is dropped", () => {
  const r = checkMapContext({ layers: ["SETTLEMENTS", "POPULATION", "POPULATION"], imageryCredit: "Someone" });
  assert.deepEqual(r, { ok: true, value: { layers: ["POPULATION", "SETTLEMENTS"], imageryUrl: null, imageryCredit: null } });
  assert.deepEqual(checkMapContext({ layers: ["ROADS"] }), { ok: false, problem: "UNKNOWN_LAYER" });
});

test("settings: an unreadable stored value is the default (nothing on, no imagery)", () => {
  assert.deepEqual(parseMapContext("{not json"), { layers: [], imageryUrl: null, imageryCredit: null });
  assert.deepEqual(parseMapContext(JSON.stringify({ layers: ["POPULATION"], imageryUrl: "http://x/{z}/{x}/{y}" })), { layers: [], imageryUrl: null, imageryCredit: null });
});

test("every context layer names its maker, licence and file; a share-alike licence is marked", () => {
  for (const k of CONTEXT_LAYER_KEYS) {
    const d = CONTEXT_LAYERS[k];
    assert.ok(d.maker && d.licence && d.file.startsWith("context/") && d.year, k);
    if (/ODbL|SA/.test(d.licence)) assert.equal(d.verdict, "SHARE_ALIKE", k);
  }
});
