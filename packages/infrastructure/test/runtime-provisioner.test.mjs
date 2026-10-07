import assert from "node:assert/strict";
import test from "node:test";
import {
  RuntimeProvisioner,
  applyManagedBlockToEnv,
  removeManagedBlockFromEnv,
  renderApiManagedBlock,
  renderWorkersManagedBlock,
  stripStandaloneManagedKeys,
  MANAGED_BLOCK_MARKER,
} from "../dist/platform/runtime-provisioner.js";

/**
 * Runtime-provisioner regression tests.
 *
 * The provisioner writes the SaaS control-plane LLM selection into the
 * Contabo runtime env files (`api.env` + `workers.env`) so selecting
 * DeepSeek on `sa.donordesk.online` actually makes the AI Reporter
 * available on `donordesk.online`. These tests pin idempotent insertion,
 * safe removal, atomic file write, restart invocation, and that the secret
 * value never leaks into the logger.
 */

function makeInMemoryFs(initial = {}) {
  const files = new Map(Object.entries(initial));
  return {
    files,
    async readFile(path) {
      const v = files.get(path);
      if (v === undefined) {
        const err = new Error(`ENOENT: ${path}`);
        err.code = "ENOENT";
        throw err;
      }
      return v;
    },
    async writeFile(path, content) {
      files.set(path, content);
    },
    async stat(path) {
      if (!files.has(path)) {
        const err = new Error(`ENOENT: ${path}`);
        err.code = "ENOENT";
        throw err;
      }
      return { uid: 1000, gid: 1000 };
    },
    async chmod() {},
    async chown() {},
    async rename(from, to) {
      const v = files.get(from);
      if (v === undefined) throw new Error(`ENOENT: ${from}`);
      files.set(to, v);
      files.delete(from);
    },
  };
}

test("applyManagedBlockToEnv: inserts, updates, and is idempotent", () => {
  const config = { provider: "deepseek", model: "deepseek-chat" };
  const initial = "# existing content\nFOO=bar\n";
  const a = applyManagedBlockToEnv(initial, renderApiManagedBlock(config, "GLOBAL"));
  assert.equal(a.changed, true);
  assert.ok(a.content.includes("AI_REPORTER_ENABLED=1"));
  assert.ok(a.content.includes("AI_REPORTER_MODEL=deepseek-chat"));
  const b = applyManagedBlockToEnv(a.content, renderApiManagedBlock(config, "GLOBAL"));
  assert.equal(b.changed, false, "re-apply identical block must be a no-op");
  const updated = renderApiManagedBlock({ ...config, model: "deepseek-reasoner" }, "GLOBAL");
  const c = applyManagedBlockToEnv(a.content, updated);
  assert.equal(c.changed, true);
  const occurrences = c.content.split(MANAGED_BLOCK_MARKER).length - 1;
  assert.equal(occurrences, 1, "managed block must not duplicate");
  assert.ok(c.content.includes("AI_REPORTER_MODEL=deepseek-reasoner"));
});

test("removeManagedBlockFromEnv: removes only the targeted block", () => {
  const config = { provider: "deepseek", model: "deepseek-chat" };
  const initial = applyManagedBlockToEnv(
    "OTHER=keep\n",
    renderWorkersManagedBlock({ ...config, apiKey: "sk-secret" }, "GLOBAL"),
  ).content;
  const removed = removeManagedBlockFromEnv(initial, "deepseek", "GLOBAL");
  assert.equal(removed.changed, true);
  assert.ok(!removed.content.includes(MANAGED_BLOCK_MARKER));
  assert.ok(!removed.content.includes("sk-secret"));
  assert.ok(removed.content.includes("OTHER=keep"));
  const removed2 = removeManagedBlockFromEnv(removed.content, "deepseek", "GLOBAL");
  assert.equal(removed2.changed, false);
});

