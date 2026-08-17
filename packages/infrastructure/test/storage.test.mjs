import assert from "node:assert/strict";
import test from "node:test";
import { LocalStorage, PiiVault, withTenantSession, EvidenceChunker, PiiFirewall, ProvenanceTracker, EvaluationHarness, withPiiFirewall, createLLMProvider, CompliantModelRouter, LocalEvidenceStorage, EvidenceStorageResolver, EnvGoogleDriveTokenStore, GoogleDriveEvidenceStorage, R2EvidenceStorage, GoogleDriveOAuthConnector, PrismaGoogleDriveCredentialStore, buildMultipartUpload, GoogleDriveWorkspaceDrive } from "../dist/index.js";
import { LlmModel } from "@donordesk/domain";

test("local storage rejects keys escaping its configured root", async () => {
  const storage = new LocalStorage();
  await assert.rejects(() => storage.read("../../etc/passwd"), /Invalid storage key/);
});

test("local evidence storage writes bytes and records a LOCAL location", async () => {
  const backend = new LocalStorage();
  const local = new LocalEvidenceStorage(backend);
  const saved = await local.save({
    tenantId: "tenant-a", evidenceId: "e1", fileName: "photo.jpg", fileType: "image/jpeg", fileSize: 42, buffer: Buffer.from("x".repeat(42)),
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.value.provider, "LOCAL");
  assert.ok(saved.value.storageKey.includes("tenant-a/evidence/e1.jpg"));
  assert.ok(saved.value.fileUrl.startsWith("/v1/files/"));
  assert.equal(saved.value.fileSize, 42);
  const bytes = await local.readBytes(saved.value);
  assert.equal(bytes.length, 42);
  // A reference-only save (no buffer) is rejected for byte-backed local storage.
  const missing = await local.save({ tenantId: "tenant-a", evidenceId: "e2", fileName: "a.pdf", fileType: "application/pdf", fileSize: 1, driveFileId: "abc" });
  assert.equal(missing.ok, false);
});

test("evidence storage resolver falls back to LOCAL when tenant has no provider", async () => {
  const backend = new LocalStorage();
  const resolver = new EvidenceStorageResolver(backend, async () => "LOCAL");
  const storage = await resolver.resolve({ toString: () => "tenant-a" });
  assert.equal(storage.provider, "LOCAL");
});

test("evidence storage resolver selects GOOGLE_DRIVE when configured", async () => {
  const backend = new LocalStorage();
  const resolver = new EvidenceStorageResolver(backend, async () => "GOOGLE_DRIVE", new EnvGoogleDriveTokenStore());
  const storage = await resolver.resolve({ toString: () => "tenant-a" });
  assert.equal(storage.provider, "GOOGLE_DRIVE");
});

test("google drive storage rejects reference saves when not connected", async () => {
  const google = new GoogleDriveEvidenceStorage(new EnvGoogleDriveTokenStore({ tenantId: "tenant-a" }));
  const saved = await google.save({
    tenantId: "tenant-b", evidenceId: "e1", fileName: "a.pdf", fileType: "application/pdf", fileSize: 1, driveFileId: "abc",
  });
  assert.equal(saved.ok, false);
  // A Drive save without a file id is rejected even when configured.
  delete process.env.GOOGLE_DRIVE_CLIENT_ID;
  const noId = await google.save({
    tenantId: "tenant-a", evidenceId: "e1", fileName: "a.pdf", fileType: "application/pdf", fileSize: 1,
  });
  assert.equal(noId.ok, false);
});

test("google drive multipart upload builds a metadata + media body", () => {
  const { body, contentType } = buildMultipartUpload(
    JSON.stringify({ name: "photo.jpg", parents: ["folder-1"] }),
    Buffer.from("HELLO-DRIVE"),
    "image/jpeg",
  );
  assert.ok(contentType.startsWith("multipart/related; boundary="));
  const text = body.toString("utf8");
  assert.ok(text.includes('"name":"photo.jpg"'));
  assert.ok(text.includes("HELLO-DRIVE"));
  assert.ok(text.endsWith("--\r\n"));
});

test("google drive managed upload requires a project workspace", async () => {
  process.env.GOOGLE_DRIVE_CLIENT_ID = "client-1";
  process.env.GOOGLE_DRIVE_CLIENT_SECRET = "secret-1";
  const google = new GoogleDriveEvidenceStorage(new EnvGoogleDriveTokenStore({ tenantId: "tenant-a" }));
  const noWorkspace = await google.save({
    tenantId: "tenant-a", projectId: "p1", evidenceId: "e1", fileName: "photo.jpg", fileType: "image/jpeg", fileSize: 42, buffer: Buffer.from("x".repeat(42)),
  });
  assert.equal(noWorkspace.ok, false);
  delete process.env.GOOGLE_DRIVE_CLIENT_ID;
  delete process.env.GOOGLE_DRIVE_CLIENT_SECRET;
});

test("drive workspace lists non-folder files from a folder", async () => {
  process.env.GOOGLE_DRIVE_CLIENT_ID = "client-1";
  process.env.GOOGLE_DRIVE_CLIENT_SECRET = "secret-1";
  process.env.GOOGLE_DRIVE_REFRESH_TOKEN = "rt-1";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com/token")) {
      return { ok: true, json: async () => ({ access_token: "at-1" }) };
    }
    if (u.includes("/files?q=")) {
      return {
        ok: true,
        json: async () => ({
          files: [
            { id: "f-1", name: "report.pdf", mimeType: "application/pdf", size: "1024", modifiedTime: "2026-08-17T00:00:00.000Z", webViewLink: "https://drive.google.com/file/d/f-1/view" },
            { id: "f-2", name: "Nested Folder", mimeType: "application/vnd.google-apps.folder", size: undefined, webViewLink: undefined },
          ],
        }),
      };
    }
    throw new Error(`unexpected fetch ${u}`);
  };
  try {
    const drive = new GoogleDriveWorkspaceDrive(new EnvGoogleDriveTokenStore({ tenantId: "tenant-a" }));
    const result = await drive.listFiles("tenant-a", "folder-1");
    assert.equal(result.ok, true);
    assert.equal(result.value.length, 1);
    assert.equal(result.value[0].id, "f-1");
    assert.equal(result.value[0].name, "report.pdf");
    assert.equal(result.value[0].size, 1024);
    assert.equal(result.value[0].webViewLink.includes("f-1"), true);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GOOGLE_DRIVE_CLIENT_ID;
    delete process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    delete process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  }
});

