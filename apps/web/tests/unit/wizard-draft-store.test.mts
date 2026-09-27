import { test } from "node:test";
import assert from "node:assert/strict";
import { createWizardDraftStore, hasWizardInput, parseWizardDraft, WIZARD_DRAFT_TTL_MS } from "../../src/features/projects/application/wizard-draft-store.ts";
import { emptyWizardData } from "../../src/features/projects/validation/project-wizard.ts";

function memory() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

test("round-trips a draft and clears it", () => {
  const storage = memory();
  let clock = 1_000;
  const store = createWizardDraftStore(storage, { maxStepIndex: 2, now: () => clock });
  const data = emptyWizardData();
  data.step.title = "Nutrition response";
  store.save({ data, stepIndex: 1 });
  const loaded = store.load();
  assert.equal(loaded?.data.step.title, "Nutrition response");
  assert.equal(loaded?.stepIndex, 1);
  assert.equal(loaded?.savedAt, 1_000);
  store.clear();
  assert.equal(store.load(), null);
});

test("expired, empty, corrupt or tampered drafts are discarded or repaired", () => {
  const storage = memory();
  let clock = 0;
  const store = createWizardDraftStore(storage, { maxStepIndex: 2, now: () => clock });
  const data = emptyWizardData();
  data.step.title = "x";
  store.save({ data, stepIndex: 2 });
  clock = WIZARD_DRAFT_TTL_MS + 1;
  assert.equal(store.load(), null);
  assert.equal(storage.map.size, 0);

  store.save({ data: emptyWizardData(), stepIndex: 0 });
  assert.equal(store.load(), null);

  storage.setItem("donordesk.project-wizard.draft", "{not json");
  assert.equal(store.load(), null);

  const repaired = parseWizardDraft(
    { stepIndex: 99, data: { step: { title: "T", evil: "<x>" }, geography: { sector: "NOPE", country: 5 }, reporting: { reportingFrequency: "HOURLY" } } },
    2,
  );
  assert.equal(repaired?.stepIndex, 2);
  assert.equal(repaired?.data.geography.sector, "NUTRITION");
  assert.equal(repaired?.data.geography.country, "");
  assert.equal(repaired?.data.reporting.reportingFrequency, "QUARTERLY");
  assert.equal("evil" in (repaired?.data.step ?? {}), false);
});

test("no storage (private mode / SSR) is a silent no-op", () => {
  const store = createWizardDraftStore(null, { maxStepIndex: 2 });
  store.save({ data: emptyWizardData(), stepIndex: 0 });
  assert.equal(store.load(), null);
});

test("hasWizardInput ignores defaults", () => {
  const data = emptyWizardData();
  assert.equal(hasWizardInput(data), false);
  data.geography.sector = "WASH";
  assert.equal(hasWizardInput(data), true);
});
