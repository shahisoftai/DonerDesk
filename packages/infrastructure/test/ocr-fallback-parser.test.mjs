import test from "node:test";
import assert from "node:assert/strict";
import { OcrFallbackDocumentParser } from "../dist/parsers/ocr-fallback-parser.js";

const input = (fileName, fileType = "application/octet-stream") => ({ buffer: Buffer.from("x"), fileName, fileType });
const inner = (text, metadata) => ({ parse: async () => ({ text, ...(metadata ? { metadata } : {}) }) });
const workerSays = (body, ok = true) => async () => ({ ok, json: async () => body });

test("a PDF with no text layer is read by the worker, and the note travels with the text", async () => {
  let called = 0;
  const parser = new OcrFallbackDocumentParser(inner("", { parseError: "x" }), "http://w", "tok", 1000, async (url, init) => {
    called += 1;
    assert.equal(url, "http://w/v1/parse");
    assert.equal(init.headers["X-Internal-Token"], "tok");
    return { ok: true, json: async () => ({ status: "EXTRACTED", text: "Wells: 12", note: "check it", ocr: { confidence: 0.9, pagesRead: 1, pagesTotal: 1 } }) };
  });
  const r = await parser.parse(input("scan.pdf", "application/pdf"));
  assert.equal(called, 1);
  assert.equal(r.text, "Wells: 12");
  assert.equal(r.metadata.ocrNote, "check it");
  assert.equal(r.metadata.parseError, undefined);
});

test("a PDF that already has words is never sent to the worker", async () => {
  const parser = new OcrFallbackDocumentParser(inner("Real words"), "http://w", "", 1000, async () => { throw new Error("must not call"); });
  assert.equal((await parser.parse(input("a.pdf", "application/pdf"))).text, "Real words");
});

test("a photographed page is read; a worker that finds nothing leaves the first answer", async () => {
  const good = new OcrFallbackDocumentParser(inner("photo.png"), "http://w", "", 1000, workerSays({ status: "EXTRACTED", text: "Sign-in sheet", ocr: { confidence: 0.8, pagesRead: 1, pagesTotal: 1 } }));
  assert.equal((await good.parse(input("photo.png", "image/png"))).text, "Sign-in sheet");
  const empty = new OcrFallbackDocumentParser(inner("photo.png"), "http://w", "", 1000, workerSays({ status: "EMPTY", text: "" }));
  assert.equal((await empty.parse(input("photo.png", "image/png"))).text, "photo.png");
});

test("an unreachable or refusing worker, or no worker at all, leaves the first answer", async () => {
  const down = new OcrFallbackDocumentParser(inner(""), "http://w", "", 1000, async () => { throw new Error("ECONNREFUSED"); });
  assert.equal((await down.parse(input("scan.pdf", "application/pdf"))).text, "");
  const refuses = new OcrFallbackDocumentParser(inner(""), "http://w", "", 1000, workerSays({}, false));
  assert.equal((await refuses.parse(input("scan.pdf", "application/pdf"))).text, "");
  const none = new OcrFallbackDocumentParser(inner(""), undefined, "", 1000, async () => { throw new Error("must not call"); });
  assert.equal((await none.parse(input("scan.pdf", "application/pdf"))).text, "");
});

test("other file types are passed through untouched", async () => {
  const parser = new OcrFallbackDocumentParser(inner("hello"), "http://w", "", 1000, async () => { throw new Error("must not call"); });
  assert.equal((await parser.parse(input("a.docx"))).text, "hello");
});
