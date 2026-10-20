import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

// The unit tests build the server with `buildServer()`; production starts it with `start()`, which adds timers and listens.
// A hook added after listen crashed production once (FST_ERR_INSTANCE_ALREADY_LISTENING): this starts the real entry point.
async function freePort() {
  return new Promise((resolve) => {
    const s = createServer().listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

test("the real server entry point starts, listens and answers /health", async () => {
  const port = await freePort();
  const child = spawn(process.execPath, ["dist/server.js"], {
    env: {
      ...process.env, PORT: String(port), HOST: "127.0.0.1", LOG_LEVEL: "info",
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://test:test@127.0.0.1:5432/donordesk",
      DATABASE_ADMIN_URL: process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL ?? "postgresql://test:test@127.0.0.1:5432/donordesk",
      JWT_SECRET: "test-secret-that-is-at-least-32-characters", INTERNAL_TOKEN: "boot-test", JOB_RETRY_INTERVAL_MS: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (d) => { output += d; });
  child.stderr.on("data", (d) => { output += d; });
  let exited = null;
  child.on("exit", (code) => { exited = code; });
  try {
    let status = 0;
    for (let i = 0; i < 40 && exited === null; i += 1) {
      try { status = (await fetch(`http://127.0.0.1:${port}/health`)).status; break; } catch { await new Promise((r) => setTimeout(r, 250)); }
    }
    assert.equal(exited, null, `the server exited (${exited}) while starting:\n${output.slice(-1500)}`);
    assert.equal(status, 200, output.slice(-1500));
    assert.doesNotMatch(output, /FST_ERR|Failed to start/);
  } finally {
    child.kill();
  }
});
