import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { InlineError } from "@/components/feedback/PageState";
import { PlaceProfileSchema } from "@/lib/server/schemas-place-tree";

export const dynamic = "force-dynamic";

/** A place's page (Phase 56): where it sits, what is inside it, and the projects that cover it or worked in it (only those the viewer may see). */
export default async function PlacePage({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  const ctx = await requireSession();
  const r = await gatewayRequest(`/v1/places/${encodeURIComponent(placeId)}/profile`, PlaceProfileSchema, ctx.token);
  if (!r.ok) {
    if (r.error.kind === "not_found") notFound();
    return <InlineError title={r.error.message} referenceId={r.error.referenceId} />;
  }
  const v = r.value;
  return (
    <div className="page-stack animate-fade-in">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link className="link-quiet" href="/where-we-work">Where we work</Link>
        {[...v.chain].reverse().map((p) => <span key={p.id}> › <Link className="link-quiet" href={`/places/${p.id}`}>{p.name}</Link></span>)}
      </nav>
      <div>
        <h1 className="page-title">{v.place.name}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{v.place.path}{v.place.facility ? " · facility" : ""}{v.place.latitude !== undefined ? ` · ${v.place.latitude.toFixed(4)}, ${v.place.longitude?.toFixed(4)}` : ""}</p>
      </div>
      <section className="space-y-2">
        <h2 className="section-title">Projects here</h2>
        {v.projects.length === 0 ? <p className="text-sm">No project you can see works here.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500"><th className="py-1 text-start">Project</th><th className="py-1 text-start">Area of the project</th><th className="py-1 text-end">Planned</th><th className="py-1 text-end">Done</th></tr></thead>
            <tbody>
              {v.projects.map((p) => (
                <tr key={p.id} className="border-t border-slate-200 dark:border-white/10">
                  <td className="py-1.5"><Link className="link" href={`/projects/${p.id}/places`}>{p.title}</Link></td>
                  <td className="py-1.5">{p.covers ? "Yes" : "No (work recorded here)"}</td>
                  <td className="py-1.5 text-end tabular-nums">{p.plannedActivities}</td>
                  <td className="py-1.5 text-end tabular-nums">{p.activities}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {v.children.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">Places inside</h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{v.children.map((c) => <li key={c.id}><Link className="link" href={`/places/${c.id}`}>{c.name}</Link></li>)}</ul>
        </section>
      )}
    </div>
  );
}
