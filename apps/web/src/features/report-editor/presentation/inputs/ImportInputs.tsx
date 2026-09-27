"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FlexibleInputsPanel } from "@/features/reporting/presentation/FlexibleInputsPanel";

/**
 * The Import tab (Report Editor P5): paste indicator values or extract them
 * from a field report; the page refreshes as soon as values are saved.
 */
export function ImportInputs({ projectId, periodId, evidenceCount }: { projectId: string; periodId: string; evidenceCount: number }) {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <FlexibleInputsPanel projectId={projectId} periodId={periodId} onApplied={() => router.refresh()} />
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Evidence</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {evidenceCount === 0 ? "No evidence is linked to this period yet." : `${evidenceCount} evidence file${evidenceCount === 1 ? "" : "s"} linked to this period.`} The AI can only
            back up statements with evidence.
          </p>
        </div>
        <Link href={`/projects/${projectId}/evidence`} className="btn-secondary">
          Manage evidence
        </Link>
      </section>
    </div>
  );
}
