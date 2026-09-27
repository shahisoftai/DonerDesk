"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

export type MenuItem = { label: string; hint?: string } & ({ onSelect: () => void } | { href: string });

/**
 * The "⋯" menu for secondary report actions (regenerate, inputs, scan,
 * versions, export center). Keyboard: Enter/Space opens, arrows move,
 * Escape closes and returns focus to the trigger.
 */
export function MoreActionsMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const first = wrapRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    const itemsEls = Array.from(wrapRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = itemsEls.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      itemsEls[(index + 1) % itemsEls.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      itemsEls[(index - 1 + itemsEls.length) % itemsEls.length]?.focus();
    }
  }

  if (items.length === 0) return null;

  const itemClass =
    "flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:hover:bg-white/5 dark:focus:bg-white/5";

  return (
    <div ref={wrapRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-12 z-40 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-white/10 dark:bg-slate-900"
        >
          {items.map((item) =>
            "href" in item ? (
              <Link key={item.label} role="menuitem" href={item.href} className={itemClass} onClick={() => setOpen(false)}>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.label}</span>
                {item.hint && <span className="text-xs text-slate-500 dark:text-slate-400">{item.hint}</span>}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={itemClass}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.label}</span>
                {item.hint && <span className="text-xs text-slate-500 dark:text-slate-400">{item.hint}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