test("r2 evidence storage requires bytes and builds public URLs without network", async () => {
  const r2 = new R2EvidenceStorage({ accountId: "acc", accessKeyId: "k", secretAccessKey: "s", bucket: "b", publicBaseUrl: "https://cdn.example" });
  // A reference-only save (no bytes) is rejected without any network call.
  const missing = await r2.save({ tenantId: "tenant-a", evidenceId: "e2", fileName: "a.pdf", fileType: "application/pdf", fileSize: 1, driveFileId: "x" });
  assert.equal(missing.ok, false);
  assert.equal(r2.provider, "R2");
  const url = await r2.resolveDownloadUrl({ provider: "R2", fileUrl: "", fileSize: 1, storageKey: "tenant-a/evidence/e1.pdf" });
  assert.ok(url.startsWith("https://cdn.example/tenant-a/evidence/e1.pdf"));
});

test("AI chunking rejects configurations that cannot advance", () => {
  assert.throws(() => new EvidenceChunker(10, 10), /smaller than chunk size/);
  const chunks = new EvidenceChunker(3, 1).chunk("one two three four five").chunks;
  assert.deepEqual(chunks.map((chunk) => chunk.text), ["one two three", "three four five"]);
});

test("PII firewall safely merges overlapping recognizer matches", () => {
  const firewall = new PiiFirewall();
  const text = "Identity AB1234567 and email person@example.org";
  const result = firewall.apply(text, "redact");
  assert.equal(result.redactedText?.includes("AB1234567"), false);
  assert.equal(result.redactedText?.includes("person@example.org"), false);
  assert.equal(result.matches.some((match, index) => index > 0 && match.start < result.matches[index - 1].end), false);
});

