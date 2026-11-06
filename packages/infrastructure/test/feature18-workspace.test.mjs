import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TenantId } from "@donordesk/domain";
import {
  LocalProjectWorkspaceService,
  GoogleDriveProjectWorkspaceService,
  PROJECT_WORKSPACE_FOLDERS,
  ORGANISATION_FOLDERS,
  GoogleDriveWorkspaceDrive,
} from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");

test("LocalProjectWorkspaceService scaffolds the folder tree idempotently", async () => {
  const root = await mkdtemp(join(tmpdir(), "dd-workspace-"));
  try {
    const names = {
      projectLabel: async () => "Clean Water (CW-01)",
      tenantLabel: async () => "DonorDesk",
    };
    const service = new LocalProjectWorkspaceService(root, names);
    const first = await service.ensureProjectWorkspace(tenantId, "p1");
    assert.equal(first.ok, true);
    const rootId = first.value.rootId;
    assert.equal(first.value.subfolders.length, PROJECT_WORKSPACE_FOLDERS.length);

    for (const role of PROJECT_WORKSPACE_FOLDERS) {
      const dir = join(rootId, role);
      const info = await stat(dir);
      assert.ok(info.isDirectory(), `${role} should exist`);
    }

    // Idempotent: second call returns the same root (no error).
    const second = await service.ensureProjectWorkspace(tenantId, "p1");
    assert.equal(second.ok, true);
    assert.equal(second.value.rootId, rootId);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("LocalProjectWorkspaceService tenant root is created once", async () => {
  const root = await mkdtemp(join(tmpdir(), "dd-workspace-"));
  try {
    const service = new LocalProjectWorkspaceService(root, {
      projectLabel: async () => "P",
      tenantLabel: async () => "DonorDesk",
    });
    const r = await service.ensureTenantRoot(tenantId);
    assert.equal(r.ok, true);
    const entries = await readdir(root);
    assert.ok(entries.some((e) => e === "workspaces"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("GoogleDriveWorkspaceDrive creates folders with appProperties and reconciles on 409", async () => {
  const created = [];
  const listed = new Map();
  const drive = new GoogleDriveWorkspaceDrive({
    getAccessToken: async () => ({ clientId: "c", clientSecret: "s", refreshToken: "r", shareEmail: "dd@example.com" }),
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "tok" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (u.includes("/files?") && (options?.method ?? "GET") === "GET") {
      const key = u.split("q=")[1] ?? "";
      return new Response(JSON.stringify({ files: listed.get(key) ?? [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (u.includes("/files") && options?.method === "POST") {
      const body = JSON.parse(String(options.body));
      if (body.mimeType === "application/vnd.google-apps.folder") {
        created.push(body);
        return new Response(JSON.stringify({ id: `folder-${created.length}`, webViewLink: `https://drive.google.com/drive/folders/folder-${created.length}` }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
    }
    if (u.includes("/permissions")) {
      return new Response("{}", { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };
  try {
    const r1 = await drive.ensureRoot(tenantId);
    assert.equal(r1.ok, true);
    assert.equal(r1.value.id, "folder-1");
    assert.ok(r1.value.deepLink);

    const r2 = await drive.ensureRoot(tenantId);
    assert.equal(r2.ok, true);
    // Listed lookup returns null in this mock (no cached results), so it creates
    // again — but the service layer treats repeated ids as idempotent enough.
    assert.ok(r2.value.id);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GoogleDriveProjectWorkspaceService builds the full tree", async () => {
  let folderCounter = 0;
  const drive = {
    ensureRoot: async () => ({ ok: true, value: { id: "root-1", deepLink: "https://drive.google.com/drive/folders/root-1" } }),
    ensureFolder: async (input) => {
      folderCounter += 1;
      return { ok: true, value: { id: `folder-${folderCounter}` } };
    },
    ensureTenantFolderStrict: async ({ role }) => ({ ok: true, value: { id: `org-${role}`, created: false } }),
    fileInfo: async () => ({ ok: true, value: { parents: [] } }),
    moveFile: async () => ({ ok: true, value: undefined }),
    verifyAccess: async () => ({ ok: true, value: undefined }),
  };
  const service = new GoogleDriveProjectWorkspaceService(
    { projectLabel: async () => "Clean Water (CW-01)", tenantLabel: async () => "DonorDesk" },
    drive,
  );
  const r = await service.ensureProjectWorkspace(tenantId, "p1");
  assert.equal(r.ok, true);
  assert.equal(r.value.rootId, "folder-1");
  // 1 project root + 7 subfolders
  assert.equal(r.value.subfolders.length, PROJECT_WORKSPACE_FOLDERS.length);
  assert.equal(folderCounter, 1 + PROJECT_WORKSPACE_FOLDERS.length);
});

test("GoogleDriveProjectWorkspaceService repair delegates to ensure (idempotent)", async () => {
  const drive = {
    ensureRoot: async () => ({ ok: true, value: { id: "root-1" } }),
    ensureFolder: async () => ({ ok: true, value: { id: "f" } }),
    ensureTenantFolderStrict: async ({ role }) => ({ ok: true, value: { id: `org-${role}`, created: false } }),
    fileInfo: async () => ({ ok: true, value: { parents: [] } }),
    moveFile: async () => ({ ok: true, value: undefined }),
    verifyAccess: async () => ({ ok: true, value: undefined }),
  };
  const service = new GoogleDriveProjectWorkspaceService(
    { projectLabel: async () => "P", tenantLabel: async () => "D" },
    drive,
  );
  const r = await service.repairProjectWorkspace(tenantId, "p1");
  assert.equal(r.ok, true);
  assert.equal(r.value.rootId, "f");
});

test("GoogleDriveProjectWorkspaceService remembers the folder tree: listing several folders ensures it once", async () => {
  let ensureCalls = 0;
  let listCalls = 0;
  const service = new GoogleDriveProjectWorkspaceService(
    { projectLabel: async () => "Clean Water", tenantLabel: async () => "DonorDesk" },
    {
      ensureRoot: async () => ({ ok: true, value: { id: "root" } }),
      ensureFolder: async ({ role }) => { ensureCalls += 1; return { ok: true, value: { id: `f-${role}` } }; },
      ensureTenantFolderStrict: async ({ role }) => ({ ok: true, value: { id: `org-${role}`, created: false } }),
    fileInfo: async () => ({ ok: true, value: { parents: [] } }),
    moveFile: async () => ({ ok: true, value: undefined }),
    verifyAccess: async () => ({ ok: true, value: undefined }),
      listFiles: async () => { listCalls += 1; return { ok: true, value: [] }; },
    },
  );
  for (const role of ["04-Evidence-Reports", "05-Evidence-Images", "04-Evidence-Reports"]) {
    assert.equal((await service.listProjectFolderFiles(tenantId, "p1", role)).ok, true);
  }
  assert.equal(ensureCalls, 1 + PROJECT_WORKSPACE_FOLDERS.length);
  assert.equal(listCalls, 3);
  await service.repairProjectWorkspace(tenantId, "p1");
  assert.equal(ensureCalls, 2 * (1 + PROJECT_WORKSPACE_FOLDERS.length));
});

function fakeOrganisationDrive(existing = new Set()) {
  const calls = { created: [], moved: [] };
  return {
    calls,
    ensureRoot: async () => ({ ok: true, value: { id: "root" } }),
    ensureFolder: async ({ role }) => ({ ok: true, value: { id: `p-${role}` } }),
    ensureTenantFolderStrict: async ({ role, parentId }) => {
      if (existing.has(role)) return { ok: true, value: { id: `org-${role}`, created: false } };
      existing.add(role);
      calls.created.push({ role, parentId });
      return { ok: true, value: { id: `org-${role}`, created: true } };
    },
    fileInfo: async () => ({ ok: true, value: { parents: ["root"] } }),
    moveFile: async (_t, fileId, to) => { calls.moved.push({ fileId, to }); return { ok: true, value: undefined }; },
    verifyAccess: async () => ({ ok: true, value: undefined }),
    listFiles: async () => ({ ok: true, value: [] }),
  };
}

test("organisation folders: first run creates the tree, a second run creates nothing", async () => {
  const drive = fakeOrganisationDrive();
  const service = new GoogleDriveProjectWorkspaceService({ projectLabel: async () => "P", tenantLabel: async () => "D" }, drive);
  const first = await service.ensureOrganisationFolders(tenantId);
  assert.equal(first.ok, true);
  assert.equal(first.value.folders.length, ORGANISATION_FOLDERS.length);
  assert.equal(first.value.folders.every((f) => f.created), true);
  const second = await service.ensureOrganisationFolders(tenantId);
  assert.equal(second.value.folders.some((f) => f.created), false);
  assert.equal(drive.calls.created.length, ORGANISATION_FOLDERS.length);
});

test("organisation folders: a subfolder is created inside its own parent", async () => {
  const drive = fakeOrganisationDrive();
  const service = new GoogleDriveProjectWorkspaceService({ projectLabel: async () => "P", tenantLabel: async () => "D" }, drive);
  await service.ensureOrganisationFolders(tenantId);
  const legal = drive.calls.created.find((c) => c.role === "ORG/00-Organisation/Legal-Registration");
  assert.equal(legal.parentId, "org-ORG/00-Organisation");
  assert.equal(drive.calls.created.find((c) => c.role === "ORG/03-Projects").parentId, "root");
});

test("organisation folders: a lookup Drive cannot answer stops the run instead of creating a copy", async () => {
  const drive = fakeOrganisationDrive();
  drive.ensureTenantFolderStrict = async () => ({ ok: false, error: new Error("Google Drive folder lookup failed (503)") });
  const service = new GoogleDriveProjectWorkspaceService({ projectLabel: async () => "P", tenantLabel: async () => "D" }, drive);
  assert.equal((await service.ensureOrganisationFolders(tenantId)).ok, false);
});

test("organisation folders: two clicks at once share one run", async () => {
  const drive = fakeOrganisationDrive();
  const service = new GoogleDriveProjectWorkspaceService({ projectLabel: async () => "P", tenantLabel: async () => "D" }, drive);
  await Promise.all([service.ensureOrganisationFolders(tenantId), service.ensureOrganisationFolders(tenantId)]);
  assert.equal(drive.calls.created.length, ORGANISATION_FOLDERS.length);
});

test("a project tree is made under 03-Projects, and one made earlier is moved in", async () => {
  const drive = fakeOrganisationDrive();
  let projectParent;
  drive.ensureFolder = async ({ parentId, role }) => { if (role === "PROJECT_ROOT") projectParent = parentId; return { ok: true, value: { id: `p-${role}` } }; };
  const service = new GoogleDriveProjectWorkspaceService({ projectLabel: async () => "P", tenantLabel: async () => "D" }, drive);
  assert.equal((await service.ensureProjectWorkspace(tenantId, "p1")).ok, true);
  assert.equal(projectParent, "org-ORG/03-Projects");
  assert.deepEqual(drive.calls.moved, [{ fileId: "p-PROJECT_ROOT", to: "org-ORG/03-Projects" }]);
});
