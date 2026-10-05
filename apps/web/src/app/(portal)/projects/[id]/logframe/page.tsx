import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { LogframeResponseSchema, OrganizationSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { DriveFolderPanel } from "@/features/evidence/presentation/DriveFolderPanel";
import { LogframeTreeEditor } from "@/features/logframe/presentation/LogframeTreeEditor";
import { SemanticsBadge } from "@/features/logframe/presentation/SemanticsBadge";
import { ConfirmSemanticsButton } from "@/features/logframe/presentation/ConfirmSemanticsButton";
import { isLogframeReorderEnabled } from "@/lib/shared/feature-flags";

export const dynamic = "force-dynamic";

export default async function LogframePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await requireSession();
  const [result, orgResult] = await Promise.all([
    gatewayRequest(`/v1/projects/${resolvedParams.id}/logframe`, LogframeResponseSchema, ctx.token),
    gatewayRequest("/v1/organization", OrganizationSchema, ctx.token),
  ]);
  const driveConnected = orgResult.ok && orgResult.value.storageProvider === "GOOGLE_DRIVE";
  if (!result.ok) {
    return (
      <div className="animate-fade-in">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Logframe &amp; indicators</h1>
          <Link className="btn" href={`/projects/${resolvedParams.id}/logframe/new`}>Add item</Link>
        </header>
        <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>
      </div>
    );
  }
  const data = result.value;
  const indicatorCounts: Record<string, number> = {};
  for (const ind of data.indicators) {
    if (ind.logframeItemId) indicatorCounts[ind.logframeItemId] = (indicatorCounts[ind.logframeItemId] ?? 0) + 1;
  }
  const needReview = data.indicators.filter((i) => i.semanticsDescription?.needsReview).map((i) => i.id);
  const canConfirm = ctx.capabilities.has("logframe.edit");
  const canReorder = isLogframeReorderEnabled() && ctx.capabilities.has("logframe.edit");

  return (
    <div className="animate-fade-in" data-tour-id="logframe-indicator-list">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Logframe &amp; indicators</h1>
        <div className="flex gap-2">
          <a className="btn-secondary text-xs" href="/api/templates/logframe">Download template</a>
          <Link className="btn-secondary text-xs" href={`/projects/${resolvedParams.id}/logframe/new`}>Add logframe item</Link>
          <ImportLogframeButton projectId={resolvedParams.id} />
        </div>
      </header>

      <section className="mt-8">
        <h2 className="font-medium">Results hierarchy</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Goal → Outcome → Output → Activity.{canReorder ? " Drag the handle to reorder items, or use “Move to” to change an item’s parent." : ""}
        </p>
        {data.items.length === 0 ? (
          <div className="card mt-3 text-sm text-slate-600 dark:text-slate-300">
            No logframe items yet.{" "}
            <Link className="font-medium text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${resolvedParams.id}/logframe/new`}>
              Add your first item
            </Link>.
          </div>
        ) : (
          <LogframeTreeEditor projectId={resolvedParams.id} items={data.items} indicatorCounts={indicatorCounts} editable={canReorder} />
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Indicators</h2>
          <div className="flex gap-2">
            {canConfirm && <ConfirmSemanticsButton indicatorIds={needReview} />}
            <ImportIndicatorsButton projectId={resolvedParams.id} />
            <Link className="btn-secondary text-xs" href={`/projects/${resolvedParams.id}/logframe/new-indicator`}>
              Add indicator
            </Link>
          </div>
        </div>
        <div className="table-shell mt-3">
          <table className="w-full text-sm">
            <caption className="sr-only">Project indicators</caption>
            <thead className="thead">
              <tr>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Indicator</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Baseline</th>
                <th className="px-3 py-2 text-left">Target</th>
                <th className="px-3 py-2 text-left">Calculation</th>
              </tr>
            </thead>
            <tbody>
              {data.indicators.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-3 text-slate-500 dark:text-slate-400">No indicators yet.</td></tr>
              )}
              {data.indicators.map((i) => (
                <tr key={i.id} className="trow">
                  <td className="px-3 py-2 font-mono">{i.code}</td>
                  <td className="px-3 py-2"><Link className="font-medium text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${resolvedParams.id}/indicators/${i.id}`}>{i.name}</Link></td>
                  <td className="px-3 py-2">{i.type?.toLowerCase().replace("_", " ") ?? "—"}</td>
                  <td className="px-3 py-2">{i.baseline || "—"}</td>
                  <td className="px-3 py-2">{i.target}{i.unit ? ` ${i.unit}` : ""}</td>
                  <td className="px-3 py-2"><SemanticsBadge description={i.semanticsDescription} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {driveConnected && (
        <div className="mt-6">
          <DriveFolderPanel
            projectId={resolvedParams.id}
            folderRoles={["02-Logframe", "03-Data-Files"]}
            title="Logframe &amp; data files in Google Drive"
          />
        </div>
      )}
    </div>
  );
}

function ImportLogframeButton({ projectId }: { projectId: string }) {
  return (
    <Link className="btn-secondary text-xs" href={`/projects/${projectId}/logframe/import`}>
      Import logframe
    </Link>
  );
}

function ImportIndicatorsButton({ projectId }: { projectId: string }) {
  return (
    <Link className="btn-secondary text-xs" href={`/projects/${projectId}/logframe/indicators/import`}>
      Import indicators
    </Link>
  );
}