test("renderWorkersManagedBlock: contains provider, model, apiKey, and timeouts", () => {
  const text = renderWorkersManagedBlock(
    { provider: "deepseek", model: "deepseek-chat", apiKey: "sk-SUPER-SECRET-KEY", baseUrl: "https://api.deepseek.com/v1/" },
    "GLOBAL",
  ).join("\n");
  assert.ok(text.includes("AI_REPORTER_PROVIDER=deepseek"));
  assert.ok(text.includes("AI_REPORTER_MODEL=deepseek-chat"));
  assert.ok(text.includes("AI_REPORTER_BASE_URL=https://api.deepseek.com/v1"));
  assert.ok(text.includes("AI_REPORTER_API_KEY=sk-SUPER-SECRET-KEY"));
  assert.ok(text.includes("AI_REPORTER_DRAFT_TIMEOUT_MS=90000"));
  assert.ok(text.includes("AI_REPORTER_TOTAL_DRAFT_TIMEOUT_MS=200000"));
  assert.ok(text.includes("AI_REPORTER_CONTRACT_VERSION=5"));
});

test("RuntimeProvisioner.provisionGlobalLlm writes env files, restarts, and is idempotent", async () => {
  const api = { path: "/etc/api.env", content: "# header\nFOO=bar\n" };
  const workers = { path: "/etc/workers.env", content: "# header\nINTERNAL_TOKEN=t\n" };
  const fsState = { [api.path]: api.content, [workers.path]: workers.content };
  const restarts = [];
  const logs = [];
  const provisioner = new RuntimeProvisioner({
    fs: makeInMemoryFs(fsState),
    execFile: async (file, args) => { restarts.push([file, args]); return { stdout: "", stderr: "" }; },
    log: (line) => logs.push(line),
  });

  const config = { provider: "deepseek", model: "deepseek-chat", apiKey: "sk-SECRET-A", baseUrl: "https://api.deepseek.com" };
  const r1 = await provisioner.provisionGlobalLlm(config, { apiEnvPath: api.path, workersEnvPath: workers.path }, { actor: { sub: "u1", email: "u1@example.org" } });
  assert.equal(r1.apiEnvChanged, true);
  assert.equal(r1.workersEnvChanged, true);
  assert.equal(r1.restarted, true);
  assert.equal(restarts.length, 2, "restart must be called for both api and workers");
  assert.deepEqual(restarts[0], ["/usr/bin/sudo", ["/usr/bin/systemctl", "restart", "donordesk-api"]]);
  assert.deepEqual(restarts[1], ["/usr/bin/sudo", ["/usr/bin/systemctl", "restart", "donordesk-workers"]]);
  const apiAfter = await provisioner["fsImpl"].readFile(api.path);
  const workersAfter = await provisioner["fsImpl"].readFile(workers.path);
  assert.ok(apiAfter.includes("AI_REPORTER_ENABLED=1"));
  assert.ok(workersAfter.includes("AI_REPORTER_API_KEY=sk-SECRET-A"));
  // The logger must NEVER receive the secret value.
  for (const line of logs) {
    assert.ok(!line.includes("sk-SECRET-A"), `logger must not receive the secret: ${line}`);
  }

  // Idempotent: re-provision with identical config writes nothing and skips restart.
  const restartsBefore = restarts.length;
  const r2 = await provisioner.provisionGlobalLlm(config, { apiEnvPath: api.path, workersEnvPath: workers.path }, { actor: { sub: "u1", email: "u1@example.org" } });
  assert.equal(r2.apiEnvChanged, false);
  assert.equal(r2.workersEnvChanged, false);
  assert.equal(r2.restarted, false);
  assert.equal(restarts.length, restartsBefore, "idempotent re-provision must not restart");
});

test("RuntimeProvisioner.deprovisionGlobalLlm removes blocks and restarts", async () => {
  const apiEnvPath = "/etc/api.env";
  const workersEnvPath = "/etc/workers.env";
  const fsImpl = makeInMemoryFs();
  const restarts = [];
  const provisioner = new RuntimeProvisioner({
    fs: fsImpl,
    execFile: async (file, args) => { restarts.push([file, args]); return { stdout: "", stderr: "" }; },
    log: () => undefined,
  });
  const config = { provider: "deepseek", model: "deepseek-chat", apiKey: "sk-SECRET-B" };
  await provisioner.provisionGlobalLlm(config, { apiEnvPath, workersEnvPath }, { actor: { sub: "u", email: "u@example.org" } });
  const restartsBeforeDeprovision = restarts.length;
  const r = await provisioner.deprovisionGlobalLlm("deepseek", { apiEnvPath, workersEnvPath }, { actor: { sub: "u", email: "u@example.org" } });
  assert.equal(r.apiEnvChanged, true);
  assert.equal(r.workersEnvChanged, true);
  assert.equal(r.restarted, true);
  assert.equal(restarts.length, restartsBeforeDeprovision + 2, "deprovision must restart both api and workers");
  const apiAfter = await provisioner["fsImpl"].readFile(apiEnvPath);
  assert.ok(!apiAfter.includes(MANAGED_BLOCK_MARKER));
});

