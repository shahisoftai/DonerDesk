"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { acceptLegalTermsAction } from "@/lib/actions/legal";
import type { LegalConsent } from "@/lib/server/schemas";

const TERMS_OF_REFERENCE = [
  {
    title: "Service and your data",
    body: "DonorDesk provides AI-assisted donor reporting, evidence management, and compliance tools. You retain ownership of your content and data; we process it only to operate the Service.",
  },
  {
    title: "Acceptable use",
    body: "You agree to use the Service lawfully, to protect account credentials, and not to upload unlawful, harmful, or child-exploitative content.",
  },
  {
    title: "AI-assisted drafting",
    body: "AI output is assistive, source-linked, and subject to human review. You are responsible for verifying and approving all AI-generated content before use.",
  },
  {
    title: "Privacy and compliance",
    body: "We process personal information in accordance with our Privacy Policy. Your organization remains responsible for lawful processing of beneficiary and staff data, including consent and child-protection obligations.",
  },
  {
    title: "Liability",
    body: "The Service is provided as-is. Our aggregate liability is limited as described in the Terms of Service, and we do not guarantee donor acceptance of any report.",
  },
  {
    title: "Governing law",
    body: "The Terms are designed to operate globally and respect the laws of your jurisdiction, including applicable data-protection and consumer-protection rules.",
  },
];

export function LegalConsentCard({
  initial,
  onAccepted,
}: {
  initial: LegalConsent;
  onAccepted?: (consent: LegalConsent) => void;
}) {
  const [checked, setChecked] = useState(initial.accepted);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState<LegalConsent>(initial);
  const [pending, startTransition] = useTransition();

  const accepted = consent.accepted;

  const submit = () => {
    if (!checked) {
      setError("Please read and check the box to accept the Terms of Service and Privacy Policy.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await acceptLegalTermsAction("onboarding");
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setConsent(result.value);
      onAccepted?.(result.value);
    });
  };

  if (accepted) {
    return (
      <div className="card" id="legal-consent" style={{ scrollMarginTop: "6rem" }}>
        <InlineAlert tone="success" title="Terms accepted">
          You accepted the Terms of Service ({consent.termsVersion}) and Privacy
          Policy ({consent.privacyVersion}) on{" "}
          {consent.acceptedAt ? new Date(consent.acceptedAt).toLocaleString() : "record"}. This
          consent is recorded in your workspace's immutable audit trail.
        </InlineAlert>
      </div>
    );
  }

  return (
    <div className="card" id="legal-consent" style={{ scrollMarginTop: "6rem" }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Terms of Reference — accept to finish setup</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            This is the final onboarding step. Please review the summary below and
            the full documents, then accept. Your acceptance is recorded with your
            identity, the document versions, timestamp, and IP address in the audit
            trail.
          </p>
        </div>
      </div>

      <ul className="mt-5 space-y-3">
        {TERMS_OF_REFERENCE.map((item) => (
          <li key={item.title} className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{item.body}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          Read the full Terms of Service →
        </a>
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          Read the full Privacy Policy →
        </a>
      </div>

      <label className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-brand-600"
          aria-label="I have read and accept the Terms of Service and Privacy Policy"
        />
        <span className="text-sm">
          I have read and I accept the{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Terms of Service
          </a>{" "}
          and the{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Privacy Policy
          </a>{" "}
          (Version {initial.termsVersion}). I understand that this acceptance is
          recorded and that DonorDesk.Online will process my organization's data
          as described in those documents.
        </span>
      </label>

      {error && (
        <div className="mt-4">
          <InlineAlert tone="danger" title={error} />
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Button onClick={submit} pending={pending} disabled={!checked}>
          {pending ? "Recording acceptance..." : "Accept and finish setup"}
        </Button>
      </div>
    </div>
  );
}
