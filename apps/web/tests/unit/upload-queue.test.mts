import { test } from "node:test";
import assert from "node:assert/strict";
import {
  uploadReducer,
  titleFromFile,
  countByState,
  type UploadItem,
} from "../../src/features/evidence/presentation/upload-queue.ts";

function makeFile(name: string, size = 100, lastModified = 1): File {
  return new File([new Uint8Array(size)], name, { lastModified });
}

function items(): UploadItem[] {
  const f = makeFile("a.pdf");
  return [{ key: `${f.name}:${f.size}:${f.lastModified}`, file: f, title: "a", state: "queued" }];
}

test("titleFromFile strips the extension", () => {
  assert.equal(titleFromFile(makeFile("field-report.pdf")), "field-report");
  assert.equal(titleFromFile(makeFile("notes")), "notes");
});

test("add appends unique files and ignores duplicates", () => {
  const f = makeFile("a.pdf");
  let state = uploadReducer([], { type: "add", files: [{ file: f, title: "a" }] });
  state = uploadReducer(state, { type: "add", files: [{ file: f, title: "a" }] });
  assert.equal(state.length, 1);
});

test("state transitions queued -> uploading -> success", () => {
  const key = items()[0]!.key;
  let state = items();
  state = uploadReducer(state, { type: "start", key });
  assert.equal(state[0]!.state, "uploading");
  state = uploadReducer(state, { type: "success", key, id: "ev-1" });
  assert.equal(state[0]!.state, "success");
  assert.equal(state[0]!.uploadedId, "ev-1");
});

test("failure keeps error message and retry returns to queued", () => {
  const key = items()[0]!.key;
  let state = items();
  state = uploadReducer(state, { type: "start", key });
  state = uploadReducer(state, { type: "fail", key, error: "timeout" });
  assert.equal(state[0]!.state, "error");
  assert.equal(state[0]!.error, "timeout");
  state = uploadReducer(state, { type: "retry", key });
  assert.equal(state[0]!.state, "queued");
  assert.equal(state[0]!.error, undefined);
});

test("remove deletes an item", () => {
  const key = items()[0]!.key;
  const state = uploadReducer(items(), { type: "remove", key });
  assert.equal(state.length, 0);
});

test("countByState counts correctly", () => {
  const key = items()[0]!.key;
  let state = items();
  state = uploadReducer(state, { type: "start", key });
  assert.equal(countByState(state, "uploading"), 1);
  assert.equal(countByState(state, "queued"), 0);
});
