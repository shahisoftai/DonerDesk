import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

// Prisma clients are pooled and shared across requests. A route that disconnects one kills whatever other requests of that
// organisation have in flight ("Transaction not found", or a request that never answers): /v1/auth/mfa did so on every page load.
test("no route disconnects a pooled Prisma client", () => {
  const dir = new URL("../src/routes/", import.meta.url);
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts"))) assert.ok(!readFileSync(new URL(f, dir), "utf8").includes("$disconnect"), `${f} disconnects a pooled client`);
});
