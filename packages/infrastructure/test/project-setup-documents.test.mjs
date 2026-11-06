// Project documents live in the organisation's own Google Drive, never on the server (Phase 36). Drive is stubbed at the
// HTTP edge so the real adapters run: where the file is put, how it moves, what is removed, and what the person is told.
import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { GoogleDriveSetupDocuments, GoogleDriveWorkspaceDrive, PROJECT_DOCUMENTS_ROLE, SETUP_STAGING_ROLE } from "../dist/index.js";
import { StoredSetupDocumentReader } from "../dist/project-setup/source-reader.js";

const T = TenantId.create("tenant-docs");
const CONFIG = { clientId: "c", clientSecret: "s", refreshToken: "r", shareEmail: "share@example.org" };
const tokens = (connected = true) => ({ getAccessToken: async () => (connected ? CONFIG : null) });

/** A tiny Drive: folders found by role, files with parents, and a log of every call. */
function stubDrive({ files = {}, failUpload = false } = {}) {
  const calls = [];
  const state = { files: structuredClone(files), folders: { TENANT_ROOT: "root-1" } };
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url));
    const method = init.method ?? "GET";
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    calls.push({ method, path: u.pathname, search: u.search, body: typeof init.body === "string" ? init.body : init.body ? "<bytes>" : "" });
    if (u.hostname === "oauth2.googleapis.com") return json({ access_token: "tok" });
    if (/\/permissions$/.test(u.pathname)) return json({});
    if (u.pathname === "/drive/v3/files" && method === "GET") {
      const q = decodeURIComponent(u.searchParams.get("q") ?? "");
      const role = /key='role' and value='([^']+)'/.exec(q)?.[1];
      return json({ files: role && state.folders[role] ? [{ id: state.folders[role] }] : [] });
    }
    if (u.pathname === "/drive/v3/files" && method === "POST") {
      const body = JSON.parse(init.body);
      const id = `folder-${Object.keys(state.folders).length + 1}`;
      state.folders[body.appProperties.role] = id;
      return json({ id });
    }
    if (u.pathname.startsWith("/upload/drive/v3/files")) {
      if (failUpload) return json({ error: "no" }, 500);
      state.files["file-new"] = { parents: [/"parents":\["([^"]+)"/.exec(Buffer.from(init.body).toString())?.[1]], webViewLink: "https://drive.example/file-new" };
      return json({ id: "file-new", webViewLink: "https://drive.example/file-new" });
    }
    const m = /^\/drive\/v3\/files\/([^/]+)$/.exec(u.pathname);
    if (m && method === "GET") {
      const f = state.files[m[1]];
      return f ? json({ parents: f.parents, webViewLink: f.webViewLink, trashed: f.trashed === true }) : json({}, 404);
    }
    if (m && method === "PATCH") {
      const f = state.files[m[1]];
      if (!f) return json({}, 404);
      if (u.searchParams.get("addParents")) f.parents = [...f.parents.filter((p) => !(u.searchParams.get("removeParents") ?? "").split(",").includes(p)), u.searchParams.get("addParents")];
      if (init.body && JSON.parse(init.body).trashed) f.trashed = true;
      return json({ id: m[1] });
    }
    return json({}, 404);
  };
  return { calls, state, restore: () => { globalThis.fetch = real; } };
}

const workspace = (docFolderId = "docs-folder") => ({
  ensureTenantRoot: async () => ({ ok: true, value: { provider: "GOOGLE_DRIVE", rootId: "root-1" } }),
  ensureProjectWorkspace: async () => ({ ok: true, value: { provider: "GOOGLE_DRIVE", rootId: "proj-root", subfolders: docFolderId ? [{ role: PROJECT_DOCUMENTS_ROLE, id: docFolderId }] : [] } }),
});
const reader = { read: async () => ({ ok: true, value: { bytes: Buffer.from("hello"), mimeType: "text/plain", name: "d.txt" } }) };
const store = (over = {}) => new GoogleDriveSetupDocuments(tokens(over.connected ?? true), new GoogleDriveWorkspaceDrive(tokens(over.connected ?? true)), over.workspace ?? workspace(), reader);

