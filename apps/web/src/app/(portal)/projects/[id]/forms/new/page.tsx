import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { LogframeResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { NewFormDesigner } from "@/features/collection/presentation/designer/NewFormDesigner";

export const dynamic = "force-dynamic";

export default async function NewFormPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const { id } = await params;
  const { from } = await searchParams;
  const ctx = await requireSession();
  if (!ctx.capabilities.has("project.edit")) return <InlineError title="You cannot design forms." />;
  const logframe = await gatewayRequest(`/v1/projects/${encodeURIComponent(id)}/logframe`, LogframeResponseSchema, ctx.token);
  if (!logframe.ok) return <InlineError title={logframe.error.message} referenceId={logframe.error.referenceId} />;
  return (
    <div className="page-stack animate-fade-in">
      <h1 className="page-title">New collection form</h1>
      <NewFormDesigner projectId={id} fromProposal={from === "proposal"} indicators={logframe.value.indicators.map((i) => ({ id: i.id, label: `${i.code} ${i.name}` }))} />
    </div>
  );
}
