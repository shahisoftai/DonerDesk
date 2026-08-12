"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getSessionToken } from "@/lib/session-client";

const EVIDENCE_TYPES = ["ATTENDANCE_SHEET","PHOTO","DISTRIBUTION_LIST","TRAINING_RECORD","FIELD_VISIT_REPORT","MONITORING_REPORT","KOBO_ODK_EXPORT","PROCUREMENT_DOCUMENT","APPROVAL_DOCUMENT","BENEFICIARY_LIST","MEETING_MINUTES","CASE_STUDY","FINANCIAL_DOCUMENT","SUPPLIER_DOCUMENT","DONOR_COMMUNICATION","OTHER"];
const CONFIDENTIALITY = ["PUBLIC","INTERNAL","SENSITIVE","HIGHLY_SENSITIVE"];

export default function NewEvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [evidenceType, setEvidenceType] = useState("OTHER");
  const [confidentialityLevel, setConfidentialityLevel] = useState("INTERNAL");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const token = getSessionToken();
    if (!token) return router.push("/login");
    if (!file) { setError("Please select a file."); return; }
    const fd = new FormData();
    fd.append("projectId", resolvedParams.id);
    fd.append("title", title);
    fd.append("evidenceType", evidenceType);
    fd.append("confidentialityLevel", confidentialityLevel);
    if (location) fd.append("location", location);
    if (notes) fd.append("notes", notes);
    fd.append("file", file);
    setBusy(true); setError(null);
    try {
      await api(`/v1/evidence/upload`, { method: "POST", token, body: fd });
      router.push(`/projects/${resolvedParams.id}/evidence`);
      router.refresh();
    } catch (e) { setError((e as { message?: string }).message ?? "Failed"); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-bold">Upload evidence</h1>
      <p className="text-sm text-slate-500">AI will suggest tags and sensitivity warnings after upload.</p>
      <form onSubmit={submit} className="card mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className="label">Evidence type</label>
          <select className="input" value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)}>
            {EVIDENCE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Confidentiality</label>
          <select className="input" value={confidentialityLevel} onChange={(e) => setConfidentialityLevel(e.target.value)}>
            {CONFIDENTIALITY.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Location (optional)</label>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">File</label>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
        </div>
        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancel</button>
          <button className="btn" disabled={busy}>{busy ? "Uploading..." : "Upload"}</button>
        </div>
      </form>
    </main>
  );
}
