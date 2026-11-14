import Link from "next/link";
import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { PlaceListSchema, UnconfirmedLocationsSchema } from "@/lib/server/schemas-places";
import { InlineError } from "@/components/feedback/PageState";
import { ProjectAreaPicker } from "@/features/places/presentation/ProjectAreaPicker";
import { ProjectDetailSchema } from "@/lib/server/schemas";
import { PlacesPanel } from "@/features/places/presentation/PlacesPanel";
import { WHERE_WE_WORK_TABS, tabOf } from "@/features/places/domain/where-we-work";

export const dynamic = "force-dynamic";

/** One page for a project's places (Phase 53.4): areas to tick, points, and the typed words still to confirm. Every other screen links here. */
export default async function WhereWeWorkPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const tab = tabOf((await searchParams).tab);
  const ctx = await requireSession();
  const [list, unconfirmed, project] = await Promise.all([
    gatewayRequest("/v1/places?includeArchived=true", PlaceListSchema, ctx.token),
    gatewayRequest("/v1/places/unconfirmed", UnconfirmedLocationsSchema, ctx.token),
    gatewayRequest(`/v1/projects/${encodeURIComponent(id)}`, ProjectDetailSchema, ctx.token),
  ]);
  if (!list.ok) return <InlineError title={list.error.message} referenceId={list.error.referenceId} />;
  const canEdit = list.value.canEdit && hasCapability(ctx, "project.edit");
  return (
    <div className="page-stack animate-fade-in">
      <h1 className="page-title">Where we work</h1>
      <nav aria-label="Where we work" className="flex gap-4 border-b border-slate-200 text-sm dark:border-slate-700">
        {WHERE_WE_WORK_TABS.map((t) => (
          <Link key={t.key} href={`/projects/${id}/places?tab=${t.key}`} aria-current={t.key === tab ? "page" : undefined} className={`-mb-px border-b-2 px-1 py-2 ${t.key === tab ? "border-brand-600 font-semibold" : "border-transparent text-slate-600 dark:text-slate-300"}`}>
            {t.label}{t.key === "confirm" && unconfirmed.ok && unconfirmed.value.items.length > 0 ? ` (${unconfirmed.value.items.length})` : ""}
          </Link>
        ))}
      </nav>
      {tab === "areas" && <ProjectAreaPicker initialCountry={project.ok ? project.value.country : ""} canEdit={canEdit} places={list.value.places.map((p) => ({ name: p.name, adminLevel: p.adminLevel, code: p.code ?? null, archived: p.archived }))} />}
      {tab === "areas" && !canEdit && <p className="text-sm text-slate-600 dark:text-slate-300">Ask a project editor to tick the areas where this project works.</p>}
      {tab !== "areas" && <PlacesPanel places={list.value.places} canEdit={canEdit} unconfirmed={tab === "confirm" && unconfirmed.ok ? unconfirmed.value : null} />}
      <p className="text-sm"><Link className="underline" href={`/visuals/maps/${id}`}>See the map</Link></p>
    </div>
  );
}
