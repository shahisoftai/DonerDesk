import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { LogframeResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { NewIndicatorForm } from "@/features/logframe/presentation/NewIndicatorForm";

export const dynamic = "force-dynamic";

export default async function NewIndicatorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ itemId?: string }>;
}) {
  const [{ id }, { itemId }] = await Promise.all([params, searchParams]);
  const ctx = await requireSession();
  const result = await gatewayRequest(`/v1/projects/${id}/logframe`, LogframeResponseSchema, ctx.token);
  return (
    <div className="animate-fade-in mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight">Add indicator</h1>
      {!result.ok ? (
        <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>
      ) : result.value.items.length === 0 ? (
        <div className="card mt-6 text-sm text-slate-600 dark:text-slate-300">
          Indicators measure a logframe item, and this project has none yet.{" "}
          <a className="font-medium text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${id}/logframe/new`}>Add a logframe item first</a>.
        </div>
      ) : (
        <NewIndicatorForm projectId={id} items={result.value.items} initialItemId={itemId} />
      )}
    </div>
  );
}
