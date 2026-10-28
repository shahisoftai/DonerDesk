import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import {
  SaveCollectionFormHandler, SetCollectionFormStatusHandler, SubmitCollectionRecordHandler, ReviewCollectionRecordHandler,
  CreateCollectionLinkHandler, ResolveCollectionLinkHandler, RevokeCollectionLinkHandler, PublicSubmitCollectionRecordHandler, PublicCollectionFormHandler,
} from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ok = (value) => ({ ok: true, value });
const manager = { tenant: { tenantId, userId: "mgr", role: "PROJECT_MANAGER" }, requestId: "r" };
const viewer = { tenant: { tenantId, userId: "v", role: "VIEWER" }, requestId: "r" };
let n = 0;
const ids = { generate: () => `id-${++n}-xxxxxxxx` };
const audit = { events: [], record: async function (e) { this.events.push(e.eventType); } };
const clock = { now: () => new Date("2026-10-10T08:00:00Z") };

function world() {
  const forms = new Map(), records = new Map(), links = new Map();
  return {
    stores: { forms, records, links },
    forms: { create: async (f) => (forms.set(f.id, f), ok()), update: async (f) => (forms.set(f.id, f), ok()), findById: async (id) => ok(forms.get(id) ?? null), listByProject: async () => ok([...forms.values()]) },
    records: {
      createOnce: async (r) => (records.has(r.id) ? ok({ record: records.get(r.id), created: false }) : (records.set(r.id, r), ok({ record: r, created: true }))),
      update: async (r) => (records.set(r.id, r), ok()), findById: async (id) => ok(records.get(id) ?? null),
      listByForm: async () => ok([...records.values()]), countByStatus: async () => ok({ PENDING: 0, ACCEPTED: 0, REJECTED: 0 }),
    },
    links: {
      create: async (l) => (links.set(l.id, l), ok()), listByForm: async () => ok([...links.values()]), findById: async (id) => ok(links.get(id) ?? null),
      revoke: async (id, t, at) => (links.set(id, { ...links.get(id), revokedAt: at }), ok()), findByTokenHash: async (h) => ok([...links.values()].find((l) => l.tokenHash === h) ?? null),
    },
    indicators: { findByProject: async () => ok([{ id: "ind1", code: "OUT-1" }]) },
  };
}

const input = {
  projectId: "p1", name: "Distribution", mappings: [{ indicatorId: "ind1", method: "SUM", valueField: "kits", dateField: "day" }],
  fields: [{ key: "day", label: "Day", type: "DATE", required: true }, { key: "kits", label: "Kits", type: "NUMBER", min: 0, required: true }],
};

test("design, publish, submit, review: a draft is editable, a published form is frozen, only accepted records are reviewed in", async () => {
  const w = world();
  const save = new SaveCollectionFormHandler(ids, w.forms, w.indicators, audit, clock);
  const status = new SetCollectionFormStatusHandler(w.forms, audit, clock);
  assert.equal((await save.handle(viewer, input)).ok, false);
  const created = await save.handle(manager, input);
  assert.ok(created.ok);
  const bad = await save.handle(manager, { ...input, mappings: [{ indicatorId: "nope", method: "COUNT" }] });
  assert.match(bad.error.message, /not in this project/);
  const badRule = await save.handle(manager, { ...input, mappings: [{ indicatorId: "ind1", method: "SUM" }] });
  assert.match(badRule.error.message, /number field/);
  assert.ok((await save.handle(manager, { ...input, name: "Renamed" }, created.value.id)).ok);

  const submit = new SubmitCollectionRecordHandler(ids, w.forms, w.records, audit, clock);
  assert.match((await submit.handle(manager, created.value.id, { answers: { day: "2026-10-03", kits: 5 } })).error.message, /not open/);
  assert.ok((await status.handle(manager, created.value.id, "PUBLISHED")).ok);
  assert.match((await save.handle(manager, input, created.value.id)).error.message, /cannot be edited/);

  const first = await submit.handle(manager, created.value.id, { id: "client-key-0001", answers: { day: "2026-10-03", kits: "5" } });
  assert.equal(first.value.duplicate, false);
  const again = await submit.handle(manager, created.value.id, { id: "client-key-0001", answers: { day: "2026-10-03", kits: "5" } });
  assert.equal(again.value.duplicate, true);
  assert.equal(w.stores.records.size, 1, "a re-sent submission is stored once");
  const invalid = await submit.handle(manager, created.value.id, { answers: { day: "2026-10-03", kits: -2 } });
  assert.match(invalid.error.message, /below 0/);

  const review = new ReviewCollectionRecordHandler(w.records, audit, clock);
  assert.equal((await review.handle(viewer, "client-key-0001", { decision: "ACCEPT" })).ok, false);
  assert.match((await review.handle(manager, "client-key-0001", { decision: "REJECT" })).error.message, /Say why/);
  assert.ok((await review.handle(manager, "client-key-0001", { decision: "ACCEPT" })).ok);
  assert.ok(audit.events.includes("collection.record.accepted"));
});

