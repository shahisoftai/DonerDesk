import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

/**
 * The portal layout's gates (terms, two-step sign-in, a restricted role's pages) read the `x-pathname` header the middleware sets, and the
 * middleware only runs for the paths in its matcher. A portal route missing from the matcher has no header, so a gate that reads it sees
 * nothing (it let a field officer open /where-we-work). Every route of the portal must be in the matcher.
 */
const matcher = [...readFileSync(new URL("../../src/middleware.ts", import.meta.url), "utf8").matchAll(/"(\/[^"]+)"/g)].map((m) => m[1]!);
const covered = (segment: string): boolean => matcher.some((m) => m === `/${segment}` || m === `/${segment}/:path*`);

test("every top-level route of the portal gets the path header", () => {
  const portal = new URL("../../src/app/(portal)/", import.meta.url);
  const routes = readdirSync(portal, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("(") && !d.name.startsWith("_") && !d.name.startsWith("@"))
    .map((d) => d.name);
  assert.ok(routes.length > 10, "the portal has its routes");
  const missing = routes.filter((r) => !covered(r));
  assert.deepEqual(missing, []);
});
