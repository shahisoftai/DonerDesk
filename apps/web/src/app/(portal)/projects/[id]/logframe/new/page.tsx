import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { LogframeResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { NewLogframeItemForm } from "@/features/logframe/presentation/NewLogframeItemForm";

export const dynamic = "force-dynamic";

export default async function NewLogframeItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ parentId?: string }>;
}) {
  const [{ id }, { parentId }] = await Promise.all([params, searchParams]);
  const ctx = await requireSession();
  const result = await gatewayRequest(`/v1/projects/${id}/logframe`, LogframeResponseSchema, ctx.token);
  return (
    <div className="animate-fade-in mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight">Add logframe item</h1>
      {result.ok ? (
        <NewLogframeItemForm projectId={id} items={result.value.items} initialParentId={parentId} />
      ) : (
        <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>
      )}
    </div>
  );
}
