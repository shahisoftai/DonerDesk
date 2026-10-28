import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { LogframeResponseSchema } from "@/lib/server/schemas";
import { CollectionFormSchema } from "@/lib/server/schemas-collection";
import { InlineError } from "@/components/feedback/PageState";
import { FormDesigner } from "@/features/collection/presentation/FormDesigner";

export const dynamic = "force-dynamic";

export default async function EditFormPage({ params }: { params: Promise<{ id: string; formId: string }> }) {
  const { id, formId } = await params;
  const ctx = await requireSession();
  if (!ctx.capabilities.has("project.edit")) return <InlineError title="You cannot design forms." />;
  const [form, logframe] = await Promise.all([
    gatewayRequest(`/v1/collection-forms/${encodeURIComponent(formId)}`, CollectionFormSchema, ctx.token),
    gatewayRequest(`/v1/projects/${encodeURIComponent(id)}/logframe`, LogframeResponseSchema, ctx.token),
  ]);
  if (!form.ok) return <InlineError title={form.error.message} referenceId={form.error.referenceId} />;
  if (!logframe.ok) return <InlineError title={logframe.error.message} referenceId={logframe.error.referenceId} />;
  if (form.value.status !== "DRAFT") return <InlineError title="A published form cannot be edited. Close it and make a new one." />;
  return (
    <div className="animate-fade-in space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Edit {form.value.name}</h1>
      <FormDesigner projectId={id} form={form.value} indicators={logframe.value.indicators.map((i) => ({ id: i.id, label: `${i.code} ${i.name}` }))} />
    </div>
  );
}