test("without a connected Drive the store says so and saves nothing", async () => {
  const drive = stubDrive();
  try {
    const docs = store({ connected: false });
    assert.equal(await docs.available(T), false);
    const staged = await docs.stage(T, { name: "d.pdf", mimeType: "application/pdf", bytes: Buffer.from("x") });
    assert.equal(staged.ok, false);
    assert.equal(drive.calls.filter((c) => c.path.startsWith("/upload")).length, 0);
  } finally { drive.restore(); }
});

test("a document is staged in a folder under the organisation's DonorDesk folder, and only its Drive id is kept", async () => {
  const drive = stubDrive();
  try {
    const staged = await store().stage(T, { name: "Proposal.docx", mimeType: "application/vnd.openxmlformats", bytes: Buffer.from("bytes") });
    assert.equal(staged.ok, true);
    assert.equal(staged.value.fileId, "file-new");
    assert.equal(staged.value.webLink, "https://drive.example/file-new");
    assert.ok(drive.state.folders[SETUP_STAGING_ROLE], "the staging folder was created once");
    assert.deepEqual(drive.state.files["file-new"].parents, [drive.state.folders[SETUP_STAGING_ROLE]], "the file sits in the staging folder");
    const createFolder = drive.calls.find((c) => c.method === "POST" && c.path === "/drive/v3/files");
    assert.equal(JSON.parse(createFolder.body).parents[0], "root-1", "the staging folder is under the tenant's DonorDesk folder");
    // Staging again reuses the folder.
    await store().stage(T, { name: "again.txt", mimeType: "text/plain", bytes: Buffer.from("y") });
    assert.equal(drive.calls.filter((c) => c.method === "POST" && c.path === "/drive/v3/files").length, 1);
  } finally { drive.restore(); }
});

test("a Drive failure is a plain sentence, never the provider's text", async () => {
  const drive = stubDrive({ failUpload: true });
  try {
    const staged = await store().stage(T, { name: "d.txt", mimeType: "text/plain", bytes: Buffer.from("x") });
    assert.equal(staged.ok, false);
    assert.match(staged.error.message, /could not be saved to your Google Drive/);
    assert.ok(!/500|upload failed/i.test(staged.error.message));
  } finally { drive.restore(); }
});

test("moving into the project replaces the staging folder, and moving again changes nothing", async () => {
  const drive = stubDrive({ files: { "f-1": { parents: ["staging-x"], webViewLink: "https://drive.example/f-1" } } });
  try {
    const first = await store().moveToProject(T, "f-1", "proj-1");
    assert.equal(first.ok, true);
    assert.equal(first.value.folder, PROJECT_DOCUMENTS_ROLE);
    assert.equal(first.value.webLink, "https://drive.example/f-1");
    assert.deepEqual(drive.state.files["f-1"].parents, ["docs-folder"]);
    const patch = drive.calls.find((c) => c.method === "PATCH");
    assert.equal(new URL(`https://x${patch.path}${patch.search}`).searchParams.get("removeParents"), "staging-x");
    const patches = drive.calls.filter((c) => c.method === "PATCH").length;
    assert.equal((await store().moveToProject(T, "f-1", "proj-1")).ok, true);
    assert.equal(drive.calls.filter((c) => c.method === "PATCH").length, patches, "already in place: no second move");
  } finally { drive.restore(); }
});

test("a project without its documents folder is a plain failure, and the file is not touched", async () => {
  const drive = stubDrive({ files: { "f-1": { parents: ["staging-x"] } } });
  try {
    const moved = await store({ workspace: workspace(null) }).moveToProject(T, "f-1", "proj-1");
    assert.equal(moved.ok, false);
    assert.deepEqual(drive.state.files["f-1"].parents, ["staging-x"]);
  } finally { drive.restore(); }
});

