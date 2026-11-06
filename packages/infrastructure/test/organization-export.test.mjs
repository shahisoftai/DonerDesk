import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, PrismaClient } from "@prisma/client";
import JSZip from "jszip";
import { ORG_EXPORT_EXCLUDED, ORG_EXPORT_OMITTED_FIELDS, exportedModels, OrganizationExporter } from "../dist/exports/organization-exporter.js";

const tenantModels = Prisma.dmmf.datamodel.models.filter((m) => m.fields.some((f) => f.name === "tenantId")).map((m) => m.name);

test("H-11: every tenant table is either exported or excluded with a reason, and no excluded entry is stale", () => {
  const exported = new Set(exportedModels().map((m) => m.name));
  for (const name of tenantModels) assert.ok(exported.has(name) || name in ORG_EXPORT_EXCLUDED, `${name} is neither exported nor excluded`);
  for (const [name, reason] of Object.entries(ORG_EXPORT_EXCLUDED)) {
    assert.ok(tenantModels.includes(name), `${name} is excluded but is not a tenant table`);
    assert.ok(reason.length > 5, `${name} needs a reason`);
  }
  for (const name of Object.keys(ORG_EXPORT_OMITTED_FIELDS)) assert.ok(exported.has(name), `${name} has omitted fields but is not exported`);
});

test("H-11: no exported column looks like a secret", () => {
  const secret = /(password(?!changed)|secret|credential|encrypt|cipher|salt|refresh|apikey|accesstoken|^token$|tokenhash)/i;
  const offenders = [];
  for (const model of exportedModels()) for (const field of model.fields) if (secret.test(field)) offenders.push(`${model.name}.${field}`);
  assert.deepEqual(offenders, []);
});

const url = process.env.UOW_VERIFY_DATABASE_URL;
const skip = url ? false : "set UOW_VERIFY_DATABASE_URL to a scratch database";

test("H-11: the export holds one organization's records, never a password hash, and a second run waits", { skip }, async (t) => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const A = `exp-a-${Date.now()}`;
  const B = `exp-b-${Date.now()}`;
  const org = (tenantId) => ({ id: `org-${tenantId}`, tenantId, name: `Org ${tenantId}`, organizationType: "NGO", country: "KE", sectors: "[]", contactName: "c", contactEmail: "c@x.org" });
  t.after(async () => {
    for (const id of [A, B]) {
      await prisma.notification.deleteMany({ where: { tenantId: id } });
      await prisma.user.deleteMany({ where: { tenantId: id } });
      await prisma.organization.deleteMany({ where: { tenantId: id } });
    }
    await prisma.$disconnect();
  });
  for (const id of [A, B]) {
    await prisma.organization.create({ data: org(id) }).catch(async () => { /* schema may require more columns */ });
  }
  const orgOk = await prisma.organization.findFirst({ where: { tenantId: A } });
  if (!orgOk) return t.skip("could not create the scratch organization (required columns differ)");
  for (const id of [A, B]) {
    await prisma.organization.findFirst({ where: { tenantId: id } }) || await prisma.organization.create({ data: org(id) });
    await prisma.user.create({ data: { id: `u-${id}`, tenantId: id, email: `${id}@x.org`, name: "U", passwordHash: "SECRET-HASH-VALUE", role: "ADMIN", status: "ACTIVE" } });
    await prisma.notification.create({ data: { id: `n-${id}`, tenantId: id, recipientId: `u-${id}`, type: "ASSIGNMENT", title: `For ${id}`, message: "m" } });
  }

  const files = { read: async () => Buffer.from("bytes") };
  const exporter = new OrganizationExporter(prisma, files);
  const result = await exporter.export(A, { includeFiles: false });
  await assert.rejects(exporter.export(A, { includeFiles: false }), /already being prepared/, "a second export of the same organization waits");
  const chunks = [];
  for await (const chunk of result.stream) chunks.push(chunk);
  const zip = await JSZip.loadAsync(Buffer.concat(chunks));
  const text = async (name) => zip.file(name)?.async("string");

  const users = await text("data/User.ndjson");
  assert.ok(users.includes(`${A}@x.org`));
  assert.ok(!users.includes("passwordHash") && !users.includes("SECRET-HASH-VALUE"), "no password hash");
  assert.ok(!users.includes(`${B}@x.org`), "only this organization");
  assert.ok((await text("data/Notification.ndjson")).includes(`For ${A}`));
  assert.ok(!(await text("data/Notification.ndjson")).includes(`For ${B}`));
  const manifest = JSON.parse(await text("manifest.json"));
  assert.equal(manifest.format, "donordesk-organization-export/1");
  assert.equal(manifest.tables.User, 1);
  assert.equal(zip.file("data/PasswordResetToken.ndjson"), null);
  assert.match(result.fileName, /^donordesk-export-\d{4}-\d{2}-\d{2}\.zip$/);

  // The lock is released when the stream is done.
  const again = await exporter.export(A, { includeFiles: false });
  for await (const _ of again.stream) { /* drain */ }
});
