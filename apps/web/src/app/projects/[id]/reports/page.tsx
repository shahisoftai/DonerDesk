import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionToken } from "@/lib/session-server";
import { api } from "@/lib/api";
import { REPORT_TYPE_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

type Period = {
  id: string;
  reportType: string;
  status: string;
  readinessScore: number;
  deadline: string;
  daysUntilDeadline: number;
  donorTemplateId: string | null;
};

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const { items } = await api<{ items: Period[] }>(
    `/v1/projects/${resolvedParams.id}/reporting-periods`,
    { token },
  ).catch(() => ({ items: [] }));

  return (
    <main className="mx-auto max-w-4xl animate-fade-in px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        <Link className="btn" href={`/projects/${resolvedParams.id}/reports/new`}>Create reporting period</Link>
      </header>

      {items.length === 0 ? (
        <div className="card mt-6 text-sm text-slate-600 dark:text-slate-300">
          No reporting periods yet. Create one to start generating drafts and running compliance checks.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((p) => (
            <div key={p.id} className="card transition hover:border-brand-400/40 dark:hover:border-brand-400/30">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{REPORT_TYPE_LABEL[p.reportType] ?? p.reportType}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Deadline: {new Date(p.deadline).toLocaleDateString()}
                    {p.daysUntilDeadline <= 7 && p.daysUntilDeadline >= 0 && (
                      <span className="ml-2 font-medium text-amber-600 dark:text-amber-400">· {p.daysUntilDeadline} day(s) left</span>
                    )}
                    {p.daysUntilDeadline < 0 && (
                      <span className="ml-2 font-medium text-red-600 dark:text-red-400">· Overdue</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Readiness</div>
                    <div className={`font-semibold ${p.readinessScore >= 75 ? "text-green-700 dark:text-green-400" : p.readinessScore >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                      {p.readinessScore}%
                    </div>
                  </div>
                  <span className={`tag ${p.status === "APPROVED" ? "tag-green" : p.status === "SUBMITTED" ? "tag-blue" : "tag-slate"}`}>
                    {p.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                {p.donorTemplateId && (
                  <Link href={`/projects/${resolvedParams.id}/reports/${p.id}`} className="btn-secondary py-1 text-xs">
                    View draft
                  </Link>
                )}
                <Link href={`/projects/${resolvedParams.id}/reports/${p.id}/compliance`} className="btn-secondary py-1 text-xs">
                  Compliance checklist
                </Link>
                {!p.donorTemplateId && (
                  <Link href={`/projects/${resolvedParams.id}/templates`} className="btn-secondary py-1 text-xs">
                    Attach template first
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
