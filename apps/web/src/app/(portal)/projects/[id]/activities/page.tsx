import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ActivitiesResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { ActivityBulkList } from "@/features/activities/presentation/ActivityBulkList";

export const dynamic = "force-dynamic";

export default async function ActivitiesPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await requireSession();
  const result = await gatewayRequest(`/v1/projects/${resolvedParams.id}/activities`, ActivitiesResponseSchema, ctx.token);
  if (!result.ok) {
    return (
      <div className="animate-fade-in">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Activity updates</h1>
          <Link className="btn" href={`/projects/${resolvedParams.id}/activities/new`}>New activity</Link>
        </header>
        <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>
      </div>
    );
  }
  const items = result.value.items;

  return (
    <div className="animate-fade-in">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Activity updates</h1>
        <div className="flex gap-2">
          <a className="btn-secondary text-xs" href="/api/templates/activities">Download template</a>
          <Link className="btn-secondary text-xs" href={`/projects/${resolvedParams.id}/activities/import`}>Import</Link>
          <Link className="btn" href={`/projects/${resolvedParams.id}/activities/new`}>New activity</Link>
        </div>
      </header>
      <ActivityBulkList projectId={resolvedParams.id} items={items} canReview={ctx.capabilities.has("activity.review")} />
    </div>
  );
}
