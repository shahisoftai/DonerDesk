import assert from "node:assert/strict";
import test from "node:test";
import { importNotesFile } from "../../src/features/imports/domain/notes-file.ts";

test("every note becomes one line under a Note column; commas and quotes are quoted", () => {
  assert.equal(importNotesFile(["Row 3: no date", 'Row 4: "OUT-1", unknown code']), 'Note\nRow 3: no date\n"Row 4: ""OUT-1"", unknown code"\n');
  assert.equal(importNotesFile([]), "Note\n");
});