test("evaluation metrics share a zero-to-one scale", () => {
  const harness = new EvaluationHarness();
  const exact = harness.evaluate("the project reached its target", "the project reached its target", 0.9);
  assert.equal(exact.passed, true);
  assert.equal(exact.overall, 1);
  const mismatch = harness.evaluate("alpha beta gamma delta", "unrelated words entirely here", 0.6);
  assert.equal(mismatch.passed, false);
  assert.ok(mismatch.scores.every((score) => score.score >= 0 && score.score <= 1));
});

test("provenance requires valid sources and flags empty or weak claims", () => {
  const tracker = new ProvenanceTracker(0.7);
  const context = { projectId: "p", tenantId: "tenant-a", periodId: "period", generatedAt: new Date(), modelId: "m", promptVersion: 1, threshold: 0.7 };
  assert.equal(tracker.buildParagraph([], context).needsVerification, true);
  assert.equal(tracker.buildParagraph([{ text: "Claim", evidenceId: "e", chunkId: "c", score: 0.5 }], context).needsVerification, true);
  assert.throws(() => tracker.buildParagraph([{ text: "Claim", evidenceId: "", chunkId: "c", score: 0.9 }], context));
});

test("LLM provider firewall removes PII before network/provider boundaries", async () => {
  let received;
  const inner = {
    name: "test", model: "test-v1", promptVersion: "1",
    async complete(input) { received = input; return { text: "ok", model: "test-v1", promptVersion: "1", usage: { inputTokens: 1, outputTokens: 1 } }; },
  };
  await withPiiFirewall(inner, "redact").complete({ systemPrompt: "Assist person@example.org", userPrompt: "Call +1 555 123 4567" });
  assert.equal(received.systemPrompt.includes("person@example.org"), false);
  assert.equal(received.userPrompt.includes("555 123 4567"), false);
  await assert.rejects(
    () => withPiiFirewall(inner, "reject").complete({ systemPrompt: "", userPrompt: "person@example.org" }),
    /contains PII/,
  );
  assert.throws(() => createLLMProvider({ provider: "openai", apiKey: "" }), /OPENAI_API_KEY/);
});

test("LLM judge uses provider output and rejects fabricated scores", async () => {
  const harness = new EvaluationHarness();
  const result = await harness.evaluateWithLlmJudge("candidate", "faithfulness", async () => JSON.stringify({ score: 0.8, reasoning: "Grounded" }));
  assert.equal(result.score, 0.8);
  await assert.rejects(() => harness.evaluateWithLlmJudge("candidate", "faithfulness", async () => JSON.stringify({ score: 5 })), /between 0 and 1/);
});

test("model routing selects the cheapest active jurisdiction-compatible model", () => {
  const model = (id, cost, jurisdiction = "EU", active = true) => LlmModel.create({ id, props: {
    name: id, provider: "ollama", version: "1", capabilities: ["chat"], costPer1kTokens: cost,
    maxTokens: 4096, jurisdiction, isActive: active,
  } });
  const selected = new CompliantModelRouter().select([
    model("expensive", 2), model("cheap", 0.2), model("wrong-region", 0, "US"), model("inactive", 0, "EU", false),
  ], { capability: "chat", jurisdiction: "EU", requiredTokens: 1000 });
  assert.equal(selected.id, "cheap");
});

