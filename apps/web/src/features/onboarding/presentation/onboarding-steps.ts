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
    key: "first-project",
    label: "Create a project",
    description: "Set up a donor-funded project workspace.",
    href: "/projects/new",
    optional: false,
  },
  {
    key: "template",
    label: "Add a donor template",
    description: "Upload the donor's reporting template.",
    href: null,
    optional: true,
  },
  {
    key: "logframe",
    label: "Add a logframe",
    description: "Define goals, outputs, and indicators.",
    href: null,
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
    key: "evidence",
    label: "Upload evidence",
    description: "Attach supporting documents and photos.",
    href: null,
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
  const projectHref = snapshot.firstProjectId ? `/projects/${snapshot.firstProjectId}` : "/projects/new";
  const steps = STEPS.map((step) => ({ ...step }));

  const setHref = (key: StepKey, href: string) => {
    const s = steps.find((x) => x.key === key);
    if (s) s.href = href;
  };

  setHref("template", snapshot.firstProjectId ? `/projects/${snapshot.firstProjectId}/templates/new` : projectHref);
  setHref("logframe", snapshot.firstProjectId ? `/projects/${snapshot.firstProjectId}/logframe` : projectHref);
  setHref("evidence", snapshot.firstProjectId ? `/projects/${snapshot.firstProjectId}/evidence/new` : projectHref);

  const isComplete: Record<StepKey, boolean> = {
    storage: snapshot.storageProvider === "GOOGLE_DRIVE",
    organization: snapshot.orgProfileComplete,
    "first-project": snapshot.projectCount > 0,
    template: snapshot.templateCount > 0,
    logframe: snapshot.logframeItemCount > 0,
    team: snapshot.teamCount > 1,
    evidence: snapshot.evidenceCount > 0,
    "legal-consent": snapshot.legalConsent.accepted,
  };

  const summary: Record<StepKey, string> = {
    storage: snapshot.storageProvider === "GOOGLE_DRIVE" ? "Google Drive connected" : "Not connected",
    organization: snapshot.orgProfileComplete ? snapshot.orgName : "Profile not filled in",
    "first-project": snapshot.projectCount > 0 ? `${snapshot.projectCount} project${snapshot.projectCount === 1 ? "" : "s"}` : "No projects yet",
    template: snapshot.templateCount > 0 ? `${snapshot.templateCount} template${snapshot.templateCount === 1 ? "" : "s"}` : "No templates",
    logframe: snapshot.logframeItemCount > 0 ? `${snapshot.logframeItemCount} logframe item${snapshot.logframeItemCount === 1 ? "" : "s"}` : "No logframe",
    team: snapshot.teamCount > 1 ? `${snapshot.teamCount} members` : "No teammates yet",
    evidence: snapshot.evidenceCount > 0 ? `${snapshot.evidenceCount} file${snapshot.evidenceCount === 1 ? "" : "s"}` : "No evidence",
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
