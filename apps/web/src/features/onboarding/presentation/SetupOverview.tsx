import Link from "next/link";
import { deriveOnboardingSteps, allComplete } from "./onboarding-steps";
import { LegalConsentCard } from "./LegalConsentCard";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import type { OnboardingSnapshot } from "../application/onboarding-status";

export function SetupOverview({ snapshot }: { snapshot: OnboardingSnapshot }) {
  const steps = deriveOnboardingSteps(snapshot);
  const complete = allComplete(steps);

  return (
    <div className="animate-fade-in mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight">Set up your workspace</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Complete the setup so your team can start reporting. Progress is saved automatically as you finish each step.
      </p>

      {complete && (
        <div className="mt-6">
          <InlineAlert tone="success" title="Setup complete">
            Your workspace is ready. Project-specific setup (logframe, templates, indicators, evidence) is
            handled per project from each project&apos;s setup checklist.
          </InlineAlert>
        </div>
      )}

      <ol className="mt-6 space-y-3">
        {steps.map((step) => (
          <li key={step.key} className="card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <StepIndicator status={step.status} label={step.label} />
                <div>
                  <div className="font-medium">{step.label}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{step.description}</div>
                  <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">{step.summary}</div>
                </div>
              </div>
              {step.status !== "complete" && step.href && (
                <Link className="btn-secondary whitespace-nowrap text-xs" href={step.href}>
                  {step.status === "current" ? "Start" : "Continue"}
                </Link>
              )}
              {step.status === "complete" && step.href && (
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-medium text-success-600 dark:text-success-400">Done</span>
                  <Link className="btn-secondary whitespace-nowrap text-xs" href={step.href}>
                    Edit
                  </Link>
                </div>
              )}
              {step.status === "complete" && !step.href && (
                <span className="shrink-0 text-sm font-medium text-success-600 dark:text-success-400">Done</span>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        <LegalConsentCard initial={snapshot.legalConsent} />
      </div>
    </div>
  );
}

function StepIndicator({ status, label }: { status: string; label: string }) {
  const base = "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold";
  if (status === "complete") {
    return (
      <span className={`${base} bg-success-500 text-white`} aria-label={`${label}: complete`}>
        ✓
      </span>
    );
  }
  if (status === "current") {
    return (
      <span className={`${base} bg-brand-500 text-white`} aria-label={`${label}: in progress`}>
        <span aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className={`${base} border border-slate-300 text-slate-400 dark:border-white/15 dark:text-slate-500`} aria-label={`${label}: pending`}>
      •
    </span>
  );
}
