"use client";

import { ReportableError } from "@/components/feedback/ReportableError";

export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ReportableError error={error} reset={reset} area="DonorDesk" />;
}
