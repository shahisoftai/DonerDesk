"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = (name || email || "?").slice(0, 1).toUpperCase();

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
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-sm font-black text-white shadow-md"
      >
        {initials}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-2 py-2 dark:border-white/10">
            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{name || "Account"}</p>
            {email && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{email}</p>}
          </div>
          <Link href="/logout" role="menuitem" className="mt-1 block rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5">
            Sign out
          </Link>
        </div>
      )}
    </div>
  );
}
