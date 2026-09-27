import assert from "node:assert/strict";
import test from "node:test";
import { excludeRestrictedEvidence } from "../dist/index.js";

const pkg = (id, confidentialityLevel) => ({ evidenceId: id, confidentialityLevel, chunks: [] });

test("restricted (sensitive / highly sensitive) evidence is withheld from the report writer", () => {
  const kept = excludeRestrictedEvidence([
    pkg("public", "PUBLIC"),
    pkg("internal", "INTERNAL"),
    pkg("sensitive", "SENSITIVE"),
    pkg("highly", "HIGHLY_SENSITIVE"),
  ]);
  assert.deepEqual(kept.map((p) => p.evidenceId), ["public", "internal"]);
});
