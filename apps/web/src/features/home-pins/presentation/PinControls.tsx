"use client";

import { useRouter } from "next/navigation";
import { moveHomePinAction, removeHomePinAction } from "@/lib/actions/home-pins";

/** Move a pin earlier or later, or take it off Home. Buttons, not dragging: it works from the keyboard and on a phone. */
export function PinControls({ id, title, index, count }: { id: string; title: string; index: number; count: number }) {
  const router = useRouter();
  const go = async (fn: () => Promise<{ ok: boolean }>) => { const r = await fn(); if (r.ok) router.refresh(); };
  const cls = "rounded px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-white/10";
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={cls} disabled={index === 0} aria-label={`Move ${title} earlier`} onClick={() => void go(() => moveHomePinAction(id, index - 1))}>←</button>
      <button type="button" className={cls} disabled={index === count - 1} aria-label={`Move ${title} later`} onClick={() => void go(() => moveHomePinAction(id, index + 1))}>→</button>
      <button type="button" className={`${cls} ms-auto`} aria-label={`Remove ${title} from Home`} onClick={() => void go(() => removeHomePinAction(id))}>Unpin</button>
    </div>
  );
}
