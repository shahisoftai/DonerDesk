import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { InlineError } from "@/components/feedback/PageState";
import { ProjectDetailSchema } from "@/lib/server/schemas";
import { ProjectPlacesSchema } from "@/lib/server/schemas-place-tree";
import { placeChoicesFor } from "@/lib/server/place-choices";
import { WHERE_WE_WORK_TABS, tabOf } from "@/features/places/domain/where-we-work";
import { WhereWeWorkAreas } from "@/features/places/presentation/where/WhereWeWorkAreas";
import { ProjectSitesView } from "@/features/places/presentation/where/ProjectSitesView";
import { ProjectWordsToConfirm } from "@/features/places/presentation/where/ProjectWordsToConfirm";

export const dynamic = "force-dynamic";

/**
 * Where this project works (Phase 53.4, Phase 56): its own areas (its footprint), the sites its records point at, and its own typed words to
 * confirm. Only this project: other projects' areas never show here. The organisation's map is Where we work under the portfolio.
 */
export default async function WhereWeWorkPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const tab = tabOf((await searchParams).tab);
  const ctx = await requireSession();
  const [mine, project, choices] = await Promise.all([
    gatewayRequest(`/v1/projects/${encodeURIComponent(id)}/places`, ProjectPlacesSchema, ctx.token),
    gatewayRequest(`/v1/projects/${encodeURIComponent(id)}`, ProjectDetailSchema, ctx.token),
    placeChoicesFor(id, ctx.token),
  ]);
  if (!mine.ok) return <InlineError title={mine.error.message} referenceId={mine.error.referenceId} />;
  const data = mine.value;
  const counts: Record<string, number> = { areas: data.areas.length, sites: data.sites.length, confirm: data.unconfirmed.length };
  return (
    <div className="page-stack animate-fade-in">
      <div>
        <h1 className="page-title">Where we work</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">The areas this project works in and the places its work happened. Only this project changes here; other projects keep their own areas.</p>
      </div>
      <nav aria-label="Where we work" className="flex gap-4 border-b border-slate-200 text-sm dark:border-slate-700">
        {WHERE_WE_WORK_TABS.map((t) => (
          <Link key={t.key} href={`/projects/${id}/places?tab=${t.key}`} aria-current={t.key === tab ? "page" : undefined} className={`-mb-px border-b-2 px-1 py-2 ${t.key === tab ? "border-brand-600 font-semibold" : "border-transparent text-slate-600 dark:text-slate-300"}`}>
            {t.label}{(counts[t.key] ?? 0) > 0 ? ` (${counts[t.key]})` : ""}
          </Link>
        ))}
      </nav>
      {tab === "areas" && <WhereWeWorkAreas projectId={id} country={project.ok ? project.value.country : ""} data={data} />}
      {tab === "areas" && !data.canEdit && <p className="text-sm text-slate-600 dark:text-slate-300">Ask a project editor to tick the areas where this project works.</p>}
      {tab === "sites" && <ProjectSitesView projectId={id} data={data} />}
      {tab === "confirm" && <ProjectWordsToConfirm projectId={id} data={data} choices={choices.choices} />}
      <p className="flex gap-4 text-sm"><Link className="underline" href={`/visuals/maps/${id}`}>See the map</Link><Link className="underline" href="/where-we-work">The organisation&apos;s map</Link></p>
    </div>
  );
}
