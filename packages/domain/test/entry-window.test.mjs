import test from "node:test";
import assert from "node:assert/strict";
import { validateEntryWindow, entryWindowState, entryWindowRefusal, describeEntryWindow } from "../dist/index.js";

test("validation: real days, closing not before opening, empty means unset", () => {
  assert.deepEqual(validateEntryWindow({ opensOn: "2026-12-01", closesOn: "2026-12-10" }).value, { opensOn: "2026-12-01", closesOn: "2026-12-10" });
  assert.deepEqual(validateEntryWindow({ opensOn: "", closesOn: null }).value, {});
  assert.match(validateEntryWindow({ opensOn: "2026-02-30" }).error.message, /opening day is not a date/);
  assert.match(validateEntryWindow({ closesOn: "soon" }).error.message, /closing day is not a date/);
  assert.match(validateEntryWindow({ opensOn: "2026-12-10", closesOn: "2026-12-01" }).error.message, /cannot close before it opens/);
  assert.ok(validateEntryWindow({ opensOn: "2026-12-01", closesOn: "2026-12-01" }).ok);
});

test("state: no window is open; before, inside (both ends included) and after", () => {
  const w = { opensOn: "2026-12-01", closesOn: "2026-12-10" };
  assert.equal(entryWindowState({}, "2030-01-01"), "OPEN");
  assert.equal(entryWindowState(w, "2026-11-30"), "NOT_YET");
  assert.equal(entryWindowState(w, "2026-12-01"), "OPEN");
  assert.equal(entryWindowState(w, "2026-12-10"), "OPEN");
  assert.equal(entryWindowState(w, "2026-12-11"), "CLOSED");
  assert.equal(entryWindowState({ closesOn: "2026-12-10" }, "2020-01-01"), "OPEN");
  assert.equal(entryWindowState({ opensOn: "2026-12-01" }, "2030-01-01"), "OPEN");
});

test("messages name the dates; nothing is said when entry is allowed", () => {
  const w = { opensOn: "2026-12-01", closesOn: "2026-12-10" };
  assert.equal(entryWindowRefusal(w, "2026-12-05"), null);
  assert.match(entryWindowRefusal(w, "2026-11-20"), /opens on 1 Dec 2026\. A reviewer can enter values before then/);
  assert.match(entryWindowRefusal(w, "2026-12-20"), /closed on 10 Dec 2026\. Ask a reviewer/);
  assert.equal(describeEntryWindow({}, "2026-12-05"), null);
  assert.equal(describeEntryWindow(w, "2026-12-05"), "Entry is open until 10 Dec 2026.");
  assert.equal(describeEntryWindow({ opensOn: "2026-12-01" }, "2026-12-05"), "Entry is open.");
  assert.equal(describeEntryWindow({ closesOn: "2026-12-10" }, "2026-12-20"), "Entry closed on 10 Dec 2026.");
  assert.equal(describeEntryWindow(w, "2026-11-01"), "Entry opens on 1 Dec 2026 and closes on 10 Dec 2026.");
  assert.equal(describeEntryWindow({ opensOn: "2026-12-01" }, "2026-11-01"), "Entry opens on 1 Dec 2026.");
});
