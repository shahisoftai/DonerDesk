import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { TemplatesResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { NewReportingPeriodForm } from "@/features/reporting/presentation/NewReportingPeriodForm";

export const dynamic = "force-dynamic";

export default async function NewReportingPeriodPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await requireSession();
  const templatesResult = await gatewayRequest(
    `/v1/projects/${resolvedParams.id}/templates`,
    TemplatesResponseSchema,
    ctx.token,
  );

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold">New reporting period</h1>
      {!templatesResult.ok && <div className="mt-4"><InlineError title={templatesResult.error.message} /></div>}
      <NewReportingPeriodForm
        projectId={resolvedParams.id}
        templates={templatesResult.ok ? templatesResult.value.items.map((t) => ({ id: t.id, templateName: t.templateName })) : []}
      />
    </div>
  );
}
