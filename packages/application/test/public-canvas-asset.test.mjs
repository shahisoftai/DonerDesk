import test from "node:test";
import assert from "node:assert/strict";
import { GetPublicCanvasAssetHandler, assetIdsOfCanvas } from "../dist/index.js";

const tenant = { toString: () => "t1" };
const pages = [{ blocks: [{ props: { assetId: "pic-1", caption: "x" } }, { props: { nested: { logoAssetId: "logo-1" }, other: "pic-9" } }] }];
const canvases = (found) => ({ findById: async () => ({ ok: true, value: found ? { canvas: { pages } } : null }) });
const assets = (row) => ({ findById: async (id) => ({ ok: true, value: row && id === row.id ? row : null }) });
const storage = { read: async () => Buffer.from("PNGDATA") };

test("only the pictures a canvas names are ids a link may fetch", () => {
  assert.deepEqual([...assetIdsOfCanvas(pages)].sort(), ["logo-1", "pic-1"]);
});

test("a link serves a picture its canvas names, and nothing else; every other case is the same refusal", async () => {
  const row = { id: "pic-1", contentType: "image/png", storageKey: "drive:t1:abc" };
  const h = new GetPublicCanvasAssetHandler(canvases(true), assets(row), storage);
  const ok = await h.handle(tenant, "c1", "pic-1");
  assert.equal(ok.ok, true);
  assert.equal(ok.value.contentType, "image/png");
  assert.equal((await h.handle(tenant, "c1", "pic-9")).ok, false, "named nowhere on the canvas");
  assert.equal((await new GetPublicCanvasAssetHandler(canvases(false), assets(row), storage).handle(tenant, "c1", "pic-1")).ok, false, "no such canvas");
  assert.equal((await new GetPublicCanvasAssetHandler(canvases(true), assets({ ...row, archivedAt: new Date() }), storage).handle(tenant, "c1", "pic-1")).ok, false, "archived picture");
  assert.equal((await new GetPublicCanvasAssetHandler(canvases(true), assets(row), { read: async () => { throw new Error("gone"); } }).handle(tenant, "c1", "pic-1")).ok, false, "unreadable file");
});
