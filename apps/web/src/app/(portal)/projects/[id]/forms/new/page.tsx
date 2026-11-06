import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { LogframeResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { FormDesigner } from "@/features/collection/presentation/FormDesigner";

export const dynamic = "force-dynamic";

export default async function NewFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  if (!ctx.capabilities.has("project.edit")) return <InlineError title="You cannot design forms." />;
  const logframe = await gatewayRequest(`/v1/projects/${encodeURIComponent(id)}/logframe`, LogframeResponseSchema, ctx.token);
  if (!logframe.ok) return <InlineError title={logframe.error.message} referenceId={logframe.error.referenceId} />;
  return (
    <div className="animate-fade-in space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">New collection form</h1>
      <FormDesigner projectId={id} indicators={logframe.value.indicators.map((i) => ({ id: i.id, label: `${i.code} ${i.name}` }))} />
    </div>
  );
}
