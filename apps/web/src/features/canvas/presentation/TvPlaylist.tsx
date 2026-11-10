"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BlockModel, Canvas } from "@donordesk/domain/contexts/canvas/index.js";
import type { ChartDrawing } from "@/lib/server/schemas-dashboards";
import { REFRESH_MS, stepIndex } from "../domain/playlist";
import { PublicCanvasView } from "./PublicCanvasView";

export interface TvItem { id: string; title: string; canvas: Canvas; drawings: ChartDrawing[]; models: Record<string, BlockModel<unknown>> }

/**
 * Canvases one after another on a full screen, for a wall display. It reads only what the signed-in person can see, asks for fresh figures
 * every five minutes, asks the screen to stay awake where the browser allows it, and stops moving while it is paused or the tab is hidden.
 * Nothing flashes or slides: a change of canvas is a plain swap, so reduced motion needs no special case.
 */
export function TvPlaylist({ items, seconds, exitHref }: { items: TvItem[]; seconds: number; exitHref: string }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = items[Math.min(index, items.length - 1)];

  useEffect(() => {
    if (paused || items.length < 2) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") setIndex((i) => stepIndex(i, items.length, 1)); }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [paused, items.length, seconds]);

  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [router]);

  useEffect(() => {
    let lock: { release(): Promise<void> } | undefined;
    const wake = (navigator as unknown as { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock;
    void wake?.request("screen").then((l) => { lock = l; }).catch(() => undefined);
    return () => { void lock?.release().catch(() => undefined); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => stepIndex(i, items.length, 1));
      else if (e.key === "ArrowLeft") setIndex((i) => stepIndex(i, items.length, -1));
      else if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length]);

  if (!current) return null;
  const btn = "rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800";
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-white p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100" data-testid="tv-playlist">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-bold tracking-tight">{current.title}</h1>
        <p className="text-sm text-slate-500" aria-live="polite">{index + 1} of {items.length}{paused ? " · paused" : ""}</p>
        {items.length > 1 && <button type="button" className={btn} onClick={() => setIndex((i) => stepIndex(i, items.length, -1))}>Previous</button>}
        {items.length > 1 && <button type="button" className={btn} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>{paused ? "Resume" : "Pause"}</button>}
        {items.length > 1 && <button type="button" className={btn} onClick={() => setIndex((i) => stepIndex(i, items.length, 1))}>Next</button>}
        <a className={btn} href={exitHref}>Exit</a>
      </header>
      <PublicCanvasView key={current.id} canvas={current.canvas} drawings={current.drawings} models={current.models} />
    </div>
  );
}
