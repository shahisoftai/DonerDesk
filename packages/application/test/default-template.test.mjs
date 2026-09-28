import assert from "node:assert/strict";
import test from "node:test";
import { DonorTemplate, ReportingProfile, TenantId } from "@donordesk/domain";
import { DeleteTemplateHandler, SetDefaultTemplateHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "user-1" }, requestId: "req-1" };
const noopAudit = { record: async () => {} };

function template(id, projectId) {
  return DonorTemplate.create({ id, tenantId, projectId, templateName: `Template ${id}`, donorName: "Donor", reportType: "QUARTERLY", language: "en", uploadedById: "user-1" });
}

/** In-memory stand-ins for the two repositories these handlers touch. */
function fakeRepos({ templates = [], profile } = {}) {
  const templateStore = new Map(templates.map((t) => [t.id, t]));
  let profileStore = profile;
  return {
    templates: {
      findById: async (id) => ({ ok: true, value: templateStore.get(id) ?? null }),
      delete: async (id) => {
        templateStore.delete(id);
        return { ok: true, value: undefined };
      },
    },
    profiles: {
      findByProject: async (projectId) => ({ ok: true, value: profileStore && profileStore.projectId === projectId ? profileStore : null }),
      update: async (p) => {
        profileStore = p;
        return { ok: true, value: p };
      },
      create: async (p) => {
        profileStore = p;
        return { ok: true, value: p };
      },
    },
    getProfile: () => profileStore,
  };
}

test("SetDefaultTemplateHandler: marks a template default, creating the profile if the project has none", async () => {
  const t = template("t1", "proj-1");
  const repos = fakeRepos({ templates: [t] });
  const handler = new SetDefaultTemplateHandler({ generate: () => "profile-1" }, repos.templates, repos.profiles, noopAudit);

  const r = await handler.handle(ctx, "t1", true);
  assert.ok(r.ok, r.ok ? "" : r.error.message);
  assert.equal(repos.getProfile().defaultTemplateId, "t1");
  assert.equal(repos.getProfile().projectId, "proj-1");
});

test("SetDefaultTemplateHandler: setting a new default replaces the previous one, leaving other profile fields untouched", async () => {
  const profile = ReportingProfile.create({ id: "p1", tenantId: tenantId.toString(), projectId: "proj-1", defaultTemplateId: "t1", tone: "TECHNICAL", writingStyle: "punchy", createdById: "user-1" });
  const repos = fakeRepos({ templates: [template("t1", "proj-1"), template("t2", "proj-1")], profile });
  const handler = new SetDefaultTemplateHandler({ generate: () => "unused" }, repos.templates, repos.profiles, noopAudit);

  const r = await handler.handle(ctx, "t2", true);
  assert.ok(r.ok);
  assert.equal(repos.getProfile().defaultTemplateId, "t2");
  assert.equal(repos.getProfile().tone, "TECHNICAL");
  assert.equal(repos.getProfile().writingStyle, "punchy");
});

test("SetDefaultTemplateHandler: unsetting the current default clears it; unsetting a non-default is a no-op", async () => {
  const profile = ReportingProfile.create({ id: "p1", tenantId: tenantId.toString(), projectId: "proj-1", defaultTemplateId: "t1", createdById: "user-1" });
  const repos = fakeRepos({ templates: [template("t1", "proj-1"), template("t2", "proj-1")], profile });
  const handler = new SetDefaultTemplateHandler({ generate: () => "unused" }, repos.templates, repos.profiles, noopAudit);

  const noop = await handler.handle(ctx, "t2", false);
  assert.ok(noop.ok);
  assert.equal(repos.getProfile().defaultTemplateId, "t1");
  const originalVersion = repos.getProfile().version;

  const cleared = await handler.handle(ctx, "t1", false);
  assert.ok(cleared.ok);
  assert.equal(repos.getProfile().defaultTemplateId, undefined);
  assert.equal(repos.getProfile().version, originalVersion + 1);
});

test("SetDefaultTemplateHandler: rejects a template that does not exist", async () => {
  const repos = fakeRepos({});
  const handler = new SetDefaultTemplateHandler({ generate: () => "unused" }, repos.templates, repos.profiles, noopAudit);
  const r = await handler.handle(ctx, "missing", true);
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "NOT_FOUND");
});

test("DeleteTemplateHandler: deleting the project's default template clears the dangling reference (regression: DEFAULT_TEMPLATE_MISSING)", async () => {
  const profile = ReportingProfile.create({ id: "p1", tenantId: tenantId.toString(), projectId: "proj-1", defaultTemplateId: "t1", createdById: "user-1" });
  const repos = fakeRepos({ templates: [template("t1", "proj-1")], profile });
  const handler = new DeleteTemplateHandler(repos.templates, repos.profiles, noopAudit);

  const r = await handler.handle(ctx, "t1");
  assert.ok(r.ok, r.ok ? "" : r.error.message);
  assert.equal(repos.getProfile().defaultTemplateId, undefined);
});

test("DeleteTemplateHandler: deleting a non-default template leaves the profile's default untouched", async () => {
  const profile = ReportingProfile.create({ id: "p1", tenantId: tenantId.toString(), projectId: "proj-1", defaultTemplateId: "t1", createdById: "user-1" });
  const repos = fakeRepos({ templates: [template("t1", "proj-1"), template("t2", "proj-1")], profile });
  const handler = new DeleteTemplateHandler(repos.templates, repos.profiles, noopAudit);

  const r = await handler.handle(ctx, "t2");
  assert.ok(r.ok);
  assert.equal(repos.getProfile().defaultTemplateId, "t1");
});

test("DeleteTemplateHandler: a project with no reporting profile yet deletes cleanly", async () => {
  const repos = fakeRepos({ templates: [template("t1", "proj-1")] });
  const handler = new DeleteTemplateHandler(repos.templates, repos.profiles, noopAudit);
  const r = await handler.handle(ctx, "t1");
  assert.ok(r.ok, r.ok ? "" : r.error.message);
  assert.equal(repos.getProfile(), undefined);
});

test("ReportingProfile.setDefaultTemplateId: a dedicated mutator, distinct from update() which cannot express clearing", () => {
  const profile = ReportingProfile.create({ id: "p1", tenantId: tenantId.toString(), projectId: "proj-1", defaultTemplateId: "t1", tone: "CONCISE", createdById: "user-1" });
  const versionBefore = profile.version;

  // update() treats undefined as "leave unchanged" — it cannot clear the field.
  profile.update({ defaultTemplateId: undefined, updatedById: "user-1" });
  assert.equal(profile.defaultTemplateId, "t1");
  assert.equal(profile.tone, "CONCISE");

  profile.setDefaultTemplateId(undefined, "user-1");
  assert.equal(profile.defaultTemplateId, undefined);
  assert.equal(profile.tone, "CONCISE", "unrelated fields are untouched");
  assert.equal(profile.version, versionBefore + 2);
});
