// What the KoboToolbox and ODK extractors read from a submission. The two share their field-finding rules and
// differ in the keys they look for and in how they find photo links, so both are pinned here.
import test from "node:test";
import assert from "node:assert/strict";
import { extractKoboData, extractOdkData } from "../dist/integrations/field-data/index.js";

const kobo = (data) => extractKoboData({ submission_id: "s", form_id: "f", submitted_at: "2026-01-01", data });
const odk = (answers) => extractOdkData({ id: 1, instanceId: "i", submitterId: 1, submitterName: "n", createdAt: "", updatedAt: "", reviewState: "", submittedBy: "", formId: "f", xmlFormId: "x", answers });

test("a field is found at any depth, and the first listed key with a value wins", () => {
  const out = kobo({ group: { inner: { visit_date: "2026-03-04", date: "" } }, notes: "", comments: "ok" });
  assert.equal(out.date, "2026-03-04");
  assert.equal(out.notes, "ok");
  assert.equal(odk({ a: { b: { location: "Gulu" } } }).location, "Gulu");
});

test("empty, null and missing fields are left out", () => {
  assert.deepEqual(kobo({ location: "", notes: null }), { location: undefined, date: undefined, beneficiaryCount: undefined, imageUrls: [], notes: undefined });
  assert.equal(odk(undefined).location, undefined);
});

test("a count is read from a number or a plain numeric string, never from other text or a negative", () => {
  assert.equal(kobo({ participants: 12 }).beneficiaryCount, 12);
  assert.equal(kobo({ participants: " 7.5 " }).beneficiaryCount, 7.5);
  assert.equal(kobo({ participants: "12 people" }).beneficiaryCount, undefined);
  assert.equal(kobo({ participants: -3 }).beneficiaryCount, undefined);
  assert.equal(kobo({ participants: "x", attendance: 4 }).beneficiaryCount, 4, "an unreadable value falls through to the next key");
  assert.equal(odk({ count: "9" }).beneficiaryCount, 9);
});

test("the two tools look for different keys", () => {
  assert.equal(kobo({ narrative: "n" }).notes, "n");
  assert.equal(odk({ narrative: "n" }).notes, undefined);
  assert.equal(odk({ _submission_time: "t" }).date, "t");
  assert.equal(kobo({ _submission_time: "t" }).date, undefined);
  assert.equal(odk({ observation: "o" }).notes, "o");
  assert.equal(kobo({ observation: "o" }).notes, undefined);
  assert.equal(kobo({ beneficiary_count: 2 }).beneficiaryCount, 2);
  assert.equal(odk({ beneficiary_count: 2 }).beneficiaryCount, undefined);
});

test("a looping structure does not hang the search, and a very deep one stops", () => {
  const loop = { a: {} }; loop.a.back = loop;
  assert.equal(kobo(loop).location, undefined);
  let deep = { location: "deep" };
  for (let i = 0; i < 30; i++) deep = { n: deep };
  assert.equal(kobo(deep).location, undefined);
});

test("photo links: a web address, or a list of them; Kobo also reads addresses inside objects", () => {
  assert.deepEqual(kobo({ photo: "https://x/a.jpg" }).imageUrls, ["https://x/a.jpg"]);
  assert.deepEqual(kobo({ photo: "ftp://x/a.jpg" }).imageUrls, []);
  assert.deepEqual(kobo({ photos: ["http://x/1.jpg", "nope", 5] }).imageUrls, ["http://x/1.jpg"]);
  assert.deepEqual(kobo({ images: [{ download_url: "https://x/2.jpg?a=1", name: "n" }] }).imageUrls, ["https://x/2.jpg?a=1"]);
  assert.deepEqual(kobo({ images: [{ name: "no link" }] }).imageUrls, []);
  assert.deepEqual(odk({ images: [{ download_url: "https://x/2.jpg" }] }).imageUrls, [], "ODK does not read objects");
  assert.deepEqual(odk({ photos: ["https://x/1.jpg", "bad"] }).imageUrls, ["https://x/1.jpg"]);
  assert.deepEqual(odk({ filename: "https://x/f.jpg" }).imageUrls, ["https://x/f.jpg"], "ODK also looks under filename");
  assert.deepEqual(kobo({ filename: "https://x/f.jpg" }).imageUrls, [], "Kobo does not");
  assert.deepEqual(kobo({ photo: "https://x/a.jpg", media: "https://x/m.jpg" }).imageUrls, ["https://x/a.jpg", "https://x/m.jpg"], "keys are read in their listed order");
});
