import test from "node:test";
import assert from "node:assert/strict";
import { connectorProblems, connectorRequest, parseExternalPage, externalValue, toAnswer, mapExternalRow, connectorRecordId } from "../dist/index.js";

const form = { fields: [
  { key: "day", label: "Day", type: "DATE", required: true },
  { key: "kits", label: "Kits", type: "NUMBER", required: true, min: 0 },
  { key: "site", label: "Site", type: "SELECT", options: [{ value: "a", label: "Camp A" }, { value: "b", label: "Camp B" }] },
  { key: "where", label: "Where", type: "GPS" },
  { key: "ok", label: "Done", type: "YES_NO" },
  { key: "photo", label: "Photo", type: "FILE" },
] };
const base = { kind: "KOBOTOOLBOX", serverUrl: "https://kf.kobotoolbox.org", sourceId: "aBcD1234", fieldMap: [{ sourceField: "visit_date", formKey: "day" }, { sourceField: "group/kits_given", formKey: "kits" }] };

test("a connector is checked: a public https server, a valid id, known questions, nothing mapped twice, every required question mapped", () => {
  assert.deepEqual(connectorProblems(base, form), []);
  const msg = (c) => connectorProblems(c, form).join(" | ");
  assert.match(msg({ ...base, serverUrl: "http://kf.kobotoolbox.org" }), /https/);
  assert.match(msg({ ...base, serverUrl: "https://localhost" }), /full host name/);
  assert.match(msg({ ...base, serverUrl: "https://app.localhost" }), /private/);
  assert.match(msg({ ...base, serverUrl: "https://10.0.0.5" }), /private/);
  assert.match(msg({ ...base, sourceId: "a b" }), /not valid/);
  assert.match(msg({ ...base, fieldMap: [...base.fieldMap, { sourceField: "x", formKey: "nope" }] }), /does not have/);
  assert.match(msg({ ...base, fieldMap: [...base.fieldMap, { sourceField: "p", formKey: "photo" }] }), /photos and documents/);
  assert.match(msg({ ...base, fieldMap: [...base.fieldMap, { sourceField: "VISIT_DATE", formKey: "site" }] }), /mapped twice/);
  assert.match(msg({ ...base, fieldMap: [{ sourceField: "visit_date", formKey: "day" }] }), /"Kits" is required but no field is mapped/);
  assert.match(msg({ ...base, fieldMap: [] }), /at least one/);
  assert.match(msg({ ...base, fieldMap: [{ sourceField: "a", formKey: "day" }, { sourceField: "b", formKey: "day" }] }), /same question/);
});

test("the request for each tool: only newer submissions, the credential in the header, never in the address", () => {
  const kobo = connectorRequest(base, "tok123", "2026-10-01T00:00:00.000Z").value;
  assert.match(kobo.url, /^https:\/\/kf\.kobotoolbox\.org\/api\/v2\/assets\/aBcD1234\/data\/\?format=json&limit=500&start=0/);
  assert.match(decodeURIComponent(kobo.url), /"_submission_time":\{"\$gte":"2026-10-01T00:00:00.000Z"\}/);
  assert.equal(kobo.headers.authorization, "Token tok123");
  assert.ok(!kobo.url.includes("tok123"));
  assert.ok(!connectorRequest(base, "tok123", undefined).value.url.includes("query="), "no cursor, everything");
  const cto = connectorRequest({ kind: "SURVEYCTO", serverUrl: "https://team.surveycto.com", sourceId: "visits_v2", fieldMap: base.fieldMap }, "user@x.org:pw", "2026-10-01T00:00:00.000Z").value;
  assert.equal(cto.url, `https://team.surveycto.com/api/v2/forms/data/wide/json/visits_v2?date=${Date.parse("2026-10-01T00:00:00.000Z") - 86_400_000}`);
  assert.equal(cto.headers.authorization, `Basic ${Buffer.from("user@x.org:pw").toString("base64")}`);
  assert.ok(connectorRequest({ ...base, serverUrl: "http://x" }, "t", undefined).error);
});

