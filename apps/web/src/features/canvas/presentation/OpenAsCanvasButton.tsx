"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { openAsCanvasAction } from "@/lib/actions/canvas";

/** Opens an older dashboard or infographic as a canvas, once: the same canvas is found again next time, and the original is never changed. */
export function OpenAsCanvasButton({ kind, sourceId, label = "Open here" }: { kind: "dashboard" | "infographic"; sourceId: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open(): Promise<void> {
    setBusy(true); setError(null);
    const r = await openAsCanvasAction(kind, sourceId);
    if (r.ok) { router.push(`/visuals/${r.value.canvas.id}`); return; }
    setBusy(false);
    setError(r.error.message);
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button type="button" onClick={() => void open()} disabled={busy} className="underline disabled:opacity-50">{busy ? "Opening…" : label}</button>
      {error && <span role="alert" className="max-w-xs text-xs text-red-700">{error}</span>}
    </span>
  );
}