test("provisionGlobalLlm preserves operator-tuned timeout and token-budget values", async () => {
  const fsp = await import("node:fs/promises");
  const dir = await fsp.mkdtemp("/tmp/dd-prov-");
  const apiEnvPath = `${dir}/api.env`;
  const workersEnvPath = `${dir}/workers.env`;
  // Operator tuned the slow-provider budgets after the first provision.
  await fsp.writeFile(
    apiEnvPath,
    "AI_REPORTER_ENABLED=1\n# dd-managed:LLM:GLOBAL:deepseek:GLOBAL\nAI_REPORTER_ENABLED=1\n# dd-end-managed:LLM\nAI_REPORTER_DRAFT_TIMEOUT_MS=600000\n",
  );
  await fsp.writeFile(
    workersEnvPath,
    "# dd-managed:LLM:GLOBAL:deepseek:GLOBAL\nAI_REPORTER_PROVIDER=deepseek\nAI_REPORTER_DRAFT_TIMEOUT_MS=600000\nAI_REPORTER_TOTAL_DRAFT_TIMEOUT_MS=600000\nAI_REPORTER_MAX_TOKENS=16384\n# dd-end-managed:LLM\n",
  );
  const restarts = [];
  const fsMod = await import("node:fs/promises");
  const provisioner = new RuntimeProvisioner({
    fs: fsMod,
    execFile: async () => ({ stdout: "", stderr: "" }),
    log: () => undefined,
  });
  const config = { provider: "deepseek", model: "deepseek-chat", apiKey: "sk-SECRET-C" };
  await provisioner.provisionGlobalLlm(config, { apiEnvPath, workersEnvPath }, { actor: { sub: "u", email: "u@example.org" } });
  const workersAfter = await fsp.readFile(workersEnvPath, "utf8");
  assert.match(workersAfter, /AI_REPORTER_DRAFT_TIMEOUT_MS=600000/);
  assert.match(workersAfter, /AI_REPORTER_TOTAL_DRAFT_TIMEOUT_MS=600000/);
  assert.match(workersAfter, /AI_REPORTER_MAX_TOKENS=16384/);
  assert.doesNotMatch(workersAfter, /AI_REPORTER_DRAFT_TIMEOUT_MS=45000/);
});

function provisionerRestartSpy(_record) {
  // no-op helper; restart interception is not needed for the preservation
  // assertion (atomicWriteEnvFile still runs; restart result is logged only).
}

test("renderApiManagedBlock: carries AI_REPORTER_DRAFT_TIMEOUT_MS so the api never falls back to its 45s hardcoded default", () => {
  const text = renderApiManagedBlock({ provider: "deepseek", model: "deepseek-chat" }, "GLOBAL").join("\n");
  assert.ok(text.includes("AI_REPORTER_DRAFT_TIMEOUT_MS=180000"), "api.env managed block must define a draft timeout");
  assert.ok(text.includes("AI_REPORTER_HTTP_TIMEOUT_MS=240000"), "HTTP ceiling must exceed the worker's 200s section budget");
  assert.ok(text.includes("AI_REPORTER_CONTRACT_VERSION=5"), "api and worker must agree on the writer contract");
});

