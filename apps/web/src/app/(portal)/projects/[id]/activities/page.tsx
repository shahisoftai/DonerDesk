import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ActivitiesResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { activityStatusTone } from "@/lib/shared/tone";
import { ACTIVITY_STATUS_LABEL } from "@/lib/labels";

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
      <div className="mt-6 space-y-3">
        {items.length === 0 && <div className="card text-sm text-slate-600 dark:text-slate-300">No activity updates yet.</div>}
        {items.map((a) => (
          <Link
            key={a.id}
            href={`/projects/${resolvedParams.id}/activities/${a.id}`}
            className="card block transition hover:border-brand-400/40 dark:hover:border-brand-400/30"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{a.activityTitle}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{a.activityDate.slice(0, 10)} · {a.location ?? "—"} · {a.participantsTotal ?? 0} participants</div>
              </div>
              <Badge tone={activityStatusTone(a.status)}>{ACTIVITY_STATUS_LABEL[a.status] ?? a.status.replace(/_/g, " ")}</Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
