import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..", "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== "node_modules" && name !== "dist") files(path, out); }
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

// Phase 52 (open/closed): a lens is a row in FRAMEWORK_LENSES; nothing branches on a lens by name.
test("no code outside the lens table branches on a lens or spells a level word by hand", () => {
  const scope = [
    ...files(join(ROOT, "packages", "domain", "src", "contexts", "logframe")),
    ...files(join(ROOT, "packages", "application", "src", "use-cases", "logframe")),
    ...files(join(ROOT, "apps", "web", "src", "features", "logframe")),
    join(ROOT, "apps", "web", "src", "app", "(portal)", "projects", "[id]", "logframe", "page.tsx"),
  ].filter((f) => !/framework-lenses\.ts$|framework-vocabulary\.ts$/.test(f));
  const offenders: string[] = [];
  for (const file of scope) {
    const text = readFileSync(file, "utf8");
    if (/\blens\s*===|===\s*lens\b|(?:===|!==)\s*"(?:RESULTS|LOGFRAME)"|case\s+"(?:RESULTS|LOGFRAME)"/.test(text)) offenders.push(`${file}: branches on a lens by name`);
  }
  assert.deepEqual(offenders, []);
});

test("the framework modules stay small, with at most one class each", () => {
  const names = ["framework-lenses", "framework-vocabulary", "framework-change-rules", "framework-change-classifier"];
  for (const name of names) {
    const text = read("packages", "domain", "src", "contexts", "logframe", `${name}.ts`);
    assert.ok(text.split("\n").length <= 300, `${name} is over 300 lines`);
    assert.ok((text.match(/^export class /gm) ?? []).length <= 1, `${name} has more than one class`);
  }
  for (const file of ["update-logframe-item", "get-framework-document"]) {
    const text = read("packages", "application", "src", "use-cases", "logframe", `${file}.ts`);
    assert.ok(text.split("\n").length <= 300, `${file} is over 300 lines`);
    assert.equal((text.match(/^export class /gm) ?? []).length, 1, `${file} should hold exactly one handler`);
  }
});

test("the domain framework modules import nothing outside the domain", () => {
  for (const name of ["framework-lenses", "framework-vocabulary", "framework-change-rules", "framework-change-classifier"]) {
    const imports = [...read("packages", "domain", "src", "contexts", "logframe", `${name}.ts`).matchAll(/from "([^"]+)"/g)].map((m) => m[1]!);
    for (const spec of imports) assert.ok(spec.startsWith("."), `${name} imports ${spec}`);
  }
});
