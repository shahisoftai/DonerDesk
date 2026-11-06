import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { CollectionFormListSchema } from "@/lib/server/schemas-collection";
import { InlineError } from "@/components/feedback/PageState";

export const dynamic = "force-dynamic";

const STATUS = { DRAFT: "Draft", PUBLISHED: "Open for answers", CLOSED: "Closed" } as const;

/** The project's collection forms: questions the field team answers, which add up to indicator values once a person accepts them. */
export default async function FormsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  const result = await gatewayRequest(`/v1/projects/${encodeURIComponent(id)}/collection-forms`, CollectionFormListSchema, ctx.token);
  if (!result.ok) return <InlineError title={result.error.message} referenceId={result.error.referenceId} />;
  const canEdit = ctx.capabilities.has("project.edit");
  return (
    <div className="animate-fade-in space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Collection forms</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Design the questions your team answers in the field. Accepted answers are counted or added up into indicator values for the right period, as drafts for you to review.</p>
        </div>
        <div className="flex gap-2">
          {/* A plain link on purpose: the field page is opened as a document so the phone can keep it for offline use. */}
          <a className="btn-secondary" href="/field">Work offline</a>
          {canEdit && <Link className="btn-primary" href={`/projects/${id}/forms/new`}>New form</Link>}
        </div>
      </header>
      {result.value.forms.length === 0 ? (
        <p className="text-sm text-slate-500">No forms yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
          {result.value.forms.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div>
                <Link className="font-medium hover:underline" href={`/projects/${id}/forms/${f.id}`}>{f.name}</Link>
                <p className="text-xs text-slate-500">{STATUS[f.status]} · {f.fields.length} question{f.fields.length === 1 ? "" : "s"}{f.counts.PENDING > 0 ? ` · ${f.counts.PENDING} waiting for review` : ""}</p>
              </div>
              <span className="text-xs text-slate-500">{f.counts.ACCEPTED} accepted</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
