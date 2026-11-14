"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { DRAWER_MAX, DRAWER_MIN } from "../domain/drawer-state";

interface Props { id: string; title: string; width: number; pinned: boolean; offset: number; onWidth: (w: number) => void; onPin: (pinned: boolean) => void; onClose: () => void; children: ReactNode }

/**
 * A drawer on the end side of the editor (Phase 50.1). Pinned, it sits beside the canvas; floating, it lies over it. Its start edge
 * can be dragged (or moved with the arrow keys) to change its width. On a phone it is a sheet from the bottom.
 */
export function DrawerShell({ id, title, width, pinned, offset, onWidth, onPin, onClose, children }: Props) {
  const { t } = useI18n();
  const start = useRef<{ x: number; w: number } | null>(null);
  const rtl = typeof document !== "undefined" && document.dir === "rtl";
  const clamp = (w: number) => Math.min(DRAWER_MAX, Math.max(DRAWER_MIN, Math.round(w)));
  // Drawn at the document root: an animated (transformed) ancestor would otherwise trap a fixed drawer inside its own box.
  const [root, setRoot] = useState<HTMLElement | null>(null);
  useEffect(() => setRoot(document.body), []);
  if (!root) return null;
  return createPortal(
    <aside id={id} aria-label={title} data-testid={id} data-pinned={pinned || undefined}
      style={{ ["--drawer-w" as string]: `${width}px`, ["--drawer-off" as string]: `${offset}px` }}
      className={`fixed inset-x-0 bottom-0 z-30 flex max-h-[70vh] flex-col border-t border-slate-200 bg-white shadow-xl print:hidden dark:border-slate-700 dark:bg-slate-900 sm:inset-x-auto sm:bottom-0 sm:top-[3.25rem] sm:max-h-none sm:w-[var(--drawer-w)] sm:border-s sm:border-t-0 sm:[inset-inline-end:var(--drawer-off)] ${pinned ? "sm:shadow-none" : ""}`}>
      <div role="separator" aria-orientation="vertical" aria-label={t("drawer.resize")} aria-valuemin={DRAWER_MIN} aria-valuemax={DRAWER_MAX} aria-valuenow={width} tabIndex={0}
        className="absolute inset-y-0 start-0 hidden w-1.5 cursor-col-resize hover:bg-brand-300 focus:bg-brand-400 focus:outline-none sm:block"
        onPointerDown={(e) => { start.current = { x: e.clientX, w: width }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (start.current) onWidth(clamp(start.current.w + (rtl ? 1 : -1) * (e.clientX - start.current.x))); }}
        onPointerUp={() => { start.current = null; }}
        onKeyDown={(e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); onWidth(clamp(width + ((e.key === "ArrowLeft") !== rtl ? 16 : -16))); } }} />
      <header className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <h2 className="flex-1 text-sm font-semibold">{title}</h2>
        <button type="button" className="hidden min-h-8 rounded px-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 sm:block" aria-pressed={pinned} onClick={() => onPin(!pinned)}>{pinned ? t("drawer.float") : t("drawer.pin")}</button>
        <button type="button" className="min-h-8 min-w-8 rounded text-lg leading-none hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={t("drawer.close")} onClick={onClose}>×</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
    </aside>,
    root,
  );
}