test("a collection link opens the form for anyone holding it; revoked, expired and unknown tokens are all 'not available'", async () => {
  const w = world();
  const save = new SaveCollectionFormHandler(ids, w.forms, w.indicators, audit, clock);
  const status = new SetCollectionFormStatusHandler(w.forms, audit, clock);
  const { value: { id: formId } } = await save.handle(manager, input);
  const makeLink = new CreateCollectionLinkHandler(ids, w.forms, w.links, audit, clock);
  assert.match((await makeLink.handle(manager, formId, { label: "Field team", expiresInDays: 7 })).error.message, /Publish the form/);
  await status.handle(manager, formId, "PUBLISHED");
  const link = await makeLink.handle(manager, formId, { label: "Field team", expiresInDays: 7 });
  assert.ok(link.ok);
  assert.ok(![...w.stores.links.values()].some((l) => JSON.stringify(l).includes(link.value.token)), "only a hash is stored");

  const resolve = new ResolveCollectionLinkHandler(w.links, clock);
  const found = await resolve.handle(link.value.token);
  assert.equal(found.value.formId, formId);
  assert.equal((await resolve.handle("wrong")).ok, false);
  assert.equal((await new ResolveCollectionLinkHandler(w.links, { now: () => new Date("2026-12-01T00:00:00Z") }).handle(link.value.token)).ok, false);

  const pub = new PublicCollectionFormHandler(w.forms);
  const shown = await pub.handle(tenantId, formId);
  assert.deepEqual(Object.keys(shown.value).sort(), ["fields", "name"]);
  const submit = new PublicSubmitCollectionRecordHandler(ids, w.forms, w.records, audit, clock);
  const sent = await submit.handle(tenantId, formId, found.value.linkId, { answers: { day: "2026-10-03", kits: 3 }, submitterName: "Amina" });
  assert.ok(sent.ok);
  const stored = (await w.records.listByForm()).value[0];
  assert.equal(stored.source, "LINK");
  assert.equal(stored.status, "PENDING");

  await new RevokeCollectionLinkHandler(w.links, audit, clock).handle(manager, found.value.linkId);
  assert.equal((await resolve.handle(link.value.token)).ok, false);
  await status.handle(manager, formId, "CLOSED");
  assert.equal((await submit.handle(tenantId, formId, found.value.linkId, { answers: { day: "2026-10-03", kits: 3 } })).ok, false);
});

import { ImportCollectionRecordsHandler, GetCollectionSheetTemplateHandler } from "../dist/index.js";

test("a sheet import: preview saves nothing, one bad row blocks all and returns an error file, applying twice stores once", async () => {
  const w = world();
  const save = new SaveCollectionFormHandler(ids, w.forms, w.indicators, audit, clock);
  const status = new SetCollectionFormStatusHandler(w.forms, audit, clock);
  const { value: { id: formId } } = await save.handle(manager, input);
  const imp = new ImportCollectionRecordsHandler(ids, w.forms, w.records, audit, clock);
  const good = "Day,Kits\n2026-10-03,4\n2026-10-04,6\n";
  const bad = "Day,Kits\n2026-10-03,4\n2026-13-04,6\n";
  assert.match((await imp.handle(manager, formId, { text: good, apply: true })).error.message, /not open/);
  await status.handle(manager, formId, "PUBLISHED");

  const preview = await imp.handle(manager, formId, { text: good, apply: false });
  assert.deepEqual([preview.value.total, preview.value.valid, preview.value.invalid, preview.value.saved], [2, 2, 0, 0]);
  assert.equal(w.stores.records.size, 0);

  const blocked = await imp.handle(manager, formId, { text: bad, apply: true });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error.message, /nothing was imported/);
  assert.match(blocked.error.details.preview.errorFile, /Problems/);
  assert.equal(w.stores.records.size, 0);

  const applied = await imp.handle(manager, formId, { text: good, apply: true });
  assert.equal(applied.value.saved, 2);
  const again = await imp.handle(manager, formId, { text: good, apply: true });
  assert.equal(again.value.saved, 0);
  assert.equal(w.stores.records.size, 2);

  const template = await new GetCollectionSheetTemplateHandler(w.forms).handle(viewer, formId);
  assert.equal(template.ok, true);
  assert.match(template.value.text, /^Day,Kits\n/);
});

test("a reviewed record can be returned to waiting, which drops it from the totals", async () => {
  const w = world();
  const save = new SaveCollectionFormHandler(ids, w.forms, w.indicators, audit, clock);
  const { value: { id: formId } } = await save.handle(manager, input);
  await new SetCollectionFormStatusHandler(w.forms, audit, clock).handle(manager, formId, "PUBLISHED");
  const sent = await new SubmitCollectionRecordHandler(ids, w.forms, w.records, audit, clock).handle(manager, formId, { id: "reopen-0001", answers: { day: "2026-10-03", kits: 2 } });
  const review = new ReviewCollectionRecordHandler(w.records, audit, clock);
  assert.match((await review.handle(manager, sent.value.id, { decision: "REOPEN" })).error.message, /already waiting/);
  await review.handle(manager, sent.value.id, { decision: "REJECT", note: "Wrong site" });
  assert.equal((await review.handle(viewer, sent.value.id, { decision: "REOPEN" })).ok, false);
  assert.ok((await review.handle(manager, sent.value.id, { decision: "REOPEN" })).ok);
  const back = w.stores.records.get(sent.value.id);
  assert.equal(back.status, "PENDING");
  assert.equal(back.reviewNote, undefined);
});

