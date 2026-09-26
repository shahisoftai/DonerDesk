import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { TemplatesResponseSchema, ReportingPeriodsResponseSchema } from "@/lib/server/schemas";
import { TemplateMappingWizard } from "@/features/templates/presentation/TemplateMappingWizard";

export const dynamic = "force-dynamic";

export default async function TemplateMappingPage({ params }: { params: Promise<{ id: string; templateId: string }> }) {
  const resolvedParams = await params;
  const ctx = await requireSession();

  const [templatesResult, periodsResult] = await Promise.all([
    gatewayRequest(`/v1/projects/${resolvedParams.id}/templates`, TemplatesResponseSchema, ctx.token),
    gatewayRequest(`/v1/projects/${resolvedParams.id}/reporting-periods`, ReportingPeriodsResponseSchema, ctx.token),
  ]);

  if (!templatesResult.ok) {
    return <div className="animate-fade-in"><p className="text-sm text-red-600 dark:text-red-400">{templatesResult.error.message}</p></div>;
  }
  const tpl = templatesResult.value.items.find((t) => t.id === resolvedParams.templateId);
  if (!tpl) return <div className="p-8 text-sm text-slate-500 dark:text-slate-400">Template not found.</div>;

  const sections = (tpl.sections ?? [])
    .filter((s): s is typeof s & { id: string } => Boolean(s.id))
    .map((s) => ({ id: s.id, title: s.title }));

  const periods = periodsResult.ok
    ? periodsResult.value.items.map((p) => ({ id: p.id, label: `${p.reportType} — ${p.status}` }))
    : [];

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">Donor template mapping</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {tpl.templateName} — detect the donor's DOCX structure, review the auto-mapped sections, approve, and lock to a
        reporting period so exports render directly into the donor's own template instead of the generic layout.
      </p>
      <div className="mt-4">
        <TemplateMappingWizard templateId={tpl.id} sections={sections} periods={periods} />
      </div>
    </div>
  );
}
