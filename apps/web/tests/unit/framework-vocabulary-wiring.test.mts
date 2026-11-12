import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const SRC = join(import.meta.dirname, "..", "..", "src");

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

// Phase 52.0: a level is named through the project's vocabulary, never by a word typed into a screen.
test("the hard-coded level table is gone and no logframe screen spells a level by hand", () => {
  const labels = readFileSync(join(SRC, "lib", "labels.ts"), "utf8");
  assert.doesNotMatch(labels, /LOGFRAME_LEVEL_LABEL/);
  const offenders: string[] = [];
  for (const file of [...files(join(SRC, "features", "logframe")), ...files(join(SRC, "app", "(portal)", "projects", "[id]", "logframe"))]) {
    const text = readFileSync(file, "utf8");
    if (/LOGFRAME_LEVEL_LABEL/.test(text)) offenders.push(`${file}: reads the removed level table`);
    if (/GOAL:\s*"(Goal|Impact)"|"Goal → Outcome/.test(text)) offenders.push(`${file}: spells the levels by hand`);
  }
  assert.deepEqual(offenders, []);
});

test("every screen that shows a level name reads it from the vocabulary hook", () => {
  const users = files(SRC).filter((f) => /useLevelName\(\)/.test(readFileSync(f, "utf8")) && !/FrameworkVocabularyProvider\.tsx$/.test(f));
  assert.ok(users.length >= 7, `expected the logframe and entry screens to use the hook, found ${users.length}`);
  for (const file of users) assert.match(readFileSync(file, "utf8"), /from ".*FrameworkVocabularyProvider"/, file);
});
