import { notFound } from "next/navigation";
import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { AiSectionRunsResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { aiRunOutcomeCopy } from "@/lib/reporting-copy";
import { formatDate } from "@/lib/shared/dates";

export const dynamic = "force-dynamic";

const OUTCOME_TONE = { WRITTEN: "success", RECOVERED: "info", STUB: "warning", NO_INPUT: "neutral" } as const;

/** What the AI writer did for the last 50 sections: who wrote each, after how many tries, and why a basic version was used. */
export default async function AiUsagePage() {
  const ctx = await requireSession();
  if (!hasCapability(ctx, "org.manage")) notFound();
  const result = await gatewayRequest("/v1/ai/section-runs", AiSectionRunsResponseSchema, ctx.token);
  if (!result.ok) {
    return <InlineError title={result.error.message} referenceId={result.error.referenceId} />;
  }
  const { counts, runs } = result.value;
  return (
    <div className="animate-fade-in space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">AI usage</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          The last {runs.length} sections the AI writer worked on: {counts.WRITTEN} written, {counts.RECOVERED} written after a retry, {counts.STUB} with a basic version
          {counts.NO_INPUT > 0 ? `, ${counts.NO_INPUT} with nothing recorded to write from` : ""}.
        </p>
      </header>
      {runs.length === 0 ? (
        <p className="card text-sm text-slate-600 dark:text-slate-300">No AI runs yet. They appear here after a report draft is generated.</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Recent AI section runs</caption>
            <thead className="text-xs text-slate-500 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-3 py-2">When</th>
                <th scope="col" className="px-3 py-2">Section</th>
                <th scope="col" className="px-3 py-2">Result</th>
                <th scope="col" className="px-3 py-2">Tries</th>
                <th scope="col" className="px-3 py-2">Time</th>
                <th scope="col" className="px-3 py-2">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const copy = aiRunOutcomeCopy(run);
                return (
                  <tr key={run.id} className="trow align-top">
                    <td className="px-3 py-2 text-xs">{formatDate(run.at)}</td>
                    <td className="px-3 py-2">{run.sectionTitle ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge tone={OUTCOME_TONE[run.outcome]}>{copy.label}</Badge>
                      {copy.why && <p className="mt-1 max-w-md text-xs text-slate-600 dark:text-slate-300">{copy.why}</p>}
                    </td>
                    <td className="px-3 py-2">{run.attempts}</td>
                    <td className="px-3 py-2 text-xs">{(run.latencyMs / 1000).toFixed(1)} s</td>
                    <td className="px-3 py-2 text-xs">{run.tokens.toLocaleString("en")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