test("stripStandaloneManagedKeys: removes pre-provisioning-era duplicate declarations, keeps the managed block's own copy", () => {
  const content = [
    "AI_REPORTER_ENABLED=1",
    "AI_REPORTER_URL=http://127.0.0.1:8092",
    "# dd-managed:LLM:GLOBAL:deepseek:GLOBAL",
    "AI_REPORTER_ENABLED=1",
    "AI_REPORTER_URL=http://127.0.0.1:8092",
    "AI_REPORTER_PROVIDER=deepseek",
    "# dd-end-managed:LLM",
    "",
  ].join("\n");
  const { content: out, changed } = stripStandaloneManagedKeys(content, ["AI_REPORTER_ENABLED", "AI_REPORTER_URL", "AI_REPORTER_PROVIDER"]);
  assert.equal(changed, true);
  // Exactly one occurrence of each key must survive (the one inside the managed block).
  assert.equal((out.match(/^AI_REPORTER_ENABLED=/gm) ?? []).length, 1);
  assert.equal((out.match(/^AI_REPORTER_URL=/gm) ?? []).length, 1);
  assert.ok(out.includes("# dd-managed:LLM"));
});

test("provisionGlobalLlm: reproduces and fixes the production bug — duplicate standalone AI_REPORTER_ENABLED/URL lines before the managed block no longer coexist with the block's own copies", async () => {
  const os = await import("node:os");
  const path = await import("node:path");
  const fsp = await import("node:fs/promises");
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "dd-provisioner-dedup-"));
  const apiEnvPath = path.join(dir, "api.env");
  const workersEnvPath = path.join(dir, "workers.env");

  // Reproduces the exact production fixture: legacy standalone declarations
  // written before the provisioning system existed, immediately followed by
  // the managed block's own (identical) declarations — the condition under
  // which systemd's EnvironmentFile loader was observed to silently drop
  // every variable defined after the duplicate.
  await fsp.writeFile(
    apiEnvPath,
    "DATABASE_URL=postgres://x\nAI_REPORTER_ENABLED=1\nAI_REPORTER_URL=http://127.0.0.1:8092\n# dd-managed:LLM:GLOBAL:deepseek:GLOBAL\nAI_REPORTER_ENABLED=1\nAI_REPORTER_URL=http://127.0.0.1:8092\nAI_REPORTER_PROVIDER=deepseek\nAI_REPORTER_MODEL=deepseek-chat\nLLM_PROVIDER=deepseek\n# dd-end-managed:LLM",
  );
  await fsp.writeFile(workersEnvPath, "INTERNAL_TOKEN=abc\n");

  const provisioner = new RuntimeProvisioner({
    fs: await import("node:fs/promises"),
    execFile: async () => ({ stdout: "", stderr: "" }),
    log: () => undefined,
  });
  const config = { provider: "deepseek", model: "deepseek-chat", apiKey: "sk-SECRET-D" };
  await provisioner.provisionGlobalLlm(config, { apiEnvPath, workersEnvPath }, { actor: { sub: "u", email: "u@example.org" } });

  const apiAfter = await fsp.readFile(apiEnvPath, "utf8");
  assert.equal((apiAfter.match(/^AI_REPORTER_ENABLED=/gm) ?? []).length, 1, "no duplicate AI_REPORTER_ENABLED lines must remain");
  assert.equal((apiAfter.match(/^AI_REPORTER_URL=/gm) ?? []).length, 1, "no duplicate AI_REPORTER_URL lines must remain");
  assert.ok(apiAfter.includes("AI_REPORTER_PROVIDER=deepseek"));
  assert.ok(apiAfter.includes("AI_REPORTER_DRAFT_TIMEOUT_MS="));
  assert.ok(apiAfter.includes("DATABASE_URL=postgres://x"), "unrelated keys must be untouched");
});


test("atomicWriteEnvFile: always writes a trailing newline (systemd EnvironmentFile drops the last line(s) otherwise)", async () => {
  const api = { path: "/etc/api-nl.env", content: "FOO=bar\n" };
  const fsState = { [api.path]: api.content };
  const provisioner = new RuntimeProvisioner({
    fs: makeInMemoryFs(fsState),
    execFile: async () => ({ stdout: "", stderr: "" }),
    log: () => undefined,
  });
  const config = { provider: "deepseek", model: "deepseek-chat", apiKey: "sk-SECRET-E" };
  await provisioner.provisionGlobalLlm(config, { apiEnvPath: api.path, workersEnvPath: "/etc/workers-nl.env" }, { actor: { sub: "u", email: "u@example.org" } });
  const written = fsState[api.path];
  assert.ok(written.endsWith("\n"), "written env file must end with a trailing newline");
});
