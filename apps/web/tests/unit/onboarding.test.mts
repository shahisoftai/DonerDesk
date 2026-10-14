import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveOnboardingSteps, allComplete, canStartWorking } from "../../src/features/onboarding/presentation/onboarding-steps.ts";
import type { OnboardingSnapshot } from "../../src/features/onboarding/application/onboarding-status.ts";

const empty: OnboardingSnapshot = {
  orgName: "",
  hasOrg: false,
  orgProfileComplete: false,
  storageProvider: "LOCAL",
  teamCount: 0,
  legalConsent: { accepted: false, termsVersion: "", privacyVersion: "" },
  reportingDefaultsComplete: false,
};

test("onboarding has no project-specific steps (Feature 18 scope)", () => {
  const steps = deriveOnboardingSteps(empty);
  const keys = steps.map((s) => s.key);
  assert.ok(!keys.includes("first-project"), "first-project must not be an account onboarding step");
  assert.ok(!keys.includes("template"), "template must not be an account onboarding step");
  assert.ok(!keys.includes("logframe"), "logframe must not be an account onboarding step");
  assert.ok(!keys.includes("evidence"), "evidence must not be an account onboarding step");
  // Account-wide steps remain.
  assert.ok(keys.includes("storage"));
  assert.ok(keys.includes("organization"));
  assert.ok(keys.includes("reporting-defaults"));
  assert.ok(keys.includes("team"));
  assert.ok(keys.includes("legal-consent"));
});

test("only the terms are required: they come first and are the current step; the rest are optional", () => {
  const steps = deriveOnboardingSteps(empty);
  assert.equal(steps[0]?.key, "legal-consent");
  assert.equal(steps[0]?.status, "current");
  assert.deepEqual(steps.filter((s) => !s.optional).map((s) => s.key), ["legal-consent"]);
  assert.equal(steps.find((s) => s.key === "storage")?.status, "pending");
  assert.equal(allComplete(steps), false);
  assert.equal(canStartWorking(steps), false);
});

test("accepting the terms is enough to start working, even with nothing else done", () => {
  const steps = deriveOnboardingSteps({ ...empty, legalConsent: { accepted: true, termsVersion: "v", privacyVersion: "v" } });
  assert.equal(canStartWorking(steps), true);
  assert.equal(allComplete(steps), true);
});

test("completed snapshot marks every step complete", () => {
  const snapshot: OnboardingSnapshot = {
    orgName: "TestOrg",
    hasOrg: true,
    orgProfileComplete: true,
    storageProvider: "GOOGLE_DRIVE",
    teamCount: 3,
    legalConsent: { accepted: true, termsVersion: "2026-08-01", privacyVersion: "2026-08-01" },
    reportingDefaultsComplete: true,
    defaultReportingTone: "CONCISE",
  };
  const steps = deriveOnboardingSteps(snapshot);
  for (const step of steps) {
    assert.equal(step.status, "complete", `${step.key} should be complete`);
  }
  assert.equal(allComplete(steps), true);
});

test("reporting-defaults is optional and summarized with its tone", () => {
  const steps = deriveOnboardingSteps({
    ...empty,
    reportingDefaultsComplete: true,
    defaultReportingTone: "CONCISE",
  });
  const defaults = steps.find((s) => s.key === "reporting-defaults");
  assert.equal(defaults?.status, "complete");
  assert.match(defaults?.summary ?? "", /CONCISE/);
});

test("a fully skipped optional setup reports complete", () => {
  const steps = deriveOnboardingSteps({
    orgName: "X",
    hasOrg: true,
    orgProfileComplete: true,
    storageProvider: "LOCAL",
    teamCount: 0,
    legalConsent: { accepted: true, termsVersion: "2026-08-01", privacyVersion: "2026-08-01" },
    reportingDefaultsComplete: false,
  });
  const requiredDone = steps.filter((s) => s.status === "complete").length >= 2;
  assert.equal(requiredDone, true);
});
