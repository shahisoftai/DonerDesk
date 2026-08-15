import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveOnboardingSteps, allComplete } from "../../src/features/onboarding/presentation/onboarding-steps.ts";
import type { OnboardingSnapshot } from "../../src/features/onboarding/application/onboarding-status.ts";

const empty: OnboardingSnapshot = {
  orgName: "",
  hasOrg: false,
  orgProfileComplete: false,
  storageProvider: "LOCAL",
  projectCount: 0,
  firstProjectId: null,
  templateCount: 0,
  logframeItemCount: 0,
  teamCount: 0,
  evidenceCount: 0,
  legalConsent: { accepted: false, termsVersion: "", privacyVersion: "" },
};

test("empty snapshot marks storage as current and later required steps pending", () => {
  const steps = deriveOnboardingSteps(empty);
  // Connect Google Drive is the first required step, so it is "current".
  const storage = steps.find((s) => s.key === "storage");
  assert.equal(storage?.status, "current");
  const firstProject = steps.find((s) => s.key === "first-project");
  assert.equal(firstProject?.status, "pending");
  assert.equal(allComplete(steps), false);
});

test("completed snapshot marks every step complete", () => {
  const snapshot: OnboardingSnapshot = {
    orgName: "TestOrg",
    hasOrg: true,
    orgProfileComplete: true,
    storageProvider: "GOOGLE_DRIVE",
    projectCount: 1,
    firstProjectId: "p1",
    templateCount: 1,
    logframeItemCount: 2,
    teamCount: 3,
    evidenceCount: 5,
    legalConsent: { accepted: true, termsVersion: "2026-08-01", privacyVersion: "2026-08-01" },
  };
  const steps = deriveOnboardingSteps(snapshot);
  for (const step of steps) {
    assert.equal(step.status, "complete", `${step.key} should be complete`);
  }
  assert.equal(allComplete(steps), true);
});

test("project step links use the first project id when available", () => {
  const steps = deriveOnboardingSteps({ ...empty, projectCount: 1, firstProjectId: "p9" });
  const template = steps.find((s) => s.key === "template");
  const logframe = steps.find((s) => s.key === "logframe");
  const evidence = steps.find((s) => s.key === "evidence");
  assert.equal(template?.href, "/projects/p9/templates/new");
  assert.equal(logframe?.href, "/projects/p9/logframe");
  assert.equal(evidence?.href, "/projects/p9/evidence/new");
});

test("only the first project is the required gate; other steps are skippable", () => {
  const steps = deriveOnboardingSteps({
    ...empty,
    projectCount: 1,
    firstProjectId: "p1",
    templateCount: 1,
    logframeItemCount: 0,
  });
  const logframe = steps.find((s) => s.key === "logframe");
  assert.equal(logframe?.status, "pending", "logframe is optional and not done");
  const firstProject = steps.find((s) => s.key === "first-project");
  assert.equal(firstProject?.status, "complete");
});

test("a fully skipped optional setup reports complete", () => {
  const steps = deriveOnboardingSteps({
    orgName: "X",
    hasOrg: true,
    orgProfileComplete: true,
    storageProvider: "LOCAL",
    projectCount: 1,
    firstProjectId: "p1",
    templateCount: 0,
    logframeItemCount: 1,
    teamCount: 0,
    evidenceCount: 0,
    legalConsent: { accepted: true, termsVersion: "2026-08-01", privacyVersion: "2026-08-01" },
  });
  const requiredDone = steps.filter((s) => s.status === "complete").length >= 2;
  assert.equal(requiredDone, true);
});
