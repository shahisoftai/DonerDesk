"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./cn";
import { BUTTON_VARIANT_CLASS, type ButtonVariant } from "./Button";

export interface SplitOption { label: string; onSelect: () => void; disabled?: boolean; hint?: ReactNode }

/** One main action with its close alternatives behind a chevron ("Save ▾ Save and hand in"). */
export function SplitButton({
  label,
  onClick,
  options,
  variant = "primary",
  disabled,
  pending,
}: {
  label: ReactNode;
  onClick: () => void;
  options: readonly SplitOption[];
  variant?: Extract<ButtonVariant, "primary" | "secondary">;
  disabled?: boolean;
  pending?: boolean;
}) {
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
  const cls = BUTTON_VARIANT_CLASS[variant];
  return (
    <div ref={root} className="relative inline-flex">
      <button type="button" className={cn(cls, "rounded-e-none")} onClick={onClick} disabled={disabled || pending} aria-busy={pending || undefined}>{label}</button>
      <button
        type="button"
        className={cn(cls, "rounded-s-none border-s border-white/20 px-2")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More save options"
        disabled={disabled || pending}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute end-0 top-full z-50 mt-1.5 min-w-[13rem] animate-pop-in rounded-xl border border-slate-200 bg-white p-1 shadow-raised dark:border-white/10 dark:bg-[#16203a]">
          {options.map((o) => (
            <button
              key={o.label}
              type="button"
              role="menuitem"
              disabled={o.disabled}
              className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-sm hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-white/5"
              onClick={() => { setOpen(false); o.onSelect(); }}
            >
              <span>{o.label}</span>
              {o.hint}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
