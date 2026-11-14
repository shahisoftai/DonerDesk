"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

export interface RowAction { label: string; href?: string; onSelect?: () => void; danger?: boolean }

/** A row's actions behind one "⋯" button (Version 4.000, plan F75): the row stays readable, the actions stay one click away. */
export function RowMenu({ label, actions }: { label: string; actions: readonly RowAction[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  if (actions.length === 0) return null;
  const item = "flex min-h-10 w-full items-center rounded-lg px-3 text-start text-sm hover:bg-slate-100 dark:hover:bg-white/5";
  return (
    <div ref={root} className="relative inline-flex">
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`Actions for ${label}`} className="btn-ghost btn-icon h-8 w-8" onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute end-0 top-full z-30 mt-1 min-w-[12rem] animate-pop-in rounded-xl border border-slate-200 bg-white p-1 shadow-raised dark:border-white/10 dark:bg-[#16203a]">
          {actions.map((a) =>
            a.href ? (
              <Link key={a.label} role="menuitem" href={a.href} prefetch={false} className={`${item} ${a.danger ? "text-red-700 dark:text-red-400" : ""}`} onClick={() => setOpen(false)}>{a.label}</Link>
            ) : (
              <button key={a.label} type="button" role="menuitem" className={`${item} ${a.danger ? "text-red-700 dark:text-red-400" : ""}`} onClick={() => { setOpen(false); a.onSelect?.(); }}>{a.label}</button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
