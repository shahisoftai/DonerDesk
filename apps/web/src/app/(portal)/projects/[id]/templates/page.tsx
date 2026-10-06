import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { TemplatesResponseSchema, OrganizationSchema, ReportingProfileResponseSchema } from "@/lib/server/schemas";
import { REPORT_TYPE_LABEL, REPORT_TYPE_OPTIONS } from "@/lib/labels";
import { InlineError } from "@/components/feedback/PageState";
import { DriveFolderPanel } from "@/features/evidence/presentation/DriveFolderPanel";
import { ExtractionMethodBadge, TemplateStatusBadge } from "@/features/templates/presentation/TemplateStatusBadge";
import { LibraryPicker } from "@/features/templates/presentation/LibraryPicker";
import { TemplateTypeDefaults } from "@/features/templates/presentation/TemplateTypeDefaults";
import { pickDefaultTemplate } from "@donordesk/domain/contexts/reporting/default-template.js";
import { HelpButton } from "@/features/tour/presentation/HelpButton";

export const dynamic = "force-dynamic";

export default async function TemplatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  const [result, library, orgResult, profileResult] = await Promise.all([
    gatewayRequest(`/v1/projects/${id}/templates`, TemplatesResponseSchema, ctx.token),
    gatewayRequest("/v1/templates/library", TemplatesResponseSchema, ctx.token),
    gatewayRequest("/v1/organization", OrganizationSchema, ctx.token),
    gatewayRequest(`/v1/projects/${id}/reporting-profile`, ReportingProfileResponseSchema, ctx.token),
  ]);
  // With no default set, the first template is the effective one
  // (ProjectReadinessService / CreateReportingPeriodHandler fall back this
  // way too) — shown as read-only "Default" until there is a real choice.
  const defaultTemplateId = profileResult.ok ? profileResult.value.profile?.defaultTemplateId : undefined;
  const explicitByType = profileResult.ok ? profileResult.value.profile?.defaultTemplateByType ?? {} : {};
  const driveConnected = orgResult.ok && orgResult.value.storageProvider === "GOOGLE_DRIVE";
  const header = (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Donor templates</h1>
          <HelpButton topic="templates" />
        </div>
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
    <div className="animate-fade-in" data-tour-id="donor-template-review">
      {header}
      <div className="mt-6 space-y-3">
        {items.length === 0 && <div className="card text-sm text-slate-600 dark:text-slate-300">No templates yet. Upload the donor&rsquo;s template or start from your library.</div>}
        {items.map((t, index) => {
          const reportable = t.sections.filter((s) => s.includeInReport);
          const pending = t.sections.filter((s) => s.reviewStatus !== "REVIEWED").length;
          const candidates = items.map((c) => ({ id: c.id, reportType: c.reportType, status: c.status, updatedAt: new Date(c.updatedAt ?? 0) }));
          // "Used for": the report types a new period of which starts from this template, by the one rule period creation uses.
          // Offer the template's own type, plus any type it is already the explicit default for (so it can be undone).
          const typesHere = REPORT_TYPE_OPTIONS.filter((type) => type === t.reportType || explicitByType[type] === t.id);
          const usedFor = REPORT_TYPE_OPTIONS.filter((type) => pickDefaultTemplate({ reportType: type, profileDefaultId: defaultTemplateId, explicitByType, candidates }).templateId === t.id);
          return (
            <div
              key={t.id}
              className="card flex flex-wrap items-center justify-between gap-3 transition duration-300 hover:-translate-y-0.5 hover:border-brand-400/40 dark:hover:border-brand-400/30"
            >
              <Link href={`/projects/${id}/templates/${t.id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 font-medium">
                  {t.templateName}
                  <TemplateStatusBadge status={t.status} />
                  <ExtractionMethodBadge method={t.extractionMeta?.method} />
                  {usedFor.length > 0 && (
                    <span className="rounded-full border border-success-500/50 px-2 py-0.5 text-[11px] font-medium text-success-700 dark:text-success-400">
                      Used for: {usedFor.map((type) => REPORT_TYPE_LABEL[type] ?? type).join(", ")}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t.donorName} · {REPORT_TYPE_LABEL[t.reportType] ?? t.reportType} · {reportable.length} report section(s)
                  {pending > 0 ? ` · ${pending} to review` : ""} · {t.requirements.annexes.length} annex(es) · v{t.version ?? 1}
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <TemplateTypeDefaults
                  templateId={t.id}
                  canEdit={ctx.capabilities.has("template.edit")}
                  types={typesHere.map((type) => ({ type, label: REPORT_TYPE_LABEL[type] ?? type, isDefault: explicitByType[type] === t.id }))}
                />
                <Link href={`/projects/${id}/templates/${t.id}`} className="text-sm text-brand-600 hover:underline dark:text-brand-400">Open</Link>
              </div>
            </div>
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
