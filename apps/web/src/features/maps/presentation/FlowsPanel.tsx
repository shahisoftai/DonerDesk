"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addPlaceFlowAction, removePlaceFlowAction } from "@/lib/actions/place-flows";
import type { PlaceFlowView } from "@/lib/server/schemas-place-flows";

export interface FlowPlaceOption { id: string; path: string }

const input = "rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900";

/** The project's recorded movements between places: what moved, from where to where, how much. They feed the "Flow map" chart; nothing here is estimated. */
export function FlowsPanel({ projectId, places, flows, canEdit, limit }: { projectId: string; places: ReadonlyArray<FlowPlaceOption>; flows: ReadonlyArray<PlaceFlowView>; canEdit: boolean; limit: number }) {
  const router = useRouter();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [what, setWhat] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function add() {
    setMessage(null);
    const r = await addPlaceFlowAction(projectId, { fromPlaceId: from, toPlaceId: to, what, quantity: Number(quantity.replace(/,/g, "")), unit });
    if (!r.ok) { setMessage(r.error.message); return; }
    setWhat(""); setQuantity(""); setMessage("Movement recorded. Draw it with the Flow map chart."); router.refresh();
  }

  return (
    <section aria-label="Movements between places" className="mt-8 space-y-3" data-testid="flows-panel">
      <h2 className="text-lg font-semibold">Movements between places</h2>
      <p className="max-w-3xl text-sm text-slate-500">Record what moved from one place to another (people, supplies, referrals) and how much. A movement is drawn on the Flow map only when both places have a pin. Up to {limit} per project.</p>
      {canEdit && (
        <form className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700" onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <label className="flex min-w-0 max-w-full flex-col gap-1">From<select className={`${input} max-w-full`} value={from} onChange={(e) => setFrom(e.target.value)}><option value="">Choose a place</option>{places.map((p) => <option key={p.id} value={p.id}>{p.path}</option>)}</select></label>
          <label className="flex min-w-0 max-w-full flex-col gap-1">To<select className={`${input} max-w-full`} value={to} onChange={(e) => setTo(e.target.value)}><option value="">Choose a place</option>{places.map((p) => <option key={p.id} value={p.id}>{p.path}</option>)}</select></label>
          <label className="flex flex-col gap-1">What moves<input className={input} value={what} maxLength={60} placeholder="People, tents…" onChange={(e) => setWhat(e.target.value)} /></label>
          <label className="flex flex-col gap-1">How much<input className={`${input} w-28`} inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
          <label className="flex flex-col gap-1">Unit<input className={`${input} w-28`} value={unit} maxLength={24} placeholder="people" onChange={(e) => setUnit(e.target.value)} /></label>
          <button type="submit" className="rounded bg-sky-700 px-3 py-1.5 font-medium text-white hover:bg-sky-800">Add movement</button>
        </form>
      )}
      {message && <p role="status" className="text-sm">{message}</p>}
      {flows.length === 0 ? <p className="text-sm text-slate-500">No movements recorded yet.</p> : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700" data-testid="flows-list">
          {flows.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span><span className="font-medium">{f.what}</span>: {f.from} → {f.to} · {f.quantity.toLocaleString("en")}{f.unit ? ` ${f.unit}` : ""}</span>
              {canEdit && <button type="button" className="underline" onClick={async () => { const r = await removePlaceFlowAction(projectId, f.id); if (r.ok) router.refresh(); else setMessage(r.error.message); }}>Remove</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
