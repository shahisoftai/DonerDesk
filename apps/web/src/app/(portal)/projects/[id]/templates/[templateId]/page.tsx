import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { LogframeResponseSchema, TemplateDetailSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { TemplateWorkspace } from "@/features/templates/presentation/TemplateWorkspace";

export const dynamic = "force-dynamic";

export default async function TemplateEditorPage({ params }: { params: Promise<{ id: string; templateId: string }> }) {
  const { id, templateId } = await params;
  const ctx = await requireSession();
  const [result, logframe] = await Promise.all([
    gatewayRequest(`/v1/templates/${encodeURIComponent(templateId)}`, TemplateDetailSchema, ctx.token),
    gatewayRequest(`/v1/projects/${id}/logframe`, LogframeResponseSchema, ctx.token),
  ]);
  if (!result.ok) {
    return <div className="animate-fade-in"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>;
  }
  const logframeOptions = logframe.ok
    ? logframe.value.items.map((item) => {
        const label = `${item.code ? `${item.code} ` : ""}${item.title}`;
        return { value: label, label: `${item.level}: ${label}` };
      })
    : [];
  return <TemplateWorkspace projectId={id} template={result.value} logframeOptions={logframeOptions} />;
}
