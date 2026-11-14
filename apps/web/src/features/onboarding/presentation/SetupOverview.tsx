import Link from "next/link";
import { deriveOnboardingSteps, allComplete } from "./onboarding-steps";
import { LegalConsentCard } from "./LegalConsentCard";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import type { OnboardingSnapshot } from "../application/onboarding-status";

export function SetupOverview({ snapshot }: { snapshot: OnboardingSnapshot }) {
  const steps = deriveOnboardingSteps(snapshot);
  const complete = allComplete(steps);
  const done = steps.filter((s) => s.status === "complete").length;

  return (
    <div className="animate-fade-in mx-auto max-w-2xl">
      {/* Version 4.000 (plan F10): one "Get started" checklist with its progress, instead of a row of setup pages. */}
      <h1 className="page-title">Get started</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        A few steps so your team can start. Each step is saved as you finish it; the optional ones can wait.
      </p>
      <div className="mt-4" aria-label={`${done} of ${steps.length} steps done`}>
        <div className="flex justify-between text-xs text-slate-500"><span>{done} of {steps.length} done</span><span>{Math.round((done / Math.max(1, steps.length)) * 100)}%</span></div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><div className="h-full rounded-full bg-brand-600 transition-[width] duration-500" style={{ width: `${(done / Math.max(1, steps.length)) * 100}%` }} /></div>
      </div>

      {complete && (
        <div className="mt-6">
          <InlineAlert tone="success" title="Setup complete">
            You can start now. The optional steps below can be done any time from Settings, and project-specific
            setup (logframe, templates, indicators, evidence) is handled per project.
            <Link className="btn-primary mt-3 inline-flex" href="/projects/new">
              Create your first project
            </Link>
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
                  <div className="font-medium">
                    {step.label}
                    {step.optional && step.status !== "complete" && (
                      <span className="ml-2 rounded-full border border-slate-300 px-2 py-0.5 text-xs font-normal text-slate-500 dark:border-white/15 dark:text-slate-400">Optional</span>
                    )}
                  </div>
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
