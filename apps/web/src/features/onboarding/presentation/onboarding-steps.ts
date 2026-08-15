import type { OnboardingSnapshot } from "../application/onboarding-status";

export type OnboardingStepStatus = "complete" | "current" | "pending";

export type OnboardingStep = {
  key: string;
  label: string;
  description: string;
  href: string | null;
  status: OnboardingStepStatus;
  summary: string;
  optional?: boolean;
};

/**
 * Account-level onboarding steps. Project-specific setup (logframe, donor
 * template, indicators, evidence) is intentionally NOT here — it lives in the
 * per-project setup checklist at `/projects/[id]/setup` (Feature 18).
 */
const STEPS: Array<{
  key: string;
  label: string;
  description: string;
  href: string | null;
  status?: never;
  summary?: never;
  optional: boolean;
}> = [
  {
    key: "storage",
    label: "Connect Google Drive",
    description: "Store evidence in your own Google Drive.",
    href: "/onboarding/storage",
    optional: false,
  },
  {
    key: "organization",
    label: "Organization profile",
    description: "Confirm your organization details.",
    href: "/onboarding/profile",
    optional: true,
  },
  {
    key: "reporting-defaults",
    label: "Default reporting profile",
    description: "Set the default tone, language, and rules applied to every new project.",
    href: "/onboarding/reporting-defaults",
    optional: true,
  },
  {
    key: "team",
    label: "Invite your team",
    description: "Add teammates with the right roles.",
    href: "/onboarding/team",
    optional: true,
  },
  {
    key: "legal-consent",
    label: "Accept Terms of Service",
    description: "Review and accept the DonorDesk Terms of Service and Privacy Policy.",
    href: "/onboarding#legal-consent",
    optional: false,
  },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

export function deriveOnboardingSteps(snapshot: OnboardingSnapshot): OnboardingStep[] {
  const steps = STEPS.map((step) => ({ ...step }));

  const isComplete: Record<StepKey, boolean> = {
    storage: snapshot.storageProvider === "GOOGLE_DRIVE",
    organization: snapshot.orgProfileComplete,
    "reporting-defaults": snapshot.reportingDefaultsComplete,
    team: snapshot.teamCount > 1,
    "legal-consent": snapshot.legalConsent.accepted,
  };

  const summary: Record<StepKey, string> = {
    storage: snapshot.storageProvider === "GOOGLE_DRIVE" ? "Google Drive connected" : "Not connected",
    organization: snapshot.orgProfileComplete ? snapshot.orgName : "Profile not filled in",
    "reporting-defaults": snapshot.reportingDefaultsComplete
      ? `${snapshot.defaultReportingTone ?? "FORMAL"} · every new project`
      : "Defaults not set",
    team: snapshot.teamCount > 1 ? `${snapshot.teamCount} members` : "No teammates yet",
    "legal-consent": snapshot.legalConsent.accepted ? `Accepted (${snapshot.legalConsent.termsVersion})` : "Not accepted",
  };

  let currentMarked = false;
  return steps.map((step) => {
    const done = isComplete[step.key as StepKey];
    let status: OnboardingStepStatus;
    if (done) {
      status = "complete";
    } else if (!currentMarked && !step.optional) {
      status = "current";
      currentMarked = true;
    } else {
      status = "pending";
    }
    return {
      ...step,
      status,
      summary: summary[step.key as StepKey] ?? "",
    };
  });
}

export function allComplete(steps: OnboardingStep[]): boolean {
  return steps.every((s) => s.status === "complete" || (s.status === "pending" && s.optional));
}
