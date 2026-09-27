import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { TemplatesResponseSchema, OrganizationSchema } from "@/lib/server/schemas";
import { REPORT_TYPE_LABEL } from "@/lib/labels";
import { InlineError } from "@/components/feedback/PageState";
import { DriveFolderPanel } from "@/features/evidence/presentation/DriveFolderPanel";
import { ExtractionMethodBadge, TemplateStatusBadge } from "@/features/templates/presentation/TemplateStatusBadge";
import { LibraryPicker } from "@/features/templates/presentation/LibraryPicker";

export const dynamic = "force-dynamic";

export default async function TemplatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  const [result, library, orgResult] = await Promise.all([
    gatewayRequest(`/v1/projects/${id}/templates`, TemplatesResponseSchema, ctx.token),
    gatewayRequest("/v1/templates/library", TemplatesResponseSchema, ctx.token),
    gatewayRequest("/v1/organization", OrganizationSchema, ctx.token),
  ]);
  const driveConnected = orgResult.ok && orgResult.value.storageProvider === "GOOGLE_DRIVE";
  const header = (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Donor templates</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          A template defines the report&rsquo;s sections and the donor&rsquo;s instructions the AI writer follows for each one.
        </p>
      </div>
      <Link className="btn" href={`/projects/${id}/templates/new`}>Add template</Link>
    </header>
  );
  if (!result.ok) {
    return (
      <div className="animate-fade-in">
        {header}
        <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>
      </div>
    );
  }
  const items = result.value.items;
  const libraryItems = library.ok ? library.value.items.filter((t) => t.projectId !== id) : [];

  return (
    <div className="animate-fade-in">
      {header}
      <div className="mt-6 space-y-3">
        {items.length === 0 && <div className="card text-sm text-slate-600 dark:text-slate-300">No templates yet. Upload the donor&rsquo;s template or start from your library.</div>}
        {items.map((t) => {
          const reportable = t.sections.filter((s) => s.includeInReport);
          const pending = t.sections.filter((s) => s.reviewStatus !== "REVIEWED").length;
          return (
            <Link
              key={t.id}
              href={`/projects/${id}/templates/${t.id}`}
              className="card flex flex-wrap items-center justify-between gap-3 transition duration-300 hover:-translate-y-0.5 hover:border-brand-400/40 dark:hover:border-brand-400/30"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2 font-medium">
                  {t.templateName}
                  <TemplateStatusBadge status={t.status} />
                  <ExtractionMethodBadge method={t.extractionMeta?.method} />
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t.donorName} · {REPORT_TYPE_LABEL[t.reportType] ?? t.reportType} · {reportable.length} report section(s)
                  {pending > 0 ? ` · ${pending} to review` : ""} · {t.requirements.annexes.length} annex(es) · v{t.version ?? 1}
                </div>
              </div>
              <span className="text-sm text-brand-600 hover:underline dark:text-brand-400">Open</span>
            </Link>
          );
        })}
      </div>

      {libraryItems.length > 0 && (
        <div className="mt-6">
          <LibraryPicker projectId={id} items={libraryItems.map((t) => ({ id: t.id, templateName: t.templateName, donorName: t.donorName, sections: t.sections.filter((s) => s.includeInReport).length }))} />
        </div>
      )}

      {driveConnected && (
        <div className="mt-6">
          <DriveFolderPanel projectId={id} folderRoles={["01-Donor-Templates"]} title="Donor templates in Google Drive" />
        </div>
      )}
    </div>
  );
}
