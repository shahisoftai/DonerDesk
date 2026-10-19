import type { BreakdownProgress } from "@/lib/server/schemas-breakdown";

const num = (n: number | null) => (n === null ? "Not recorded" : n.toLocaleString("en-GB"));

/**
 * Each group's target beside the verified figure so far. Only verified values count; a group nobody has reported on says
 * "Not recorded", never 0. A rate has no percentage of target.
 */
export function BreakdownProgressTable({ items, only }: { items: BreakdownProgress["items"]; only?: string }) {
  const shown = only ? items.filter((i) => i.indicatorId === only) : items;
  if (shown.length === 0) return null;
  return (
    <section className="card mt-4 space-y-4" aria-labelledby="breakdown-progress-title">
      <h3 id="breakdown-progress-title" className="font-medium">Targets by group</h3>
      {shown.map((ind) => (
        <div key={ind.indicatorId} className="space-y-1">
          {!only && <p className="text-sm"><span className="font-mono text-slate-500">{ind.code}</span> {ind.name}{ind.unit ? <span className="text-slate-500"> ({ind.unit})</span> : null}</p>}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500">
                <th scope="col" className="py-1 pr-3 font-medium">Group</th><th scope="col" className="py-1 pr-3 font-medium">Target</th>
                <th scope="col" className="py-1 pr-3 font-medium">Verified so far</th><th scope="col" className="py-1 font-medium">Of target</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                {ind.rows.map((r) => (
                  <tr key={`${r.dimension}-${r.category}`}>
                    <td className="py-1 pr-3">{r.category}</td>
                    <td className="py-1 pr-3 font-mono">{num(r.target)}</td>
                    <td className="py-1 pr-3 font-mono">{num(r.actual)}</td>
                    <td className="py-1 font-mono">{r.percentOfTarget === null ? "—" : `${r.percentOfTarget}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}