test("PII vault isolates ciphertext and search hashes by tenant and derivation salt", () => {
  const masterKey = "11".repeat(32);
  const first = new PiiVault({ masterKey, kekDerivationSalt: "22".repeat(16), residencyRegion: "EU" });
  const second = new PiiVault({ masterKey, kekDerivationSalt: "33".repeat(16), residencyRegion: "EU" });
  const encrypted = first.encrypt("person@example.org", "tenant-a");

  assert.equal(first.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag, "tenant-a"), "person@example.org");
  assert.throws(() => first.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag, "tenant-b"));
  assert.notEqual(first.hashEmail("person@example.org", "tenant-a"), first.hashEmail("person@example.org", "tenant-b"));
  assert.notEqual(first.hashEmail("person@example.org", "tenant-a"), second.hashEmail("person@example.org", "tenant-a"));
});

test("PII vault rejects an absent or undersized derivation salt", () => {
  assert.throws(
    () => new PiiVault({ masterKey: "11".repeat(32), kekDerivationSalt: "", residencyRegion: "EU" }),
    /at least 16 bytes/,
  );
});

test("replica URLs carry tenant RLS and connection attribution settings", () => {
  const scoped = new URL(withTenantSession("postgresql://app:secret@db.example/donordesk", "tenant-a"));
  assert.equal(scoped.searchParams.get("options"), "-c app.current_tenant=tenant-a -c application_name=donordesk:tenant-a");
  assert.throws(() => withTenantSession("postgresql://db.example/donordesk", "bad tenant"), /Invalid tenant/);
});

test("google drive oauth connector builds a consent URL and requires config", async () => {
  delete process.env.GOOGLE_DRIVE_CLIENT_ID;
  delete process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  delete process.env.GOOGLE_DRIVE_REDIRECT_URI;
  const unconfigured = new GoogleDriveOAuthConnector();
  assert.equal((await unconfigured.buildAuthUrl("s1")).authUrl, "");

  process.env.GOOGLE_DRIVE_CLIENT_ID = "client-1";
  process.env.GOOGLE_DRIVE_CLIENT_SECRET = "secret-1";
  process.env.GOOGLE_DRIVE_REDIRECT_URI = "https://app.example/api/auth/drive/callback";
  const configured = new GoogleDriveOAuthConnector();
  const { authUrl } = await configured.buildAuthUrl("state-abc");
  assert.ok(authUrl.startsWith("https://accounts.google.com/o/oauth2/v2/auth"));
  assert.ok(authUrl.includes("access_type=offline"));
  assert.ok(authUrl.includes("state=state-abc"));
});

test("google drive credential store round-trips an encrypted refresh token", async () => {
  // In-memory prisma stub implementing just the platformConfiguration calls used.
  const rows = [];
  const prisma = {
    platformConfiguration: {
      findUnique: async ({ where }) => rows.find((r) => r.scopeId === where.scopeType_scopeId_category_provider.scopeId && r.scopeType === where.scopeType_scopeId_category_provider.scopeType && r.category === where.scopeType_scopeId_category_provider.category && r.provider === where.scopeType_scopeId_category_provider.provider) ?? null,
      create: async ({ data }) => { rows.push(data); return data; },
      update: async ({ where, data }) => { const i = rows.findIndex((r) => r.id === where.id); rows[i] = { ...rows[i], ...data }; return rows[i]; },
    },
  };
  const key = Buffer.alloc(32, 7);
  const store = new PrismaGoogleDriveCredentialStore(prisma, key);
  const save = await store.save("tenant-a", "rt-secret");
  assert.equal(save.ok, true);
  const found = await store.find("tenant-a");
  assert.equal(found.ok, true);
  assert.equal(found.value.refreshToken, "rt-secret");
  // Encrypted at rest, not plaintext.
  assert.notEqual(rows[0].secretCiphertext, "rt-secret");
});

test("google drive credential store rejects an undersized master key", async () => {
  const store = new PrismaGoogleDriveCredentialStore({ platformConfiguration: { findUnique: async () => null, create: async ({ data }) => data, update: async () => ({}) } }, Buffer.alloc(8));
  await assert.rejects(() => store.save("tenant-a", "rt"), /PLATFORM_MASTER_KEY/);
});
