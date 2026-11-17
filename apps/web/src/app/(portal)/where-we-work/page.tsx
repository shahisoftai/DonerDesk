import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { InlineError } from "@/components/feedback/PageState";
import { WhereWeWorkSchema } from "@/lib/server/schemas-place-tree";
import { WHERE_LEVELS, levelOf } from "@/features/places/domain/where-levels";

export const dynamic = "force-dynamic";

/**
 * Where we work (Phase 56): the organisation's map of its work, derived from every project's areas and the places its work happened. Nobody
 * keeps it up to date by hand. Only projects the viewer may see are counted.
 */
export default async function OrganisationWhereWeWorkPage({ searchParams }: { searchParams: Promise<{ level?: string }> }) {
  const level = levelOf((await searchParams).level);
  const ctx = await requireSession();
  const r = await gatewayRequest(`/v1/where-we-work?level=${level}`, WhereWeWorkSchema, ctx.token);
  if (!r.ok) return <InlineError title={r.error.message} referenceId={r.error.referenceId} />;
  const v = r.value;
  return (
    <div data-tour-id="where-we-work" className="page-stack animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Where we work</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">Which projects work in each area and what they did there, from every project&apos;s areas and records. Each project chooses its own areas under Plan › Where we work.</p>
        </div>
        {v.canManage && <Link className="btn-secondary btn-sm" href="/where-we-work/manage">Manage places</Link>}
      </div>
      <nav aria-label="Level" className="flex gap-2 text-sm">
        {WHERE_LEVELS.map((l) => <Link key={l.level} href={`/where-we-work?level=${l.level}`} aria-current={l.level === level ? "page" : undefined} className={l.level === level ? "btn-primary btn-sm" : "btn-ghost btn-sm"}>{l.label}</Link>)}
      </nav>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {v.areas.length} {v.areas.length === 1 ? "area" : "areas"}{v.overlaps > 0 ? ` · ${v.overlaps} with more than one project` : ""}{v.notPlacedAtLevel > 0 ? ` · ${v.notPlacedAtLevel} records at a place above this level` : ""}
      </p>
      {v.areas.length === 0 ? <p className="text-sm">No project has chosen areas at this level yet.</p> : (
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-slate-500"><th className="py-1 text-start">Area</th><th className="py-1 text-start">Projects</th><th className="py-1 text-end">Planned</th><th className="py-1 text-end">Done</th></tr></thead>
          <tbody>
            {v.areas.map((a) => (
              <tr key={a.id} className="border-t border-slate-200 align-top dark:border-white/10">
                <td className="py-1.5"><Link className="link" href={`/places/${a.id}`}>{a.path}</Link></td>
                <td className="py-1.5">{a.projects.map((p, i) => <span key={p.id}>{i > 0 && ", "}<Link className="link-quiet" href={`/projects/${p.id}/places`}>{p.title}</Link></span>)}</td>
                <td className="py-1.5 text-end tabular-nums">{a.plannedActivities}</td>
                <td className="py-1.5 text-end tabular-nums">{a.activities}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {v.projectsWithoutAreas.length > 0 && (
        <section className="space-y-1 text-sm">
          <h2 className="section-title">Projects with no areas yet</h2>
          <ul className="flex flex-wrap gap-3">{v.projectsWithoutAreas.map((p) => <li key={p.id}><Link className="link" href={`/projects/${p.id}/places`}>{p.title}</Link></li>)}</ul>
        </section>
      )}
    </div>
  );
}
