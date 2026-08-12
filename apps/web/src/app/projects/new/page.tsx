"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getSessionToken } from "@/lib/session-client";

const SECTORS = ["NUTRITION", "FOOD_SECURITY", "WASH", "HEALTH", "PROTECTION", "EDUCATION", "LIVELIHOODS", "SHELTER", "MULTI_SECTOR", "OTHER"];
const FREQUENCIES = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "FINAL", "CUSTOM"];

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [donorName, setDonorName] = useState("");
  const [implementingOrganization, setImplementingOrganization] = useState("");
  const [country, setCountry] = useState("");
  const [sector, setSector] = useState("NUTRITION");
  const [reportingFrequency, setReportingFrequency] = useState("MONTHLY");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = getSessionToken();
    if (!token) {
      router.push("/login");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const r = await api<{ id: string }>("/v1/projects", {
        method: "POST",
        token,
        body: JSON.stringify({
          title,
          projectCode,
          donorName,
          implementingOrganization,
          country,
          sector,
          reportingFrequency,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          budgetAmount: budgetAmount ? Number(budgetAmount) : undefined,
        }),
      });
      router.push(`/projects/${r.id}`);
    } catch (e) {
      setError((e as { message?: string }).message ?? "Failed to create project");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-bold">New project</h1>
      <p className="text-sm text-slate-500">Step 2 of the setup wizard — set up a donor-funded project workspace.</p>
      <form onSubmit={onSubmit} className="card mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Project title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
        <Field label="Project code"><input className="input" value={projectCode} onChange={(e) => setProjectCode(e.target.value)} required /></Field>
        <Field label="Donor name"><input className="input" value={donorName} onChange={(e) => setDonorName(e.target.value)} required /></Field>
        <Field label="Implementing organization"><input className="input" value={implementingOrganization} onChange={(e) => setImplementingOrganization(e.target.value)} required /></Field>
        <Field label="Country"><input className="input" value={country} onChange={(e) => setCountry(e.target.value)} required /></Field>
        <Field label="Sector">
          <select className="input" value={sector} onChange={(e) => setSector(e.target.value)}>
            {SECTORS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        </Field>
        <Field label="Reporting frequency">
          <select className="input" value={reportingFrequency} onChange={(e) => setReportingFrequency(e.target.value)}>
            {FREQUENCIES.map((f) => <option key={f} value={f}>{f.toLowerCase().replace("_", " ")}</option>)}
          </select>
        </Field>
        <Field label="Budget (USD, optional)"><input className="input" type="number" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} /></Field>
        <Field label="Start date"><input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></Field>
        <Field label="End date"><input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></Field>
        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancel</button>
          <button className="btn" disabled={busy}>{busy ? "Creating..." : "Create project"}</button>
        </div>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
