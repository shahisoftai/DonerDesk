"use client";

import { useEffect } from "react";
import { ErrorState } from "./PageState";

const SUPPORT_EMAIL = "support@donordesk.online";

/**
 * An error boundary body: what failed, a reference to quote, and a "Report this" link that fills the email in. Placed
 * inside a segment, the layout around it (for example the settings tabs) stays, so one broken card never blanks the page.
 */
export function ReportableError({ error, reset, area }: { error: Error & { digest?: string }; reset: () => void; area: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const reference = error.digest;
  const subject = encodeURIComponent(`Problem on ${area}${reference ? ` (ref ${reference})` : ""}`);
  const body = encodeURIComponent(`What I was doing:\n\n\nPage: ${typeof window === "undefined" ? "" : window.location.href}\nReference: ${reference ?? "none"}`);
  return (
    <div className="space-y-2">
      <ErrorState title="This part of the page could not be loaded" message={`Your other pages are not affected. Try again; if it keeps happening, report it and quote the reference.`} referenceId={reference} onRetry={reset} />
      <a className="text-sm text-brand-600 underline dark:text-brand-400" href={`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`}>
        Report this
      </a>
    </div>
  );
}