test("replies are read; a submission without an id or a time is skipped and counted", () => {
  const kobo = parseExternalPage("KOBOTOOLBOX", { next: "https://kf/next", results: [
    { _id: 1, _uuid: "u-1", _submission_time: "2026-10-03T08:00:00", visit_date: "2026-10-02" },
    { _id: 2, _submission_time: "2026-10-04T08:00:00" },
    { _uuid: "u-3" },
    "junk",
  ] });
  assert.deepEqual(kobo.page.rows.map((r) => r.externalId), ["u-1", "2"]);
  assert.equal(kobo.skipped, 1);
  assert.equal(kobo.page.hasMore, true);
  const cto = parseExternalPage("SURVEYCTO", [{ KEY: "uuid:abc", SubmissionDate: "Oct 28, 2026 10:00:00 AM", kits: "4" }, { SubmissionDate: "Oct 28, 2026" }]);
  assert.deepEqual(cto.page.rows.map((r) => r.externalId), ["uuid:abc"]);
  assert.equal(cto.skipped, 1);
  assert.equal(parseExternalPage("KOBOTOOLBOX", null).page.rows.length, 0);
});

test("a field of the other tool is found by exact name, ignoring case, or by its name inside a group", () => {
  const v = { "group/kits_given": "5", Visit_Date: "2026-10-02", other: "x" };
  assert.equal(externalValue(v, "group/kits_given"), "5");
  assert.equal(externalValue(v, "kits_given"), "5");
  assert.equal(externalValue(v, "visit_date"), "2026-10-02");
  assert.equal(externalValue(v, "missing"), undefined);
});

test("values become answers in the shape of the question", () => {
  const f = (key) => form.fields.find((x) => x.key === key);
  assert.equal(toAnswer(f("day"), "2026-10-02T09:30:00.000+03:00"), "2026-10-02");
  assert.equal(toAnswer(f("day"), "Oct 28, 2026 10:00:00 AM"), "2026-10-28");
  assert.equal(toAnswer(f("site"), "camp b"), "b");
  assert.deepEqual(toAnswer(f("where"), "1.5 32.1 1100 5"), { lat: "1.5", lon: "32.1" });
  assert.equal(toAnswer(f("kits"), "1,200"), "1200");
  assert.equal(toAnswer(f("kits"), ""), undefined);
  assert.equal(toAnswer(f("kits"), null), undefined);
});

test("a submission is mapped and checked with the form's own rules; a problem names what is wrong and stores nothing", () => {
  const good = mapExternalRow({ externalId: "u1", submittedAt: "2026-10-03T08:00:00.000Z", values: { visit_date: "2026-10-02", "group/kits_given": "5" } }, base.fieldMap, form);
  assert.deepEqual(good.problems, []);
  assert.deepEqual(good.stored, { day: "2026-10-02", kits: 5 });
  const bad = mapExternalRow({ externalId: "u2", submittedAt: "2026-10-03T08:00:00.000Z", values: { visit_date: "2026-13-40", kits_given: "-2" } }, base.fieldMap, form);
  assert.equal(bad.problems.length, 2);
  assert.deepEqual(bad.stored, {});
});

test("a submission always has the same record id, and another connector's has another", () => {
  assert.equal(connectorRecordId("c1", "uuid:abc"), connectorRecordId("c1", "uuid:abc"));
  assert.notEqual(connectorRecordId("c1", "uuid:abc"), connectorRecordId("c2", "uuid:abc"));
  assert.match(connectorRecordId("c1", "x"), /^ext-[0-9a-f]{40}$/);
});

test("a time with no zone is read as UTC whatever the machine's own zone is", () => {
  const { page } = parseExternalPage("KOBOTOOLBOX", { results: [{ _uuid: "u", _submission_time: "2026-10-04T08:00:00" }, { _uuid: "v", _submission_time: "2026-10-04T08:00:00+03:00" }] });
  assert.deepEqual(page.rows.map((r) => r.submittedAt), ["2026-10-04T08:00:00.000Z", "2026-10-04T05:00:00.000Z"]);
});
