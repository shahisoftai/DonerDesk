import assert from "node:assert/strict";
import test from "node:test";
import {
  DONOR_PACK_BLUEPRINTS,
  instantiateDonorPackBlueprint,
  listDonorPackBlueprintKeys,
} from "../dist/index.js";

test("blueprint catalog covers the flagship donor mechanisms", () => {
  assert.deepEqual(listDonorPackBlueprintKeys().sort(), ["echo-hip", "unhcr-ppa", "usaid-qpr"]);
});

test("instantiate produces a valid pack for each blueprint (createRequirementPack invariants)", () => {
  for (const key of listDonorPackBlueprintKeys()) {
    const pack = instantiateDonorPackBlueprint({ key, id: `pack-${key}` });
    assert.equal(pack.id, `pack-${key}`);
    assert.equal(pack.status, "DRAFT");
    assert.ok(pack.requirements.length >= 4, `${key} should carry distinctive requirements`);
    for (const r of pack.requirements) {
      assert.equal(r.sourceReference.sourceType, "DONOR_PACK");
      assert.equal(r.sourceReference.sourceId, `blueprint:${key}`);
      assert.ok(r.key.includes(":"));
    }
  }
});

test("QUESTION blueprint requirements carry interrogative guidance", () => {
  const pack = instantiateDonorPackBlueprint({ key: "usaid-qpr", id: "p1" });
  const questions = pack.requirements.filter((r) => r.kind === "QUESTION");
  assert.ok(questions.length >= 2);
  for (const q of questions) {
    assert.ok(q.guidance && q.guidance.trim().length > 0, "QUESTION requirements must state the question in guidance");
  }
});

test("unknown keys fail loudly with the known catalog", () => {
  assert.throws(() => instantiateDonorPackBlueprint({ key: "nope", id: "p2" }), /Unknown donor pack blueprint: nope/);
});

test("catalog keys are unique (OCP: adding a pack is a data entry)", () => {
  const keys = DONOR_PACK_BLUEPRINTS.map((b) => b.key);
  assert.equal(new Set(keys).size, keys.length);
  const donorMechanism = DONOR_PACK_BLUEPRINTS.map((b) => `${b.donorKey}:${b.mechanismKey}`);
  assert.equal(new Set(donorMechanism).size, donorMechanism.length);
});
