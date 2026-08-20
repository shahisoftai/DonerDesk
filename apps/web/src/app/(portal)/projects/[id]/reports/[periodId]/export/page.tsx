import Link from "next/link";
import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ExportsResponseSchema, ExportPreflightSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { ExportsPanel } from "@/features/exports/presentation/ExportsPanel";

export const dynamic = "force-dynamic";

export default async function ExportPage({ params }: { params: Promise<{ id: string; periodId: string }> }) {
  const { id, periodId } = await params;
  const ctx = await requireSession();
  const [exportsResult, preflightResult] = await Promise.all([
    gatewayRequest(`/v1/projects/${id}/exports`, ExportsResponseSchema, ctx.token),
    gatewayRequest(`/v1/reporting-periods/${periodId}/export-preflight`, ExportPreflightSchema, ctx.token),
  ]);
  return <div className="animate-fade-in"><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-medium uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">Controlled snapshot</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Export center</h2><p className="mt-1 text-sm text-slate-500">Review warnings, select files, and preserve immutable export history.</p></div><Link className="btn-secondary" href={`/projects/${id}/reports/${periodId}`}>Back to report</Link></header>
    {!preflightResult.ok && <div className="mt-5"><InlineError title={preflightResult.error.message} referenceId={preflightResult.error.referenceId} /></div>}
    {preflightResult.ok && (preflightResult.value.blocking.length > 0 || preflightResult.value.warnings.length > 0) && <section className="card mt-6"><h3 className="font-medium">Preflight summary</h3><ul className="mt-3 space-y-2 text-sm">{preflightResult.value.blocking.map((issue) => <li className="text-danger-700 dark:text-danger-400" key={issue.code}>Blocking: {issue.message}</li>)}{preflightResult.value.warnings.map((issue) => <li className="text-warning-700 dark:text-warning-400" key={issue.code}>Warning: {issue.message}</li>)}</ul></section>}
    {!exportsResult.ok ? <div className="mt-5"><InlineError title={exportsResult.error.message} /></div> : <div className="mt-6"><ExportsPanel projectId={id} periodId={periodId} initialExports={exportsResult.value.items} canExport={hasCapability(ctx, "export.create")} /></div>}
  </div>;
}
