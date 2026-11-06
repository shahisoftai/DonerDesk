import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { TemplateDetailSchema } from "@/lib/server/schemas-dashboards";
import { InlineError } from "@/components/feedback/PageState";
import { TemplateEditor } from "@/features/dashboards/presentation/TemplateEditor";

export const dynamic = "force-dynamic";

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  const r = await gatewayRequest(`/v1/dashboard-templates/${encodeURIComponent(id)}`, TemplateDetailSchema, ctx.token);
  if (!r.ok) return <InlineError title={r.error.message} referenceId={r.error.referenceId} />;
  return (
    <div className="animate-fade-in space-y-4">
      <p className="text-sm"><Link className="underline" href="/dashboards/templates">Dashboard templates</Link></p>
      <TemplateEditor template={r.value.template as never} updatedAt={r.value.updatedAt} canEdit={r.value.canEdit && ctx.capabilities.has("project.edit")} />
    </div>
  );
}
