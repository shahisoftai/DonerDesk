import assert from "node:assert/strict";
import test from "node:test";
import {
  RuntimeProvisioner,
  applyManagedBlockToEnv,
  removeManagedBlockFromEnv,
  renderApiManagedBlock,
  renderWorkersManagedBlock,
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
  assert.ok(text.includes("AI_REPORTER_DRAFT_TIMEOUT_MS=45000"));
  assert.ok(text.includes("AI_REPORTER_CONTRACT_VERSION=2"));
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