test("only a document still in the staging folder is removed; one the person moved is left alone", async () => {
  const drive = stubDrive();
  try {
    const docs = store();
    const staged = await docs.stage(T, { name: "d.txt", mimeType: "text/plain", bytes: Buffer.from("x") });
    const stagingId = drive.state.folders[SETUP_STAGING_ROLE];
    drive.state.files["elsewhere"] = { parents: ["somewhere-else"] };
    assert.equal((await docs.removeStaged(T, "elsewhere")).ok, true);
    assert.notEqual(drive.state.files["elsewhere"].trashed, true, "a file outside staging is never trashed");
    assert.equal((await docs.removeStaged(T, staged.value.fileId)).ok, true);
    assert.equal(drive.state.files[staged.value.fileId].trashed, true);
    assert.deepEqual(drive.state.files["elsewhere"].parents, ["somewhere-else"]);
    assert.ok(stagingId);
    assert.equal((await docs.removeStaged(T, "gone")).ok, true, "a file already gone is fine");
  } finally { drive.restore(); }
});

test("the reader downloads from Drive and parses; an old server-stored key and a missing file get plain sentences", async () => {
  const parsed = [];
  const parse = { handle: async (input) => { parsed.push(input); return { ok: true, value: { text: "Line one\nLine two" } }; } };
  const docs = { read: async (_t, id) => (id === "gone" ? { ok: false, error: new Error("404") } : { ok: true, value: { bytes: Buffer.from("bytes"), mimeType: "application/pdf", name: "d.pdf" } }) };
  const r = new StoredSetupDocumentReader(docs, parse);
  const ok = await r.read({ tenantId: T, storageKey: "drive:abc", fileName: "d.pdf" });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.length, 1);
  assert.equal(parsed[0].fileType, "application/pdf");
  const old = await r.read({ tenantId: T, storageKey: "project-setup/t/old", fileName: "d.pdf" });
  assert.equal(old.ok, false);
  assert.match(old.error.message, /Add it again/);
  const missing = await r.read({ tenantId: T, storageKey: "drive:gone", fileName: "d.pdf" });
  assert.equal(missing.ok, false);
  assert.match(missing.error.message, /could not be read from your Google Drive/);
  assert.ok(!/404/.test(missing.error.message));
});

test("several documents are read in turn, block numbers stay unique across the set, and the file is named when one cannot be read", async () => {
  const texts = { a: "Alpha one\nAlpha two", b: "Beta one", bad: null };
  const parse = { handle: async ({ fileName }) => (texts[fileName] == null ? { ok: false, error: new Error("This file has no readable text.") } : { ok: true, value: { text: texts[fileName] } }) };
  const docs = { read: async (_t, id) => ({ ok: true, value: { bytes: Buffer.from(id), mimeType: "text/plain", name: id } }) };
  const reader = new StoredSetupDocumentReader(docs, parse);
  const ok = await reader.read({ tenantId: T, storageKey: "drive:a,b", fileName: "a (+1 more)" });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value.map((b) => [b.documentId, b.index]), [["source-1", 0], ["source-2", 1]]);
  assert.deepEqual(ok.value.map((b) => b.text), ["Alpha one\nAlpha two", "Beta one"]);
  const failed = await reader.read({ tenantId: T, storageKey: "drive:a,bad", fileName: "x" });
  assert.equal(failed.ok, false);
  assert.match(failed.error.message, /^bad: This file has no readable text/);
});

test("moving a document reports its own name from Drive", async () => {
  const drive = stubDrive({ files: { "f-1": { parents: ["staging-x"], webViewLink: "https://drive.example/f-1", name: "Proposal.docx" } } });
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const res = await original(url, init);
    if (String(url).includes("/drive/v3/files/f-1?fields=name") && (init?.method ?? "GET") === "GET") {
      const body = await res.clone().json();
      return new Response(JSON.stringify({ ...body, name: "Proposal.docx" }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return res;
  };
  try {
    const moved = await store().moveToProject(T, "f-1", "proj-1");
    assert.equal(moved.ok, true);
    assert.equal(moved.value.name, "Proposal.docx");
  } finally { globalThis.fetch = original; drive.restore(); }
});
