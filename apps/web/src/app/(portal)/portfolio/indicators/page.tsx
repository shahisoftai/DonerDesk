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
export default async function PortfolioIndicatorsPage({ searchParams }: { searchParams: Promise<{ donor?: string }> }) {
  const { donor } = await searchParams;
  const ctx = await requireSession();
  const res = await gatewayRequest("/v1/portfolio/indicators", PortfolioIndicatorsSchema, ctx.token);
  if (!res.ok) return <InlineError title={res.error.message} referenceId={res.error.referenceId} />;
  const donors = [...new Set(res.value.items.map((g) => g.donorName))].sort((a, b) => a.localeCompare(b));
  const groups = donor ? res.value.items.filter((g) => g.donorName === donor) : res.value.items;
  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">Indicators across projects</h2>
        <p className="mt-1 text-sm text-slate-500">Verified values added up per donor. Projects you are not on are not shown.</p>
        <p className="mt-2"><a className="btn-secondary" href="/api/portfolio/indicators/export">Download as a spreadsheet (CSV)</a></p>
      </header>
      {donors.length > 1 && (
        <nav aria-label="Donor" className="flex flex-wrap gap-2 text-sm">
          <a href="/portfolio/indicators" className={`rounded-lg border px-3 py-1 ${!donor ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 dark:border-white/15"}`}>All donors</a>
          {donors.map((d) => <a key={d} href={`/portfolio/indicators?donor=${encodeURIComponent(d)}`} aria-current={donor === d ? "page" : undefined} className={`rounded-lg border px-3 py-1 ${donor === d ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 dark:border-white/15"}`}>{d}</a>)}
        </nav>
      )}
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
            {g.countedElsewhere.map((p) => (
              <li key={`c-${p.projectId}`} className="flex flex-wrap justify-between gap-2 py-2 text-slate-500">
                <span>{p.projectTitle} (counted by another project, not added)</span>
                <span className="font-mono">{num(p.value)}</span>
              </li>
            ))}
            {g.mismatched.map((p) => (
              <li key={`m-${p.projectId}`} className="flex flex-wrap justify-between gap-2 py-2 text-amber-700 dark:text-amber-400">
                <span>{p.projectTitle} (different unit or type, not added)</span>
                <span className="font-mono">{num(p.value)}</span>
              </li>
            ))}
          </ul>
          {g.possibleOverlap && (
            <p role="note" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              <strong>Possible double count:</strong> {g.possibleOverlap.projects.join(", ")}. {g.possibleOverlap.message}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
