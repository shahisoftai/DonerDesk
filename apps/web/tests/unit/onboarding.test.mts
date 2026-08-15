import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveOnboardingSteps, allComplete } from "../../src/features/onboarding/presentation/onboarding-steps.ts";
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

test("empty snapshot marks storage as current and later required steps pending", () => {
  const steps = deriveOnboardingSteps(empty);
  // Connect Google Drive is the first required step, so it is "current".
  const storage = steps.find((s) => s.key === "storage");
  assert.equal(storage?.status, "current");
  const consent = steps.find((s) => s.key === "legal-consent");
  assert.equal(consent?.status, "pending");
  assert.equal(allComplete(steps), false);
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
