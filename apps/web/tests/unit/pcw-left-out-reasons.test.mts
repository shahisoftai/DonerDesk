import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// The web schema keeps its own list; a reason the domain adds and this list lacks makes every draft holding it fail to open.
test("the draft schema accepts every left-out reason the domain can report", () => {
  const domain = readFileSync(new URL("../../../../packages/domain/src/contexts/project-setup/pcw/run-views.ts", import.meta.url), "utf8");
  const schema = readFileSync(new URL("../../src/lib/server/schemas-project-setup-draft.ts", import.meta.url), "utf8");
  const reasons = /READING_LEFT_OUT_REASONS = \[([^\]]+)\]/.exec(domain)![1]!.match(/"[A-Z_]+"/g)!;
  assert.ok(reasons.length >= 4);
  for (const r of reasons) assert.ok(schema.includes(r), `${r} is missing from the web schema`);
});
