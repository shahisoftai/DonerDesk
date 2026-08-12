import { test } from "node:test";
import assert from "node:assert/strict";
import {
  autosaveReducer,
  createAutosaveState,
  isDirty,
  type AutosaveState,
} from "../../src/features/reporting/application/autosave-reducer.ts";

function state(): AutosaveState {
  return createAutosaveState("hello", "v1");
}

test("init creates an idle, clean state", () => {
  const s = createAutosaveState("text", "v1");
  assert.equal(s.status, "idle");
  assert.equal(s.text, "text");
  assert.equal(s.savedText, "text");
  assert.equal(s.version, "v1");
});

test("typing makes the state dirty and back to idle when equal to saved", () => {
  let s = state();
  s = autosaveReducer(s, { type: "input", text: "hello world" });
  assert.equal(s.status, "dirty");
  assert.equal(isDirty(s), true);
  s = autosaveReducer(s, { type: "input", text: "hello" });
  assert.equal(s.status, "idle");
});

test("save success updates version and savedText", () => {
  let s = autosaveReducer(state(), { type: "input", text: "edited" });
  s = autosaveReducer(s, { type: "save-start" });
  assert.equal(s.status, "saving");
  s = autosaveReducer(s, { type: "save-success", version: "v2" });
  assert.equal(s.status, "saved");
  assert.equal(s.version, "v2");
  assert.equal(s.savedText, "edited");
  assert.equal(isDirty(s), false);
});

test("conflict preserves local text as recovery", () => {
  let s = autosaveReducer(state(), { type: "input", text: "local change" });
  s = autosaveReducer(s, { type: "conflict", error: "changed elsewhere" });
  assert.equal(s.status, "conflict");
  assert.equal(s.recovery, "local change");
  assert.equal(s.error, "changed elsewhere");
});

test("discard-local reverts to the saved text", () => {
  let s = autosaveReducer(state(), { type: "input", text: "local change" });
  s = autosaveReducer(s, { type: "conflict", error: "conflict" });
  s = autosaveReducer(s, { type: "discard-local" });
  assert.equal(s.status, "idle");
  assert.equal(s.text, "hello");
  assert.equal(s.recovery, undefined);
});

test("save failure keeps text and marks failed", () => {
  let s = autosaveReducer(state(), { type: "input", text: "edited" });
  s = autosaveReducer(s, { type: "save-start" });
  s = autosaveReducer(s, { type: "save-fail", error: "network" });
  assert.equal(s.status, "failed");
  assert.equal(s.error, "network");
});
