import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { EvidenceResponseSchema } from "@/lib/server/schemas";
import { InlineError, EmptyState } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { verificationStatusTone, confidentialityTone } from "@/lib/shared/tone";
import { EVIDENCE_TYPE_LABEL, EVIDENCE_VERIFICATION_LABEL, CONFIDENTIALITY_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function GlobalEvidencePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const query = typeof raw.q === "string" ? raw.q : "";
  const verificationStatus = typeof raw.status === "string" && raw.status !== "all" ? raw.status : undefined;
  const ctx = await requireSession();
  const result = await gatewayRequest("/v1/evidence/search", EvidenceResponseSchema, ctx.token, {
    method: "POST",
    body: { query: query || undefined, verificationStatus, page: 1, pageSize: 100 },
  });

  return (
    <div className="animate-fade-in">
      <header>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">Cross-project queue</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Evidence</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Review evidence across the projects you are allowed to access.</p>
      </header>
      <form className="card mt-6 grid gap-3 sm:grid-cols-[1fr_14rem_auto]" action="/evidence">
        <label className="text-sm font-medium">Search<input className="input mt-1" name="q" defaultValue={query} placeholder="Title or file name" /></label>
        <label className="text-sm font-medium">Verification
          <select className="input mt-1" name="status" defaultValue={verificationStatus ?? "all"}>
            <option value="all">All states</option><option value="PENDING">Pending review</option><option value="VERIFIED">Verified</option><option value="REJECTED">Rejected</option>
          </select>
        </label>
        <button className="btn self-end" type="submit">Apply filters</button>
      </form>
      {!result.ok && <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>}
      {result.ok && result.value.items.length === 0 && <div className="mt-6"><EmptyState>No evidence matches these filters. Open a project to upload evidence.</EmptyState></div>}
      {result.ok && result.value.items.length > 0 && (
        <div className="table-shell mt-6 overflow-x-auto">
          <table className="w-full text-sm"><caption className="sr-only">Evidence across accessible projects</caption>
            <thead className="thead"><tr><th className="px-4 py-3 text-left">Evidence</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Verification</th><th className="px-4 py-3 text-left">Confidentiality</th></tr></thead>
            <tbody>{result.value.items.map((item) => <tr className="trow" key={item.id}>
              <td className="px-4 py-3">{item.projectId ? <Link className="font-medium text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${item.projectId}/evidence/${item.id}`}>{item.title}</Link> : <span className="font-medium">{item.title}</span>}<span className="block text-xs text-slate-500">{item.fileName}</span></td>
              <td className="px-4 py-3">{EVIDENCE_TYPE_LABEL[item.evidenceType] ?? item.evidenceType.replace(/_/g, " ")}</td>
              <td className="px-4 py-3"><Badge tone={verificationStatusTone(item.verificationStatus)}>{EVIDENCE_VERIFICATION_LABEL[item.verificationStatus] ?? item.verificationStatus.replace(/_/g, " ")}</Badge></td>
              <td className="px-4 py-3"><Badge tone={confidentialityTone(item.confidentialityLevel)}>{CONFIDENTIALITY_LABEL[item.confidentialityLevel] ?? item.confidentialityLevel.replace(/_/g, " ")}</Badge></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
