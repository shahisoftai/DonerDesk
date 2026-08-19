"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { createLogframeItemAction } from "@/lib/actions/logframe";

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
    setBusy(true); setError(null);
    try {
      const result = await createLogframeItemAction({
        projectId: resolvedParams.id,
        level,
        code: code || undefined,
        title,
        description: description || undefined,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push(`/projects/${resolvedParams.id}/logframe`);
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">Add logframe item</h1>
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
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancel</button>
          <button className="btn" disabled={busy}>Save</button>
        </div>
      </form>
    </div>
  );
}
