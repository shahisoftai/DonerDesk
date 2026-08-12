import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const srcRoot = join(import.meta.dirname, "..", "..", "src");

function filesIn(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesIn(full));
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const clientFiles = filesIn(srcRoot).filter((f) => {
  const content = readFileSync(f, "utf8");
  return content.includes('"use client"');
});

test("session-client.ts browser token access has been removed", () => {
  const file = join(srcRoot, "lib", "session-client.ts");
  assert.equal(existsSync(file), false, "session-client.ts must not exist");
});

test("no client component reads the session token from the browser cookie", () => {
  for (const file of clientFiles) {
    const content = readFileSync(file, "utf8");
    assert.equal(content.includes("getClientToken"), false, `${relative(srcRoot, file)} must not call getClientToken`);
    assert.equal(content.includes("getSessionToken"), false, `${relative(srcRoot, file)} must not call getSessionToken`);
    assert.doesNotMatch(content, /dd_session/i, `${relative(srcRoot, file)} must not read the dd_session cookie in the browser`);
  }
});

test("server-only gateway modules are marked with server-only", () => {
  const gateway = readFileSync(join(srcRoot, "lib", "server", "api-gateway.ts"), "utf8");
  assert.match(gateway, /server-only/);
  const authCtx = readFileSync(join(srcRoot, "lib", "server", "auth-context.ts"), "utf8");
  assert.match(authCtx, /server-only/);
});
