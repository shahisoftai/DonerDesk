"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getSessionToken } from "@/lib/session-client";

export default function NewTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [templateName, setTemplateName] = useState("");
  const [donorName, setDonorName] = useState("");
  const [reportType, setReportType] = useState("MONTHLY");
  const [language, setLanguage] = useState("en");
  const [extractedRawText, setExtractedRawText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = getSessionToken();
    if (!token) return router.push("/login");
    setError(null); setBusy(true);
    try {
      const r = await api<{ id: string; sections: unknown[] }>("/v1/templates", {
        method: "POST",
        token,
        body: JSON.stringify({ projectId: resolvedParams.id, templateName, donorName, reportType, language, extractedRawText: extractedRawText || undefined }),
      });
      router.push(`/projects/${resolvedParams.id}/templates/${r.id}`);
    } catch (e) {
      setError((e as { message?: string }).message ?? "Failed to upload template");
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-3xl animate-fade-in px-6 py-8">
      <h1 className="text-2xl font-bold">Upload donor template</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">Paste the donor instructions or upload a file. The AI extracts structured sections for review.</p>
      <form onSubmit={onSubmit} className="card mt-6 space-y-4">
        <div>
          <label className="label">Template name</label>
          <input className="input" value={templateName} onChange={(e) => setTemplateName(e.target.value)} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Donor name</label>
            <input className="input" value={donorName} onChange={(e) => setDonorName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Report type</label>
            <select className="input" value={reportType} onChange={(e) => setReportType(e.target.value)}>
              {["MONTHLY", "QUARTERLY", "ANNUAL", "FINAL", "ACTIVITY", "SITUATION", "CUSTOM"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Template text (paste donor instructions)</label>
          <textarea className="input min-h-[200px]" value={extractedRawText} onChange={(e) => setExtractedRawText(e.target.value)} placeholder="Section 1. Executive Summary&#10;Section 2. Activities completed..." />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancel</button>
          <button className="btn" disabled={busy}>{busy ? "Extracting..." : "Upload & extract"}</button>
        </div>
      </form>
    </main>
  );
}
