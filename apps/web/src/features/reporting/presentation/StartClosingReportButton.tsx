"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startClosingReportAction } from "@/lib/actions/reporting";
import { Button } from "@/components/ui/Button";

export function StartClosingReportButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const result = await startClosingReportAction(projectId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push(`/projects/${projectId}/reports/${result.value.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button pending={busy} onClick={() => void start()}>Start the closing report</Button>
      {error && <p role="alert" className="mt-2 text-sm font-medium text-danger-700 dark:text-danger-400">{error}</p>}
    </div>
  );
}
