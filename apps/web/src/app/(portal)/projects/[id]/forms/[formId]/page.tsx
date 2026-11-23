import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ReportingPeriodsResponseSchema } from "@/lib/server/schemas";
import { CollectionFormSchema } from "@/lib/server/schemas-collection";
import { InlineError } from "@/components/feedback/PageState";
import { periodOptionLabel, recentFirst } from "@/lib/shared/option-labels";
import { FormWorkspace } from "@/features/collection/presentation/FormWorkspace";

export const dynamic = "force-dynamic";

export default async function FormPage({ params, searchParams }: { params: Promise<{ id: string; formId: string }>; searchParams: Promise<{ place?: string }> }) {
  const { id, formId } = await params;
  const { place } = await searchParams;
  const ctx = await requireSession();
  const [form, periods] = await Promise.all([
    gatewayRequest(`/v1/collection-forms/${encodeURIComponent(formId)}`, CollectionFormSchema, ctx.token),
    gatewayRequest(`/v1/projects/${encodeURIComponent(id)}/reporting-periods`, ReportingPeriodsResponseSchema, ctx.token),
  ]);
  if (!form.ok) return <InlineError title={form.error.message} referenceId={form.error.referenceId} />;
  const options = periods.ok ? recentFirst(periods.value.items, (p) => p.startDate).map((p) => ({ id: p.id, label: periodOptionLabel(p) })) : [];
  const canEdit = ctx.capabilities.has("project.edit");
  return (
    <div className="page-stack animate-fade-in">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs"><Link className="hover:underline" href={`/projects/${id}/forms`}>Collection forms</Link></p>
          <h1 className="page-title">{form.value.name}</h1>
          {form.value.description && <p className="mt-1 text-sm text-slate-500">{form.value.description}</p>}
        </div>
        {canEdit && form.value.status === "DRAFT" && <Link className="btn-secondary" href={`/projects/${id}/forms/${formId}/edit`}>Edit the questions</Link>}
      </header>
      <FormWorkspace form={form.value} periods={options} canEdit={canEdit} canSubmit={ctx.capabilities.has("collection.submit")} canReview={ctx.capabilities.has("indicator.verify")} canEnter={ctx.capabilities.has("indicator.update")} initialPlaceId={place} />
    </div>
  );
}