import { UploadCollectionFileHandler, GetCollectionFileHandler, collectionFileType, ListCollectionRecordsHandler } from "../dist/index.js";

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(32)]);

test("attachments: allowed kinds are told by their bytes, an id from another form is refused, only reviewers can download", async () => {
  assert.equal(collectionFileType(png), "image/png");
  assert.equal(collectionFileType(Buffer.from("MZ not allowed")), null);
  assert.equal(collectionFileType(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(4)])), "image/webp");

  const w = world();
  const filesStore = new Map(), blobs = new Map();
  const files = { create: async (f) => (filesStore.set(f.id, f), ok()), findById: async (id) => ok(filesStore.get(id) ?? null) };
  const storage = { put: async (i) => (blobs.set(i.key, i.body), { url: "", key: i.key, size: i.body.length }), read: async (k) => blobs.get(k) };
  const save = new SaveCollectionFormHandler(ids, w.forms, w.indicators, audit, clock);
  const status = new SetCollectionFormStatusHandler(w.forms, audit, clock);
  const withFile = { ...input, fields: [...input.fields, { key: "photo", label: "Photo", type: "FILE" }] };
  const { value: { id: formId } } = await save.handle(manager, withFile);
  const { value: { id: otherId } } = await save.handle(manager, { ...input, name: "Other" });
  await status.handle(manager, formId, "PUBLISHED");
  await status.handle(manager, otherId, "PUBLISHED");

  const upload = new UploadCollectionFileHandler(ids, w.forms, files, storage, clock);
  assert.match((await upload.handle(manager, formId, { name: "a.exe", bytes: Buffer.from("MZ....") })).error.message, /photo/i);
  assert.match((await upload.handle(manager, formId, { name: "big.png", bytes: Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]) })).error.message, /5 MB/);
  assert.match((await upload.handle(manager, otherId, { name: "p.png", bytes: png })).error.message, /does not ask for a file/);
  assert.equal((await upload.handle(viewer, formId, { name: "p.png", bytes: png })).ok, false);
  const up = await upload.handlePublic(tenantId, formId, { name: "../../my photo?.png", bytes: png });
  assert.ok(up.ok);
  assert.equal(filesStore.get(up.value.id).fileName, "my photo_.png");

  const submit = new SubmitCollectionRecordHandler(ids, w.forms, w.records, audit, clock, files);
  const base = { day: "2026-10-03", kits: 2 };
  assert.match((await submit.handle(manager, formId, { answers: { ...base, photo: "doesnotexist1" } })).error.message, /not found/);
  const good = await submit.handle(manager, formId, { id: "with-photo-01", answers: { ...base, photo: up.value.id } });
  assert.ok(good.ok);

  const list = new ListCollectionRecordsHandler(w.forms, w.records, async () => new Map(), undefined, files);
  assert.equal((await list.handle(manager, formId)).value[0].files.photo.name, "my photo_.png");
  const get = new GetCollectionFileHandler(files, storage);
  assert.equal((await get.handle(viewer, up.value.id)).ok, false);
  assert.equal((await get.handle(manager, up.value.id)).value.contentType, "image/png");
});

import { GetOfflinePackHandler } from "../dist/index.js";

test("the offline pack holds the open forms and the live places, and only for people who can submit records", async () => {
  const w = world();
  const save = new SaveCollectionFormHandler(ids, w.forms, w.indicators, audit, clock);
  const status = new SetCollectionFormStatusHandler(w.forms, audit, clock);
  const { value: { id: open } } = await save.handle(manager, { ...input, name: "Open one", description: "d" });
  await save.handle(manager, { ...input, name: "Still a draft" });
  await status.handle(manager, open, "PUBLISHED");
  const places = { list: async () => ok([
    { id: "uga", tenantId, name: "Uganda", kind: "AREA", adminLevel: 0, aliases: [], archived: false, createdById: "u" },
    { id: "gulu", tenantId, name: "Gulu", kind: "AREA", adminLevel: 2, parentId: "uga", aliases: [], archived: false, createdById: "u" },
    { id: "old", tenantId, name: "Old", kind: "AREA", adminLevel: 2, aliases: [], archived: true, createdById: "u" },
  ]) };
  const pack = new GetOfflinePackHandler(w.forms, places, clock);
  assert.equal((await pack.handle(viewer, "p1")).ok, false);
  const r = await pack.handle(manager, "p1");
  assert.deepEqual(r.value.forms.map((f) => f.name), ["Open one"]);
  assert.deepEqual(Object.keys(r.value.forms[0]).sort(), ["description", "fields", "id", "name"], "no mappings, counts or project data");
  assert.deepEqual(r.value.places.map((p) => [p.id, p.path]), [["uga", "Uganda"], ["gulu", "Gulu › Uganda"]]);
  assert.equal(r.value.generatedAt, "2026-10-10T08:00:00.000Z");
});
