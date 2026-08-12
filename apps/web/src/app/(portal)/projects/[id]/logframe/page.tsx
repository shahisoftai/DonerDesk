import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { LogframeResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { LOGFRAME_LEVEL_LABEL } from "@/lib/labels";
import { buildHierarchy, walkHierarchy, type HierarchyNode } from "@/lib/shared/hierarchy";
import type { z } from "zod";

export const dynamic = "force-dynamic";

type LogframeItem = z.infer<typeof LogframeResponseSchema>["items"][number];

const LEVEL_ORDER = ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"];

export default async function LogframePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await requireSession();
  const result = await gatewayRequest(`/v1/projects/${resolvedParams.id}/logframe`, LogframeResponseSchema, ctx.token);
  if (!result.ok) {
    return (
      <div className="animate-fade-in">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Logframe &amp; indicators</h1>
          <Link className="btn" href={`/projects/${resolvedParams.id}/logframe/new`}>Add item</Link>
        </header>
        <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>
      </div>
    );
  }
  const data = result.value;
  const sorted = [...data.items].sort(
    (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || (a.code ?? "").localeCompare(b.code ?? ""),
  );
  const tree = buildHierarchy<LogframeItem>(sorted);
  const indicatorsByItem = new Map<string, typeof data.indicators>();
  for (const ind of data.indicators) {
    const key = ind.logframeItemId ?? "";
    if (!key) continue;
    const list = indicatorsByItem.get(key) ?? [];
    list.push(ind);
    indicatorsByItem.set(key, list);
  }

  return (
    <div className="animate-fade-in">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Logframe &amp; indicators</h1>
        <Link className="btn" href={`/projects/${resolvedParams.id}/logframe/new`}>Add logframe item</Link>
      </header>

      <section className="mt-8">
        <h2 className="font-semibold">Results hierarchy</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Goal → Outcome → Output → Activity. Expand items to see their children.
        </p>
        {tree.length === 0 ? (
          <div className="card mt-3 text-sm text-slate-600 dark:text-slate-300">
            No logframe items yet.{" "}
            <Link className="font-semibold text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${resolvedParams.id}/logframe/new`}>
              Add your first item
            </Link>.
          </div>
        ) : (
          <LogframeTree nodes={tree} projectId={resolvedParams.id} indicatorCounts={countsByItem(indicatorsByItem)} />
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Indicators</h2>
          <Link className="btn-secondary text-xs" href={`/projects/${resolvedParams.id}/logframe/new-indicator`}>
            Add indicator
          </Link>
        </div>
        <div className="table-shell mt-3">
          <table className="w-full text-sm">
            <caption className="sr-only">Project indicators</caption>
            <thead className="thead">
              <tr>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Indicator</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Baseline</th>
                <th className="px-3 py-2 text-left">Target</th>
              </tr>
            </thead>
            <tbody>
              {data.indicators.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-3 text-slate-500 dark:text-slate-400">No indicators yet.</td></tr>
              )}
              {data.indicators.map((i) => (
                <tr key={i.id} className="trow">
                  <td className="px-3 py-2 font-mono">{i.code}</td>
                  <td className="px-3 py-2"><Link className="font-medium text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${resolvedParams.id}/indicators/${i.id}`}>{i.name}</Link></td>
                  <td className="px-3 py-2">{i.type?.toLowerCase().replace("_", " ") ?? "—"}</td>
                  <td className="px-3 py-2">{i.baseline || "—"}</td>
                  <td className="px-3 py-2">{i.target}{i.unit ? ` ${i.unit}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function countsByItem(map: Map<string, { id: string }[]>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [key, list] of map) out.set(key, list.length);
  return out;
}

function LogframeTree({
  nodes,
  projectId,
  indicatorCounts,
}: {
  nodes: HierarchyNode<LogframeItem>[];
  projectId: string;
  indicatorCounts: Map<string, number>;
}) {
  const rows: Array<{ node: HierarchyNode<LogframeItem>; depth: number }> = [];
  walkHierarchy(nodes, (node, depth) => rows.push({ node, depth }));

  return (
    <ul className="mt-3 space-y-2" role="tree" aria-label="Logframe hierarchy">
      {rows.map(({ node, depth }) => {
        const indent = { paddingLeft: `${depth * 1.5 + 0.25}rem` };
        const count = indicatorCounts.get(node.id) ?? 0;
        return (
          <li key={node.id} role="treeitem" aria-level={depth + 1}>
            <div className="card flex flex-wrap items-center justify-between gap-3" style={indent}>
              <div className="flex items-center gap-2">
                <Badge tone={levelTone(node.level)}>{LOGFRAME_LEVEL_LABEL[node.level] ?? node.level}</Badge>
                {node.code && <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{node.code}</span>}
                <span className="font-semibold">{node.title}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {count > 0 && <span className="text-slate-500 dark:text-slate-400">{count} indicator{count === 1 ? "" : "s"}</span>}
                <Link className="text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${projectId}/logframe/new-indicator?itemId=${encodeURIComponent(node.id)}`}>
                  Add indicator
                </Link>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function levelTone(level: string): "info" | "success" | "warning" | "neutral" | "ai" {
  switch (level) {
    case "GOAL": return "info";
    case "OUTCOME": return "success";
    case "OUTPUT": return "warning";
    default: return "neutral";
  }
}
