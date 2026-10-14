import test from "node:test";
import assert from "node:assert/strict";
import { EvidencePackFileLoader } from "../dist/index.js";

const storage = (files, failing = []) => ({ read: async (key) => { if (failing.includes(key)) throw new Error("gone"); return Buffer.from(files[key] ?? "") ; } });

test("files with stored bytes are read; a Drive file or an unreadable one is named with its reason", async () => {
  const loader = new EvidencePackFileLoader(storage({ k1: "AAA", k2: "BB" }, ["k3"]));
  const out = await loader.load([
    { fileName: "a.pdf", storageKey: "k1" },
    { fileName: "b.csv", storageKey: "k2" },
    { fileName: "drive.pdf" },
    { fileName: "lost.pdf", storageKey: "k3" },
  ]);
  assert.deepEqual(out.files.map((f) => f.name), ["a.pdf", "b.csv"]);
  assert.deepEqual(out.notIncluded.map((n) => [n.name, n.reason]), [["drive.pdf", "kept in the organisation's own Drive, not stored here"], ["lost.pdf", "the file could not be read"]]);
});

test("two files with the same name get distinct names inside the pack", async () => {
  const out = await new EvidencePackFileLoader(storage({ k1: "1", k2: "2" })).load([{ fileName: "photo.jpg", storageKey: "k1" }, { fileName: "photo.jpg", storageKey: "k2" }]);
  assert.deepEqual(out.files.map((f) => f.name), ["photo.jpg", "photo-2.jpg"]);
});

test("the size cap leaves files out with a reason instead of building an unbounded zip", async () => {
  const out = await new EvidencePackFileLoader(storage({ k1: "12345", k2: "12345" }), 8).load([{ fileName: "a", storageKey: "k1", fileSize: 5 }, { fileName: "b", storageKey: "k2", fileSize: 5 }]);
  assert.deepEqual(out.files.map((f) => f.name), ["a"]);
  assert.match(out.notIncluded[0].reason, /too large/);
});
