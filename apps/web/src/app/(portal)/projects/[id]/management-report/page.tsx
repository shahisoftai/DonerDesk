import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ManagementReportSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";

export const dynamic = "force-dynamic";

/** One page that says where the project stands: delivery, indicators, reports, problems and risks, and evidence. Also a CSV. */
export default async function ManagementReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  const res = await gatewayRequest(`/v1/projects/${id}/management-report`, ManagementReportSchema, ctx.token);
  if (!res.ok) return <InlineError title={res.error.message} referenceId={res.error.referenceId} />;
  const { sections, today, projectTitle } = res.value;
  return (
    <div className="animate-fade-in space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Management report</h1>
          <p className="mt-1 text-sm text-slate-500">{projectTitle} · as of {today}</p>
        </div>
        <div className="flex gap-2">
          <a className="btn-secondary" href={`/api/projects/${id}/management-report/export`}>Download as a spreadsheet (CSV)</a>
          <Link className="btn-secondary" href={`/projects/${id}`}>Back to the project</Link>
        </div>
      </header>
      {sections.map((s) => (
        <section key={s.title} className="card space-y-2" aria-labelledby={`mr-${s.title.replace(/\W+/g, "-")}`}>
          <h2 id={`mr-${s.title.replace(/\W+/g, "-")}`} className="font-medium">{s.title}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">{s.summary}</p>
          {s.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>{s.headers.map((h) => <th key={h} scope="col" className="py-1.5 pr-3 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {s.rows.map((row, i) => (
                    <tr key={i}>{row.map((cell, j) => <td key={j} className="py-1.5 pr-3 align-top">{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
