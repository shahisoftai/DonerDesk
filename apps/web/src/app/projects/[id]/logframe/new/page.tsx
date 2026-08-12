"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getSessionToken } from "@/lib/session-client";

const LEVELS = ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"];

export default function NewLogframeItemPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [level, setLevel] = useState("GOAL");
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const token = getSessionToken();
    if (!token) return router.push("/login");
    setBusy(true); setError(null);
    try {
      await api(`/v1/logframe-items`, {
        method: "POST",
        token,
        body: JSON.stringify({ projectId: resolvedParams.id, level, code: code || undefined, title, description: description || undefined }),
      });
      router.push(`/projects/${resolvedParams.id}/logframe`);
      router.refresh();
    } catch (e) { setError((e as { message?: string }).message ?? "Failed"); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-bold">Add logframe item</h1>
      <form onSubmit={submit} className="card mt-6 space-y-4">
        <div>
          <label className="label">Level</label>
          <select className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Code (optional)</label>
          <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. O1.2" />
        </div>
        <div>
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancel</button>
          <button className="btn" disabled={busy}>Save</button>
        </div>
      </form>
    </main>
  );
}
