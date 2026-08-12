"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getSessionToken } from "@/lib/session-client";

type Readiness = { overall: number; sectionsScore: number; indicatorsScore: number; evidenceScore: number; checklistScore: number; approvalScore: number };
type Checklist = Array<{ id: string; title: string; severity: string; status: string; type: string }>;
type ExportItem = { id: string; exportType: string; fileUrl: string; createdAt: string };

const EXPORT_TYPES = ["WORD", "PDF", "EXCEL_INDICATORS", "EVIDENCE_CHECKLIST", "EVIDENCE_PACK_ZIP"];

export function ReportWorkspace({ projectId, periodId, readiness, checklist, exports }: { projectId: string; periodId: string; readiness: Readiness; checklist: Checklist; exports: ExportItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftMsg, setDraftMsg] = useState<string | null>(null);

  async function generate() {
    const token = getSessionToken();
    if (!token) return router.push("/login");
    setBusy("draft"); setError(null); setDraftMsg(null);
    try {
      const r = await api<{ draftId: string; sectionIds: string[] }>(`/v1/reporting-periods/${periodId}/generate-draft`, { method: "POST", token, body: JSON.stringify({}) });
      setDraftMsg(`Generated draft ${r.draftId.slice(0, 8)} with ${r.sectionIds.length} sections.`);
      router.refresh();
    } catch (e) { setError((e as { message?: string }).message ?? "Failed"); } finally { setBusy(null); }
  }

  async function detectMissing() {
    const token = getSessionToken();
    if (!token) return router.push("/login");
    setBusy("detect"); setError(null);
    try {
      await api(`/v1/reporting-periods/${periodId}/detect-missing`, { method: "POST", token, body: JSON.stringify({}) });
      router.refresh();
    } catch (e) { setError((e as { message?: string }).message ?? "Failed"); } finally { setBusy(null); }
  }

  async function exportOne(type: string) {
    const token = getSessionToken();
    if (!token) return router.push("/login");
    setBusy(type); setError(null);
    try {
      await api(`/v1/exports`, { method: "POST", token, body: JSON.stringify({ projectId, reportingPeriodId: periodId, exportType: type }) });
      router.refresh();
    } catch (e) { setError((e as { message?: string }).message ?? "Failed"); } finally { setBusy(null); }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      <section className="card relative overflow-hidden lg:col-span-1">
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-brand-500/15 to-accent-400/15 blur-2xl" />
        <h2 className="font-semibold">Readiness score</h2>
        <div className="mt-3 bg-gradient-to-r from-brand-500 to-accent-400 bg-clip-text text-5xl font-extrabold text-transparent">{readiness.overall}%</div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-400" style={{ width: `${Math.min(100, Math.max(0, readiness.overall))}%` }} />
        </div>
        <div className="mt-4 space-y-1.5 text-sm">
          <Row label="Sections" v={readiness.sectionsScore} />
          <Row label="Indicators" v={readiness.indicatorsScore} />
          <Row label="Evidence" v={readiness.evidenceScore} />
          <Row label="Checklist" v={readiness.checklistScore} />
          <Row label="Approval" v={readiness.approvalScore} />
        </div>
        <button className="btn mt-4 w-full" disabled={busy === "draft"} onClick={generate}>{busy === "draft" ? "Generating..." : "Generate AI draft"}</button>
        {draftMsg && <p className="mt-2 text-xs text-green-700 dark:text-green-400">{draftMsg}</p>}
        <button className="btn-secondary mt-3 w-full" disabled={busy === "detect"} onClick={detectMissing}>{busy === "detect" ? "Scanning..." : "Run compliance check"}</button>
      </section>

      <section className="card lg:col-span-1">
        <h2 className="font-semibold">Compliance checklist</h2>
        {checklist.length === 0 && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">No checklist items yet.</p>}
        <ul className="mt-3 space-y-2">
          {checklist.map((c) => (
            <li key={c.id} className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-white/5">
              <div>
                <div className="text-sm font-medium">{c.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{c.type.replace(/_/g, " ").toLowerCase()}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`tag ${c.severity === "CRITICAL" ? "tag-red" : c.severity === "HIGH" ? "tag-amber" : "tag-slate"}`}>{c.severity}</span>
                <span className={`tag ${c.status === "RESOLVED" ? "tag-green" : "tag-amber"}`}>{c.status}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card lg:col-span-1">
        <h2 className="font-semibold">Exports</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXPORT_TYPES.map((t) => (
            <button key={t} className="btn-secondary text-xs" disabled={busy === t} onClick={() => exportOne(t)}>{busy === t ? "..." : t.replace(/_/g, " ")}</button>
          ))}
        </div>
        <ul className="mt-4 space-y-1">
          {exports.length === 0 && <li className="text-sm text-slate-500 dark:text-slate-400">No exports yet.</li>}
          {exports.map((e) => (
            <li key={e.id} className="flex items-center justify-between text-sm">
              <span>{e.exportType.replace(/_/g, " ").toLowerCase()}</span>
              <a className="text-brand-600 hover:underline dark:text-brand-400" href={e.fileUrl} target="_blank" rel="noreferrer">Download</a>
            </li>
          ))}
        </ul>
      </section>
      {error && <p className="text-sm text-red-600 dark:text-red-400 lg:col-span-3">{error}</p>}
    </div>
  );
}

function Row({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-mono">{v}%</span>
    </div>
  );
}
