"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getSessionToken } from "@/lib/session-client";

const TYPES = ["MONTHLY", "QUARTERLY", "ANNUAL", "FINAL", "ACTIVITY", "SITUATION", "CUSTOM"];

export default function NewReportingPeriodPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [reportType, setReportType] = useState("MONTHLY");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const token = getSessionToken();
    if (!token) return router.push("/login");
    setBusy(true); setError(null);
    try {
      const r = await api<{ id: string }>(`/v1/reporting-periods`, {
        method: "POST",
        token,
        body: JSON.stringify({
          projectId: resolvedParams.id,
          reportType,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          deadline: new Date(deadline).toISOString(),
        }),
      });
      router.push(`/projects/${resolvedParams.id}/reports/${r.id}`);
    } catch (e) { setError((e as { message?: string }).message ?? "Failed"); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-bold">New reporting period</h1>
      <form onSubmit={submit} className="card mt-6 space-y-4">
        <div>
          <label className="label">Report type</label>
          <select className="input" value={reportType} onChange={(e) => setReportType(e.target.value)}>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className="label">Start</label><input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></div>
          <div><label className="label">End</label><input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></div>
          <div><label className="label">Donor deadline</label><input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} required /></div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancel</button>
          <button className="btn" disabled={busy}>Create period</button>
        </div>
      </form>
    </main>
  );
}
