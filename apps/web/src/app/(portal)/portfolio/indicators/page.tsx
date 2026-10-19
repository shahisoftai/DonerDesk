import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { PortfolioIndicatorsSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";

export const dynamic = "force-dynamic";

const num = (n: number | null) => (n === null ? "Not measured" : n.toLocaleString("en-GB"));

/**
 * The same indicator across every project you can see, per donor. Only verified values are added up; a project with none is
 * shown as not measured, and a project whose unit or type differs is listed on its own and not added.
 */
export default async function PortfolioIndicatorsPage() {
  const ctx = await requireSession();
  const res = await gatewayRequest("/v1/portfolio/indicators", PortfolioIndicatorsSchema, ctx.token);
  if (!res.ok) return <InlineError title={res.error.message} referenceId={res.error.referenceId} />;
  const groups = res.value.items;
  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">Indicators across projects</h2>
        <p className="mt-1 text-sm text-slate-500">Verified values added up per donor. Projects you are not on are not shown.</p>
      </header>
      {groups.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-300">No indicators in the projects you can see yet.</p>}
      {groups.map((g) => (
        <section key={`${g.donorName}-${g.indicatorCode}`} className="card space-y-3" aria-label={`${g.donorName} ${g.indicatorCode}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-xs text-slate-500">{g.donorName} · <span className="font-mono">{g.indicatorCode}</span></p>
              <h3 className="font-medium">{g.indicatorName}</h3>
            </div>
            <p className="text-sm">
              <span className="text-lg font-semibold">{num(g.total)}</span>
              {g.targetTotal !== null && <span className="text-slate-500"> of {num(g.targetTotal)}{g.percentOfTarget !== null ? ` (${g.percentOfTarget}%)` : ""}</span>}
              {g.unit && <span className="text-slate-500"> {g.unit}</span>}
            </p>
          </div>
          <ul className="divide-y divide-slate-200 text-sm dark:divide-white/10">
            {g.projects.map((p) => (
              <li key={p.projectId} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{p.projectTitle}</span>
                <span className="font-mono text-slate-600 dark:text-slate-300">{num(p.value)}{p.asOf ? ` · as of ${p.asOf}` : ""}</span>
              </li>
            ))}
            {g.mismatched.map((p) => (
              <li key={`m-${p.projectId}`} className="flex flex-wrap justify-between gap-2 py-2 text-amber-700 dark:text-amber-400">
                <span>{p.projectTitle} (different unit or type, not added)</span>
                <span className="font-mono">{num(p.value)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
