import Link from "next/link";
import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { LogframeVersionsResponseSchema, LogframeChangesResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { formatDate } from "@/lib/shared/dates";
import { getTranslator } from "@/lib/server/locale";
import { ApproveFrameworkButton } from "@/features/logframe/presentation/ApproveFrameworkButton";

export const dynamic = "force-dynamic";

const SHOWN = 15;

/** Every change to the results framework, newest first, with what changed; a manager can sign a version off as the agreed one. */
export default async function LogframeHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  const { t } = await getTranslator();
  const versions = await gatewayRequest(`/v1/projects/${id}/logframe/versions`, LogframeVersionsResponseSchema, ctx.token);
  if (!versions.ok) return <InlineError title={versions.error.message} referenceId={versions.error.referenceId} />;
  const shown = versions.value.items.slice(0, SHOWN);
  // What a sign-off now would cover: the changes since the last signed-off version, counted by kind.
  const lastSigned = versions.value.items.find((v) => v.approvedAt);
  const newest = versions.value.items[0];
  let pendingSummary = "";
  if (lastSigned && newest && newest.version > lastSigned.version) {
    const pending = await gatewayRequest(`/v1/projects/${id}/logframe/versions/${newest.version}/changes?from=${lastSigned.version}`, LogframeChangesResponseSchema, ctx.token);
    if (pending.ok) {
      const results = pending.value.changes.filter((c) => c.group === "STRUCTURE").length;
      const measures = pending.value.changes.filter((c) => c.group === "MEASUREMENT").length;
      pendingSummary = [results > 0 ? t("framework.history.pendingResults", { count: results }) : "", measures > 0 ? t("framework.history.pendingMeasures", { count: measures }) : ""].filter(Boolean).join("; ");
    }
  }
  const changes = await Promise.all(shown.map((v) => gatewayRequest(`/v1/projects/${id}/logframe/versions/${v.version}/changes`, LogframeChangesResponseSchema, ctx.token)));
  return (
    <div className="page-stack animate-fade-in">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Framework history</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Every change to the results framework is kept, so you can show what it said when a report was approved and why a target moved.
          </p>
        </div>
        <Link className="btn-secondary text-xs" href={`/projects/${id}/logframe`}>Back to the logframe</Link>
      </header>
      {hasCapability(ctx, "project.edit") && <ApproveFrameworkButton projectId={id} pendingSummary={pendingSummary} />}
      {shown.length === 0 ? (
        <p className="card text-sm text-slate-600 dark:text-slate-300">No history yet. A version is saved each time the framework changes.</p>
      ) : (
        <ol className="space-y-3">
          {shown.map((v, index) => {
            const detail = changes[index];
            return (
              <li key={v.version} className="card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Version {v.version} <span className="text-xs font-normal text-slate-500">· {formatDate(v.createdAt)}</span></p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {v.kinds.includes("STRUCTURE") ? <Badge tone="info">{t("framework.history.structure")}</Badge> : null}
                    {v.kinds.includes("MEASUREMENT") ? <Badge tone="neutral">{t("framework.history.measurement")}</Badge> : null}
                    {v.approvedAt ? <Badge tone="success">{t("framework.history.signedOff", { date: formatDate(v.approvedAt) })}</Badge> : null}
                  </div>
                </div>
                {detail?.ok && detail.value.changes.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
                    {detail.value.changes.slice(0, 25).map((c, i) => <li key={i}>{c.text}</li>)}
                    {detail.value.changes.length > 25 && <li className="list-none text-xs text-slate-500">and {detail.value.changes.length - 25} more</li>}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{v.summary}</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {versions.value.items.length > SHOWN && <p className="text-xs text-slate-500">Showing the latest {SHOWN} of {versions.value.items.length} versions.</p>}
    </div>
  );
}
