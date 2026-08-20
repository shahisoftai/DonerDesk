"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";

export type BellItem = { id: string; title: string; read: boolean };

export function NotificationBell({ items }: { items: BellItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative grid h-10 w-10 place-items-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm transition hover:border-brand-400 hover:text-brand-600 dark:border-white/15 dark:bg-white/5 dark:text-slate-300 dark:hover:border-brand-400/60"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger-600 px-1 text-[10px] font-medium text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-slate-900">
          <p className="px-2 py-1 text-[11px] font-medium text-slate-400">Notifications</p>
          {items.length === 0 && <p className="px-2 py-3 text-sm text-slate-500 dark:text-slate-400">No notifications.</p>}
          <ul className="max-h-72 overflow-auto">
            {items.slice(0, 10).map((item) => (
              <li key={item.id} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/5">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", item.read ? "bg-slate-300" : "bg-brand-500")} aria-hidden="true" />
                <span className={cn(item.read ? "text-slate-500" : "font-medium text-slate-800 dark:text-slate-100")}>{item.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
