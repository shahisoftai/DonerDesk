import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionToken } from "@/lib/session-server";
import { api } from "@/lib/api";
import { EVIDENCE_TYPE_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

type Evidence = {
  id: string; fileName: string; title: string; evidenceType: string; verificationStatus: string;
  confidentialityLevel: string; fileUrl: string; uploadedById: string;
  aiSuggestedTags: Array<{ field: string; value: string; confidence: string; accepted: boolean }>;
};

export default async function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const { items } = await api<{ items: Evidence[]; total: number }>(`/v1/evidence/search`, {
    method: "POST",
    token,
    body: JSON.stringify({ projectId: resolvedParams.id, pageSize: 50 }),
  }).catch(() => ({ items: [], total: 0 }));

  return (
    <main className="mx-auto max-w-5xl animate-fade-in px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Evidence library</h1>
        <Link className="btn" href={`/projects/${resolvedParams.id}/evidence/new`}>Upload evidence</Link>
      </header>
      <p className="text-sm text-slate-600 dark:text-slate-400">{items.length} file(s) in this project.</p>
      <div className="table-shell mt-6">
        <table className="w-full text-sm">
          <thead className="thead">
            <tr>
              <th className="px-3 py-2 text-left">File</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Verification</th>
              <th className="px-3 py-2 text-left">Confidentiality</th>
              <th className="px-3 py-2 text-left">AI tags</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-slate-500 dark:text-slate-400">No evidence uploaded yet.</td></tr>}
            {items.map((e) => (
              <tr key={e.id} className="trow">
                <td className="px-3 py-2">
                  <div className="font-semibold">{e.title}</div>
                  <a className="text-xs text-brand-600 hover:underline dark:text-brand-400" href={e.fileUrl} target="_blank" rel="noreferrer">{e.fileName}</a>
                </td>
                <td className="px-3 py-2">{EVIDENCE_TYPE_LABEL[e.evidenceType] ?? e.evidenceType}</td>
                <td className="px-3 py-2"><span className={`tag ${e.verificationStatus === "VERIFIED" ? "tag-green" : "tag-amber"}`}>{e.verificationStatus}</span></td>
                <td className="px-3 py-2">{e.confidentialityLevel}</td>
                <td className="px-3 py-2 text-xs">{e.aiSuggestedTags.filter((t) => t.accepted).map((t) => `${t.field}=${t.value}`).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
