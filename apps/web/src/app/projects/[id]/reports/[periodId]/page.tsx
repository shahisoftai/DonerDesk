import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionToken } from "@/lib/session-server";
import { api, apiRaw } from "@/lib/api";
import { REPORT_TYPE_LABEL, REPORT_STATUS_LABEL } from "@/lib/labels";
import { ReportWorkspace } from "./ReportWorkspace";

export const dynamic = "force-dynamic";

export default async function ReportWorkspacePage({ params }: { params: Promise<{ id: string; periodId: string }> }) {
  const resolvedParams = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");

  // We pull draft by listing projects (period list is implicit via generate endpoint).
  // For now, fetch readiness + checklist + exports for this period.
  const [readiness, checklist, exports] = await Promise.all([
    api<{ overall: number; sectionsScore: number; indicatorsScore: number; evidenceScore: number; checklistScore: number; approvalScore: number }>(`/v1/reporting-periods/${resolvedParams.periodId}/readiness`, { token }).catch(() => null),
    api<{ items: Array<{ id: string; title: string; severity: string; status: string; type: string }> }>(`/v1/reporting-periods/${resolvedParams.periodId}/checklist`, { token }).catch(() => ({ items: [] })),
    api<{ items: Array<{ id: string; exportType: string; fileUrl: string; createdAt: string }> }>(`/v1/projects/${resolvedParams.id}/exports`, { token }).catch(() => ({ items: [] })),
  ]);

  if (!readiness) return notFound();

  return (
    <main className="mx-auto max-w-6xl animate-fade-in px-6 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Report workspace</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Reporting period {resolvedParams.periodId.slice(0, 8)}</p>
        </div>
        <Link className="btn-secondary" href={`/projects/${resolvedParams.id}/reports`}>Back</Link>
      </header>

      <ReportWorkspace
        projectId={resolvedParams.id}
        periodId={resolvedParams.periodId}
        readiness={readiness}
        checklist={checklist.items}
        exports={exports.items}
      />
    </main>
  );
}
