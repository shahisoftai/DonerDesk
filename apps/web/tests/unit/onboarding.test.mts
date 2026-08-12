import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveOnboardingSteps, allComplete } from "../../src/features/onboarding/presentation/onboarding-steps.ts";
import type { OnboardingSnapshot } from "../../src/features/onboarding/application/onboarding-status.ts";

const empty: OnboardingSnapshot = {
  orgName: "",
  hasOrg: false,
  projectCount: 0,
  firstProjectId: null,
  templateCount: 0,
  logframeItemCount: 0,
  teamCount: 0,
  evidenceCount: 0,
};

test("empty snapshot marks first-project as current and later required steps pending", () => {
  const steps = deriveOnboardingSteps(empty);
  const firstProject = steps.find((s) => s.key === "first-project");
  assert.equal(firstProject?.status, "current");
  assert.equal(steps.find((s) => s.key === "organization")?.status, "pending");
  assert.equal(allComplete(steps), false);
});

test("completed snapshot marks every step complete", () => {
  const snapshot: OnboardingSnapshot = {
    orgName: "TestOrg",
    hasOrg: true,
    projectCount: 1,
    firstProjectId: "p1",
    templateCount: 1,
    logframeItemCount: 2,
    teamCount: 3,
    evidenceCount: 5,
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
    projectCount: 1,
    firstProjectId: "p1",
    templateCount: 0,
    logframeItemCount: 1,
    teamCount: 0,
    evidenceCount: 0,
  });
  const requiredDone = steps.filter((s) => s.status === "complete").length >= 2;
  assert.equal(requiredDone, true);
});
